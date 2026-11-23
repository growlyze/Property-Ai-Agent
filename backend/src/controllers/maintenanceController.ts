import { Request, Response } from 'express';
import { MaintenanceStatus, Prisma, PrismaClient, Priority } from '@prisma/client';
import { maintenanceService } from '../services/maintenance.service';
import {
  canAccessMaintenanceRequest,
  canAccessRental,
  canModifyMaintenanceRequest,
  canWriteRentals,
  currentUserId,
  isAdmin,
  maintenanceScopeFilter,
} from '../utils/rentalAccess';

const prisma = new PrismaClient();

/**
 * Maintenance request CRUD.
 *
 * SECURITY MODEL (see utils/rentalAccess.ts)
 * ------------------------------------------
 * The router applies only `authMiddleware.protect`, so ownership is decided
 * here. Before this controller enforced tenancy, `GET /api/maintenance` returned
 * every maintenance request in the system and `PUT` was
 * `data: req.body` on any id.
 *
 * Rules:
 *   - the collection is filtered by `maintenanceScopeFilter`;
 *   - a resident MAY create a request for the home they lease (self-service —
 *     that is the feature), but may never edit or close one;
 *   - `requestedById` is server-set to the caller unless an operator files on a
 *     resident's behalf; it is never taken verbatim from an ordinary body;
 *   - `rentalId` is not writable on update, so a request cannot be moved to
 *     another property (which would expose it under a different landlord);
 *   - existence (404) before access (403).
 */

/** Fields a client may change. `rentalId` / `requestedById` are absent. */
const WRITABLE_FIELDS = [
  'title',
  'description',
  'status',
  'priority',
  'notes',
  'scheduledDate',
  'completedDate',
  'estimatedCost',
  'actualCost',
  'categoryId',
] as const;

const DATE_FIELDS = new Set<string>(['scheduledDate', 'completedDate']);

function pickWritable(body: unknown): Record<string, unknown> {
  const source = (body ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of WRITABLE_FIELDS) {
    if (source[field] !== undefined) out[field] = source[field];
  }
  for (const field of DATE_FIELDS) {
    const value = out[field];
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) out[field] = parsed;
    }
  }
  return out;
}

/** Ownership ids needed by the access checks. */
const OWNERSHIP_INCLUDE = {
  Rental: { select: { managerId: true, ownerId: true, createdById: true } },
} as const;

