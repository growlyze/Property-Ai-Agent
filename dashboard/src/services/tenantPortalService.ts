import api from './api';

/** Tenant self-service API calls. Every endpoint is scoped server-side to the signed-in tenant. */

export interface Paged<T> {
  data: T[];
  total: number;
  page?: number;
  limit?: number;
}

export interface TenantRental {
  id: string;
  title?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  unitNumber?: string | null;
}

export interface TenantLease {
  id: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  securityDeposit?: number | null;
  status: string;
  rental: TenantRental | null;
}

export interface TenantSummary {
  lease: TenantLease | null;
  nextPayment: { dueDate: string; amount: number } | null;
  balanceDue: number;
  openMaintenance: number;
  unreadNotifications: number;
}

export interface TenantPayment {
  id: string;
  amount: number;
  paymentMethod?: string | null;
  paymentDate: string;
  status: string;
  notes?: string | null;
  leaseDetails?: string | null;
  type?: string | null;
}

export interface TenantMaintenanceRequest {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt?: string;
  scheduledDate?: string | null;
  completedDate?: string | null;
  Rental?: TenantRental | null;
}

export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';

export interface NewMaintenanceRequest {
  title: string;
  description: string;
  priority: MaintenancePriority;
}

export interface TenantDocument {
  id: string;
  name: string;
  description?: string | null;
  type?: string | null;
  fileUrl?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  propertyName?: string | null;
  uploadedAt?: string | null;
  updatedAt?: string | null;
}

export interface PortalNotification {
  id: string;
  type?: string;
  title: string;
  message: string;
  isRead?: boolean;
  priority?: string;
  sentAt?: string | null;
  createdAt: string;
}

export interface NotificationPage extends Paged<PortalNotification> {
  unread?: number;
}

export function toPaged<T>(body: any): Paged<T> {
  const data: T[] = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
  return { data, total: Number(body?.total ?? data.length), page: body?.page, limit: body?.limit };
}

export const tenantPortalService = {
  async getSummary(): Promise<TenantSummary> {
    const res = await api.get('/tenant/me/summary');
    return res.data?.data ?? res.data;
  },

  async getPayments(page = 1, limit = 20): Promise<Paged<TenantPayment>> {
    const res = await api.get('/payments', { params: { page, limit } });
    return toPaged<TenantPayment>(res.data);
  },

  async getMaintenance(page = 1, limit = 20): Promise<Paged<TenantMaintenanceRequest>> {
    const res = await api.get('/maintenance', { params: { page, limit } });
    return toPaged<TenantMaintenanceRequest>(res.data);
  },

  async createMaintenance(body: NewMaintenanceRequest): Promise<TenantMaintenanceRequest> {
    const res = await api.post('/maintenance', body);
    return res.data?.data ?? res.data;
  },

  async getDocuments(page = 1, limit = 50): Promise<Paged<TenantDocument>> {
    const res = await api.get('/documents', { params: { page, limit } });
    return toPaged<TenantDocument>(res.data);
  },

  async getNotifications(page = 1, limit = 20): Promise<NotificationPage> {
    const res = await api.get('/notifications', { params: { page, limit } });
    return { ...toPaged<PortalNotification>(res.data), unread: res.data?.unread };
  },

  async markNotificationRead(id: string): Promise<void> {
    await api.put(`/notifications/${id}/read`);
  },
};

export default tenantPortalService;
