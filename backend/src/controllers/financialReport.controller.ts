import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { isOperator, transactionScopeFilter } from '../utils/rentalAccess';

const prisma = new PrismaClient();

/**
 * GET /api/financial-reports?type=monthly|quarterly|annual&period=&propertyId=
 *
 * Builds the dashboard's FinancialReport from Transaction rows (operators
 * only, tenancy-scoped with `transactionScopeFilter`). Returns a one-element
 * array, which is what pages/FinancialReports.tsx reads.
 *
 * period: monthly "YYYY-MM"; quarterly "YYYY-Qn" or "YYYY-MM" (the quarter
 * containing that month) or "YYYY"; annual "YYYY". Defaults to the current one.
 * Rent paid = COMPLETED; overdue = PENDING past its date, or FAILED.
 */

type ReportType = 'monthly' | 'quarterly' | 'annual';

function window(type: ReportType, period: string | undefined, now: Date) {
  const year = /^\d{4}/.test(period ?? '') ? parseInt(period!.slice(0, 4), 10) : now.getFullYear();
  const monthMatch = period?.match(/^\d{4}-(\d{2})/);
  const quarterMatch = period?.match(/^\d{4}-Q([1-4])$/i);
  const month = monthMatch ? parseInt(monthMatch[1], 10) - 1 : now.getMonth();

  if (type === 'annual') {
    return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1), label: `${year}` };
  }
  if (type === 'quarterly') {
    const q = quarterMatch ? parseInt(quarterMatch[1], 10) - 1 : Math.floor(month / 3);
    return { start: new Date(year, q * 3, 1), end: new Date(year, q * 3 + 3, 1), label: `${year}-Q${q + 1}` };
  }
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 1),
    label: `${year}-${String(month + 1).padStart(2, '0')}`,
  };
}

export async function getFinancialReports(req: Request, res: Response) {
  try {
    if (!isOperator(req)) return res.status(403).json({ error: 'Not allowed to view financial reports' });

    const now = new Date();
    const type: ReportType = ['monthly', 'quarterly', 'annual'].includes(String(req.query.type))
      ? (String(req.query.type) as ReportType)
      : 'monthly';
    const { start, end, label } = window(type, typeof req.query.period === 'string' ? req.query.period : undefined, now);

    const and: Prisma.TransactionWhereInput[] = [{ transactionDate: { gte: start, lt: end } }];
    const scope = transactionScopeFilter(req);
    if (scope) and.push(scope as Prisma.TransactionWhereInput);
    if (typeof req.query.propertyId === 'string' && req.query.propertyId) {
      and.push({ Lease: { rentalId: req.query.propertyId } });
    }

    const rows = await prisma.transaction.findMany({
      where: { AND: and },
      select: {
        amount: true,
        status: true,
        type: true,
        transactionDate: true,
        Lease: { select: { rentalId: true, Rental: { select: { title: true } } } },
      },
      orderBy: { transactionDate: 'asc' },
    });

    const classify = (r: (typeof rows)[number]): 'paid' | 'overdue' | 'pending' | null => {
      if (r.status === 'COMPLETED') return 'paid';
      if (r.status === 'FAILED') return 'overdue';
      if (r.status === 'PENDING') return r.transactionDate < now ? 'overdue' : 'pending';
      return null; // REFUNDED
    };
    // Monthly reports trend by day; quarterly and annual by month.
    const bucket = (d: Date) =>
      type === 'monthly' ? d.toISOString().slice(0, 10) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    let totalRevenue = 0;
    let totalOverdue = 0;
    const trends = new Map<string, { date: string; amount: number; status: 'paid' | 'overdue' | 'pending' }>();
    const byProperty = new Map<string, { propertyId: string; propertyName: string; revenue: number; overdue: number }>();

    for (const r of rows) {
      const kind = classify(r);
      if (!kind) continue;
      if (kind === 'paid') totalRevenue += r.amount;
      if (kind === 'overdue') totalOverdue += r.amount;

      const key = `${bucket(r.transactionDate)}|${kind}`;
      const t = trends.get(key) ?? { date: bucket(r.transactionDate), amount: 0, status: kind };
      t.amount += r.amount;
      trends.set(key, t);

      const pid = r.Lease.rentalId;
      const p = byProperty.get(pid) ?? { propertyId: pid, propertyName: r.Lease.Rental.title, revenue: 0, overdue: 0 };
      if (kind === 'paid') p.revenue += r.amount;
      if (kind === 'overdue') p.overdue += r.amount;
      byProperty.set(pid, p);
    }

    res.status(200).json([
      {
        id: `${type}-${label}${req.query.propertyId ? `-${req.query.propertyId}` : ''}`,
        type,
        period: label,
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        totalRevenue,
        totalOverdue,
        transactionCount: rows.length,
        paymentTrends: [...trends.values()].sort((a, b) => a.date.localeCompare(b.date)),
        propertyBreakdown: [...byProperty.values()].sort((a, b) => b.revenue - a.revenue),
      },
    ]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
