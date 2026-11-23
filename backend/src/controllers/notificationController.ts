import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { sendNotification } from '../services/notificationService';
import { currentUserId, isAdmin, isOperator } from '../utils/rentalAccess';

const prisma = new PrismaClient();

/**
 * In-app notifications (the `Notification` table) plus outbound sends.
 *
 * Every route requires a logged-in user (see notificationRoutes.ts). Before
 * this rewrite all four handlers were placeholders returning `{}`, and
 * `POST /api/notifications` was unauthenticated while calling
 * `sendNotification` (email/SMS) with a caller-chosen recipient, which made
 * the API an open message relay.
 *
 * Visibility: ADMIN sees every notification; everyone else sees only their own.
 */

const INCLUDE = { User: { select: { id: true, firstName: true, lastName: true } } } as const;
type Row = Prisma.NotificationGetPayload<{ include: typeof INCLUDE }>;

const TYPE_TITLES: Record<string, string> = {
  payment: 'Payment update',
  maintenance: 'Maintenance update',
  lease: 'Lease update',
  announcement: 'Announcement',
  system: 'System notice',
  message: 'New message',
  application: 'Application update',
};

/** The dashboard's Notification shape (services/dashboardService.ts). */
function toDto(n: Row) {
  const type = n.type.toLowerCase();
  const urgent = /overdue|failed|emergency|urgent|final notice/i.test(n.message);
  return {
    id: n.id,
    type,
    title: TYPE_TITLES[type] ?? 'Notification',
    message: n.message,
    link: n.link,
    isRead: n.isRead,
    recipientIds: [n.userId],
    recipientNames: n.User ? [`${n.User.firstName} ${n.User.lastName}`.trim()] : [],
    senderId: 'system',
    senderName: 'Growlyze',
    priority: urgent ? 'high' : 'medium',
    status: n.isRead ? 'delivered' : 'sent',
    sentAt: n.createdAt.toISOString(),
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.createdAt.toISOString(),
    deliveryCount: 1,
  };
}

class NotificationController {
  /** POST /api/notifications — operators only. Stores an in-app notification and, if a channel is given, sends it. */
  async createNotification(req: Request, res: Response) {
    try {
      if (!isOperator(req)) return res.status(403).json({ error: 'Not allowed to send notifications' });
      const { userId, message, type = 'system', link, channel, to, subject } = req.body ?? {};
      if (!userId || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'userId and message are required' });
      }
      const recipient = await prisma.user.findUnique({ where: { id: String(userId) }, select: { id: true } });
      if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

      const created = await prisma.notification.create({
        data: { userId: recipient.id, message: message.trim(), type: String(type).toUpperCase(), link: link ?? null },
        include: INCLUDE,
      });
      if (channel && to) {
        await sendNotification(channel, to, subject ?? TYPE_TITLES[String(type).toLowerCase()] ?? 'Notification', message);
      }
      res.status(201).json(toDto(created));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** GET /api/notifications?page=&limit=&search=&type=&status= — `{ data, total, page, limit, unread }`. */
  async listNotifications(req: Request, res: Response) {
    try {
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10) || 10));
      const and: Prisma.NotificationWhereInput[] = [];
      if (!isAdmin(req)) and.push({ userId: currentUserId(req) ?? '__no_user__' });
      if (typeof req.query.type === 'string' && req.query.type) and.push({ type: req.query.type.toUpperCase() });
      if (req.query.status === 'delivered') and.push({ isRead: true });
      if (req.query.status === 'sent') and.push({ isRead: false });
      if (typeof req.query.search === 'string' && req.query.search.trim()) {
        and.push({ message: { contains: req.query.search.trim(), mode: 'insensitive' } });
      }
      const where: Prisma.NotificationWhereInput = and.length ? { AND: and } : {};

      const [total, unread, rows] = await Promise.all([
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { AND: [where, { isRead: false }] } }),
        prisma.notification.findMany({
          where,
          include: INCLUDE,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);
      res.status(200).json({ data: rows.map(toDto), total, page, limit, unread });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** GET /api/notifications/:userId — that user's notifications (self or ADMIN only). */
  async getNotifications(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      if (!isAdmin(req) && currentUserId(req) !== userId) {
        return res.status(403).json({ error: 'You can only read your own notifications' });
      }
      const rows = await prisma.notification.findMany({
        where: { userId },
        include: INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      res.status(200).json(rows.map(toDto));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** PUT /api/notifications/:id/read — the recipient (or ADMIN) marks it read. */
  async markAsRead(req: Request, res: Response) {
    try {
      const existing = await prisma.notification.findUnique({ where: { id: req.params.id } });
      if (!existing || (!isAdmin(req) && existing.userId !== currentUserId(req))) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      const updated = await prisma.notification.update({
        where: { id: existing.id },
        data: { isRead: true },
        include: INCLUDE,
      });
      res.status(200).json(toDto(updated));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new NotificationController();
