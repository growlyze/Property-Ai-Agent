import { Request, Response } from 'express';
import { PrismaClient, Prisma, DocumentType } from '@prisma/client';
import { currentUserId, isAdmin, isOperator } from '../utils/rentalAccess';

const prisma = new PrismaClient();

/**
 * GET /api/documents?page=&limit=&search=&type=&propertyId=&tenantId=&leaseId=&maintenanceId=&dateFrom=&dateTo=
 * Lists Document rows in the dashboard's `Document` shape as `{ data, total, page, limit }`.
 *
 * Visibility: ADMIN sees everything. Operators (manager/owner) see documents
 * on rentals they manage, own or created, plus their own uploads. Residents see
 * documents on their own leases/rentals plus their own uploads. Archived
 * documents are hidden.
 */

const INCLUDE = {
  User: { select: { firstName: true, lastName: true } },
  Rental: { select: { title: true } },
  Lease: { select: { tenantId: true, User: { select: { firstName: true, lastName: true } } } },
} as const;
type Row = Prisma.DocumentGetPayload<{ include: typeof INCLUDE }>;

function visibility(req: Request): Prisma.DocumentWhereInput | undefined {
  if (isAdmin(req)) return undefined;
  const userId = currentUserId(req);
  if (!userId) return { id: '__no_user__' };
  if (isOperator(req)) {
    return {
      OR: [
        { uploadedById: userId },
        { Rental: { OR: [{ managerId: userId }, { ownerId: userId }, { createdById: userId }] } },
        { Lease: { Rental: { OR: [{ managerId: userId }, { ownerId: userId }, { createdById: userId }] } } },
      ],
    };
  }
  return {
    OR: [
      { uploadedById: userId },
      { Lease: { tenantId: userId } },
      { Rental: { Leases: { some: { tenantId: userId } } } },
    ],
  };
}

function toDto(d: Row) {
  const ext = (d.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? d.mimeType?.split('/')[1] ?? 'file').toLowerCase();
  const tenant = d.Lease?.User;
  return {
    id: d.id,
    name: d.name,
    description: d.description ?? undefined,
    type: d.type,
    fileUrl: d.cdnUrl ?? d.url,
    fileType: ext,
    fileSize: d.size ?? 0,
    mimeType: d.mimeType ?? undefined,
    uploadedBy: d.uploadedById,
    uploadedByName: d.User ? `${d.User.firstName} ${d.User.lastName}`.trim() : undefined,
    propertyId: d.rentalId ?? undefined,
    propertyName: d.Rental?.title,
    leaseId: d.leaseId ?? undefined,
    tenantId: d.Lease?.tenantId,
    tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : undefined,
    maintenanceId: d.maintenanceRequestId ?? undefined,
    tags: [d.type.toLowerCase().replace(/_/g, ' ')],
    sharedWith: [],
    version: 1,
    permissions: 'shared',
    uploadedAt: d.uploadedAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

function parseDate(v: unknown): Date | undefined {
  if (typeof v !== 'string' || !v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function listDocuments(req: Request, res: Response) {
  try {
    const q = req.query;
    const page = Math.max(1, parseInt(String(q.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(q.limit ?? '10'), 10) || 10));
    const and: Prisma.DocumentWhereInput[] = [{ isArchived: false }];
    const scope = visibility(req);
    if (scope) and.push(scope);

    const str = (k: string) => (typeof q[k] === 'string' && q[k] ? String(q[k]) : undefined);
    const type = str('type')?.toUpperCase();
    if (type && (Object.values(DocumentType) as string[]).includes(type)) and.push({ type: type as DocumentType });
    if (str('propertyId')) and.push({ rentalId: str('propertyId') });
    if (str('leaseId')) and.push({ leaseId: str('leaseId') });
    if (str('tenantId')) and.push({ Lease: { tenantId: str('tenantId') } });
    if (str('maintenanceId')) and.push({ maintenanceRequestId: str('maintenanceId') });
    if (str('uploadedBy')) and.push({ uploadedById: str('uploadedBy') });
    const from = parseDate(q.dateFrom);
    const to = parseDate(q.dateTo);
    if (from || to) and.push({ uploadedAt: { ...(from && { gte: from }), ...(to && { lte: to }) } });
    const search = str('search');
    if (search) {
      and.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { Rental: { title: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }

    const where: Prisma.DocumentWhereInput = { AND: and };
    const [total, rows] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        include: INCLUDE,
        orderBy: { uploadedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    res.status(200).json({ data: rows.map(toDto), total, page, limit });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
