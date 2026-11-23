import React, { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import api from '../services/api';
import workOrderService, {
  WORK_ORDER_STATUSES,
  WorkOrderItem,
  WorkOrderStatus,
  apiErrorMessage,
} from '../services/workOrderService';
import { PriorityChip, StatusChip, fmtDate, money, pretty } from '../components/portal/PortalUI';

/**
 * Staff work orders, backed by GET /api/work-orders (scoped to the operator's portfolio).
 * Staff can create a work order from a maintenance request (optionally assigning a vendor),
 * change its status, and accept or reject vendor quotes.
 */

interface Option {
  id: string;
  label: string;
}

const toOptions = (body: any, label: (x: any) => string): Option[] =>
  (Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : []).map((x: any) => ({ id: x.id, label: label(x) }));

function CreateWorkOrderDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [maintenanceRequestId, setMaintenanceRequestId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [notes, setNotes] = useState('');

  const requests = useQuery({
    queryKey: ['wo-create-maintenance-options'],
    queryFn: async () =>
      toOptions((await api.get('/maintenance', { params: { page: 1, limit: 100 } })).data, (m) =>
        [m.title, m.Rental?.title || m.rental?.title, pretty(m.status)].filter(Boolean).join(' · '),
      ),
    enabled: open,
    retry: false,
  });
  const vendors = useQuery({
    queryKey: ['wo-create-vendor-options'],
    queryFn: async () =>
      toOptions((await api.get('/vendors', { params: { limit: 100 } })).data, (v) =>
        [v.name, v.specialty ? pretty(v.specialty) : null].filter(Boolean).join(' · '),
      ),
    enabled: open,
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      workOrderService.create({ maintenanceRequestId, vendorId: vendorId || undefined, notes: notes.trim() || undefined }),
    onSuccess: () => {
      setMaintenanceRequestId('');
      setVendorId('');
      setNotes('');
      onCreated();
    },
  });

  return (
    <Dialog open={open} onClose={create.isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>New work order</DialogTitle>
      <DialogContent>
        {create.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {apiErrorMessage(create.error, 'Could not create the work order.')}
          </Alert>
        )}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label="Maintenance request"
            value={maintenanceRequestId}
            onChange={(e) => setMaintenanceRequestId(e.target.value)}
            required
            fullWidth
            helperText={requests.isError ? 'Could not load maintenance requests.' : ' '}
          >
            {(requests.data ?? []).map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Assign vendor (optional)"
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            fullWidth
            helperText={vendors.isError ? 'Could not load vendors.' : 'Leave empty to collect quotes first.'}
          >
            <MenuItem value="">
              <em>No vendor yet</em>
            </MenuItem>
            {(vendors.data ?? []).map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={create.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => create.mutate()} disabled={!maintenanceRequestId || create.isPending}>
          {create.isPending ? 'Creating…' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function QuotesDialog({
  job,
  onClose,
  onDecide,
  pendingId,
}: {
  job: WorkOrderItem | null;
  onClose: () => void;
  onDecide: (quoteId: string, status: 'ACCEPTED' | 'REJECTED') => void;
  pendingId?: string;
}) {
  const quotes = job?.quotes ?? [];
  return (
    <Dialog open={!!job} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Quotes · {job?.title}</DialogTitle>
      <DialogContent>
        {quotes.length === 0 ? (
          <Typography sx={{ color: 'text.secondary' }}>No quotes yet.</Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={1.5}>
            {quotes.map((q) => (
              <Stack key={q.id} direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }}>
                    {q.vendorName || 'Vendor'} · {money(q.amount, 2)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', wordBreak: 'break-word' }}>
                    {[q.details, fmtDate(q.createdAt)].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                  {String(q.status).toUpperCase() === 'PENDING' ? (
                    <>
                      <Button size="small" variant="contained" color="success" disabled={pendingId === q.id} onClick={() => onDecide(q.id, 'ACCEPTED')}>
                        Accept
                      </Button>
                      <Button size="small" variant="outlined" color="error" disabled={pendingId === q.id} onClick={() => onDecide(q.id, 'REJECTED')}>
                        Reject
                      </Button>
                    </>
                  ) : (
                    <StatusChip status={q.status} />
                  )}
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

const WorkOrderList: React.FC = () => {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [quotesFor, setQuotesFor] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const query = useQuery({
    queryKey: ['staff-work-orders', page, rowsPerPage, searchTerm, status],
    queryFn: () => workOrderService.list({ page: page + 1, limit: rowsPerPage, search: searchTerm || undefined, status: status || undefined }),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['staff-work-orders'] });

  const statusM = useMutation({
    mutationFn: ({ id, next }: { id: string; next: WorkOrderStatus }) => workOrderService.updateStatus(id, next),
    onSuccess: () => {
      setSnackbar({ message: 'Status updated', severity: 'success' });
      refresh();
    },
    onError: (e) => setSnackbar({ message: apiErrorMessage(e, 'Could not update status'), severity: 'error' }),
  });
  const quoteM = useMutation({
    mutationFn: ({ quoteId, decision }: { quoteId: string; decision: 'ACCEPTED' | 'REJECTED' }) => workOrderService.decideQuote(quoteId, decision),
    onSuccess: (_d, v) => {
      setSnackbar({ message: v.decision === 'ACCEPTED' ? 'Quote accepted' : 'Quote rejected', severity: 'success' });
      refresh();
    },
    onError: (e) => setSnackbar({ message: apiErrorMessage(e, 'Could not update the quote'), severity: 'error' }),
  });

  const workOrders = query.data?.data ?? [];
  const totalCount = query.data?.total ?? 0;
  const quotesJob = workOrders.find((w) => w.id === quotesFor) ?? null;

  if (query.isLoading) {
    return (
      <Card>
        <CardHeader title={<Skeleton variant="text" width="60%" aria-label="Loading work orders" />} subheader={<Skeleton variant="text" width="40%" />} />
        <CardContent>
          <Skeleton variant="rectangular" height={400} aria-label="Loading work orders content" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Work Orders"
        subheader={
          <Box display="flex" alignItems="center" gap={1}>
            <Chip label={totalCount} color="primary" size="small" />
            <Typography variant="body2" color="text.secondary">
              {totalCount} work order{totalCount !== 1 ? 's' : ''}
            </Typography>
          </Box>
        }
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)} aria-label="Create work order">
            New
          </Button>
        }
      />
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search work orders by title or description..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
          />
          <TextField
            select
            size="small"
            label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
            sx={{ minWidth: 180 }}
            InputLabelProps={{ shrink: true }}
            SelectProps={{ displayEmpty: true }}
          >
            <MenuItem value="">All statuses</MenuItem>
            {WORK_ORDER_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {pretty(s)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        {query.isError ? (
          <Alert severity="error" role="alert" aria-live="polite">
            Failed to load work orders: {apiErrorMessage(query.error)}
          </Alert>
        ) : workOrders.length === 0 ? (
          <Typography color="text.secondary">No work orders found</Typography>
        ) : (
          <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
            <Table aria-label="work orders table" size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Work order</TableCell>
                  <TableCell>Property</TableCell>
                  <TableCell>Vendor</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Quotes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {workOrders.map((wo) => {
                  const pendingQuotes = (wo.quotes ?? []).filter((q) => String(q.status).toUpperCase() === 'PENDING').length;
                  return (
                    <TableRow key={wo.id} hover>
                      <TableCell sx={{ maxWidth: 260 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {wo.title}
                        </Typography>
                        {wo.maintenanceRequest?.title && wo.maintenanceRequest.title !== wo.title && (
                          <Typography variant="caption" color="text.secondary">
                            Request: {wo.maintenanceRequest.title}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{wo.rental?.title || '—'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {[wo.rental?.address, wo.rental?.city].filter(Boolean).join(', ')}
                        </Typography>
                      </TableCell>
                      <TableCell>{(wo.vendors ?? []).map((v) => v.name).join(', ') || <Typography variant="caption" color="text.secondary">Unassigned</Typography>}</TableCell>
                      <TableCell>
                        <PriorityChip priority={wo.priority} />
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          variant="standard"
                          value={wo.status}
                          disabled={statusM.isPending && statusM.variables?.id === wo.id}
                          onChange={(e) => statusM.mutate({ id: wo.id, next: e.target.value as WorkOrderStatus })}
                          inputProps={{ 'aria-label': `Status for ${wo.title}` }}
                          SelectProps={{ renderValue: (v) => <StatusChip status={String(v)} /> }}
                        >
                          {WORK_ORDER_STATUSES.map((s) => (
                            <MenuItem key={s} value={s}>
                              {pretty(s)}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      <TableCell>{fmtDate(wo.createdAt)}</TableCell>
                      <TableCell align="right">
                        <Button size="small" startIcon={<RequestQuoteIcon />} onClick={() => setQuotesFor(wo.id)} sx={{ whiteSpace: 'nowrap' }}>
                          {(wo.quotes ?? []).length}
                          {pendingQuotes ? ` (${pendingQuotes} new)` : ''}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={totalCount}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_e, p) => setPage(p)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </TableContainer>
        )}
      </CardContent>

      <CreateWorkOrderDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          setSnackbar({ message: 'Work order created', severity: 'success' });
          refresh();
        }}
      />
      <QuotesDialog
        job={quotesJob}
        onClose={() => setQuotesFor(null)}
        onDecide={(quoteId, decision) => quoteM.mutate({ quoteId, decision })}
        pendingId={quoteM.isPending ? quoteM.variables?.quoteId : undefined}
      />

      <Snackbar open={!!snackbar} autoHideDuration={6000} onClose={() => setSnackbar(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snackbar ? (
          <Alert onClose={() => setSnackbar(null)} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Card>
  );
};

export default WorkOrderList;
