import React, { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import GavelIcon from '@mui/icons-material/Gavel';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import EngineeringIcon from '@mui/icons-material/Engineering';
import SavingsIcon from '@mui/icons-material/Savings';
import api from '../services/api';
import workOrderService, { apiErrorMessage, WorkOrderItem } from '../services/workOrderService';
import { EmptyState, ErrorNote, INK, Loading, PageHeader, StatCard, StatusChip, fmtDate, money } from '../components/portal/PortalUI';

const isPending = (s: string) => String(s).toUpperCase() === 'PENDING';
const isAccepted = (s: string) => String(s).toUpperCase() === 'ACCEPTED';

/**
 * Vendor bidding: every work order that collects vendor quotes is a request for quote,
 * and each quote is a bid (GET /api/work-orders; decisions via PATCH /api/work-orders/quotes/:id).
 */
const VendorBiddingPlatformScreen: React.FC = () => {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const orders = useQuery({
    queryKey: ['vendor-bidding', 'work-orders'],
    queryFn: async () => (await workOrderService.list({ page: 1, limit: 100 })).data,
  });
  const vendors = useQuery({
    queryKey: ['vendor-bidding', 'vendors'],
    queryFn: async () => {
      const body = (await api.get('/vendors', { params: { limit: 100 } })).data;
      return (Array.isArray(body?.data) ? body.data : []) as any[];
    },
  });

  const decide = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACCEPTED' | 'REJECTED' }) => workOrderService.decideQuote(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-bidding', 'work-orders'] });
      qc.invalidateQueries({ queryKey: ['work-orders'] });
    },
  });

  const rfqs = useMemo(
    () =>
      (orders.data ?? [])
        .filter((w) => (w.quotes ?? []).length > 0)
        .map((w) => {
          const amounts = (w.quotes ?? []).map((q) => Number(q.amount) || 0);
          const accepted = (w.quotes ?? []).find((q) => isAccepted(q.status));
          return {
            wo: w,
            bids: (w.quotes ?? []).length,
            pending: (w.quotes ?? []).filter((q) => isPending(q.status)).length,
            low: Math.min(...amounts),
            high: Math.max(...amounts),
            accepted,
            saving: accepted ? Math.max(...amounts) - Number(accepted.amount) : 0,
          };
        })
        .sort((a, b) => b.pending - a.pending || new Date(b.wo.createdAt).getTime() - new Date(a.wo.createdAt).getTime()),
    [orders.data]
  );

  const openCount = rfqs.filter((r) => !r.accepted).length;
  const pendingBids = rfqs.reduce((s, r) => s + r.pending, 0);
  const savings = rfqs.reduce((s, r) => s + r.saving, 0);
  const current: WorkOrderItem | undefined = rfqs.find((r) => r.wo.id === selected)?.wo;
  const currentQuotes = [...(current?.quotes ?? [])].sort((a, b) => Number(a.amount) - Number(b.amount));

  return (
    <Box sx={{ textAlign: 'left' }}>
      <PageHeader
        title="Vendor bidding"
        subtitle="Compare vendor quotes on each job and award the work."
        action={
          <Button variant="contained" startIcon={<AddIcon />} component={RouterLink} to="/work-orders">
            Request quotes
          </Button>
        }
      />

      {(orders.isError || vendors.isError) && (
        <Box sx={{ mb: 2 }}>
          <ErrorNote text="Bidding data could not be loaded." onRetry={() => orders.refetch()} />
        </Box>
      )}

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, mb: 3 }}>
        <StatCard icon={<GavelIcon fontSize="small" />} label="Open for bids" value={orders.isLoading ? '…' : openCount} sub="Jobs not yet awarded" accent="#F25C05" />
        <StatCard icon={<RequestQuoteIcon fontSize="small" />} label="Bids to review" value={orders.isLoading ? '…' : pendingBids} sub="Waiting for a decision" accent="#2E6BE6" />
        <StatCard
          icon={<EngineeringIcon fontSize="small" />}
          label="Vendors"
          value={vendors.isLoading ? '…' : (vendors.data ?? []).length}
          sub="On your vendor list"
          accent="#12A150"
          to="/vendor-performance"
        />
        <StatCard icon={<SavingsIcon fontSize="small" />} label="Saved vs highest bid" value={money(savings)} sub="On awarded jobs" accent="#F5A524" />
      </Box>

      <Paper sx={{ border: `2px solid ${INK}` }}>
        <Typography variant="h6" sx={{ fontWeight: 800, p: 2, borderBottom: `2px solid ${INK}` }}>
          Jobs with bids
        </Typography>
        {orders.isLoading ? (
          <Loading />
        ) : rfqs.length === 0 ? (
          <EmptyState title="No bids yet" text="When vendors quote on a work order, the bids appear here for comparison." />
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 760 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Job</TableCell>
                  <TableCell>Property</TableCell>
                  <TableCell align="right">Bids</TableCell>
                  <TableCell align="right">Range</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {rfqs.map((r) => (
                  <TableRow key={r.wo.id} hover>
                    <TableCell>
                      <Typography sx={{ fontWeight: 700 }}>{r.wo.title.replace(/^WO:\s*/, '')}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Opened {fmtDate(r.wo.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>{r.wo.rental?.title ?? '—'}</TableCell>
                    <TableCell align="right">{r.bids}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {r.low === r.high ? money(r.low) : `${money(r.low)} – ${money(r.high)}`}
                    </TableCell>
                    <TableCell>
                      {r.accepted ? (
                        <Chip size="small" color="success" label={`Awarded · ${money(Number(r.accepted.amount))}`} />
                      ) : r.pending ? (
                        <Chip size="small" color="warning" label={`${r.pending} to review`} />
                      ) : (
                        <Chip size="small" label="All bids declined" />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="outlined" onClick={() => setSelected(r.wo.id)}>
                        Compare bids
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={Boolean(current)} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {current?.title.replace(/^WO:\s*/, '')}
          <Typography variant="body2" component="div" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {current?.rental?.title} · <StatusChip status={current?.status} />
          </Typography>
        </DialogTitle>
        <DialogContent>
          {decide.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {apiErrorMessage(decide.error, 'Could not update the bid.')}
            </Alert>
          )}
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 560 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Vendor</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Details</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {currentQuotes.map((q, k) => (
                  <TableRow key={q.id}>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {q.vendorName ?? 'Vendor'}
                      {k === 0 && currentQuotes.length > 1 && <Chip size="small" label="Lowest" sx={{ ml: 1 }} color="success" variant="outlined" />}
                    </TableCell>
                    <TableCell align="right">{money(Number(q.amount), 2)}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{q.details || '—'}</TableCell>
                    <TableCell>
                      <StatusChip status={q.status} />
                    </TableCell>
                    <TableCell align="right">
                      {isPending(q.status) && (
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button size="small" variant="contained" color="success" disabled={decide.isPending} onClick={() => decide.mutate({ id: q.id, status: 'ACCEPTED' })}>
                            Accept
                          </Button>
                          <Button size="small" variant="outlined" disabled={decide.isPending} onClick={() => decide.mutate({ id: q.id, status: 'REJECTED' })}>
                            Reject
                          </Button>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VendorBiddingPlatformScreen;
