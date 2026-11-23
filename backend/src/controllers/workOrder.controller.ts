import { Request, Response } from 'express';
import { Prisma, QuoteStatus, WorkOrderStatus } from '@prisma/client';
import { prisma } from '../config/database';
import {
  currentUserId,
  isOperator,
  isResident,
  isVendor,
  maintenanceScopeFilter,
  workOrderScopeFilter,
} from '../utils/rentalAccess';

/**
 * Work orders for the role-based portals (GET/POST /api/work-orders, …).
 *
 * Tenancy is `workOrderScopeFilter` from utils/rentalAccess.ts:
 *   ADMIN        -> all
 *   PM / OWNER   -> work orders under rentals they manage, own or created
 *   VENDOR       -> work orders assigned to their Vendor row
 *   TENANT       -> work orders on maintenance requests they filed (read-only)
 *
 * Every single-row lookup is `findFirst({ id, ...scope })`, so a row outside the
 * caller's scope is indistinguishable from a missing one (404). Role gates that
 * do not depend on the row (e.g. "tenants never write") answer 403 first.
 */

const SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  MaintenanceRequest: {
    select: {
      id: true,
      title: true,
      status: true,
      Rental: { select: { id: true, title: true, address: true, city: true, unitNumber: true } },
    },
  },
  WorkOrderAssignment: {
    select: { Vendor: { select: { id: true, name: true, specialty: true } } },
    orderBy: { assignedAt: 'asc' },
  },
  WorkOrderQuote: {
    select: {
      id: true,
      vendorId: true,
      amount: true,
      details: true,
      status: true,
      createdAt: true,
      Vendor: { select: { name: true, contactPersonId: true } },
    },
    orderBy: { createdAt: 'desc' },
  },
  ScheduledEvent: { select: { startTime: true } },
} satisfies Prisma.WorkOrderSelect;

type WorkOrderRow = Prisma.WorkOrderGetPayload<{ select: typeof SELECT }>;

const QUOTE_SELECT = {
  id: true,
  vendorId: true,
  amount: true,
  details: true,
  status: true,
  createdAt: true,
  Vendor: { select: { name: true } },
} satisfies Prisma.WorkOrderQuoteSelect;

type QuoteRow = Prisma.WorkOrderQuoteGetPayload<{ select: typeof QUOTE_SELECT }>;

function quoteDto(q: QuoteRow) {
  return {
    id: q.id,
    vendorId: q.vendorId,
    vendorName: q.Vendor?.name ?? null,
    amount: q.amount,
    details: q.details,
    status: q.status,
    createdAt: q.createdAt.toISOString(),
  };
}

function toDto(req: Request, row: WorkOrderRow) {
  const userId = currentUserId(req);
  const vendorView = isVendor(req);
  const rental = row.MaintenanceRequest?.Rental;
  // A vendor sees only its own quotes: competitors' prices are not its business.
  // A resident sees none: landlord-vendor pricing is not part of the tenancy
  // (same rule as vendor payments in vendorPaymentScopeFilter).
  const quotes = vendorView
    ? row.WorkOrderQuote.filter((q) => q.Vendor?.contactPersonId === userId)
    : isResident(req)
      ? []
      : row.WorkOrderQuote;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    rental: rental
      ? {
          id: rental.id,
          title: rental.title,
          address: rental.address,
          city: rental.city,
          unitNumber: rental.unitNumber,
        }
      : null,
    maintenanceRequest: row.MaintenanceRequest
      ? {
          id: row.MaintenanceRequest.id,
          title: row.MaintenanceRequest.title,
          status: row.MaintenanceRequest.status,
        }
      : null,
    vendors: row.WorkOrderAssignment.map((a) => ({
      id: a.Vendor.id,
      name: a.Vendor.name,
      specialty: a.Vendor.specialty,
    })),
    quotes: quotes.map((q) => ({
      id: q.id,
      vendorId: q.vendorId,
      vendorName: q.Vendor?.name ?? null,
      amount: q.amount,
      details: q.details,
      status: q.status,
      createdAt: q.createdAt.toISOString(),
    })),
    scheduledFor: row.ScheduledEvent?.startTime ? row.ScheduledEvent.startTime.toISOString() : null,
  };
}

