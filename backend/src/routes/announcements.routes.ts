import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { LeaseStatus, Prisma, UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/authMiddleware';
import { currentUserId, isOperator, rentalScopeFilter } from '../utils/rentalAccess';

/**
 * /api/announcements — staff announcements delivered as in-app notifications.
 *
 * There is no Announcement table: publishing writes one `Notification` (type ANNOUNCEMENT)
 * per recipient, which is what tenants and staff see in their notification lists.
 * Drafts (created but not yet published) are held in memory for this process only.
 *
 *   POST  /api/announcements              create a draft  { title, content, recipientGroups, propertyIds, tenantIds, priority }
 *   PATCH /api/announcements/:id/publish  deliver it
 *   GET   /api/announcements/:id          read a draft
 *
 * Only operators (admin / property manager) may use it; property and tenant targets are
 * limited to the caller's own rentals (utils/rentalAccess.ts).
 */

interface Draft {
  id: string;
  title: string;
  content: string;
  priority: string;
  recipientGroups: string[];
  propertyIds: string[];
  tenantIds: string[];
  createdById: string;
  createdAt: string;
  status: 'draft' | 'published';
  recipientCount?: number;
  publishedAt?: string;
}

const drafts = new Map<string, Draft>();
const GROUPS = new Set(['all-tenants', 'property-managers', 'maintenance-staff']);
const PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);

const strList = (v: unknown, max = 200) =>
  Array.isArray(v) ? [...new Set(v.map(String).filter(Boolean))].slice(0, max) : [];

const router = Router();

router.use(authMiddleware.protect, (req: Request, res: Response, next) => {
  if (!isOperator(req)) return res.status(403).json({ error: 'Not allowed to send announcements' });
  next();
});

router.post('/', (req: Request, res: Response) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });
  if (title.length > 200 || content.length > 5000) return res.status(400).json({ error: 'Announcement is too long' });
  if (req.body?.scheduledAt && new Date(req.body.scheduledAt).getTime() > Date.now() + 60_000) {
    return res.status(400).json({ error: 'Scheduled announcements are not supported yet. Publish now instead.' });
  }

  const draft: Draft = {
    id: randomUUID(),
    title,
    content,
    priority: PRIORITIES.has(String(req.body?.priority)) ? String(req.body.priority) : 'medium',
    recipientGroups: strList(req.body?.recipientGroups).filter((g) => GROUPS.has(g)),
    propertyIds: strList(req.body?.propertyIds),
    tenantIds: strList(req.body?.tenantIds),
    createdById: currentUserId(req) as string,
    createdAt: new Date().toISOString(),
    status: 'draft',
  };
  if (!draft.recipientGroups.length && !draft.propertyIds.length && !draft.tenantIds.length) {
    return res.status(400).json({ error: 'Choose at least one recipient' });
  }
  drafts.set(draft.id, draft);
  res.status(201).json(draft);
});

router.get('/:id', (req: Request, res: Response) => {
  const d = drafts.get(String(req.params.id));
  if (!d || d.createdById !== currentUserId(req)) return res.status(404).json({ error: 'Announcement not found' });
  res.json(d);
});

router.patch('/:id/publish', async (req: Request, res: Response) => {
  const d = drafts.get(String(req.params.id));
  if (!d || d.createdById !== currentUserId(req)) return res.status(404).json({ error: 'Announcement not found' });
  if (d.status === 'published') return res.json(d);

  try {
    // Rentals the caller may address (admins: all).
    const scope = rentalScopeFilter(req) as Prisma.RentalWhereInput | undefined;
    const activeLease: Prisma.LeaseWhereInput = { status: LeaseStatus.ACTIVE, Rental: scope ?? {} };

    const recipients = new Set<string>();
    if (d.recipientGroups.includes('all-tenants') || d.propertyIds.length || d.tenantIds.length) {
      const leases = await prisma.lease.findMany({
        where: {
          AND: [
            activeLease,
            d.recipientGroups.includes('all-tenants')
              ? {}
              : {
                  OR: [
                    ...(d.propertyIds.length ? [{ rentalId: { in: d.propertyIds } }] : []),
                    ...(d.tenantIds.length ? [{ tenantId: { in: d.tenantIds } }] : []),
                  ],
                },
          ],
        },
        select: { tenantId: true },
      });
      leases.forEach((l) => recipients.add(l.tenantId));
      // Tenants picked by name who have no active lease yet still get it, if they are tenants.
      if (d.tenantIds.length) {
        const users = await prisma.user.findMany({
          where: { id: { in: d.tenantIds }, role: UserRole.TENANT, isActive: true },
          select: { id: true },
        });
        // Non-admins may only reach tenants that lease one of their rentals (handled above).
        if (!scope) users.forEach((u) => recipients.add(u.id));
      }
    }
    if (d.recipientGroups.includes('property-managers')) {
      (await prisma.user.findMany({ where: { role: UserRole.PROPERTY_MANAGER, isActive: true }, select: { id: true } })).forEach(
        (u) => recipients.add(u.id)
      );
    }
    if (d.recipientGroups.includes('maintenance-staff')) {
      (await prisma.user.findMany({ where: { role: UserRole.VENDOR, isActive: true }, select: { id: true } })).forEach((u) =>
        recipients.add(u.id)
      );
    }
    recipients.delete(d.createdById);
    if (recipients.size === 0) return res.status(400).json({ error: 'No one matches the chosen recipients' });

    const message = `${d.title}: ${d.content}`.slice(0, 5000);
    await prisma.notification.createMany({
      data: [...recipients].map((userId) => ({ userId, message, type: 'ANNOUNCEMENT' })),
    });
    d.status = 'published';
    d.recipientCount = recipients.size;
    d.publishedAt = new Date().toISOString();
    res.json(d);
  } catch (error) {
    res.status(500).json({ error: 'Failed to publish announcement' });
  }
});

export default router;
