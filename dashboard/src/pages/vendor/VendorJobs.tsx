import React, { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Chip, Pagination, Snackbar, Stack, TextField } from '@mui/material';
import workOrderService, { WorkOrderItem, WorkOrderStatus, apiErrorMessage } from '../../services/workOrderService';
import vendorPortalService from '../../services/vendorPortalService';
import { EmptyState, ErrorNote, Loading, PageHeader, PageShell, pretty } from '../../components/portal/PortalUI';
import { JobCard, QuoteDialog } from './JobCard';

const PAGE_SIZE = 10;
const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'ON_HOLD', label: 'On hold' },
  { value: 'COMPLETED', label: 'Completed' },
];

const STATUS_DONE: Record<string, string> = {
  IN_PROGRESS: 'Job started',
  ON_HOLD: 'Job put on hold',
  COMPLETED: 'Job marked complete',
};

const VendorJobs: React.FC = () => {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [quoteJob, setQuoteJob] = useState<WorkOrderItem | null>(null);
  const [toast, setToast] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);

  const me = useQuery({ queryKey: ['vendor-me'], queryFn: vendorPortalService.getMe, retry: false, staleTime: 60_000 });
  const q = useQuery({
    queryKey: ['vendor-jobs', status, search, page],
    queryFn: () => workOrderService.list({ status: status || undefined, search: search || undefined, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['vendor-jobs'] });
    qc.invalidateQueries({ queryKey: ['vendor-me'] });
  };

  const statusM = useMutation({
    mutationFn: ({ id, next }: { id: string; next: WorkOrderStatus }) => workOrderService.updateStatus(id, next),
    onSuccess: (_d, v) => {
      setToast({ severity: 'success', text: STATUS_DONE[v.next] ?? `Status set to ${pretty(v.next)}` });
      refresh();
    },
    onError: (e) => setToast({ severity: 'error', text: apiErrorMessage(e, 'Could not update the job.') }),
  });

  const quoteM = useMutation({
    mutationFn: ({ id, amount, details }: { id: string; amount: number; details: string }) =>
      workOrderService.submitQuote(id, { amount, details: details || undefined }),
    onSuccess: () => {
      setQuoteJob(null);
      setToast({ severity: 'success', text: 'Quote sent' });
      refresh();
    },
  });

  const jobs = q.data?.data ?? [];
  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageShell>
      <PageHeader title="Jobs" subtitle="Work orders assigned to you or open for quotes." />

      <Stack spacing={1.5} sx={{ mb: 2.5 }}>
        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }} role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <Chip
              key={f.value || 'all'}
              label={f.label}
              clickable
              color={status === f.value ? 'primary' : 'default'}
              variant={status === f.value ? 'filled' : 'outlined'}
              onClick={() => {
                setStatus(f.value);
                setPage(1);
              }}
              data-testid={`filter-${f.value || 'ALL'}`}
              sx={{ flexShrink: 0 }}
            />
          ))}
        </Box>
        <TextField
          size="small"
          placeholder="Search jobs"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          sx={{ maxWidth: { sm: 360 }, bgcolor: 'background.paper' }}
          inputProps={{ 'aria-label': 'Search jobs' }}
        />
      </Stack>

      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <ErrorNote text={`Could not load your jobs. ${apiErrorMessage(q.error, '')}`} onRetry={() => q.refetch()} />
      ) : jobs.length === 0 ? (
        <EmptyState
          title={status ? `No ${pretty(status).toLowerCase()} jobs` : 'No jobs yet'}
          text="New work orders from property managers will show up here."
        />
      ) : (
        <>
          <Stack spacing={2} data-testid="vendor-jobs-list">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                myVendorId={me.data?.id}
                busy={statusM.isPending && statusM.variables?.id === job.id}
                onStatus={(j, next) => statusM.mutate({ id: j.id, next })}
                onQuote={(j) => {
                  quoteM.reset();
                  setQuoteJob(j);
                }}
              />
            ))}
          </Stack>
          {pages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2.5 }}>
              <Pagination count={pages} page={page} onChange={(_, v) => setPage(v)} size="small" />
            </Box>
          )}
        </>
      )}

      <QuoteDialog
        open={!!quoteJob}
        job={quoteJob}
        pending={quoteM.isPending}
        error={quoteM.isError ? apiErrorMessage(quoteM.error, 'Could not send the quote.') : null}
        onClose={() => setQuoteJob(null)}
        onSubmit={(amount, details) => quoteJob && quoteM.mutate({ id: quoteJob.id, amount, details })}
      />

      <Snackbar open={!!toast} autoHideDuration={5000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {toast ? (
          <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)}>
            {toast.text}
          </Alert>
        ) : undefined}
      </Snackbar>
    </PageShell>
  );
};

export default VendorJobs;
