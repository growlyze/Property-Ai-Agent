import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { isOperator } from '../utils/rentalAccess';

const prisma = new PrismaClient();

// Only these user columns ever leave the API for a tenant listing. The old
// handler returned whole User rows, including the bcrypt password hash, MFA
// secret and reset tokens, to every logged-in caller.
const TENANT_PUBLIC_FIELDS = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

class TenantController {
  /**
   * GET /api/tenants?page=&limit=&search=
   * Response: { data: Tenant[], total, page, limit } — the shape every
   * dashboard consumer (dashboardService.getTenants) reads.
   * Operators (ADMIN / PROPERTY_MANAGER / OWNER) only: residents and vendors
   * must not be able to enumerate other tenants.
   */
  async getAllTenants(req: Request, res: Response) {
    try {
      if (!isOperator(req)) {
        return res.status(403).json({ error: 'Not allowed to list tenants' });
      }

      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10) || 10));
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

      const where: Prisma.UserWhereInput = { role: 'TENANT' };
      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          select: {
            ...TENANT_PUBLIC_FIELDS,
            Lease: {
              where: { status: { in: ['ACTIVE', 'PENDING'] } },
              orderBy: { startDate: 'desc' },
              take: 1,
              select: {
                id: true,
                startDate: true,
                endDate: true,
                status: true,
                rentAmount: true,
                rentalId: true,
                Rental: { select: { title: true, address: true, city: true, state: true } },
              },
            },
          },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      const data = users.map(({ Lease, ...u }) => {
        const lease = Lease[0];
        return {
          ...u,
          name: `${u.firstName} ${u.lastName}`.trim(),
          leaseStart: lease?.startDate.toISOString() ?? null,
          leaseEnd: lease?.endDate.toISOString() ?? null,
          status: lease?.status === 'ACTIVE' ? 'active' : 'pending',
          unitId: lease?.rentalId ?? null,
          rentAmount: lease?.rentAmount ?? null,
          property: lease?.Rental
            ? { title: lease.Rental.title, address: `${lease.Rental.address}, ${lease.Rental.city}, ${lease.Rental.state}` }
            : null,
        };
      });

      res.status(200).json({ data, total, page, limit });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async searchTenants(req: Request, res: Response) {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const searchQuery = q.toLowerCase();
      
      // Search tenants with their current lease and property information
      const tenants = await prisma.user.findMany({
        where: {
          role: 'TENANT',
          OR: [
            {
              firstName: {
                contains: searchQuery,
                mode: 'insensitive'
              }
            },
            {
              lastName: {
                contains: searchQuery,
                mode: 'insensitive'
              }
            },
            {
              email: {
                contains: searchQuery,
                mode: 'insensitive'
              }
            }
          ]
        },
        include: {
          Lease: {
            where: {
              status: 'ACTIVE'
            },
            include: {
              Rental: {
                select: {
                  address: true,
                  city: true,
                  state: true,
                  zipCode: true
                }
              }
            },
            orderBy: {
              startDate: 'desc'
            },
            take: 1
          }
        },
        take: 20 // Limit results for performance
      });

      // Transform the data to match the expected interface
      const searchResults = tenants.map(tenant => {
        const currentLease = tenant.Lease[0];
        return {
          id: tenant.id,
          firstName: tenant.firstName,
          lastName: tenant.lastName,
          email: tenant.email,
          property: currentLease ? {
            address: `${currentLease.Rental.address}, ${currentLease.Rental.city}, ${currentLease.Rental.state} ${currentLease.Rental.zipCode}`,
            unit: 'N/A' // Unit info not available in current schema
          } : {
            address: 'No active lease',
            unit: 'N/A'
          },
          currentLease: currentLease ? {
            id: currentLease.id,
            startDate: currentLease.startDate.toISOString(),
            endDate: currentLease.endDate.toISOString()
          } : undefined
        };
      });

      res.status(200).json({
        tenants: searchResults,
        total: searchResults.length
      });
    } catch (error: any) {
      console.error('Error searching tenants:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export default new TenantController();