function scoped(req: Request, where: Prisma.WorkOrderWhereInput): Prisma.WorkOrderWhereInput {
  const scope = workOrderScopeFilter(req) as Prisma.WorkOrderWhereInput | undefined;
  return scope ? { AND: [scope, where] } : where;
}

/** Fetch a work order the caller can see, or null (→ 404). */
function findScoped(req: Request, id: string) {
  return prisma.workOrder.findFirst({ where: scoped(req, { id }), select: SELECT });
}

/** The `Vendor` row linked to the calling VENDOR login, if any. */
function callerVendor(req: Request) {
  const userId = currentUserId(req);
  if (!userId) return Promise.resolve(null);
  return prisma.vendor.findUnique({ where: { contactPersonId: userId }, select: { id: true } });
}

const VENDOR_SETTABLE: readonly WorkOrderStatus[] = [
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.ON_HOLD,
  WorkOrderStatus.COMPLETED,
];

function parseStatus(raw: unknown): WorkOrderStatus | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return (Object.values(WorkOrderStatus) as string[]).includes(v) ? (v as WorkOrderStatus) : undefined;
}

export async function listWorkOrders(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const and: Prisma.WorkOrderWhereInput[] = [];
    if (typeof req.query.status === 'string' && req.query.status.trim()) {
      const statuses = req.query.status
        .split(',')
        .map(parseStatus)
        .filter((s): s is WorkOrderStatus => !!s);
      // An unknown status filter matches nothing rather than silently everything.
      and.push(statuses.length ? { status: { in: statuses } } : { id: '__no_match__' });
    }
    if (search) {
      const contains = { contains: search, mode: 'insensitive' as const };
      and.push({
        OR: [
          { title: contains },
          { description: contains },
          { MaintenanceRequest: { Rental: { title: contains } } },
          { MaintenanceRequest: { Rental: { address: contains } } },
        ],
      });
    }
    const where = scoped(req, and.length ? { AND: and } : {});

    const [total, rows] = await Promise.all([
      prisma.workOrder.count({ where }),
      prisma.workOrder.findMany({
        where,
        select: SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.status(200).json({ data: rows.map((r) => toDto(req, r)), total, page, limit });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list work orders' });
  }
}

export async function getWorkOrder(req: Request, res: Response) {
  try {
    const row = await findScoped(req, req.params.id);
    if (!row) return res.status(404).json({ error: 'Work order not found' });
    res.status(200).json({ data: toDto(req, row) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load work order' });
  }
}

export async function createWorkOrder(req: Request, res: Response) {
  if (!isOperator(req)) {
    return res.status(403).json({ error: 'Not authorized to create work orders' });
  }
  try {
    const { maintenanceRequestId, vendorId, notes } = req.body ?? {};
    if (!maintenanceRequestId || typeof maintenanceRequestId !== 'string') {
      return res.status(400).json({ error: 'maintenanceRequestId is required' });
    }

    const scope = maintenanceScopeFilter(req) as Prisma.MaintenanceRequestWhereInput | undefined;
    const request = await prisma.maintenanceRequest.findFirst({
      where: scope ? { AND: [scope, { id: maintenanceRequestId }] } : { id: maintenanceRequestId },
      select: { id: true, title: true, description: true, priority: true, WorkOrder: { select: { id: true } } },
    });
    if (!request) return res.status(404).json({ error: 'Maintenance request not found' });
    if (request.WorkOrder) {
      return res
        .status(409)
        .json({ error: 'This maintenance request already has a work order', workOrderId: request.WorkOrder.id });
    }

    if (vendorId !== undefined && vendorId !== null && vendorId !== '') {
      if (typeof vendorId !== 'string') return res.status(400).json({ error: 'vendorId must be a string' });
      const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
      if (!vendor) return res.status(400).json({ error: 'vendorId is not a valid vendor' });
    }
    const assign = typeof vendorId === 'string' && vendorId !== '';

    const created = await prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.create({
        data: {
          title: request.title,
          description: request.description,
          priority: request.priority,
          status: assign ? WorkOrderStatus.ASSIGNED : WorkOrderStatus.OPEN,
          maintenanceRequestId: request.id,
        },
        select: { id: true },
      });
      if (assign) {
        await tx.workOrderAssignment.create({
          data: {
            workOrderId: wo.id,
            vendorId,
            notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
          },
        });
      }
      return wo;
    });

    const row = await prisma.workOrder.findUnique({ where: { id: created.id }, select: SELECT });
    res.status(201).json({ data: toDto(req, row!) });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'This maintenance request already has a work order' });
    }
    res.status(500).json({ error: 'Failed to create work order' });
  }
}

