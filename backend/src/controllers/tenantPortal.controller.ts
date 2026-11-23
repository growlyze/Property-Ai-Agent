import { Request, Response } from 'express';
import { LeaseStatus, UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { currentUserId, currentUserRole } from '../utils/rentalAccess';

/**
 * GET /api/tenant/me/summary — the signed-in TENANT's home screen: their lease,
 * the next rent payment, overdue balance, open maintenance and unread
 * notifications. Everything is keyed on the caller's own id; there is no
 * parameter that could point it at another tenant.
 */

const OPEN_MAINTENANCE = ['OPEN', 'IN_PROGRESS', 'ON_HOLD'] as const;
const LEASE_PRIORITY: LeaseStatus[] = [LeaseStatus.ACTIVE, LeaseStatus.PENDING];

/**
 * The next rent due date when no pending rent transaction is on file: the next
 * occurrence of the lease's start day-of-month on or after today, within the
 * lease term.
 */
function nextDueFromLease(startDate: Date, endDate: Date, now: Date): Date | null {
  const day = startDate.getUTCDate();
  const candidate = (y: number, m: number) => {
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(day, last)));
  };
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let due = candidate(today.getUTCFullYear(), today.getUTCMonth());
  if (due < today) due = candidate(today.getUTCFullYear(), today.getUTCMonth() + 1);
  if (due < startDate) due = startDate;
  return due > endDate ? null : due;
}

export async function getTenantSummary(req: Request, res: Response) {
  if (currentUserRole(req) !== UserRole.TENANT) {
    return res.status(403).json({ error: 'Only tenant accounts have a tenant summary' });
  }
  const userId = currentUserId(req)!;

  try {
    const leases = await prisma.lease.findMany({
      where: { tenantId: userId, status: { in: LEASE_PRIORITY } },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        rentAmount: true,
        securityDeposit: true,
        status: true,
        Rental: {
          select: { id: true, title: true, address: true, city: true, state: true, unitNumber: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });
    // Prefer the ACTIVE lease; fall back to a PENDING (signed, not started) one.
    const lease =
      leases.find((l) => l.status === LeaseStatus.ACTIVE) ??
      leases.find((l) => l.status === LeaseStatus.PENDING) ??
      null;

    const now = new Date();
    const ownRent = { type: 'RENT_PAYMENT' as const, Lease: { tenantId: userId } };

    const [overdue, upcoming, openMaintenance, unreadNotifications] = await Promise.all([
      prisma.transaction.aggregate({
        where: { ...ownRent, status: { in: ['PENDING', 'FAILED'] }, transactionDate: { lt: now } },
        _sum: { amount: true },
      }),
      lease
        ? prisma.transaction.findFirst({
            where: { ...ownRent, leaseId: lease.id, status: 'PENDING', transactionDate: { gte: now } },
            select: { transactionDate: true, amount: true },
            orderBy: { transactionDate: 'asc' },
          })
        : Promise.resolve(null),
      prisma.maintenanceRequest.count({
        where: { requestedById: userId, status: { in: [...OPEN_MAINTENANCE] } },
      }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    let nextPayment: { dueDate: string; amount: number } | null = null;
    if (upcoming) {
      nextPayment = { dueDate: upcoming.transactionDate.toISOString(), amount: upcoming.amount };
    } else if (lease && lease.status === LeaseStatus.ACTIVE) {
      const due = nextDueFromLease(lease.startDate, lease.endDate, now);
      if (due) nextPayment = { dueDate: due.toISOString(), amount: lease.rentAmount };
    }

    res.status(200).json({
      data: {
        lease: lease
          ? {
              id: lease.id,
              startDate: lease.startDate.toISOString(),
              endDate: lease.endDate.toISOString(),
              rentAmount: lease.rentAmount,
              securityDeposit: lease.securityDeposit,
              status: lease.status,
              rental: lease.Rental,
            }
          : null,
        nextPayment,
        balanceDue: Math.round((overdue._sum.amount ?? 0) * 100) / 100,
        openMaintenance,
        unreadNotifications,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load tenant summary' });
  }
}
