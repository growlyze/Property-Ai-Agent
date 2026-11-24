import { Router, Request, Response } from 'express';
import multer from 'multer';
import { Prisma, User, UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/authMiddleware';

/**
 * Direct messages between users, grouped into conversations by `Message.conversationId`.
 *
 *   GET   /api/message-threads            conversations the caller takes part in (admins: all)
 *   GET   /api/message-threads/:id        one conversation and its messages
 *   POST  /api/messages                   send (JSON or multipart without files)
 *   PATCH /api/messages/:id/read          mark a message addressed to the caller as read
 *
 * Scope: a user only ever sees messages they sent or received; ADMIN sees every conversation.
 */

const upload = multer({ limits: { fileSize: 1, files: 0 } });

const USER_SELECT = { id: true, firstName: true, lastName: true, role: true } as const;
const MESSAGE_INCLUDE = {
  User_Message_senderIdToUser: { select: USER_SELECT },
  User_Message_receiverIdToUser: { select: USER_SELECT },
  MaintenanceRequest: { select: { id: true, title: true } },
} as const;

type MessageRow = Prisma.MessageGetPayload<{ include: typeof MESSAGE_INCLUDE }>;

const fullName = (u?: { firstName?: string | null; lastName?: string | null } | null) =>
  [u?.firstName, u?.lastName].filter(Boolean).join(' ') || 'Unknown user';

const me = (req: Request) => req.user as User;
const isAdmin = (req: Request) => me(req).role === UserRole.ADMIN;

/** Messages the caller may see. */
const scopeWhere = (req: Request): Prisma.MessageWhereInput =>
  isAdmin(req) ? {} : { OR: [{ senderId: me(req).id }, { receiverId: me(req).id }] };

const threadKey = (m: { id: string; conversationId: string | null }) => m.conversationId ?? `single-${m.id}`;

function messageDto(m: MessageRow, viewerId: string) {
  return {
    id: m.id,
    threadId: threadKey(m),
    senderId: m.senderId,
    senderName: fullName(m.User_Message_senderIdToUser),
    senderRole: m.User_Message_senderIdToUser?.role,
    recipientIds: [m.receiverId],
    recipientNames: [fullName(m.User_Message_receiverIdToUser)],
    subject: m.MaintenanceRequest?.title ?? '',
    content: m.content,
    isRead: Boolean(m.readAt) || m.senderId === viewerId,
    readAt: m.readAt?.toISOString(),
    sentAt: m.sentAt.toISOString(),
    updatedAt: (m.readAt ?? m.sentAt).toISOString(),
    isMine: m.senderId === viewerId,
    attachments: [],
    hasAttachments: false,
  };
}

function threadDto(id: string, msgs: MessageRow[], viewerId: string) {
  const sorted = [...msgs].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const people = new Map<string, string>();
  for (const m of sorted) {
    people.set(m.senderId, fullName(m.User_Message_senderIdToUser));
    people.set(m.receiverId, fullName(m.User_Message_receiverIdToUser));
  }
  // Show the other party first so the inbox reads "conversation with …".
  const ids = [...people.keys()].sort((a, b) => (a === viewerId ? 1 : 0) - (b === viewerId ? 1 : 0));
  const subject =
    sorted.find((m) => m.MaintenanceRequest?.title)?.MaintenanceRequest?.title ??
    (first.content.length > 60 ? `${first.content.slice(0, 57)}…` : first.content);
  return {
    id,
    subject,
    participants: ids,
    participantNames: ids.map((i) => people.get(i) as string),
    lastMessageAt: last.sentAt.toISOString(),
    lastMessagePreview: last.content.length > 120 ? `${last.content.slice(0, 117)}…` : last.content,
    lastMessageSender: fullName(last.User_Message_senderIdToUser),
    unreadCount: sorted.filter((m) => m.receiverId === viewerId && !m.readAt).length,
    messageCount: sorted.length,
    createdAt: first.sentAt.toISOString(),
    updatedAt: last.sentAt.toISOString(),
  };
}

export const threadsRouter = Router();
export const messagesRouter = Router();

threadsRouter.get('/', authMiddleware.protect, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

    const rows = await prisma.message.findMany({
      where: scopeWhere(req),
      include: MESSAGE_INCLUDE,
      orderBy: { sentAt: 'desc' },
      take: 2000,
    });
    const groups = new Map<string, MessageRow[]>();
    for (const m of rows) {
      const k = threadKey(m);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(m);
    }
    let threads = [...groups.entries()].map(([id, msgs]) => threadDto(id, msgs, me(req).id));
    if (search) {
      threads = threads.filter((t) =>
        [t.subject, t.lastMessagePreview, ...(t.participantNames ?? [])].some((s) => s.toLowerCase().includes(search))
      );
    }
    threads.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    res.json({ data: threads.slice((page - 1) * limit, page * limit), total: threads.length, page, limit });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load conversations' });
  }
});

