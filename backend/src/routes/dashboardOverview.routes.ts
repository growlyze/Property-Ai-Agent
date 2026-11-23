import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  applicationScopeFilter,
  leaseScopeFilter,
  maintenanceScopeFilter,
  rentalScopeFilter,
  transactionScopeFilter,
} from '../utils/rentalAccess';

const prisma = new PrismaClient();
const router = Router();

/** Combine a tenancy scope (may be undefined = unrestricted) with extra conditions. */
function scoped<T>(scope: Record<string, unknown> | undefined, ...extra: T[]): { AND: T[] } {
  return { AND: [...(scope ? [scope as unknown as T] : []), ...extra] };
}

/**
 * GET /api/dashboard/overview
 * Everything the home dashboard shows, in one call. Every figure is computed
 * through the tenancy scope filters in utils/rentalAccess.ts, so an ADMIN sees
 * the whole portfolio, a manager or owner sees their own rentals, and a
 * resident sees only their own lease, payments and requests.
 */
router.get('/overview', authMiddleware.protect, async (req: Request, res: Response) => {
  try {
    const rentalScope = rentalScopeFilter(req);
    const leaseScope = leaseScopeFilter(req);
    const txScope = transactionScopeFilter(req);
    const mrScope = maintenanceScopeFilter(req);
    const appScope = applicationScopeFilter(req);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const rentWhere = (extra: Prisma.TransactionWhereInput) =>
      scoped<Prisma.TransactionWhereInput>(txScope, { type: 'RENT_PAYMENT' }, extra);

    const [
      totalRentals,
      vacantRentals,
      activeLeases,
      openMaintenance,
      urgentMaintenance,
      pendingApplications,
      collected,
      pending,
      failed,
      recentMaintenance,
      recentPayments,
      expiringLeases,
      revenueRows,
    ] = await Promise.all([
      prisma.rental.count({ where: scoped<Prisma.RentalWhereInput>(rentalScope) }),
      prisma.rental.count({ where: scoped<Prisma.RentalWhereInput>(rentalScope, { isAvailable: true }) }),
      prisma.lease.count({ where: scoped<Prisma.LeaseWhereInput>(leaseScope, { status: 'ACTIVE' }) }),
      prisma.maintenanceRequest.count({
        where: scoped<Prisma.MaintenanceRequestWhereInput>(mrScope, { status: { in: ['OPEN', 'IN_PROGRESS', 'ON_HOLD'] } }),
      }),
      prisma.maintenanceRequest.count({
        where: scoped<Prisma.MaintenanceRequestWhereInput>(mrScope, {
          status: { in: ['OPEN', 'IN_PROGRESS', 'ON_HOLD'] },
          priority: { in: ['HIGH', 'EMERGENCY'] },
        }),
      }),
      prisma.application.count({ where: scoped<Prisma.ApplicationWhereInput>(appScope, { status: 'PENDING' }) }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: rentWhere({ status: 'COMPLETED', transactionDate: { gte: monthStart } }),
      }),
      prisma.transaction.aggregate({ _sum: { amount: true }, _count: true, where: rentWhere({ status: 'PENDING' }) }),
      prisma.transaction.aggregate({ _sum: { amount: true }, _count: true, where: rentWhere({ status: 'FAILED' }) }),
      prisma.maintenanceRequest.findMany({
        where: scoped<Prisma.MaintenanceRequestWhereInput>(mrScope),
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
          Rental: { select: { title: true } },
        },
      }),
      prisma.transaction.findMany({
        where: rentWhere({}),
        orderBy: { transactionDate: 'desc' },
        take: 6,
        select: {
          id: true,
          amount: true,
          status: true,
          transactionDate: true,
          Lease: {
            select: {
              User: { select: { firstName: true, lastName: true } },
              Rental: { select: { title: true } },
            },
          },
        },
      }),
      prisma.lease.findMany({
        where: scoped<Prisma.LeaseWhereInput>(leaseScope, { status: 'ACTIVE', endDate: { gte: now, lte: in60Days } }),
        orderBy: { endDate: 'asc' },
        take: 5,
        select: {
          id: true,
          endDate: true,
          rentAmount: true,
          User: { select: { firstName: true, lastName: true } },
          Rental: { select: { title: true } },
        },
      }),
      prisma.transaction.findMany({
        where: rentWhere({ status: 'COMPLETED', transactionDate: { gte: sixMonthsAgo } }),
        select: { amount: true, transactionDate: true },
      }),
    ]);

    // Collected rent per month for the last six months (oldest first).
    const months: { month: string; collected: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ month: d.toLocaleString('en-US', { month: 'short' }), collected: 0 });
    }
    for (const row of revenueRows) {
      const t = row.transactionDate;
      const idx = (t.getFullYear() - sixMonthsAgo.getFullYear()) * 12 + (t.getMonth() - sixMonthsAgo.getMonth());
      if (idx >= 0 && idx < 6) months[idx].collected += row.amount;
    }

    const occupied = totalRentals - vacantRentals;
    res.json({
      data: {
        portfolio: {
          totalRentals,
          occupied,
          vacant: vacantRentals,
          occupancyRate: totalRentals ? Math.round((occupied / totalRentals) * 100) : 0,
          activeLeases,
        },
        rent: {
          collectedThisMonth: collected._sum.amount ?? 0,
          pendingAmount: pending._sum.amount ?? 0,
          pendingCount: pending._count,
          failedAmount: failed._sum.amount ?? 0,
          failedCount: failed._count,
          monthly: months,
        },
        maintenance: { open: openMaintenance, urgent: urgentMaintenance },
        applications: { pending: pendingApplications },
        recentMaintenance: recentMaintenance.map((m) => ({
          id: m.id,
          title: m.title,
          status: m.status,
          priority: m.priority,
          createdAt: m.createdAt,
          rental: m.Rental?.title ?? null,
        })),
        recentPayments: recentPayments.map((t) => ({
          id: t.id,
          amount: t.amount,
          status: t.status,
          date: t.transactionDate,
          tenant: t.Lease?.User ? `${t.Lease.User.firstName} ${t.Lease.User.lastName}` : null,
          rental: t.Lease?.Rental?.title ?? null,
        })),
        expiringLeases: expiringLeases.map((l) => ({
          id: l.id,
          endDate: l.endDate,
          rentAmount: l.rentAmount,
          tenant: l.User ? `${l.User.firstName} ${l.User.lastName}` : null,
          rental: l.Rental?.title ?? null,
        })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
