import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import DescriptionIcon from '@mui/icons-material/Description';
import BuildIcon from '@mui/icons-material/Build';
import PaymentsIcon from '@mui/icons-material/Payments';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import api from '../services/api';

/**
 * Home dashboard: the portfolio at a glance. All figures come from
 * GET /api/dashboard/overview, which applies the caller's tenancy scope.
 */

interface Overview {
  portfolio: { totalRentals: number; occupied: number; vacant: number; occupancyRate: number; activeLeases: number };
  rent: {
    collectedThisMonth: number;
    pendingAmount: number;
    pendingCount: number;
    failedAmount: number;
    failedCount: number;
    monthly: { month: string; collected: number }[];
  };
  maintenance: { open: number; urgent: number };
  applications: { pending: number };
  recentMaintenance: { id: string; title: string; status: string; priority: string; createdAt: string; rental: string | null }[];
  recentPayments: { id: string; amount: number; status: string; date: string; tenant: string | null; rental: string | null }[];
  expiringLeases: { id: string; endDate: string; rentAmount: number; tenant: string | null; rental: string | null }[];
}

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const date = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const daysUntil = (s: string) => Math.max(0, Math.ceil((new Date(s).getTime() - Date.now()) / 86_400_000));
const pretty = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

const PRIORITY_COLOR: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  EMERGENCY: 'error',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'default',
};
const PAYMENT_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  COMPLETED: 'success',
  PENDING: 'warning',
  FAILED: 'error',
  REFUNDED: 'default',
};

function Kpi({
  icon,
  label,
  value,
  sub,
  accent,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent: string;
  to: string;
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent component={RouterLink} to={to} sx={{ display: 'block', color: 'inherit', textDecoration: 'none', p: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              bgcolor: accent,
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              border: '1.5px solid #140827',
            }}
          >
            {icon}
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
            {label}
          </Typography>
        </Stack>
        <Typography sx={{ fontSize: '1.9rem', fontWeight: 800, lineHeight: 1.1 }}>{value}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {sub}
        </Typography>
      </CardContent>
    </Card>
  );
}

function Section({ title, to, children }: { title: string; to: string; children: React.ReactNode }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {title}
          </Typography>
          <Button component={RouterLink} to={to} size="small" endIcon={<ArrowForwardIcon />}>
            View all
          </Button>
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Typography variant="body2" sx={{ color: 'text.secondary', py: 2 }}>
      {text}
    </Typography>
  );
}

function RentChart({ data }: { data: Overview['rent']['monthly'] }) {
  const max = Math.max(1, ...data.map((d) => d.collected));
  return (
    <Stack direction="row" alignItems="flex-end" spacing={1.5} sx={{ height: 170, pt: 1 }}>
      {data.map((d) => (
        <Stack key={d.month} alignItems="center" spacing={0.75} sx={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {d.collected ? money(d.collected) : ''}
          </Typography>
          <Box
            title={`${d.month}: ${money(d.collected)}`}
            sx={{
              width: '100%',
              maxWidth: 48,
              height: `${Math.max(2, (d.collected / max) * 110)}px`,
              bgcolor: 'primary.main',
              border: '1.5px solid #140827',
              borderRadius: '6px 6px 0 0',
            }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            {d.month}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

const Dashboard: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: async () => (await api.get<{ data: Overview }>('/dashboard/overview')).data.data,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error || !data) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        Could not load the dashboard overview. Check that the API is running, then refresh.
      </Alert>
    );
  }

  const { portfolio, rent, maintenance, applications } = data;
  const grid = { display: 'grid', gap: 2.5 } as const;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto', textAlign: 'left' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Portfolio overview
        </Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Occupancy, rent, maintenance and leasing across your properties.
        </Typography>
      </Box>

      <Box sx={{ ...grid, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' }, mb: 2.5 }}>
        <Kpi
          icon={<HomeWorkIcon fontSize="small" />}
          label="Occupancy"
          value={`${portfolio.occupancyRate}%`}
          sub={`${portfolio.occupied} of ${portfolio.totalRentals} units let · ${portfolio.vacant} vacant`}
          accent="#f55809"
          to="/rentals"
        />
        <Kpi
          icon={<DescriptionIcon fontSize="small" />}
          label="Active leases"
          value={String(portfolio.activeLeases)}
          sub={`${data.expiringLeases.length} ending in the next 60 days`}
          accent="#9a57ff"
          to="/leases"
        />
        <Kpi
          icon={<PaymentsIcon fontSize="small" />}
          label="Rent collected"
          value={money(rent.collectedThisMonth)}
          sub={`This month · ${money(rent.pendingAmount)} pending`}
          accent="#0db664"
          to="/payments"
        />
        <Kpi
          icon={<BuildIcon fontSize="small" />}
          label="Open maintenance"
          value={String(maintenance.open)}
          sub={`${maintenance.urgent} high priority or emergency`}
          accent="#ffb900"
          to="/maintenance-requests"
        />
        <Kpi
          icon={<AssignmentIndIcon fontSize="small" />}
          label="Applications"
          value={String(applications.pending)}
          sub="Waiting for screening"
          accent="#397ae7"
          to="/tenant-screening"
        />
      </Box>

      {rent.failedCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2.5, border: '2px solid #140827' }}>
          {rent.failedCount} rent payment{rent.failedCount === 1 ? '' : 's'} failed ({money(rent.failedAmount)}).{' '}
          <RouterLink to="/overdue-payments">Review overdue payments</RouterLink>
        </Alert>
      )}

      <Box sx={{ ...grid, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, mb: 2.5 }}>
        <Section title="Rent collected, last 6 months" to="/payments">
          <RentChart data={rent.monthly} />
        </Section>
        <Section title="Leases ending soon" to="/leases">
          {data.expiringLeases.length === 0 ? (
            <Empty text="No leases end in the next 60 days." />
          ) : (
            <Stack divider={<Divider flexItem />} spacing={1.25}>
              {data.expiringLeases.map((l) => (
                <Stack key={l.id} direction="row" justifyContent="space-between" spacing={2}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }} noWrap>
                      {l.tenant ?? 'Tenant'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                      {l.rental}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {date(l.endDate)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      in {daysUntil(l.endDate)} days
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          )}
        </Section>
      </Box>

      <Box sx={{ ...grid, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <Section title="Recent maintenance" to="/maintenance-requests">
          {data.recentMaintenance.length === 0 ? (
            <Empty text="No maintenance requests yet." />
          ) : (
            <Stack divider={<Divider flexItem />} spacing={1.25}>
              {data.recentMaintenance.map((m) => (
                <Stack key={m.id} direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }} noWrap>
                      {m.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                      {m.rental} · {date(m.createdAt)}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                    <Chip size="small" label={pretty(m.priority)} color={PRIORITY_COLOR[m.priority] ?? 'default'} />
                    <Chip size="small" label={pretty(m.status)} variant="outlined" />
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </Section>
        <Section title="Recent rent payments" to="/payments">
          {data.recentPayments.length === 0 ? (
            <Empty text="No rent payments recorded yet." />
          ) : (
            <Stack divider={<Divider flexItem />} spacing={1.25}>
              {data.recentPayments.map((p) => (
                <Stack key={p.id} direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }} noWrap>
                      {p.tenant ?? 'Tenant'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                      {p.rental} · {date(p.date)}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexShrink: 0 }}>
                    <Typography sx={{ fontWeight: 800 }}>{money(p.amount)}</Typography>
                    <Chip size="small" label={pretty(p.status)} color={PAYMENT_COLOR[p.status] ?? 'default'} />
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </Section>
      </Box>
    </Box>
  );
};

export default Dashboard;