class MaintenanceController {
  async getAllMaintenanceRequests(req: Request, res: Response) {
    try {
      // GET /api/maintenance → { data, total, page, limit }. Optional search,
      // status and priority (comma lists, case-insensitive). Paged only when
      // page/limit is sent (limit capped at 100), otherwise all in-scope rows.
      const paged = req.query.page !== undefined || req.query.limit !== undefined;
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10) || 10));
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const enumList = <T extends string>(raw: unknown, allowed: readonly T[]): T[] =>
        typeof raw === 'string'
          ? (raw.split(',').map((v) => v.trim().toUpperCase().replace(/[s-]+/g, '_')) as T[]).filter((v) =>
              allowed.includes(v)
            )
          : [];
      const statuses = enumList(req.query.status, Object.values(MaintenanceStatus));
      const priorities = enumList(req.query.priority, Object.values(Priority));

      const filter: Prisma.MaintenanceRequestWhereInput[] = [];
      if (statuses.length) filter.push({ status: { in: statuses } });
      if (priorities.length) filter.push({ priority: { in: priorities } });
      if (search) {
        const contains = { contains: search, mode: 'insensitive' as const };
        filter.push({
          OR: [
            { title: contains },
            { description: contains },
            { Rental: { title: contains } },
            { Rental: { address: contains } },
            { User: { firstName: contains } },
            { User: { lastName: contains } },
          ],
        });
      }

      const { rows, total } = await maintenanceService.getAllMaintenanceRequests(
        maintenanceScopeFilter(req),
        {
          filter: filter.length ? { AND: filter } : undefined,
          ...(paged ? { skip: (page - 1) * limit, take: limit } : {}),
        }
      );
      res.status(200).json({ data: rows, total, page: paged ? page : 1, limit: paged ? limit : total });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async createMaintenanceRequest(req: Request, res: Response) {
    try {
      const userId = currentUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'Not authorized' });
        return;
      }

      const body = req.body ?? {};
      const { title, description } = body;
      let rentalId: string | undefined =
        typeof body.rentalId === 'string' && body.rentalId.trim() ? body.rentalId.trim() : undefined;

      if (!title || !description) {
        return res.status(400).json({ error: 'title and description are required' });
      }

      // Priority is accepted case-insensitively (LOW|MEDIUM|HIGH|EMERGENCY).
      let priority: Priority | undefined;
      if (body.priority !== undefined && body.priority !== null && body.priority !== '') {
        const p = String(body.priority).trim().toUpperCase();
        if (!(Object.values(Priority) as string[]).includes(p)) {
          return res
            .status(400)
            .json({ error: `priority must be one of ${Object.values(Priority).join(', ')}` });
        }
        priority = p as Priority;
      }

      const operator = canWriteRentals(req);

      if (!operator) {
        // Residents (and anyone else who is not an operator) may only report a
        // fault in a home they LEASE. With no rentalId, default to their ACTIVE
        // lease. An application is not a tenancy, so it no longer qualifies.
        const leases = await prisma.lease.findMany({
          where: { tenantId: userId, status: { in: ['ACTIVE', 'PENDING'] } },
          select: { rentalId: true, status: true },
          orderBy: { startDate: 'desc' },
        });
        if (!rentalId) {
          const active = leases.find((l) => l.status === 'ACTIVE');
          if (!active) {
            return res
              .status(400)
              .json({ error: 'rentalId is required (no active lease found for this account)' });
          }
          rentalId = active.rentalId;
        } else if (!leases.some((l) => l.rentalId === rentalId)) {
          return res.status(403).json({ error: 'You can only report maintenance for a home you lease' });
        }

        // Self-service create: only the fault description is the resident's to
        // set. Status, costs, scheduling and attribution are the landlord's.
        const maintenanceRequest = await prisma.maintenanceRequest.create({
          data: {
            title: String(title),
            description: String(description),
            ...(priority ? { priority } : {}),
            rentalId,
            requestedById: userId,
          },
        });
        return res.status(201).json({ data: maintenanceRequest });
      }

      if (!rentalId) {
        return res.status(400).json({ error: 'rentalId is required' });
      }

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
        select: { managerId: true, ownerId: true, createdById: true },
      });
      if (!rental) {
        return res.status(404).json({ error: 'Rental not found' });
      }

      // Operators must control the rental.
      if (!canAccessRental(req, { ...rental, Leases: [], Applications: [] })) {
        return res.status(403).json({ error: 'You do not have access to this rental' });
      }

      // Attribution: an operator may file on a resident's behalf, but the value
      // must be a real user.
      const requestedById = body.requestedById ? body.requestedById : userId;
      if (requestedById !== userId) {
        const requester = await prisma.user.findUnique({
          where: { id: requestedById },
          select: { id: true },
        });
        if (!requester) {
          return res.status(400).json({ error: 'requestedById is not a valid user' });
        }
      }

      const maintenanceRequest = await prisma.maintenanceRequest.create({
        data: {
          ...pickWritable(body),
          ...(priority ? { priority } : {}),
          title,
          description,
          rentalId,
          requestedById,
        } as any,
      });
      res.status(201).json({ data: maintenanceRequest });
    } catch (error: any) {
      if (error?.code === 'P2003' || error?.name === 'PrismaClientValidationError') {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  async getMaintenanceRequestById(req: Request, res: Response) {
    try {
      const maintenanceRequest = await prisma.maintenanceRequest.findUnique({
        where: { id: req.params.id },
        include: OWNERSHIP_INCLUDE,
      });
      if (!maintenanceRequest) {
        res.status(404).json({ message: 'Maintenance request not found' });
        return;
      }
      if (!canAccessMaintenanceRequest(req, maintenanceRequest)) {
        res.status(403).json({ error: 'You do not have access to this maintenance request' });
        return;
      }
      res.status(200).json(maintenanceRequest);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateMaintenanceRequest(req: Request, res: Response) {
    try {
      const existing = await prisma.maintenanceRequest.findUnique({
        where: { id: req.params.id },
        include: OWNERSHIP_INCLUDE,
      });
      if (!existing) {
        res.status(404).json({ message: 'Maintenance request not found' });
        return;
      }
      if (!canModifyMaintenanceRequest(req, existing)) {
        res.status(403).json({ error: 'You do not have access to this maintenance request' });
        return;
      }

      const data = pickWritable(req.body);
      if (data.priority !== undefined) {
        const valid = Object.values(Priority) as string[];
        if (!valid.includes(String(data.priority))) {
          res.status(400).json({ error: 'Invalid priority' });
          return;
        }
      }

      const maintenanceRequest = await prisma.maintenanceRequest.update({
        where: { id: req.params.id },
        data: data as any,
      });
      res.status(200).json(maintenanceRequest);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async deleteMaintenanceRequest(req: Request, res: Response) {
    try {
      const existing = await prisma.maintenanceRequest.findUnique({
        where: { id: req.params.id },
        include: OWNERSHIP_INCLUDE,
      });
      if (!existing) {
        res.status(404).json({ message: 'Maintenance request not found' });
        return;
      }
      if (!canModifyMaintenanceRequest(req, existing)) {
        res.status(403).json({ error: 'You do not have access to this maintenance request' });
        return;
      }

      await prisma.maintenanceRequest.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Re-assign a work order to a different vendor.
   *
   * The route is role-gated (ADMIN / PROPERTY_MANAGER), but role alone cannot
   * answer "is this YOUR work order" — without the check below a manager could
   * re-point ANY work order in the system, and the `deleteMany` would first wipe
   * the incumbent vendor's assignment.
   */
  async assignVendorToWorkOrder(req: Request, res: Response) {
    const { workOrderId, vendorId } = req.body ?? {};
    try {
      if (!workOrderId || !vendorId) {
        res.status(400).json({ error: 'workOrderId and vendorId are required' });
        return;
      }

      const workOrder = await prisma.workOrder.findUnique({
        where: { id: workOrderId },
        include: {
          MaintenanceRequest: {
            include: {
              Rental: { select: { managerId: true, ownerId: true, createdById: true } },
            },
          },
        },
      });
      if (!workOrder) {
        res.status(404).json({ error: 'Work order not found' });
        return;
      }

      const rental = workOrder.MaintenanceRequest?.Rental;
      if (!isAdmin(req)) {
        const userId = currentUserId(req);
        const owns =
          !!userId &&
          !!rental &&
          (rental.managerId === userId ||
            rental.ownerId === userId ||
            rental.createdById === userId);
        if (!owns) {
          res.status(403).json({ error: 'You do not have access to this work order' });
          return;
        }
      }

      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        select: { id: true },
      });
      if (!vendor) {
        res.status(400).json({ error: 'vendorId is not a valid vendor' });
        return;
      }

      // Only NOW touch the existing assignment set, once authorization passed.
      await prisma.workOrderAssignment.deleteMany({ where: { workOrderId } });
      const assignment = await prisma.workOrderAssignment.create({
        data: { workOrderId, vendorId },
      });
      res.status(201).json(assignment);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async createWorkOrderFromRequest(req: Request, res: Response) {
    try {
      const { maintenanceRequestId } = req.body;
      const workOrder = await maintenanceService.createWorkOrderFromRequest(maintenanceRequestId);
      if (workOrder) {
        res.status(201).json(workOrder);
      } else {
        res.status(404).json({ message: 'Maintenance request not found' });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // New: Batch endpoint for creating work orders from multiple requests
  async createWorkOrdersFromRequests(req: Request, res: Response) {
    try {
      const { maintenanceRequestIds } = req.body;
      if (!Array.isArray(maintenanceRequestIds) || maintenanceRequestIds.length === 0) {
        return res.status(400).json({ message: 'maintenanceRequestIds must be a non-empty array' });
      }
      const workOrders = await maintenanceService.createWorkOrdersFromRequests(maintenanceRequestIds);
      res.status(201).json(workOrders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new MaintenanceController();