export async function updateWorkOrderStatus(req: Request, res: Response) {
  const operator = isOperator(req);
  const vendor = isVendor(req);
  if (!operator && !vendor) {
    return res.status(403).json({ error: 'Not authorized to update work orders' });
  }
  try {
    const status = parseStatus(req.body?.status);
    if (!status) {
      return res
        .status(400)
        .json({ error: `status must be one of ${Object.values(WorkOrderStatus).join(', ')}` });
    }

    const existing = await prisma.workOrder.findFirst({
      where: scoped(req, { id: req.params.id }),
      select: { id: true, maintenanceRequestId: true },
    });
    if (!existing) return res.status(404).json({ error: 'Work order not found' });

    if (vendor && !VENDOR_SETTABLE.includes(status)) {
      return res
        .status(403)
        .json({ error: `Vendors may only set status to ${VENDOR_SETTABLE.join(', ')}` });
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: existing.id },
        data: {
          status,
          completedAt: status === WorkOrderStatus.COMPLETED ? now : null,
        },
      });
      if (status === WorkOrderStatus.COMPLETED) {
        await tx.maintenanceRequest.update({
          where: { id: existing.maintenanceRequestId },
          data: { status: 'COMPLETED', completedDate: now },
        });
      } else if (status === WorkOrderStatus.IN_PROGRESS) {
        await tx.maintenanceRequest.update({
          where: { id: existing.maintenanceRequestId },
          data: { status: 'IN_PROGRESS' },
        });
      }
    });

    const row = await findScoped(req, existing.id);
    res.status(200).json({ data: toDto(req, row!) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update work order status' });
  }
}

export async function createQuote(req: Request, res: Response) {
  if (!isVendor(req)) {
    return res.status(403).json({ error: 'Only the assigned vendor may submit a quote' });
  }
  try {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a number greater than 0' });
    }
    const details = req.body?.details;
    if (details !== undefined && details !== null && typeof details !== 'string') {
      return res.status(400).json({ error: 'details must be a string' });
    }

    const [vendorRow, workOrder] = await Promise.all([
      callerVendor(req),
      prisma.workOrder.findFirst({ where: scoped(req, { id: req.params.id }), select: { id: true } }),
    ]);
    if (!workOrder || !vendorRow) return res.status(404).json({ error: 'Work order not found' });

    const quote = await prisma.workOrderQuote.create({
      data: {
        workOrderId: workOrder.id,
        vendorId: vendorRow.id,
        amount: Math.round(amount * 100) / 100,
        details: typeof details === 'string' && details.trim() ? details.trim() : null,
        status: QuoteStatus.PENDING,
      },
      select: QUOTE_SELECT,
    });
    res.status(201).json({ data: quoteDto(quote) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit quote' });
  }
}

export async function updateQuoteStatus(req: Request, res: Response) {
  if (!isOperator(req)) {
    return res.status(403).json({ error: 'Not authorized to review quotes' });
  }
  try {
    const raw = typeof req.body?.status === 'string' ? req.body.status.trim().toUpperCase() : '';
    if (raw !== QuoteStatus.ACCEPTED && raw !== QuoteStatus.REJECTED) {
      return res.status(400).json({ error: "status must be 'ACCEPTED' or 'REJECTED'" });
    }

    const scope = workOrderScopeFilter(req) as Prisma.WorkOrderWhereInput | undefined;
    const quote = await prisma.workOrderQuote.findFirst({
      where: { id: req.params.quoteId, ...(scope ? { WorkOrder: scope } : {}) },
      select: { id: true },
    });
    if (!quote) return res.status(404).json({ error: 'Quote not found' });

    const updated = await prisma.workOrderQuote.update({
      where: { id: quote.id },
      data: { status: raw as QuoteStatus },
      select: QUOTE_SELECT,
    });
    res.status(200).json({ data: quoteDto(updated) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update quote' });
  }
}
