import { Request, Response } from 'express';
import { PrismaClient, PaymentStatus, TransactionStatus } from '@prisma/client';
import {
  canModifyTransaction,
  currentUserId,
  isAdmin,
  isOperator,
  transactionScopeFilter,
} from '../utils/rentalAccess';

const prisma = new PrismaClient();

/**
 * Payment approvals for the dashboard Financials page
 * (components/financial/PaymentApproval.tsx):
 *
 *   GET  /api/payments/transactions/pending
 *   GET  /api/payments/vendor-payments/pending
 *   POST /api/payments/transactions/:id/(approve|reject)
 *   POST /api/payments/vendor-payments/:id/(approve|reject)
 *
 * Operators only (ADMIN / PROPERTY_MANAGER / OWNER). Lists and writes are
 * tenancy-scoped through utils/rentalAccess.ts: an ADMIN sees everything, any
 * other operator only rows under rentals they manage, own or created. Every
 * nested user is read with `select`, so no password hash or token leaves here.
 *
 * Response rows use the shape the dashboard component declares
 * (`lease.unit.property.name`, `lease.tenant.firstName`,
 * `vendor.name`, `workOrder.maintenanceRequest.property.name`).
 */

const RENTAL_OWNERSHIP = { managerId: true, ownerId: true, createdById: true } as const;

function deny(res: Response) {
  return res.status(403).json({ error: 'Forbidden' });
}

/** Prisma `where` fragment limiting VendorPayment rows to the caller's rentals. */
function vendorPaymentScopeFilter(req: Request): Record<string, unknown> | undefined {
  if (isAdmin(req)) return undefined;
  const userId = currentUserId(req);
  if (!userId || !isOperator(req)) return { id: '__no_access__' };
  return {
    WorkOrder: {
      MaintenanceRequest: {
        Rental: { OR: [{ managerId: userId }, { ownerId: userId }, { createdById: userId }] },
      },
    },
  };
}

function ownsRental(req: Request, rental?: { managerId: string; ownerId: string; createdById: string } | null) {
  if (isAdmin(req)) return true;
  const userId = currentUserId(req);
  if (!userId || !rental) return false;
  return [rental.managerId, rental.ownerId, rental.createdById].includes(userId);
}

export const getPendingTransactions = async (req: Request, res: Response) => {
  try {
    if (!isOperator(req)) return deny(res);
    const scope = transactionScopeFilter(req);
    const rows = await prisma.transaction.findMany({
      where: { status: TransactionStatus.PENDING, ...(scope ?? {}) },
      select: {
        id: true,
        amount: true,
        type: true,
        description: true,
        createdAt: true,
        Lease: {
          select: {
            id: true,
            User: { select: { id: true, firstName: true, lastName: true } },
            Rental: { select: { id: true, title: true, unitNumber: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    res.status(200).json(
      rows.map((t) => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        description: t.description ?? '',
        createdAt: t.createdAt,
        lease: {
          id: t.Lease.id,
          unit: {
            unitNumber: t.Lease.Rental.unitNumber ?? '',
            property: { id: t.Lease.Rental.id, name: t.Lease.Rental.title },
          },
          tenant: {
            id: t.Lease.User.id,
            firstName: t.Lease.User.firstName,
            lastName: t.Lease.User.lastName,
          },
        },
      }))
    );
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to load pending transactions' });
  }
};

export const getPendingVendorPayments = async (req: Request, res: Response) => {
  try {
    if (!isOperator(req)) return deny(res);
    const scope = vendorPaymentScopeFilter(req);
    const rows = await prisma.vendorPayment.findMany({
      where: { status: PaymentStatus.PENDING, ...(scope ?? {}) },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        Vendor: { select: { id: true, name: true } },
        WorkOrder: {
          select: {
            id: true,
            title: true,
            MaintenanceRequest: { select: { id: true, Rental: { select: { id: true, title: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    res.status(200).json(
      rows.map((p) => ({
        id: p.id,
        amount: p.amount,
        // VendorPayment has no notes column; the work order title is the useful label.
        notes: p.WorkOrder.title,
        createdAt: p.createdAt,
        vendor: { id: p.Vendor.id, name: p.Vendor.name },
        workOrder: {
          id: p.WorkOrder.id,
          maintenanceRequest: {
            id: p.WorkOrder.MaintenanceRequest.id,
            property: {
              id: p.WorkOrder.MaintenanceRequest.Rental?.id ?? null,
              name: p.WorkOrder.MaintenanceRequest.Rental?.title ?? '',
            },
          },
        },
      }))
    );
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to load pending vendor payments' });
  }
};

async function decideTransaction(req: Request, res: Response, status: TransactionStatus) {
  try {
    const userId = currentUserId(req);
    if (!userId || !isOperator(req)) return deny(res);

    const tx = await prisma.transaction.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        status: true,
        Lease: { select: { tenantId: true, Rental: { select: RENTAL_OWNERSHIP } } },
      },
    });
    // Same 404 for "missing" and "not yours", so ids cannot be probed.
    if (!tx || !canModifyTransaction(req, tx)) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    if (tx.status !== TransactionStatus.PENDING) {
      return res.status(409).json({ error: 'Transaction is not pending approval' });
    }

    const updated = await prisma.transaction.update({
      where: { id: tx.id },
      data: { status, approvedById: userId },
      select: { id: true, status: true, amount: true, approvedById: true, updatedAt: true },
    });
    res.status(200).json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update transaction' });
  }
}

async function decideVendorPayment(req: Request, res: Response, status: PaymentStatus) {
  try {
    const userId = currentUserId(req);
    if (!userId || !isOperator(req)) return deny(res);

    const payment = await prisma.vendorPayment.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        status: true,
        WorkOrder: { select: { MaintenanceRequest: { select: { Rental: { select: RENTAL_OWNERSHIP } } } } },
      },
    });
    if (!payment || !ownsRental(req, payment.WorkOrder.MaintenanceRequest.Rental)) {
      return res.status(404).json({ error: 'Vendor payment not found' });
    }
    if (payment.status !== PaymentStatus.PENDING) {
      return res.status(409).json({ error: 'Vendor payment is not pending approval' });
    }

    const updated = await prisma.vendorPayment.update({
      where: { id: payment.id },
      data: { status, approvedById: userId },
      select: { id: true, status: true, amount: true, approvedById: true, updatedAt: true },
    });
    res.status(200).json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update vendor payment' });
  }
}

export const approveTransaction = (req: Request, res: Response) =>
  decideTransaction(req, res, TransactionStatus.COMPLETED);

export const rejectTransaction = (req: Request, res: Response) =>
  decideTransaction(req, res, TransactionStatus.FAILED);

export const approveVendorPayment = (req: Request, res: Response) =>
  decideVendorPayment(req, res, PaymentStatus.PAID);

export const rejectVendorPayment = (req: Request, res: Response) =>
  decideVendorPayment(req, res, PaymentStatus.FAILED);
