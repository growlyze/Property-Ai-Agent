import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

/**
 * Small building blocks shared by the tenant and vendor portals. Styling follows
 * pages/Dashboard.tsx (ink borders, hard shadows from the MUI theme).
 */

export const INK = '#140827';

export const money = (n: number | null | undefined, digits = 0) =>
  Number(n ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits, minimumFractionDigits: digits });

export const fmtDate = (s?: string | null) =>
  // Dates from the API are calendar dates stored at midnight (UTC or the property's zone);
  // format in UTC so a "Dec 1" due date never shows as "Nov 30" in western time zones.
  s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '—';

export const pretty = (s?: string | null) =>
  String(s ?? '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

const STATUS_COLOR: Record<string, ChipColor> = {
  // payments
  COMPLETED: 'success',
  PAID: 'success',
  PENDING: 'warning',
  PROCESSING: 'info',
  FAILED: 'error',
  REFUNDED: 'default',
  // maintenance / work orders
  OPEN: 'warning',
  ASSIGNED: 'info',
  IN_PROGRESS: 'info',
  ON_HOLD: 'default',
  CANCELLED: 'default',
  // quotes
  ACCEPTED: 'success',
  REJECTED: 'error',
  // leases
  ACTIVE: 'success',
  EXPIRED: 'default',
  TERMINATED: 'default',
};

export const PRIORITY_COLOR: Record<string, ChipColor> = {
  EMERGENCY: 'error',
  URGENT: 'error',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'default',
};

export function StatusChip({ status }: { status?: string | null }) {
  const key = String(status ?? '').toUpperCase().replace(/\s+/g, '_');
  return <Chip size="small" label={pretty(status) || 'Unknown'} color={STATUS_COLOR[key] ?? 'default'} />;
}

export function PriorityChip({ priority }: { priority?: string | null }) {
  const key = String(priority ?? '').toUpperCase();
  return <Chip size="small" variant="outlined" label={pretty(priority) || '—'} color={PRIORITY_COLOR[key] ?? 'default'} />;
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto', width: '100%', textAlign: 'left' }}>{children}</Box>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      justifyContent="space-between"
      spacing={1.5}
      sx={{ mb: 3 }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800, fontSize: { xs: '1.6rem', md: '2.125rem' } }}>
          {title}
        </Typography>
        {subtitle && <Typography sx={{ color: 'text.secondary' }}>{subtitle}</Typography>}
      </Box>
      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Stack>
  );
}

export function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent: string;
  to?: string;
}) {
  const body = (
    <>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.25 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '8px',
            bgcolor: accent,
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            border: `1.5px solid ${INK}`,
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
          {label}
        </Typography>
      </Stack>
      <Typography sx={{ fontSize: { xs: '1.6rem', md: '1.9rem' }, fontWeight: 800, lineHeight: 1.1 }}>{value}</Typography>
      {sub && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {sub}
        </Typography>
      )}
    </>
  );
  return (
    <Card sx={{ height: '100%' }}>
      {to ? (
        <CardContent component={RouterLink} to={to} sx={{ display: 'block', color: 'inherit', textDecoration: 'none', p: 2.5 }}>
          {body}
        </CardContent>
      ) : (
        <CardContent sx={{ p: 2.5 }}>{body}</CardContent>
      )}
    </Card>
  );
}

export function SectionCard({
  title,
  to,
  linkLabel = 'View all',
  children,
}: {
  title: string;
  to?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {title}
          </Typography>
          {to && (
            <Button component={RouterLink} to={to} size="small" endIcon={<ArrowForwardIcon />}>
              {linkLabel}
            </Button>
          )}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }} aria-busy="true">
      <CircularProgress aria-label={label} />
    </Box>
  );
}

export function ErrorNote({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <Alert
      severity="error"
      sx={{ border: `2px solid ${INK}` }}
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
    >
      {text}
    </Alert>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <Box sx={{ textAlign: 'center', py: 5, px: 2 }}>
      <Typography sx={{ fontWeight: 800, mb: 0.5 }}>{title}</Typography>
      {text && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: action ? 2 : 0 }}>
          {text}
        </Typography>
      )}
      {action}
    </Box>
  );
}

/** One row in a mobile-friendly list: text on the left, meta on the right, wraps on phones. */
export function ListRow({ primary, secondary, right }: { primary: React.ReactNode; secondary?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
      <Box sx={{ minWidth: 0, maxWidth: '100%' }}>
        <Typography sx={{ fontWeight: 700, wordBreak: 'break-word' }}>{primary}</Typography>
        {secondary && (
          <Typography variant="body2" sx={{ color: 'text.secondary', wordBreak: 'break-word' }}>
            {secondary}
          </Typography>
        )}
      </Box>
      {right && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0, flexWrap: 'wrap', rowGap: 1 }}>
          {right}
        </Stack>
      )}
    </Stack>
  );
}
