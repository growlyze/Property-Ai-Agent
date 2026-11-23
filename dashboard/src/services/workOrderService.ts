import api from './api';

/** Work orders (GET/POST/PATCH /api/work-orders). Used by the staff list and the vendor portal. */

export type WorkOrderStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type WorkOrderPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
export type QuoteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | string;

export const WORK_ORDER_STATUSES: WorkOrderStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

export interface WorkOrderQuote {
  id: string;
  vendorId: string;
  vendorName?: string | null;
  amount: number;
  details?: string | null;
  status: QuoteStatus;
  createdAt: string;
}

export interface WorkOrderItem {
  id: string;
  title: string;
  description?: string | null;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string | null;
  scheduledFor?: string | null;
  rental?: { id: string; title?: string | null; address?: string | null; city?: string | null; unitNumber?: string | null } | null;
  maintenanceRequest?: { id: string; title?: string | null; status?: string | null } | null;
  vendors?: { id: string; name: string; specialty?: string | null }[];
  quotes?: WorkOrderQuote[];
}

export interface WorkOrderPage {
  data: WorkOrderItem[];
  total: number;
  page?: number;
  limit?: number;
}

export interface WorkOrderQuery {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const workOrderService = {
  async list(q: WorkOrderQuery = {}): Promise<WorkOrderPage> {
    const params: Record<string, any> = { page: q.page ?? 1, limit: q.limit ?? 20 };
    if (q.status) params.status = q.status;
    if (q.search) params.search = q.search;
    const res = await api.get('/work-orders', { params });
    const body = res.data;
    const data: WorkOrderItem[] = Array.isArray(body?.data) ? body.data : [];
    return { data, total: Number(body?.total ?? data.length), page: body?.page, limit: body?.limit };
  },

  async get(id: string): Promise<WorkOrderItem> {
    const res = await api.get(`/work-orders/${id}`);
    return res.data?.data ?? res.data;
  },

  async create(body: { maintenanceRequestId: string; vendorId?: string; notes?: string }): Promise<WorkOrderItem> {
    const res = await api.post('/work-orders', body);
    return res.data?.data ?? res.data;
  },

  async updateStatus(id: string, status: WorkOrderStatus): Promise<WorkOrderItem> {
    const res = await api.patch(`/work-orders/${id}/status`, { status });
    return res.data?.data ?? res.data;
  },

  async submitQuote(id: string, body: { amount: number; details?: string }): Promise<WorkOrderQuote> {
    const res = await api.post(`/work-orders/${id}/quotes`, body);
    return res.data?.data ?? res.data;
  },

  async decideQuote(quoteId: string, status: 'ACCEPTED' | 'REJECTED'): Promise<WorkOrderQuote> {
    const res = await api.patch(`/work-orders/quotes/${quoteId}`, { status });
    return res.data?.data ?? res.data;
  },
};

/** Best-effort readable message from an axios error. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = err as any;
  return e?.response?.data?.message || e?.response?.data?.error || e?.message || fallback;
}

/** True when the endpoint is not deployed yet (404 from the API). */
export const isNotFound = (err: unknown) => (err as any)?.response?.status === 404;

export default workOrderService;
