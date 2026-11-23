import { Request, Response } from 'express';
import { PrismaClient, Prisma, TransactionStatus } from '@prisma/client';
import {
  canAccessLease,
  canModifyTransaction,
  canWriteRentals,
  transactionScopeFilter,
} from '../utils/rentalAccess';

const prisma = new PrismaClient();

/**
 * Rent payment records for the dashboard's Payments page
 * (GET/POST /api/payments, PUT/DELETE /api/payments/:id).
 *
 * A payment record is a `Transaction` row viewed in the dashboard's
 * `PaymentRecord` shape. Tenancy is the transaction policy from
 * utils/rentalAccess.ts: the list is scoped with `transactionScopeFilter`,
 * writes need `canWriteRentals` plus access to the target lease.
 *
 * `Transaction` has no payment-method column, so the method is stored as a
 * leading `[method:<value>]` tag in `description`; the rest of the description
 * is the record's notes.
 */

const METHODS = ['cash', 'check', 'bank_transfer', 'credit_card'] as const;
type Method = (typeof METHODS)[number];
const METHOD_TAG = /^\[method:([a-z_]+)\]\s*/;

const UI_TO_DB_STATUS: Record<string, TransactionStatus> = {
  pending: 'PENDING',
  completed: 'COMPLETED',
  failed: 'FAILED',
  refunded: 'REFUNDED',
};

const INCLUDE = {
  Lease: {
    include: {
      User: { select: { id: true, firstName: true, lastName: true, email: true } },
      Rental: { select: { title: true, address: true, managerId: true, ownerId: true, createdById: true } },
    },
  },
} as const;

type TxWithLease = Prisma.TransactionGetPayload<{ include: typeof INCLUDE }>;

function parseDescription(description: string | null): { method: Method; notes: string } {
  const text = description ?? '';
  const m = text.match(METHOD_TAG);
  const method = (m && (METHODS as readonly string[]).includes(m[1]) ? m[1] : 'bank_transfer') as Method;
  return { method, notes: text.replace(METHOD_TAG, '') };
}

function buildDescription(method: unknown, notes: unknown): string {
  const safeMethod = (METHODS as readonly string[]).includes(String(method)) ? String(method) : 'bank_transfer';
  const text = typeof notes === 'string' ? notes.trim() : '';
  return `[method:${safeMethod}]${text ? ` ${text}` : ''}`;
}

