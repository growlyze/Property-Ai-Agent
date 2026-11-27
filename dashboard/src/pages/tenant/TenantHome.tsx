import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Card, CardContent, Divider, Stack, Typography } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import PaymentsIcon from '@mui/icons-material/Payments';
import BuildIcon from '@mui/icons-material/Build';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { useAuth } from '../../contexts/AuthContext';
import tenantPortalService, { TenantSummary } from '../../services/tenantPortalService';
import {
  EmptyState,
  ErrorNote,
  ListRow,
  Loading,
  PageHeader,
  PageShell,
  SectionCard,
  StatCard,
  StatusChip,
  PriorityChip,
  fmtDate,
  money,
  INK,
} from '../../components/portal/PortalUI';

const firstName = (name?: string) => (name || '').split(' ')[0] || 'there';

function LeaseCard({ summary }: { summary: TenantSummary | undefined }) {
  const lease = summary?.lease;
  if (!lease) {
    return (
      <Card>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
            <HomeIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Your lease
            </Typography>
          </Stack>
          <Typography sx={{ color: 'text.secondary' }} data-testid="no-lease">
            You don&apos;t have an active lease with us yet. Once your lease starts, your home, rent and payment details
            will appear here. Questions? Check your notifications or contact your property manager.
          </Typography>
        </CardContent>
      </Card>
    );
  }
  const r = lease.rental;
  const unit = r?.unitNumber ? `Unit ${r.unitNumber}` : null;
  const address = [r?.address, r?.city, r?.state].filter(Boolean).join(', ');
  return (
    <Card data-testid="lease-card">
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '10px',
                bgcolor: 'primary.main',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                border: `1px solid var(--color-border-default)`,
                flexShrink: 0,
              }}
            >
              <HomeIcon />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2, wordBreak: 'break-word' }}>
                {r?.title || unit || 'Your home'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', wordBreak: 'break-word' }}>
                {[unit && r?.title ? unit : null, address].filter(Boolean).join(' · ') || 'Address not on file'}
              </Typography>
            </Box>
          </Stack>
          <StatusChip status={lease.status} />
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: 2,
          }}
        >
          {[
            ['Monthly rent', money(lease.rentAmount)],
            ['Lease start', fmtDate(lease.startDate)],
            ['Lease end', fmtDate(lease.endDate)],
            ['Deposit', lease.securityDeposit != null ? money(lease.securityDeposit) : '—'],
          ].map(([label, value]) => (
            <Box key={label}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                {label}
              </Typography>
              <Typography sx={{ fontWeight: 800 }}>{value}</Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}

const TenantHome: React.FC = () => {
  const { user } = useAuth();

  const summaryQ = useQuery({
    queryKey: ['tenant-summary'],
    queryFn: tenantPortalService.getSummary,
    retry: false,
  });
  // Recent activity (also the fallback source for counts if the summary endpoint is unavailable).
  const maintQ = useQuery({
    queryKey: ['tenant-maintenance', 1, 5],
    queryFn: () => tenantPortalService.getMaintenance(1, 5),
    retry: false,
  });
  const payQ = useQuery({
    queryKey: ['tenant-payments', 1, 3],
    queryFn: () => tenantPortalService.getPayments(1, 3),
    retry: false,
  });
  const notifQ = useQuery({
    queryKey: ['tenant-notifications-count'],
    queryFn: () => tenantPortalService.getNotifications(1, 1),
    retry: false,
    enabled: summaryQ.isError,
  });

  if (summaryQ.isLoading) return <Loading />;

  const summary = summaryQ.data;
  const openRequests = (maintQ.data?.data ?? []).filter((m) => !['COMPLETED', 'CANCELLED'].includes(String(m.status).toUpperCase()));
  const openMaintenance = summary?.openMaintenance ?? (maintQ.data ? openRequests.length : undefined);
  const unread = summary?.unreadNotifications ?? notifQ.data?.unread;

  return (
    <PageShell>
      <PageHeader
        title={`Hi ${firstName(user?.name)}`}
        subtitle="Your home, rent and requests in one place."
      />

      {summaryQ.isError && (
        <Alert severity="info" sx={{ mb: 2.5, border: `1px solid var(--color-border-default)` }}>
          Your lease summary isn&apos;t available right now. Your payments and requests are still shown below.
        </Alert>
      )}

      <Box sx={{ mb: 2.5 }}>{summary !== undefined && <LeaseCard summary={summary} />}</Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, mb: 2.5 }}>
        <StatCard
          icon={<PaymentsIcon fontSize="small" />}
          label="Next payment"
          value={summary?.nextPayment ? money(summary.nextPayment.amount) : '—'}
          sub={summary?.nextPayment ? `Due ${fmtDate(summary.nextPayment.dueDate)}` : 'Nothing scheduled'}
          accent="#1e6bff"
          to="/my/payments"
        />
        <StatCard
          icon={<ReceiptLongIcon fontSize="small" />}
          label="Balance due"
          value={summary ? money(summary.balanceDue) : '—'}
          sub={summary && summary.balanceDue > 0 ? 'Please pay as soon as possible' : 'You are all paid up'}
          accent={summary && summary.balanceDue > 0 ? '#e53935' : '#0db664'}
          to="/my/payments"
        />
        <StatCard
          icon={<BuildIcon fontSize="small" />}
          label="Open requests"
          value={openMaintenance ?? '—'}
          sub="Maintenance in progress"
          accent="#ffb900"
          to="/my/maintenance"
        />
        <StatCard
          icon={<NotificationsIcon fontSize="small" />}
          label="Unread"
          value={unread ?? '—'}
          sub="Notifications"
          accent="#397ae7"
          to="/my/notifications"
        />
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<ReportProblemIcon />}
          component={RouterLink}
          to="/my/maintenance?report=1"
          data-testid="quick-report-issue"
        >
          Report an issue
        </Button>
        <Button variant="outlined" size="large" startIcon={<PaymentsIcon />} component={RouterLink} to="/my/payments">
          View payments
        </Button>
      </Stack>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <SectionCard title="Recent requests" to="/my/maintenance">
          {maintQ.isLoading ? (
            <Loading />
          ) : maintQ.isError ? (
            <ErrorNote text="Could not load your maintenance requests." onRetry={() => maintQ.refetch()} />
          ) : (maintQ.data?.data.length ?? 0) === 0 ? (
            <EmptyState title="No requests yet" text="If something in your home needs fixing, report it here." />
          ) : (
            <Stack divider={<Divider flexItem />} spacing={1.25}>
              {maintQ.data!.data.map((m) => (
                <ListRow
                  key={m.id}
                  primary={m.title}
                  secondary={`Reported ${fmtDate(m.createdAt)}`}
                  right={
                    <>
                      <PriorityChip priority={m.priority} />
                      <StatusChip status={m.status} />
                    </>
                  }
                />
              ))}
            </Stack>
          )}
        </SectionCard>
        <SectionCard title="Recent payments" to="/my/payments">
          {payQ.isLoading ? (
            <Loading />
          ) : payQ.isError ? (
            <ErrorNote text="Could not load your payments." onRetry={() => payQ.refetch()} />
          ) : (payQ.data?.data.length ?? 0) === 0 ? (
            <EmptyState title="No payments yet" text="Your rent payments will show up here." />
          ) : (
            <Stack divider={<Divider flexItem />} spacing={1.25}>
              {payQ.data!.data.map((p) => (
                <ListRow
                  key={p.id}
                  primary={money(p.amount, 2)}
                  secondary={fmtDate(p.paymentDate)}
                  right={<StatusChip status={p.status} />}
                />
              ))}
            </Stack>
          )}
        </SectionCard>
      </Box>
    </PageShell>
  );
};

export default TenantHome;
