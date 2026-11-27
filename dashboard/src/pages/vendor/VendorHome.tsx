import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import HandymanIcon from '@mui/icons-material/Handyman';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import PaymentsIcon from '@mui/icons-material/Payments';
import StarIcon from '@mui/icons-material/Star';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import { useAuth } from '../../contexts/AuthContext';
import vendorPortalService, { VendorProfile } from '../../services/vendorPortalService';
import workOrderService from '../../services/workOrderService';
import { EmptyState, ErrorNote, Loading, PageHeader, PageShell, SectionCard, StatCard, money, pretty, INK } from '../../components/portal/PortalUI';
import { JobCard } from './JobCard';

const asList = (v?: string[] | string | null) => (Array.isArray(v) ? v : v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);

function ProfileCard({ me }: { me: VendorProfile }) {
  const areas = asList(me.serviceAreas);
  const certs = asList(me.certifications);
  return (
    <Card data-testid="vendor-profile">
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
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
            <HandymanIcon />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2, wordBreak: 'break-word' }}>
              {me.name}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {[me.specialty ? pretty(me.specialty) : null, me.hourlyRate ? `${money(me.hourlyRate)}/hr` : null, me.availability ? pretty(me.availability) : null]
                .filter(Boolean)
                .join(' · ') || 'Vendor'}
            </Typography>
          </Box>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 2.5 }} sx={{ color: 'text.secondary', mb: areas.length || certs.length ? 1.5 : 0 }}>
          {me.phone && (
            <Stack direction="row" spacing={0.75} alignItems="center">
              <PhoneIcon sx={{ fontSize: 16 }} />
              <Typography variant="body2">{me.phone}</Typography>
            </Stack>
          )}
          {me.email && (
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
              <EmailIcon sx={{ fontSize: 16 }} />
              <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                {me.email}
              </Typography>
            </Stack>
          )}
        </Stack>
        {(areas.length > 0 || certs.length > 0) && (
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {areas.map((a) => (
              <Chip key={`a-${a}`} size="small" label={a} variant="outlined" />
            ))}
            {certs.map((c) => (
              <Chip key={`c-${c}`} size="small" label={c} color="secondary" variant="outlined" />
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

const VendorHome: React.FC = () => {
  const { user } = useAuth();
  const me = useQuery({ queryKey: ['vendor-me'], queryFn: vendorPortalService.getMe, retry: false });
  const active = useQuery({
    queryKey: ['vendor-jobs', 'home-active'],
    // status accepts a comma-separated list.
    queryFn: () => workOrderService.list({ status: 'OPEN,ASSIGNED,IN_PROGRESS,ON_HOLD', page: 1, limit: 20 }),
    retry: false,
  });

  if (me.isLoading) return <Loading />;

  const stats = me.data?.stats ?? {};
  const activeJobs = (active.data?.data ?? []).filter((j) => ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'].includes(j.status));

  return (
    <PageShell>
      <PageHeader
        title={`Hi ${(me.data?.name || user?.name || 'there').split(' ')[0]}`}
        subtitle="Your jobs, quotes and payouts."
        action={
          <Button variant="contained" component={RouterLink} to="/vendor/jobs" startIcon={<HandymanIcon />} fullWidth>
            View all jobs
          </Button>
        }
      />

      {me.isError ? (
        <Alert severity="info" sx={{ mb: 2.5, border: `1px solid var(--color-border-default)` }}>
          Your vendor profile isn&apos;t available right now. Your jobs are still listed below.
        </Alert>
      ) : (
        me.data && (
          <Box sx={{ mb: 2.5 }}>
            <ProfileCard me={me.data} />
          </Box>
        )
      )}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, mb: 2.5 }}>
        <StatCard
          icon={<HandymanIcon fontSize="small" />}
          label="Active jobs"
          value={stats.activeJobs ?? (active.data ? activeJobs.length : '—')}
          sub={`${stats.completedJobs ?? 0} completed`}
          accent="#1e6bff"
          to="/vendor/jobs"
        />
        <StatCard
          icon={<RequestQuoteIcon fontSize="small" />}
          label="Pending quotes"
          value={stats.pendingQuotes ?? '—'}
          sub="Awaiting a decision"
          accent="#4d8bff"
          to="/vendor/jobs"
        />
        <StatCard
          icon={<PaymentsIcon fontSize="small" />}
          label="Paid to you"
          value={stats.paidTotal != null ? money(stats.paidTotal) : '—'}
          sub={stats.pendingPaymentTotal ? `${money(stats.pendingPaymentTotal)} pending` : 'Nothing pending'}
          accent="#0db664"
          to="/vendor/payments"
        />
        <StatCard
          icon={stats.averageRating ? <StarIcon fontSize="small" /> : <TaskAltIcon fontSize="small" />}
          label="Rating"
          value={stats.averageRating ? Number(stats.averageRating).toFixed(1) : '—'}
          sub={stats.averageRating ? 'Average from managers' : 'No ratings yet'}
          accent="#ffb900"
        />
      </Box>

      <SectionCard title="Active jobs" to="/vendor/jobs">
        {active.isLoading ? (
          <Loading />
        ) : active.isError ? (
          <ErrorNote text="Could not load your jobs." onRetry={() => active.refetch()} />
        ) : activeJobs.length === 0 ? (
          <EmptyState title="No active jobs" text="When a manager assigns you a work order it will show up here." />
        ) : (
          <Stack spacing={1.5} data-testid="vendor-active-jobs">
            {activeJobs.slice(0, 5).map((j) => (
              <JobCard key={j.id} job={j} compact />
            ))}
          </Stack>
        )}
      </SectionCard>
    </PageShell>
  );
};

export default VendorHome;