threadsRouter.get('/:id', authMiddleware.protect, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const idWhere: Prisma.MessageWhereInput = id.startsWith('single-') ? { id: id.slice(7) } : { conversationId: id };
    const msgs = await prisma.message.findMany({
      where: { AND: [idWhere, scopeWhere(req)] },
      include: MESSAGE_INCLUDE,
      orderBy: { sentAt: 'asc' },
    });
    if (msgs.length === 0) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ thread: threadDto(id, msgs, me(req).id), messages: msgs.map((m) => messageDto(m, me(req).id)) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load conversation' });
  }
});

messagesRouter.post('/', authMiddleware.protect, upload.none(), async (req: Request, res: Response) => {
  try {
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    if (!content) return res.status(400).json({ error: 'Message content is required' });
    if (content.length > 5000) return res.status(400).json({ error: 'Message is too long' });

    let recipientIds: string[] = [];
    const raw = req.body?.recipientIds;
    if (Array.isArray(raw)) recipientIds = raw.map(String);
    else if (typeof raw === 'string' && raw) {
      try {
        const parsed = JSON.parse(raw);
        recipientIds = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
      } catch {
        recipientIds = [raw];
      }
    }
    const threadId = typeof req.body?.threadId === 'string' && req.body.threadId ? req.body.threadId : undefined;

    // Replying in a thread: the recipient is the other participant, and the caller must be in it.
    let conversationId: string | undefined;
    if (threadId) {
      const idWhere: Prisma.MessageWhereInput = threadId.startsWith('single-')
        ? { id: threadId.slice(7) }
        : { conversationId: threadId };
      // Admins may reply in any conversation (they can read all of them); everyone else only in their own.
      const prior = await prisma.message.findFirst({
        where: { AND: [idWhere, scopeWhere(req)] },
        orderBy: { sentAt: 'desc' },
        include: MESSAGE_INCLUDE,
      });
      if (!prior) return res.status(404).json({ error: 'Conversation not found' });
      conversationId = prior.conversationId ?? undefined;
      if (!conversationId) {
        conversationId = `conv-${prior.id}`;
        await prisma.message.update({ where: { id: prior.id }, data: { conversationId } });
      }
      // In a thread the recipient is always derived from the thread, whatever the client sent,
      // so a reply never fans out to every participant.
      {
        const participant = prior.senderId === me(req).id || prior.receiverId === me(req).id;
        if (participant) {
          recipientIds = [prior.senderId === me(req).id ? prior.receiverId : prior.senderId];
        } else {
          // Admin joining someone else's conversation: write to the tenant side of it.
          const tenantSide =
            prior.User_Message_senderIdToUser?.role === UserRole.TENANT ? prior.senderId : prior.receiverId;
          recipientIds = [tenantSide];
        }
      }
    }

    recipientIds = [...new Set(recipientIds)].filter((r) => r && r !== me(req).id).slice(0, 50);
    if (recipientIds.length === 0) return res.status(400).json({ error: 'Choose at least one recipient' });
    const found = await prisma.user.findMany({ where: { id: { in: recipientIds }, isActive: true }, select: { id: true } });
    if (found.length !== recipientIds.length) return res.status(400).json({ error: 'Unknown recipient' });

    const created: MessageRow[] = [];
    for (const receiverId of recipientIds) {
      const m = await prisma.message.create({
        data: {
          content,
          senderId: me(req).id,
          receiverId,
          conversationId: conversationId ?? `conv-${me(req).id.slice(-6)}-${receiverId.slice(-6)}-${Date.now()}`,
        },
        include: MESSAGE_INCLUDE,
      });
      created.push(m);
    }
    res.status(201).json(messageDto(created[0], me(req).id));
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

messagesRouter.patch('/:id/read', authMiddleware.protect, async (req: Request, res: Response) => {
  try {
    const msg = await prisma.message.findFirst({ where: { id: String(req.params.id), receiverId: me(req).id } });
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    const updated = await prisma.message.update({
      where: { id: msg.id },
      data: { readAt: msg.readAt ?? new Date() },
      include: MESSAGE_INCLUDE,
    });
    res.json(messageDto(updated, me(req).id));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update message' });
  }
});
