import { Request, Response } from 'express';
import { PrismaClient, ApplicationStatus } from '@prisma/client';
import { pushNotificationService } from '../services/pushNotification.service';
import {
  applicationScopeFilter,
  canAccessApplication,
  canAccessRental,
  canModifyApplication,
  canWriteRentals,
  currentUserId,
  isAdmin,
} from '../utils/rentalAccess';

const prisma = new PrismaClient();

/**
 * Rental application CRUD.
 *
 * SECURITY MODEL (see utils/rentalAccess.ts)
 * ------------------------------------------
 * The router applies only `authMiddleware.protect`. Before this controller
 * enforced tenancy, `GET /api/applications` ran a bare `findMany()` and returned
 * every application in the system — including `notes` — to any authenticated
 * user, and `create` was `prisma.application.create({ data: req.body })`, so a
 * caller could file an application as somebody else or attach it to a rental
 * they had nothing to do with.
 *
 * Rules:
 *   - the collection is filtered by `applicationScopeFilter`;
 *   - `applicantId` is server-set to the caller — never taken from the body.
 *     An operator may file ON BEHALF of a named applicant, but only against a
 *     rental they control;
 *   - `PUT` cannot move `rentalId`/`applicantId`; only `status` and `notes` are
 *     writable, and only operators may write at all;
 *   - existence (404) is checked before access (403).
 */

const WRITABLE_FIELDS = ['status', 'notes'] as const;

function pickWritable(body: unknown): Record<string, unknown> {
  const source = (body ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of WRITABLE_FIELDS) {
    if (source[field] !== undefined) out[field] = source[field];
  }
  return out;
}

/** Ownership ids needed by the access checks. */
const OWNERSHIP_INCLUDE = {
  Rental: { select: { managerId: true, ownerId: true, createdById: true } },
} as const;

/**
 * Read shape for the screening screens: the applicant's contact details, the
 * rental, and the screening / risk / background-check rows. Only display-safe
 * fields are selected (no password hashes, tokens, etc.). The Rental ownership
 * ids are still needed by `canAccessApplication` and are stripped by
 * `toReadShape` before the row is returned.
 */
const READ_INCLUDE = {
  User: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  Rental: {
    select: {
      id: true,
      title: true,
      address: true,
      city: true,
      state: true,
      unitNumber: true,
      rent: true,
      managerId: true,
      ownerId: true,
      createdById: true,
    },
  },
  Screening: { select: { status: true, reportUrl: true, createdAt: true, updatedAt: true } },
  RiskAssessment: { select: { score: true, details: true, createdAt: true, updatedAt: true } },
  BackgroundCheck: { select: { status: true, reportUrl: true, createdAt: true, updatedAt: true } },
} as const;

/** Risk `details` keys that are safe and useful to show in the UI. */
const RISK_DETAIL_KEYS = [
  'riskLevel',
  'creditScore',
  'monthlyIncome',
  'recommendation',
  'confidence',
  'factors',
] as const;

function toReadShape(row: any) {
  if (!row) return row;
  const { Rental, RiskAssessment, ...rest } = row;
  let risk = RiskAssessment ?? null;
  if (risk) {
    const raw = (risk.details && typeof risk.details === 'object' ? risk.details : {}) as Record<string, unknown>;
    const details: Record<string, unknown> = {};
    for (const key of RISK_DETAIL_KEYS) {
      if (raw[key] !== undefined) details[key] = raw[key];
    }
    risk = { ...risk, details };
  }
  let rental = Rental ?? null;
  if (rental) {
    const { managerId: _m, ownerId: _o, createdById: _c, ...safeRental } = rental;
    rental = safeRental;
  }
  return { ...rest, Rental: rental, RiskAssessment: risk };
}

