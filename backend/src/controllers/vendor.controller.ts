import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { isOperator } from '../utils/rentalAccess';

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

  public async getProfile(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { id },
      });
      if (vendor) {
        res.status(200).json(vendor);
      } else {
        res.status(404).json({ error: 'Vendor not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve vendor profile' });
    }
  }
}

export const vendorController = new VendorController();
