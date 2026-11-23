import React, { useState, useEffect } from 'react';
import {
 Box,
 Typography,
 GridLegacy as Grid,
 Card,
 CardContent,
 Button,
 Chip,
 Avatar,
 IconButton,
 Tabs,
 Tab,
 Dialog,
 DialogTitle,
 DialogContent,
 DialogActions,
 TextField,
 FormControl,
 InputLabel,
 Select,
 MenuItem,
 useTheme,
 useMediaQuery,
} from '@mui/material';
import {
 Add as AddIcon,
 FilterList as FilterIcon,
 TrendingUp as TrendingUpIcon,
 BugReport as BugReportIcon,
 CheckCircle as CheckCircleIcon,
 AccessTime as AccessTimeIcon,
 PriorityHigh as PriorityHighIcon,
 Comment as CommentIcon,
 Assignment as AssignmentIcon,
 Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { asArray, num } from '../utils/safeData';
import { UXReviewCard } from '../components/ux-review/UXReviewCard';
import { UXReviewStats } from '../components/ux-review/UXReviewStats';
import { UXReviewFilters } from '../components/ux-review/UXReviewFilters';
import { UXReviewCreateModal } from '../components/ux-review/UXReviewCreateModal';
import { UXReviewDetailModal } from '../components/ux-review/UXReviewDetailModal';
import { UXReviewAssignmentModal } from '../components/ux-review/UXReviewAssignmentModal';

interface UXReview {
 id: string;
 title: string;
 description?: string;
 componentId: string;
 componentType: string;
 reviewer: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
 };
 reviewType: string;
 severity: string;
 status: string;
 priority: string;
 url?: string;
 screenshots: string[];
 tags: string[];
 createdAt: string;
 updatedAt: string;
 resolvedAt?: string;
 metrics: any[];
 assignments: any[];
 comments: any[];
}

interface UXReviewStatsData {
 totalReviews: number;
 openReviews: number;
 inProgressReviews: number;
 resolvedReviews: number;
 severityStats: Array<{ severity: string; _count: { _all: number } }>;
 priorityStats: Array<{ priority: string; _count: { _all: number } }>;
 typeStats: Array<{ reviewType: string; _count: { _all: number } }>;
}

/** Backend enums (prisma UXReviewStatus / UXReviewPriority / UXComponentType). */
const API_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'NEEDS_REVISION', 'APPROVED', 'REJECTED'];
const API_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const API_COMPONENT_TYPES = ['DASHBOARD', 'PROPERTY_PAGE', 'UNIT_PAGE', 'MAINTENANCE_FLOW', 'LEASING_FLOW', 'ONBOARDING', 'SETTINGS', 'OTHER'];

/** `apiService` resolves to `{ data }` or `{ error }`; turn errors into thrown errors. */
async function unwrap<T = any>(promise: Promise<{ data?: T; error?: any }>): Promise<T | undefined> {
 const result = await promise;
 if (result?.error) throw new Error(result.error.message || 'Request failed');
 return result?.data;
}

/** Map a backend UXReview row (`User`, `UXReviewAssignment`, ...) into the UI shape. */
function normalizeReview(raw: any): UXReview {
 const r = raw && typeof raw === 'object' ? raw : {};
 const reviewer = r.reviewer || r.User || {};
 return {
  ...r,
  id: String(r.id ?? ''),
  title: r.title || 'Untitled review',
  componentType: r.componentType || 'OTHER',
  reviewer: {
   id: reviewer.id || r.reviewerId || '',
   firstName: reviewer.firstName || '',
   lastName: reviewer.lastName || '',
   email: reviewer.email || '',
  },
  reviewType: r.reviewType || r.componentType || 'OTHER',
  severity: r.severity || r.priority || 'MEDIUM',
  status: r.status || 'PENDING',
  priority: r.priority || 'MEDIUM',
  screenshots: Array.isArray(r.screenshots) ? r.screenshots : [],
  tags: Array.isArray(r.tags) ? r.tags : [],
  assignments: asArray(r.assignments ?? r.UXReviewAssignment).map((a: any) => ({
   ...a,
   assignee: a?.assignee || a?.User || { firstName: '', lastName: '' },
  })),
  comments: asArray(r.comments ?? r.UXReviewComment).map((c: any) => ({
   ...c,
   author: c?.author || c?.User || { firstName: '', lastName: '' },
  })),
  metrics: Array.isArray(r.metrics) ? r.metrics.filter((m: any) => m && m.metricType) : [],
 } as UXReview;
}

