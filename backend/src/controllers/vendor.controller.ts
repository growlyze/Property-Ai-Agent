import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { currentUserId, isOperator, isVendor } from '../utils/rentalAccess';

const ACTIVE_JOB_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'] as const;

class VendorController {
  /**
   * GET /api/vendors — vendor directory used by pickers (e.g. vendor performance).
   * Operators only (ADMIN / PROPERTY_MANAGER / OWNER); returns display fields
   * only, never contact-person account data.
   */
  public async listVendors(req: Request, res: Response): Promise<void> {
    if (!isOperator(req)) {
      res.status(403).json({ message: 'Not authorized to list vendors' });
      return;
    }
    try {
      const vendors = await prisma.vendor.findMany({
        select: { id: true, name: true, specialty: true },
        orderBy: { name: 'asc' },
        take: 500,
      });
      res.status(200).json({ data: vendors, total: vendors.length });
    } catch (error) {
      res.status(500).json({ error: 'Failed to list vendors' });
    }
  }

  /**
   * GET /api/vendors/me — the signed-in VENDOR's own profile plus job / quote /
   * payment stats. The login is linked through `Vendor.contactPersonId`.
   * Never returns the Stripe account id or contact-person account data.
   */
  public async getMe(req: Request, res: Response): Promise<void> {
    if (!isVendor(req)) {
      res.status(403).json({ message: 'Only vendor accounts have a vendor profile' });
      return;
    }
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { contactPersonId: currentUserId(req) },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          specialty: true,
          address: true,
          certifications: true,
          serviceAreas: true,
          hourlyRate: true,
          availability: true,
        },
      });
      if (!vendor) {
        res.status(404).json({ message: 'No vendor profile is linked to this account' });
        return;
      }

      const assigned = { WorkOrderAssignment: { some: { vendorId: vendor.id } } };
      const [activeJobs, completedJobs, pendingQuotes, paid, pendingPay, rating] = await Promise.all([
        prisma.workOrder.count({ where: { ...assigned, status: { in: [...ACTIVE_JOB_STATUSES] } } }),
        prisma.workOrder.count({ where: { ...assigned, status: 'COMPLETED' } }),
        prisma.workOrderQuote.count({ where: { vendorId: vendor.id, status: 'PENDING' } }),
        prisma.vendorPayment.aggregate({ where: { vendorId: vendor.id, status: 'PAID' }, _sum: { amount: true } }),
        prisma.vendorPayment.aggregate({
          where: { vendorId: vendor.id, status: { in: ['PENDING', 'APPROVED'] } },
          _sum: { amount: true },
        }),
        prisma.vendorPerformanceRating.aggregate({ where: { vendorId: vendor.id }, _avg: { rating: true } }),
      ]);

      const avg = rating._avg.rating;
      res.status(200).json({
        data: {
          ...vendor,
          stats: {
            activeJobs,
            completedJobs,
            pendingQuotes,
            paidTotal: paid._sum.amount ?? 0,
            pendingPaymentTotal: pendingPay._sum.amount ?? 0,
            averageRating: avg === null ? null : Math.round(avg * 10) / 10,
          },
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load vendor profile' });
    }
  }

  public async updateProfile(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const {
      name,
      phone,
      email,
      address,
      specialty,
      serviceAreas,
      availability,
      certifications,
      hourlyRate,
    } = req.body;

    try {
      const updatedVendor = await prisma.vendor.update({
        where: { id },
        data: {
          name,
          phone,
          email,
          address,
          specialty,
          serviceAreas,
          availability,
          certifications,
          hourlyRate,
        },
      });
      res.status(200).json(updatedVendor);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update vendor profile' });
    }
  }

  /**
   * GET /api/vendors/:id — operators, or the vendor viewing itself. Returns
   * business fields only: previously the whole row (including
   * `stripeAccountId`) went to any logged-in user.
   */
  public async getProfile(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          specialty: true,
          certifications: true,
          serviceAreas: true,
          hourlyRate: true,
          standardRate: true,
          availability: true,
          workload: true,
          contactPersonId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      const isSelf = !!vendor && isVendor(req) && vendor.contactPersonId === currentUserId(req);
      if (!vendor || (!isOperator(req) && !isSelf)) {
        res.status(404).json({ error: 'Vendor not found' });
        return;
      }
      const { contactPersonId: _contact, ...profile } = vendor;
      res.status(200).json(profile);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve vendor profile' });
    }
  }
}

export const vendorController = new VendorController();
