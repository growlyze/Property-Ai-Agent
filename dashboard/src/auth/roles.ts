/**
 * Role policy: the single source of truth for who can open which page and
 * what each role sees in the navigation. Both the route guard
 * (components/ProtectedRoute) and the menu (components/Layout) read from here.
 *
 * | Role                    | Experience                                         |
 * |-------------------------|----------------------------------------------------|
 * | ADMIN                   | Full staff dashboard + admin-only pages            |
 * | PROPERTY_MANAGER, OWNER | Full staff dashboard, no admin-only pages          |
 * | TENANT                  | Tenant portal (/ , /my/*)                          |
 * | VENDOR                  | Vendor portal (/ , /vendor/*, /my/notifications)   |
 */
import {
  Dashboard as DashboardIcon,
  Analytics as AnalyticsIcon,
  Build as BuildIcon,
  Apartment as ApartmentIcon,
  People as PeopleIcon,
  AccountBalance as AccountBalanceIcon,
  Campaign as CampaignIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Description as DescriptionIcon,
  Warning as WarningIcon,
  Email as EmailIcon,
  Security as SecurityIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  Hub as HubIcon,
  RateReview as RateReviewIcon,
  PhoneIphone as PhoneIphoneIcon,
  Home as HomeIcon,
  Payments as PaymentsIcon,
  Handyman as HandymanIcon,
  FolderOpen as FolderOpenIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { createNavigationItem, type NavigationItem } from '../design-system/navigation';

export type Role = 'ADMIN' | 'PROPERTY_MANAGER' | 'OWNER' | 'TENANT' | 'VENDOR';

export const ROLES = {
  ADMIN: 'ADMIN',
  PROPERTY_MANAGER: 'PROPERTY_MANAGER',
  OWNER: 'OWNER',
  TENANT: 'TENANT',
  VENDOR: 'VENDOR',
} as const;

/** Roles that get the operator (staff) dashboard. */
export const STAFF_ROLES: readonly Role[] = ['ADMIN', 'PROPERTY_MANAGER', 'OWNER'];
export const ADMIN_ROLES: readonly Role[] = ['ADMIN'];

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  PROPERTY_MANAGER: 'Property manager',
  OWNER: 'Owner',
  TENANT: 'Tenant',
  VENDOR: 'Vendor',
};

export function normalizeRole(role?: string | null): Role | null {
  const r = String(role ?? '').trim().toUpperCase();
  return (r in ROLE_LABELS ? (r as Role) : null);
}

export const roleLabel = (role?: string | null): string => {
  const r = normalizeRole(role);
  return r ? ROLE_LABELS[r] : 'User';
};

export const isStaff = (role?: string | null) => {
  const r = normalizeRole(role);
  return !!r && STAFF_ROLES.includes(r);
};
export const isAdmin = (role?: string | null) => normalizeRole(role) === 'ADMIN';
export const isTenant = (role?: string | null) => normalizeRole(role) === 'TENANT';
export const isVendor = (role?: string | null) => normalizeRole(role) === 'VENDOR';

/** Staff pages only ADMIN may open (each also covers its sub-paths). */
export const ADMIN_ONLY_PATHS = [
  '/access-control',
  '/security-settings',
  '/roles',
  '/users',
  '/permissions',
  '/user-management',
  '/user-invitations',
  '/ux-review',
  '/mobile-audit',
  '/external-integrations',
  '/forms-showcase',
  '/ai-components-demo',
  '/document-verification-demo',
];

/** Portal pages. Staff do not use these (they have their own versions). */
export const TENANT_PATHS = ['/my/payments', '/my/maintenance', '/my/documents', '/my/notifications'];
export const VENDOR_PATHS = ['/vendor/jobs', '/vendor/payments', '/my/notifications'];
const PORTAL_PREFIXES = ['/my', '/vendor'];

/** path === base, or path is under base ("/vendor" matches "/vendor/jobs" but not "/vendor-bidding"). */
const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