class ApplicationController {
  async getAllApplications(req: Request, res: Response) {
    try {
      const applications = await prisma.application.findMany({
        where: applicationScopeFilter(req),
        include: READ_INCLUDE,
        orderBy: { appliedDate: 'desc' },
      });
      res.status(200).json(applications.map(toReadShape));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async createApplication(req: Request, res: Response) {
    try {
      const userId = currentUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'Not authorized' });
        return;
      }

      const body = req.body ?? {};
      const { rentalId } = body;
      if (!rentalId) {
        res.status(400).json({ error: 'rentalId is required' });
        return;
      }

      // Who is this application FOR? A resident may only apply as themselves.
      // An operator may file on behalf of a named applicant — but only for a
      // rental they control, which the access check below enforces.
      const requestedApplicantId = body.applicantId;
      const applicantId =
        isAdmin(req) && requestedApplicantId ? requestedApplicantId : userId;

      if (!isAdmin(req) && requestedApplicantId && requestedApplicantId !== userId) {
        res.status(403).json({ error: 'You may only apply as yourself' });
        return;
      }

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
        select: { managerId: true, ownerId: true, createdById: true },
      });
      if (!rental) {
        res.status(404).json({ error: 'Rental not found' });
        return;
      }

      // Who may apply to which rental:
      //   - a resident applying as THEMSELVES may apply to any rental that
      //     exists — that is the whole point of applying (they do not lease it
      //     yet, so any ownership check would be circular);
      //   - an operator filing on someone's behalf must control the rental;
      //   - an ADMIN may file for anyone, anywhere.
      const filingAsSelf = applicantId === userId;
      if (!filingAsSelf && !isAdmin(req)) {
        if (!canAccessRental(req, { ...rental, Leases: [], Applications: [] })) {
          res.status(403).json({ error: 'You do not have access to this rental' });
          return;
        }
      }

      if (filingAsSelf && !isAdmin(req) && !canWriteRentals(req)) {
        // A resident must at least be applying to a real, currently available
        // rental rather than one already taken off the market.
        const full = await prisma.rental.findUnique({
          where: { id: rentalId },
          select: { isAvailable: true, status: true },
        });
        if (full && (full.isAvailable === false || full.status !== 'ACTIVE')) {
          res.status(400).json({ error: 'This rental is not accepting applications' });
          return;
        }
      }

      const application = await prisma.application.create({
        data: {
          ...pickWritable(body),
          rentalId,
          applicantId,
        } as any,
      });

      // Best-effort notification; a push failure must not fail the request.
      try {
        const applicant = await prisma.user.findUnique({
          where: { id: application.applicantId },
          include: { Device: true },
        });
        if (applicant?.Device && applicant.Device.length > 0) {
          const device = applicant.Device[0];
          const pushToken = device.pushToken || '';
          const platform = device.deviceType || 'android';
          const title = 'Application Received';
          const bodyText = 'Your application has been received and is under review.';
          if (platform === 'ios') {
            await pushNotificationService.sendIOSNotification(pushToken, title, bodyText);
          } else {
            await pushNotificationService.sendAndroidNotification(pushToken, title, bodyText);
          }
        }
      } catch (notifyError) {
        console.warn('Application notification failed (application still created):', notifyError);
      }

      res.status(201).json(application);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        res.status(409).json({ error: 'You have already applied for this rental' });
        return;
      }
      if (error?.code === 'P2003' || error?.name === 'PrismaClientValidationError') {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }

  async getApplicationById(req: Request, res: Response) {
    try {
      const application = await prisma.application.findUnique({
        where: { id: req.params.id },
        include: READ_INCLUDE,
      });
      if (!application) {
        res.status(404).json({ message: 'Application not found' });
        return;
      }
      if (!canAccessApplication(req, application)) {
        res.status(403).json({ error: 'You do not have access to this application' });
        return;
      }
      res.status(200).json(toReadShape(application));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateApplication(req: Request, res: Response) {
    try {
      const existing = await prisma.application.findUnique({
        where: { id: req.params.id },
        include: OWNERSHIP_INCLUDE,
      });
      if (!existing) {
        res.status(404).json({ message: 'Application not found' });
        return;
      }
      if (!canModifyApplication(req, existing)) {
        res.status(403).json({ error: 'You do not have access to this application' });
        return;
      }

      const data = pickWritable(req.body);
      if (data.status !== undefined) {
        const valid = Object.values(ApplicationStatus) as string[];
        if (!valid.includes(String(data.status))) {
          res.status(400).json({ error: 'Invalid status' });
          return;
        }
      }

      const application = await prisma.application.update({
        where: { id: req.params.id },
        data: data as any,
      });
      res.status(200).json(application);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async deleteApplication(req: Request, res: Response) {
    try {
      const existing = await prisma.application.findUnique({
        where: { id: req.params.id },
        include: OWNERSHIP_INCLUDE,
      });
      if (!existing) {
        res.status(404).json({ message: 'Application not found' });
        return;
      }
      if (!canModifyApplication(req, existing)) {
        res.status(403).json({ error: 'You do not have access to this application' });
        return;
      }

      await prisma.application.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new ApplicationController();
