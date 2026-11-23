import React, { useState } from 'react';
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
  InputAdornment,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import CheckIcon from '@mui/icons-material/Check';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import PlaceIcon from '@mui/icons-material/Place';
import { WorkOrderItem, WorkOrderStatus, WorkOrderQuote } from '../../services/workOrderService';
import { PriorityChip, StatusChip, fmtDate, money } from '../../components/portal/PortalUI';

export const ACTIVE_STATUSES: WorkOrderStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'];

export const propertyLine = (wo: WorkOrderItem) => {
  const r = wo.rental;
  if (!r) return 'Property not specified';
  const unit = r.unitNumber && !(r.title || '').includes(r.unitNumber) ? `Unit ${r.unitNumber}` : null;
  return [r.title, unit, [r.address, r.city].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
};

export function QuoteDialog({
  open,
  job,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  job: WorkOrderItem | null;
  pending: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (amount: number, details: string) => void;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [amount, setAmount] = useState('');
  const [details, setDetails] = useState('');
  const [touched, setTouched] = useState(false);
  const value = Number(amount);
  const invalid = !(value > 0);

  React.useEffect(() => {
    if (open) {
      setAmount('');
      setDetails('');
      setTouched(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <Box
        component="form"
        noValidate
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          setTouched(true);
          if (!invalid) onSubmit(value, details.trim());
        }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Send a quote</DialogTitle>
        <DialogContent>
          {job && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              {job.title} · {propertyLine(job)}
            </Typography>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Stack spacing={2}>
            <TextField
              label="Amount"
              name="amount"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={touched && invalid}
              helperText={touched && invalid ? 'Enter an amount greater than 0.' : ' '}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              inputProps={{ min: 0, step: '0.01' }}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label="Details (optional)"
              name="details"
              placeholder="Labour, parts, timing…"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={pending} data-testid="submit-quote">
            {pending ? 'Sending…' : 'Send quote'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function QuoteList({ quotes }: { quotes: WorkOrderQuote[] }) {
  if (quotes.length === 0) return null;
  return (
    <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover' }}>
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
        Your quotes
      </Typography>
      <Stack spacing={0.75} sx={{ mt: 0.5 }}>
        {quotes.map((q) => (
          <Stack key={q.id} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Typography variant="body2" sx={{ minWidth: 0, wordBreak: 'break-word' }}>
              <strong>{money(q.amount, 2)}</strong>
              {q.details ? ` · ${q.details}` : ''}
              <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                {' '}
                · {fmtDate(q.createdAt)}
              </Typography>
            </Typography>
            <StatusChip status={q.status} />
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

export function JobCard({
  job,
  myVendorId,
  busy,
  compact = false,
  onStatus,
  onQuote,
}: {
  job: WorkOrderItem;
  myVendorId?: string;
  busy?: boolean;
  compact?: boolean;
  onStatus?: (job: WorkOrderItem, status: WorkOrderStatus) => void;
  onQuote?: (job: WorkOrderItem) => void;
}) {
  const s = job.status;
  const quotes = (job.quotes ?? []).filter((q) => !myVendorId || q.vendorId === myVendorId);
  const closed = s === 'COMPLETED' || s === 'CANCELLED';

  return (
    <Card data-testid="job-card">
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, wordBreak: 'break-word' }}>{job.title}</Typography>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary', mt: 0.25 }}>
              <PlaceIcon sx={{ fontSize: 16, flexShrink: 0 }} />
              <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                {propertyLine(job)}
              </Typography>
            </Stack>
          </Box>
          <StatusChip status={s} />
        </Stack>

        {!compact && job.description && (
          <Typography variant="body2" sx={{ mt: 1, wordBreak: 'break-word' }}>
            {job.description}
          </Typography>
        )}

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.25, flexWrap: 'wrap', rowGap: 1 }}>
          <PriorityChip priority={job.priority} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {job.scheduledFor ? `Scheduled ${fmtDate(job.scheduledFor)}` : `Created ${fmtDate(job.createdAt)}`}
            {job.completedAt ? ` · Completed ${fmtDate(job.completedAt)}` : ''}
          </Typography>
        </Stack>

        {!compact && <QuoteList quotes={quotes} />}

        {!compact && !closed && (onStatus || onQuote) && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
            {onStatus && s !== 'IN_PROGRESS' && (
              <Button
                variant="contained"
                startIcon={<PlayArrowIcon />}
                disabled={busy}
                onClick={() => onStatus(job, 'IN_PROGRESS')}
                data-testid="job-start"
              >
                {s === 'ON_HOLD' ? 'Resume' : 'Start'}
              </Button>
            )}
            {onStatus && s !== 'ON_HOLD' && (
              <Button variant="outlined" startIcon={<PauseIcon />} disabled={busy} onClick={() => onStatus(job, 'ON_HOLD')} data-testid="job-hold">
                Put on hold
              </Button>
            )}
            {onStatus && (s === 'IN_PROGRESS' || s === 'ON_HOLD') && (
              <Button
                variant="outlined"
                color="success"
                startIcon={<CheckIcon />}
                disabled={busy}
                onClick={() => onStatus(job, 'COMPLETED')}
                data-testid="job-complete"
              >
                Mark complete
              </Button>
            )}
            {onQuote && (
              <Button variant="text" startIcon={<RequestQuoteIcon />} disabled={busy} onClick={() => onQuote(job)} data-testid="job-quote">
                Send quote
              </Button>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
