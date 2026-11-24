import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Divider, Stack, Typography } from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AssignmentIcon from '@mui/icons-material/Assignment';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import api from '../services/api';
import PhotoAnalysis from '../components/PhotoAnalysis';
import workOrderService, { apiErrorMessage, WorkOrderItem } from '../services/workOrderService';
import {
  EmptyState,
  ErrorNote,
  ListRow,
  Loading,
  PageHeader,
  PageShell,
  PriorityChip,
  SectionCard,
  StatCard,
  StatusChip,
  fmtDate,
  money,
} from '../components/portal/PortalUI';

interface MaintenanceRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  Rental?: { title?: string | null } | null;
  User?: { firstName?: string | null; lastName?: string | null } | null;
}

const OPEN_REQUEST = new Set(['OPEN', 'PENDING', 'IN_PROGRESS', 'ASSIGNED']);
const DONE_WORK_ORDER = new Set(['COMPLETED', 'CANCELLED']);

/**
 * Maintenance overview: open requests, active work orders and vendor quotes that need a
 * decision, plus the photo-analysis helper. Full lists live on /maintenance-requests and
 * /work-orders.
 */
const MaintenancePage: React.FC = () => {
  const qc = useQueryClient();

  const requests = useQuery({
    queryKey: ['maintenance-overview', 'requests'],
    queryFn: async () => {
      const body = (await api.get('/maintenance', { params: { page: 1, limit: 100 } })).data;
      return (Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : []) as MaintenanceRow[];
    },
  });

  const workOrders = useQuery({
    queryKey: ['maintenance-overview', 'work-orders'],
    queryFn: async () => (await workOrderService.list({ page: 1, limit: 100 })).data,
  });

  const decide = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACCEPTED' | 'REJECTED' }) => workOrderService.decideQuote(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-overview', 'work-orders'] });
      qc.invalidateQueries({ queryKey: ['work-orders'] });
    },
  });

  const reqRows = requests.data ?? [];
  const openRequests = reqRows.filter((r) => OPEN_REQUEST.has(String(r.status).toUpperCase()));
  const emergencies = openRequests.filter((r) => ['EMERGENCY', 'URGENT', 'HIGH'].includes(String(r.priority).toUpperCase()));
  const woRows: WorkOrderItem[] = workOrders.data ?? [];
  const activeWorkOrders = woRows.filter((w) => !DONE_WORK_ORDER.has(w.status));
  const pendingQuotes = woRows.flatMap((w) =>
    (w.quotes ?? []).filter((q) => String(q.status).toUpperCase() === 'PENDING').map((q) => ({ quote: q, workOrder: w }))
  );

  const recentOpen = [...openRequests]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const loading = requests.isLoading || workOrders.isLoading;

  return (
    <PageShell>
      <PageHeader
        title="Maintenance"
        subtitle="Open requests, active work orders and vendor quotes that need a decision."
        action={
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <Button variant="outlined" component={RouterLink} to="/work-orders">
              Work orders
            </Button>
            <Button variant="contained" component={RouterLink} to="/maintenance-requests">
              All requests
            </Button>
          </Stack>
        }
      />

      {(requests.isError || workOrders.isError) && (
        <Box sx={{ mb: 3 }}>
          <ErrorNote
            text="Some maintenance data could not be loaded."
            onRetry={() => {
              requests.refetch();
              workOrders.refetch();
            }}
          />
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 2.5,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          mb: 3,
        }}
      >
        <StatCard
          icon={<BuildIcon fontSize="small" />}
          label="Open requests"
          value={loading ? '…' : openRequests.length}
          sub={`${reqRows.length} in total`}
          accent="#F25C05"
          to="/maintenance-requests"
        />
        <StatCard
          icon={<WarningAmberIcon fontSize="small" />}
          label="High priority"
          value={loading ? '…' : emergencies.length}
          sub="Emergency, urgent or high"
          accent="#D92D20"
          to="/emergency-response"
        />
        <StatCard
          icon={<AssignmentIcon fontSize="small" />}
          label="Active work orders"
          value={loading ? '…' : activeWorkOrders.length}
          sub={`${woRows.length - activeWorkOrders.length} completed or cancelled`}
          accent="#2E6BE6"
          to="/work-orders"
        />
        <StatCard
          icon={<RequestQuoteIcon fontSize="small" />}
          label="Quotes to review"
          value={loading ? '…' : pendingQuotes.length}
          sub={pendingQuotes.length ? money(pendingQuotes.reduce((s, p) => s + Number(p.quote.amount || 0), 0)) + ' quoted' : 'Nothing waiting'}
          accent="#12A150"
        />
      </Box>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, mb: 3 }}>
        <SectionCard title="Quotes awaiting review" to="/work-orders" linkLabel="Work orders">
          {loading ? (
            <Loading />
          ) : pendingQuotes.length === 0 ? (
            <EmptyState title="No quotes waiting" text="New vendor quotes will appear here for approval." />
          ) : (
            <Stack divider={<Divider />} spacing={1.5}>
              {pendingQuotes.map(({ quote, workOrder }) => (
                <Box key={quote.id}>
                  <ListRow
                    primary={workOrder.title.replace(/^WO:\s*/, '')}
                    secondary={`${quote.vendorName ?? 'Vendor'} · ${workOrder.rental?.title ?? 'Property'} · ${fmtDate(quote.createdAt)}`}
                    right={<Typography sx={{ fontWeight: 800 }}>{money(quote.amount, 2)}</Typography>}
                  />
                  {quote.details && (
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                      {quote.details}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: quote.id, status: 'ACCEPTED' })}
                    >
                      Approve
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: quote.id, status: 'REJECTED' })}
                    >
                      Reject
                    </Button>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
          {decide.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {apiErrorMessage(decide.error, 'Could not update the quote.')}
            </Alert>
          )}
        </SectionCard>

        <SectionCard title="Newest open requests" to="/maintenance-requests">
          {loading ? (
            <Loading />
          ) : recentOpen.length === 0 ? (
            <EmptyState title="No open requests" text="Everything reported so far has been resolved." />
          ) : (
            <Stack divider={<Divider />} spacing={1.5}>
              {recentOpen.map((r) => (
                <ListRow
                  key={r.id}
                  primary={r.title}
                  secondary={`${r.Rental?.title ?? 'Property'} · ${fmtDate(r.createdAt)}`}
                  right={
                    <>
                      <PriorityChip priority={r.priority} />
                      <StatusChip status={r.status} />
                    </>
                  }
                />
              ))}
            </Stack>
          )}
        </SectionCard>
      </Box>

      <SectionCard title="Photo analysis">
        <PhotoAnalysis
          maintenanceRequestId={recentOpen[0]?.id ?? ''}
          key={recentOpen[0]?.id ?? 'none'}
          requests={openRequests.map((r) => ({ id: r.id, label: `${r.title} · ${r.Rental?.title ?? 'Property'}` }))}
        />
      </SectionCard>
    </PageShell>
  );
};

export default MaintenancePage;