/** Map backend stats (`total`, `countsByStatus`, ...) into the UI stats shape. */
function normalizeStats(raw: any): UXReviewStatsData {
 const r = raw && typeof raw === 'object' ? raw : {};
 const toStats = (counts: any, key: string) =>
  Array.isArray(counts)
   ? counts
   : Object.entries(counts && typeof counts === 'object' ? counts : {}).map(([k, v]) => ({
      [key]: k,
      _count: { _all: num(v) },
     }));
 const byStatus = r.countsByStatus && typeof r.countsByStatus === 'object' ? r.countsByStatus : {};
 const priorityStats = toStats(r.priorityStats ?? r.countsByPriority, 'priority');
 return {
  totalReviews: num(r.totalReviews ?? r.total),
  openReviews: num(r.openReviews ?? num(byStatus.PENDING) + num(byStatus.NEEDS_REVISION)),
  inProgressReviews: num(r.inProgressReviews ?? byStatus.IN_PROGRESS),
  resolvedReviews: num(r.resolvedReviews ?? num(byStatus.COMPLETED) + num(byStatus.APPROVED)),
  // The backend has no separate severity; priority doubles as severity.
  severityStats: (r.severityStats ?? priorityStats.map((p: any) => ({ severity: p.priority, _count: p._count }))) as any,
  priorityStats: priorityStats as any,
  typeStats: toStats(r.typeStats ?? r.countsByComponentType, 'reviewType') as any,
 };
}