const normalizePath = (path: string) => {
  const p = (path || '/').split(/[?#]/)[0];
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
};

/** Can this role open this path? Unknown roles may only see "/". */
export function canAccess(role: string | null | undefined, path: string): boolean {
  const r = normalizeRole(role);
  const p = normalizePath(path);
  if (p === '/') return true;
  if (!r) return false;

  if (r === 'TENANT') return TENANT_PATHS.some((base) => under(p, base));
  if (r === 'VENDOR') return VENDOR_PATHS.some((base) => under(p, base));

  // Staff
  if (PORTAL_PREFIXES.some((base) => under(p, base))) return false;
  if (ADMIN_ONLY_PATHS.some((base) => under(p, base))) return r === 'ADMIN';
  return true;
}

/** Where a role lands after login. Every role's home is "/", which renders a role-specific page. */
export function homePathFor(_role?: string | null): string {
  return '/';
}

/** Notifications inbox for a role. */
export function notificationsPathFor(role?: string | null): string {
  return isStaff(role) ? '/notifications' : '/my/notifications';
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

type Section = NonNullable<NavigationItem['section']>;
const nav = (
  id: string,
  label: string,
  icon: NavigationItem['icon'],
  href: string,
  section: Section,
  extra: Partial<NavigationItem> = {},
) => createNavigationItem({ id, label, icon, href, section, ...extra });

/** Master staff menu. Filtered per role by canAccess(). */
const STAFF_NAV: NavigationItem[] = [
  nav('dashboard', 'Dashboard', DashboardIcon, '/', 'main', { description: 'Overview and key metrics', mobileTab: true }),
  nav('properties', 'Properties', ApartmentIcon, '/properties', 'main', { description: 'Property listings and management', mobileTab: true }),
  nav('maintenance', 'Maintenance', BuildIcon, '/maintenance', 'main', { description: 'Maintenance requests and tracking', mobileTab: true }),
  nav('communications', 'Communications', CampaignIcon, '/communications', 'main', { description: 'Message center and notifications', mobileTab: true }),
  nav('analytics', 'AI Insights', AnalyticsIcon, '/ai-insights', 'main', { description: 'Analytics and AI-powered insights', mobileTab: true }),

  nav('tenants', 'Tenants', PeopleIcon, '/tenants', 'management', { description: 'Tenant management' }),
  nav('leases', 'Leases', DescriptionIcon, '/leases', 'management', { description: 'Lease management and tracking' }),
  nav('payments', 'Payments', AccountBalanceIcon, '/payments', 'management', { description: 'Payment records and processing' }),
  nav('maintenance-requests', 'Maintenance Requests', BuildIcon, '/maintenance-requests', 'management', { description: 'Maintenance request records' }),
  nav('work-orders', 'Work Orders', AssignmentIcon, '/work-orders', 'management', { description: 'Vendor work orders and quotes' }),
  nav('documents', 'Documents', FolderOpenIcon, '/documents', 'management', {
    description: 'Document upload and management',
    children: [
      nav('documents-list', 'All Documents', DescriptionIcon, '/documents', 'management'),
      nav('documents-search', 'Search Documents', DescriptionIcon, '/documents/search', 'management'),
    ],
  }),
  nav('messages', 'Messages', EmailIcon, '/messages', 'management', { description: 'Tenant messaging' }),
  nav('notifications', 'Notifications', NotificationsIcon, '/notifications', 'management', {
    description: 'Notifications and announcements',
    children: [
      nav('notifications-list', 'All Notifications', NotificationsIcon, '/notifications', 'management'),
      nav('notifications-compose', 'Create Announcement', NotificationsIcon, '/notifications/compose', 'management'),
      nav('notifications-templates', 'Templates', NotificationsIcon, '/notifications/templates', 'management'),
    ],
  }),
  nav('tenant-management', 'Tenant Screening', PeopleIcon, '/tenant-screening', 'management', { description: 'Applications and screening' }),
  nav('analytics-dashboard', 'Analytics Dashboard', AnalyticsIcon, '/analytics-dashboard', 'management'),
  nav('overdue-payments', 'Overdue Payments', WarningIcon, '/overdue-payments', 'management'),
  nav('financial-reports', 'Financial Reports', AccountBalanceIcon, '/financial-reports', 'management'),

  nav('settings', 'Security Settings', SettingsIcon, '/security-settings', 'admin', { description: 'System settings and security' }),
  nav('access-control', 'Access Control', AdminPanelSettingsIcon, '/access-control', 'admin', { description: 'Users, roles and permissions' }),
  nav('external-integrations', 'Integrations', HubIcon, '/external-integrations', 'admin'),
  nav('ux-review', 'UX Review', RateReviewIcon, '/ux-review', 'admin'),
  nav('mobile-audit', 'Mobile Audit', PhoneIphoneIcon, '/mobile-audit', 'admin'),
  nav('forms-showcase', 'Forms Showcase', SecurityIcon, '/forms-showcase', 'admin'),
];

const TENANT_NAV: NavigationItem[] = [
  nav('dashboard', 'Home', HomeIcon, '/', 'main', { mobileTab: true, description: 'Your lease at a glance' }),
  nav('my-payments', 'Payments', PaymentsIcon, '/my/payments', 'main', { mobileTab: true, description: 'Rent history' }),
  nav('my-maintenance', 'Maintenance', BuildIcon, '/my/maintenance', 'main', { mobileTab: true, description: 'Your repair requests' }),
  nav('my-documents', 'Documents', FolderOpenIcon, '/my/documents', 'main', { mobileTab: true, description: 'Lease and documents' }),
  nav('my-notifications', 'Notifications', NotificationsIcon, '/my/notifications', 'main', { mobileTab: true }),
];

const VENDOR_NAV: NavigationItem[] = [
  nav('dashboard', 'Home', HomeIcon, '/', 'main', { mobileTab: true, description: 'Your work at a glance' }),
  nav('vendor-jobs', 'Jobs', HandymanIcon, '/vendor/jobs', 'main', { mobileTab: true, description: 'Work orders and quotes' }),
  nav('vendor-payments', 'Payments', PaymentsIcon, '/vendor/payments', 'main', { mobileTab: true, description: 'Your payouts' }),
  nav('my-notifications', 'Notifications', NotificationsIcon, '/my/notifications', 'main', { mobileTab: true }),
];

function filterTree(items: NavigationItem[], allow: (href: string) => boolean): NavigationItem[] {
  return items
    .filter((item) => allow(item.href))
    .map((item) => (item.children ? { ...item, children: filterTree(item.children, allow) } : item));
}

/** The menu a role sees. Every entry is guaranteed to pass canAccess(). */
export function navItemsFor(role?: string | null): NavigationItem[] {
  const r = normalizeRole(role);
  const source = r === 'TENANT' ? TENANT_NAV : r === 'VENDOR' ? VENDOR_NAV : r ? STAFF_NAV : [];
  return filterTree(source, (href) => canAccess(r, href));
}
