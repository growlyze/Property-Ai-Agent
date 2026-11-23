import api from './api';

/** Vendor self-service API calls. Every endpoint is scoped server-side to the signed-in vendor. */

export interface VendorStats {
  activeJobs: number;
  completedJobs: number;
  pendingQuotes: number;
  paidTotal: number;
  pendingPaymentTotal: number;
  averageRating: number | null;
}

export interface VendorProfile {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  specialty?: string | null;
  address?: string | null;
  certifications?: string[] | string | null;
  serviceAreas?: string[] | string | null;
  hourlyRate?: number | null;
  availability?: string | null;
  stats?: Partial<VendorStats> | null;
}

export interface VendorPayment {
  id: string;
  amount: number;
  status: string;
  paymentDate?: string | null;
  workOrder?: { id: string; title?: string | null } | null;
  rental?: { title?: string | null } | null;
}

export const vendorPortalService = {
  async getMe(): Promise<VendorProfile> {
    const res = await api.get('/vendors/me');
    return res.data?.data ?? res.data;
  },

  async getPayments(page = 1, limit = 50): Promise<{ data: VendorPayment[]; total: number }> {
    const res = await api.get('/vendor-payments/mine', { params: { page, limit } });
    const body = res.data;
    const data: VendorPayment[] = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
    return { data, total: Number(body?.total ?? data.length) };
  },
};

export default vendorPortalService;
