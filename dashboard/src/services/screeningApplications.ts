import api from './api';

/**
 * Rental applications as returned by GET /api/applications(/:id): the
 * application plus applicant contact, rental, and the screening / risk /
 * background-check rows. Used by /tenant-screening, its detail page and
 * /ai-risk-assessment.
 *
 * Older backends return the bare application row (no relations), so every
 * relation is optional and the helpers below fall back gracefully.
 */
export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface ScreeningApplication {
  id: string;
  rentalId: string;
  applicantId: string;
  status: ApplicationStatus;
  notes?: string | null;
  appliedDate: string;
  createdAt: string;
  updatedAt: string;
  User?: { id: string; firstName: string; lastName: string; email: string; phone?: string | null } | null;
  Rental?: {
    id: string;
    title: string;
    address: string;
    city: string;
    state: string;
    unitNumber?: string | null;
    rent?: number | null;
  } | null;
  Screening?: { status: string; reportUrl?: string | null; createdAt: string; updatedAt: string } | null;
  BackgroundCheck?: { status: string; reportUrl?: string | null; createdAt: string; updatedAt: string } | null;
  RiskAssessment?: {
    score: number;
    details?: {
      riskLevel?: string;
      creditScore?: number;
      monthlyIncome?: number;
      recommendation?: string;
      confidence?: number;
      factors?: string[];
    } | null;
    createdAt: string;
    updatedAt: string;
  } | null;
}

export async function fetchApplications(): Promise<ScreeningApplication[]> {
  const { data } = await api.get<ScreeningApplication[]>('/applications');
  return Array.isArray(data) ? data : [];
}

export async function fetchApplication(id: string): Promise<ScreeningApplication> {
  const { data } = await api.get<ScreeningApplication>(`/applications/${id}`);
  return data;
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
  notes?: string,
): Promise<void> {
  await api.put(`/applications/${id}`, notes !== undefined ? { status, notes } : { status });
}

// ---- display helpers --------------------------------------------------------

export const applicantName = (a: ScreeningApplication) =>
  a.User ? `${a.User.firstName} ${a.User.lastName}`.trim() : 'Applicant';

export const rentalLabel = (a: ScreeningApplication) => a.Rental?.title ?? 'Rental';

export const rentalAddress = (a: ScreeningApplication) =>
  a.Rental ? `${a.Rental.address}, ${a.Rental.city}, ${a.Rental.state}` : '';

export const money = (n?: number | null) =>
  typeof n === 'number' && Number.isFinite(n)
    ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    : '—';

export const formatDate = (s?: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/** "Today", "Yesterday", "3 days ago", or a date for anything older than 30 days. */
export const relativeDate = (s?: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return formatDate(s);
};

/** Title-case an enum-ish value: "REVIEW_REQUIRED" -> "Review required". */
export const pretty = (s?: string | null) =>
  s ? s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : '—';

export const STATUS_COLOR: Record<string, 'warning' | 'success' | 'error' | 'default'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  WITHDRAWN: 'default',
};

/** Colour for screening / background-check statuses. */
export const checkColor = (s?: string | null): 'success' | 'warning' | 'error' | 'info' | 'default' => {
  switch ((s ?? '').toUpperCase()) {
    case 'COMPLETED':
    case 'CLEAR':
      return 'success';
    case 'IN_PROGRESS':
      return 'info';
    case 'PENDING':
      return 'warning';
    case 'FLAGGED':
    case 'FAILED':
    case 'REVIEW_REQUIRED':
      return 'error';
    default:
      return 'default';
  }
};

/**
 * Risk score is 0–100 where HIGHER means riskier. The stored level wins; when
 * it is missing we derive it from the score.
 */
export const riskLevel = (a: ScreeningApplication): RiskLevel | null => {
  const r = a.RiskAssessment;
  if (!r) return null;
  const stored = String(r.details?.riskLevel ?? '').toLowerCase();
  if (stored === 'low' || stored === 'medium' || stored === 'high') return stored;
  if (r.score >= 60) return 'high';
  if (r.score >= 35) return 'medium';
  return 'low';
};

export const RISK_COLOR: Record<RiskLevel, 'success' | 'warning' | 'error'> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
};

/** Confidence may arrive as 0–1 or 0–100; always return a whole percentage. */
export const confidencePct = (v?: number | null): number | null => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.round(v <= 1 ? v * 100 : v);
};

export const RECOMMENDATION_LABEL: Record<string, string> = {
  APPROVE: 'Approve',
  APPROVE_WITH_CONDITIONS: 'Approve with conditions',
  REQUIRE_GUARANTOR: 'Require a guarantor',
  DECLINE: 'Decline',
};

export const recommendationLabel = (s?: string | null) => (s ? RECOMMENDATION_LABEL[s] ?? pretty(s) : '—');

export const creditColor = (n?: number | null) =>
  typeof n !== 'number' ? 'text.secondary' : n >= 700 ? 'success.main' : n >= 620 ? 'warning.main' : 'error.main';

/** Income-to-rent multiple, e.g. 2.9 (or null if either side is unknown). */
export const incomeMultiple = (a: ScreeningApplication): number | null => {
  const income = a.RiskAssessment?.details?.monthlyIncome;
  const rent = a.Rental?.rent;
  if (typeof income !== 'number' || typeof rent !== 'number' || rent <= 0) return null;
  return Math.round((income / rent) * 10) / 10;
};