function toRecord(tx: TxWithLease) {
  const { method, notes } = parseDescription(tx.description);
  const tenant = tx.Lease?.User;
  const rental = tx.Lease?.Rental;
  return {
    id: tx.id,
    tenantId: tenant?.id ?? null,
    leaseId: tx.leaseId,
    amount: tx.amount,
    type: tx.type,
    paymentMethod: method,
    paymentDate: tx.transactionDate.toISOString(),
    status: tx.status.toLowerCase(),
    notes,
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
    tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : undefined,
    leaseDetails: rental ? `${rental.title} — ${rental.address}` : undefined,
  };
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function listPaymentRecords(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10) || 10));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? UI_TO_DB_STATUS[req.query.status.toLowerCase()] : undefined;
    const method = typeof req.query.method === 'string' && (METHODS as readonly string[]).includes(req.query.method)
      ? req.query.method
      : undefined;
    const from = parseDate(req.query.dateFrom);
    const to = parseDate(req.query.dateTo);

    const and: Prisma.TransactionWhereInput[] = [];
    const scope = transactionScopeFilter(req);
    if (scope) and.push(scope as Prisma.TransactionWhereInput);
    if (status) and.push({ status });
    if (method) and.push({ description: { startsWith: `[method:${method}]` } });
    if (from || to) and.push({ transactionDate: { ...(from && { gte: from }), ...(to && { lte: to }) } });
    if (search) {
      and.push({
        OR: [
          { description: { contains: search, mode: 'insensitive' } },
          { Lease: { User: { firstName: { contains: search, mode: 'insensitive' } } } },
          { Lease: { User: { lastName: { contains: search, mode: 'insensitive' } } } },
          { Lease: { User: { email: { contains: search, mode: 'insensitive' } } } },
          { Lease: { Rental: { title: { contains: search, mode: 'insensitive' } } } },
        ],
      });
    }
    const where: Prisma.TransactionWhereInput = and.length ? { AND: and } : {};

    const [total, rows] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        include: INCLUDE,
        orderBy: { transactionDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.status(200).json({ data: rows.map(toRecord), total, page, limit });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function createPaymentRecord(req: Request, res: Response) {
  try {
    if (!canWriteRentals(req)) {
      return res.status(403).json({ error: 'You may not record payments' });
    }
    const body = req.body ?? {};
    const amount = Number(body.amount);
    if (!body.leaseId) return res.status(400).json({ error: 'leaseId is required' });
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'amount must be a positive number' });

    const lease = await prisma.lease.findUnique({
      where: { id: String(body.leaseId) },
      include: { Rental: { select: { managerId: true, ownerId: true, createdById: true } } },
    });
    if (!lease) return res.status(404).json({ error: 'Lease not found' });
    if (!canAccessLease(req, lease)) return res.status(403).json({ error: 'You do not have access to this lease' });

    const created = await prisma.transaction.create({
      data: {
        leaseId: lease.id,
        amount,
        type: 'RENT_PAYMENT',
        status: UI_TO_DB_STATUS[String(body.status ?? 'completed').toLowerCase()] ?? 'COMPLETED',
        description: buildDescription(body.paymentMethod, body.notes),
        transactionDate: parseDate(body.paymentDate) ?? new Date(),
      },
      include: INCLUDE,
    });
    res.status(201).json(toRecord(created));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function updatePaymentRecord(req: Request, res: Response) {
  try {
    const existing = await prisma.transaction.findUnique({ where: { id: req.params.id }, include: INCLUDE });
    if (!existing) return res.status(404).json({ error: 'Payment not found' });
    if (!canModifyTransaction(req, existing)) return res.status(403).json({ error: 'You may not change this payment' });

    const body = req.body ?? {};
    const current = parseDescription(existing.description);
    const data: Prisma.TransactionUpdateInput = {};
    if (body.amount !== undefined) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'amount must be a positive number' });
      data.amount = amount;
    }
    if (body.status !== undefined) {
      const s = UI_TO_DB_STATUS[String(body.status).toLowerCase()];
      if (!s) return res.status(400).json({ error: 'invalid status' });
      data.status = s;
    }
    if (body.paymentMethod !== undefined || body.notes !== undefined) {
      data.description = buildDescription(body.paymentMethod ?? current.method, body.notes ?? current.notes);
    }
    const date = parseDate(body.paymentDate);
    if (date) data.transactionDate = date;

    const updated = await prisma.transaction.update({ where: { id: existing.id }, data, include: INCLUDE });
    res.status(200).json(toRecord(updated));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function deletePaymentRecord(req: Request, res: Response) {
  try {
    const existing = await prisma.transaction.findUnique({ where: { id: req.params.id }, include: INCLUDE });
    if (!existing) return res.status(404).json({ error: 'Payment not found' });
    if (!canModifyTransaction(req, existing)) return res.status(403).json({ error: 'You may not delete this payment' });
    await prisma.transaction.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/payments/overdue — unpaid rent (PENDING or FAILED rent payments
 * whose due date, `transactionDate`, has passed), in the dashboard's
 * `OverduePayment` shape, most overdue first. Tenancy-scoped like the list.
 * Filters: propertyId (rental id), tenantId, dateFrom, dateTo,
 * minDaysOverdue, maxDaysOverdue, limit.
 */
export async function listOverduePayments(req: Request, res: Response) {
  try {
    const now = new Date();
    const DAY = 86_400_000;
    const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit ?? '100'), 10) || 100));
    const minDays = Math.max(0, parseInt(String(req.query.minDaysOverdue ?? '1'), 10) || 1);
    const maxDays = parseInt(String(req.query.maxDaysOverdue ?? ''), 10);
    const from = parseDate(req.query.dateFrom);
    const to = parseDate(req.query.dateTo);

    const dueBefore = new Date(now.getTime() - minDays * DAY);
    const dateFilter: Prisma.DateTimeFilter = { lte: to && to < dueBefore ? to : dueBefore };
    if (Number.isFinite(maxDays)) dateFilter.gte = new Date(now.getTime() - maxDays * DAY);
    if (from && (!dateFilter.gte || from > dateFilter.gte)) dateFilter.gte = from;

    const and: Prisma.TransactionWhereInput[] = [
      { type: 'RENT_PAYMENT', status: { in: ['PENDING', 'FAILED'] }, transactionDate: dateFilter },
    ];
    const scope = transactionScopeFilter(req);
    if (scope) and.push(scope as Prisma.TransactionWhereInput);
    if (typeof req.query.propertyId === 'string' && req.query.propertyId) and.push({ Lease: { rentalId: req.query.propertyId } });
    if (typeof req.query.tenantId === 'string' && req.query.tenantId) and.push({ Lease: { tenantId: req.query.tenantId } });

    const rows = await prisma.transaction.findMany({
      where: { AND: and },
      orderBy: { transactionDate: 'asc' },
      take: limit,
      include: {
        Lease: {
          select: {
            tenantId: true,
            rentalId: true,
            User: { select: { firstName: true, lastName: true } },
            Rental: { select: { title: true, unitNumber: true } },
          },
        },
      },
    });

    const data = rows.map((tx) => ({
      id: tx.id,
      tenantId: tx.Lease.tenantId,
      tenantName: `${tx.Lease.User.firstName} ${tx.Lease.User.lastName}`.trim(),
      unitNumber: tx.Lease.Rental.unitNumber ?? tx.Lease.Rental.title,
      propertyName: tx.Lease.Rental.title,
      propertyId: tx.Lease.rentalId,
      amount: tx.amount,
      status: tx.status.toLowerCase(),
      dueDate: tx.transactionDate.toISOString(),
      daysOverdue: Math.floor((now.getTime() - tx.transactionDate.getTime()) / DAY),
      paymentMethod: parseDescription(tx.description).method,
    }));
    res.status(200).json({ data, total: data.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