const UXReviewDashboard: React.FC = () => {
 const { user } = useAuth();
 const theme = useTheme();
 const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
 
 const [tabValue, setTabValue] = useState(0);
 const [selectedReview, setSelectedReview] = useState<UXReview | null>(null);
 const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
 const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
 const [filters, setFilters] = useState({
  status: '',
  severity: '',
  priority: '',
  reviewType: '',
  tags: '',
 });

 // Fetch UX Review stats
 const { data: stats, isLoading: statsLoading } = useQuery<UXReviewStatsData>({
  queryKey: ['ux-review-stats'],
  // Only ADMIN / PROPERTY_MANAGER may read stats; others get 403 -> no stats panel.
  queryFn: async () => normalizeStats(await unwrap(apiService.get('/ux-review/stats'))),
  retry: false,
 });

 // Fetch UX Reviews
 const { data: reviews, isLoading: reviewsLoading, refetch } = useQuery<UXReview[]>({
  queryKey: ['ux-reviews', filters],
  queryFn: async () => {
   // Only forward values the backend enums accept; an unknown enum value
   // makes Prisma reject the whole query.
   const params = new URLSearchParams();
   if (API_STATUSES.includes(filters.status)) params.append('status', filters.status);
   if (API_PRIORITIES.includes(filters.priority)) params.append('priority', filters.priority);
   if (API_COMPONENT_TYPES.includes(filters.reviewType)) params.append('componentType', filters.reviewType);
   const qs = params.toString();
   const body = await unwrap(apiService.get(`/ux-review${qs ? `?${qs}` : ''}`));
   return asArray(body).map(normalizeReview);
  },
  retry: false,
 });

 // "My Assignments" is derived from the assignments embedded in each review
 // (there is no per-user assignments endpoint), keyed on the logged-in user.
 const myId = user?.id;
 const isAssignedToMe = (review: UXReview) =>
  !!myId && review.assignments.some((a: any) => (a?.assigneeId ?? a?.User?.id) === myId);

 const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
  setTabValue(newValue);
 };

 const handleFilterChange = (newFilters: any) => {
  setFilters(newFilters);
 };

 const handleCreateReview = async (reviewData: any) => {
  try {
   await apiService.post('/ux-review', reviewData);
   setIsCreateModalOpen(false);
   refetch();
  } catch (error) {
   console.error('Error creating review:', error);
  }
 };

 const handleAssignReview = async (assignmentData: any) => {
  try {
   await apiService.post(`/ux-review/${selectedReview?.id}/assign`, assignmentData);
   setIsAssignmentModalOpen(false);
   refetch();
  } catch (error) {
   console.error('Error assigning review:', error);
  }
 };

 const getStatusIcon = (status: string) => {
  switch (status) {
   case 'OPEN':
    return <BugReportIcon color="error" />;
   case 'IN_PROGRESS':
    return <AccessTimeIcon color="warning" />;
   case 'RESOLVED':
    return <CheckCircleIcon color="success" />;
   default:
    return <BugReportIcon />;
  }
 };

 const getSeverityColor = (severity: string) => {
  switch (severity) {
   case 'CRITICAL':
    return 'error';
   case 'HIGH':
    return 'warning';
   case 'MEDIUM':
    return 'info';
   case 'LOW':
    return 'default';
   default:
    return 'default';
  }
 };

 const getPriorityColor = (priority: string) => {
  switch (priority) {
   case 'URGENT':
    return 'error';
   case 'HIGH':
    return 'warning';
   case 'MEDIUM':
    return 'info';
   case 'LOW':
    return 'default';
   default:
    return 'default';
  }
 };

 const filteredReviews = (Array.isArray(reviews) ? reviews : []).filter((review) => {
  if (tabValue === 1) {
   return isAssignedToMe(review);
  }
  return true;
 });

 if (statsLoading || reviewsLoading) {
  return (
   <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
    <Typography variant="h6">Loading UX Review Dashboard...</Typography>
   </Box>
  );
 }

 return (
  <Box p={isMobile ? 2 : 4}>
   <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
    <Typography variant="h4" component="h1">
     UX Review Dashboard
    </Typography>
    <Button
     variant="contained"
     color="primary"
     startIcon={<AddIcon />}
     onClick={() => setIsCreateModalOpen(true)}
     size={isMobile ? 'small' : 'medium'}
    >
     New Review
    </Button>
   </Box>

   {/* Stats Overview */}
   {stats && <UXReviewStats stats={stats} />}

   {/* Filters */}
   <UXReviewFilters
    filters={filters}
    onFilterChange={handleFilterChange}
    isMobile={isMobile}
   />

   {/* Tabs */}
   <Box mb={3}>
    <Tabs value={tabValue} onChange={handleTabChange}>
     <Tab label="All Reviews" icon={<BugReportIcon />} />
     <Tab label="My Assignments" icon={<AssignmentIcon />} />
    </Tabs>
   </Box>

   {/* Reviews Grid */}
   <Grid container spacing={3}>
    {filteredReviews.map((review) => (
     <Grid xs={12} md={6} lg={4} key={review.id}>
      <UXReviewCard
       review={review}
       onClick={() => setSelectedReview(review)}
       onAssign={() => {
        setSelectedReview(review);
        setIsAssignmentModalOpen(true);
       }}
       getStatusIcon={getStatusIcon}
       getSeverityColor={getSeverityColor}
       getPriorityColor={getPriorityColor}
      />
     </Grid>
    ))}
   </Grid>

   {filteredReviews.length === 0 && (
    <Box display="flex" flexDirection="column" alignItems="center" py={8}>
     <BugReportIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
     <Typography variant="h6" color="text.secondary">
      No reviews found
     </Typography>
     <Typography variant="body2" color="text.secondary">
      {tabValue === 1 ? 'You have no assigned reviews' : 'No reviews match your filters'}
     </Typography>
    </Box>
   )}

   {/* Modals */}
   <UXReviewCreateModal
    open={isCreateModalOpen}
    onClose={() => setIsCreateModalOpen(false)}
    onSubmit={handleCreateReview}
   />

   <UXReviewDetailModal
    open={selectedReview !== null}
    onClose={() => setSelectedReview(null)}
    review={selectedReview}
   />

   <UXReviewAssignmentModal
    open={isAssignmentModalOpen}
    onClose={() => setIsAssignmentModalOpen(false)}
    review={selectedReview}
    onAssign={handleAssignReview}
   />
  </Box>
 );
};

export default UXReviewDashboard;