import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Pagination,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import tenantPortalService, { MaintenancePriority } from '../../services/tenantPortalService';
import { apiErrorMessage } from '../../services/workOrderService';
import {
  EmptyState,
  ErrorNote,
  Loading,
  PageHeader,
  PageShell,
  PriorityChip,
  StatusChip,
  fmtDate,
} from '../../components/portal/PortalUI';

const PAGE_SIZE = 10;

const PRIORITIES: { value: MaintenancePriority; label: string; hint: string }[] = [
  { value: 'LOW', label: 'Low', hint: 'Cosmetic or can wait' },
  { value: 'MEDIUM', label: 'Medium', hint: 'Needs fixing soon' },
  { value: 'HIGH', label: 'High', hint: 'Affects daily living' },
  { value: 'EMERGENCY', label: 'Emergency', hint: 'Flooding, no heat, safety risk' },
];

function ReportIssueDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<MaintenancePriority>('MEDIUM');
  const [touched, setTouched] = useState(false);

  const mutation = useMutation({
    mutationFn: tenantPortalService.createMaintenance,
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setTouched(false);
      onCreated();
    },
  });

  const titleError = touched && title.trim().length < 3;
  const descError = touched && description.trim().length < 5;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (title.trim().length < 3 || description.trim().length < 5) return;
    mutation.mutate({ title: title.trim(), description: description.trim(), priority });
  };

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <Box component="form" onSubmit={submit} noValidate>
        <DialogTitle sx={{ fontWeight: 800 }}>Report an issue</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Tell us what needs fixing. We&apos;ll send it to your property manager for your current home.
          </Typography>
          {mutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {apiErrorMessage(mutation.error, 'Could not send your request. Please try again.')}
            </Alert>
          )}
          <Stack spacing={2}>
            <TextField
              label="What's the problem?"
              placeholder="e.g. Kitchen tap is leaking"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={titleError}
              helperText={titleError ? 'Please add a short title (at least 3 characters).' : ' '}
              required
              fullWidth
              autoFocus
              inputProps={{ maxLength: 120 }}
            />
            <TextField
              label="Details"
              placeholder="Where is it, when did it start, anything you've tried?"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              error={descError}
              helperText={descError ? 'Please describe the problem (at least 5 characters).' : ' '}
              required
              fullWidth
              multiline
              minRows={4}
            />
            <TextField
              select
              label="How urgent is it?"
              name="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as MaintenancePriority)}
              fullWidth
            >
              {PRIORITIES.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label} — {p.hint}
                </MenuItem>
              ))}
            </TextField>
            {priority === 'EMERGENCY' && (
              <Alert severity="warning">If anyone is in danger, call emergency services first.</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending} data-testid="submit-issue">
            {mutation.isPending ? 'Sending…' : 'Send request'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

const TenantMaintenance: React.FC = () => {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toast, setToast] = useState(false);

  // /my/maintenance?report=1 (the "Report an issue" quick action) opens the dialog.
  useEffect(() => {
    if (params.get('report') === '1') {
      setDialogOpen(true);
      params.delete('report');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const q = useQuery({
    queryKey: ['tenant-maintenance', page, PAGE_SIZE],
    queryFn: () => tenantPortalService.getMaintenance(page, PAGE_SIZE),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const items = q.data?.data ?? [];
  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const reportButton = (
    <Button variant="contained" startIcon={<ReportProblemIcon />} onClick={() => setDialogOpen(true)} fullWidth data-testid="report-issue">
      Report an issue
    </Button>
  );

  return (
    <PageShell>
      <PageHeader title="Maintenance" subtitle="Requests you've reported and where they're at." action={reportButton} />
      <Card>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          {q.isLoading ? (
            <Loading />
          ) : q.isError ? (
            <ErrorNote text="Could not load your maintenance requests." onRetry={() => q.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title="No requests yet"
              text="Something broken or not working? Let us know and we'll get it sorted."
              action={
                <Button variant="outlined" onClick={() => setDialogOpen(true)}>
                  Report an issue
                </Button>
              }
            />
          ) : (
            <>
              <Stack divider={<Divider flexItem />} spacing={2} data-testid="tenant-maintenance-list">
                {items.map((m) => (
                  <Box key={m.id}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                      <Typography sx={{ fontWeight: 700, wordBreak: 'break-word' }}>{m.title}</Typography>
                      <StatusChip status={m.status} />
                    </Stack>
                    {m.description && (
                      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, wordBreak: 'break-word' }}>
                        {m.description}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, flexWrap: 'wrap', rowGap: 1 }}>
                      <PriorityChip priority={m.priority} />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Reported {fmtDate(m.createdAt)}
                        {m.scheduledDate ? ` · Scheduled ${fmtDate(m.scheduledDate)}` : ''}
                        {m.completedDate ? ` · Completed ${fmtDate(m.completedDate)}` : ''}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
              {pages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2.5 }}>
                  <Pagination count={pages} page={page} onChange={(_, v) => setPage(v)} size="small" />
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ReportIssueDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={() => {
          setDialogOpen(false);
          setToast(true);
          setPage(1);
          qc.invalidateQueries({ queryKey: ['tenant-maintenance'] });
          qc.invalidateQueries({ queryKey: ['tenant-summary'] });
        }}
      />
      <Snackbar open={toast} autoHideDuration={5000} onClose={() => setToast(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setToast(false)}>
          Thanks, your request has been sent.
        </Alert>
      </Snackbar>
    </PageShell>
  );
};

export default TenantMaintenance;
