import React, { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, Card, CardContent, Divider, Stack, Typography } from '@mui/material';
import SensorsIcon from '@mui/icons-material/Sensors';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import api from '../../services/api';
import { EmptyState, INK, ListRow, Loading, PageHeader, PageShell, SectionCard } from '../portal/PortalUI';

const OPEN = new Set(['OPEN', 'PENDING', 'IN_PROGRESS', 'ASSIGNED']);

const FEATURES = [
  { icon: <MonitorHeartIcon />, title: 'System health scores', text: 'HVAC, plumbing, electrical and safety systems scored 0–100 for every building.' },
  { icon: <NotificationsActiveIcon />, title: 'Predictive alerts', text: 'Early warnings when a system starts to drift, before a tenant reports it.' },
  { icon: <ShowChartIcon />, title: 'Trends over time', text: '7, 30 and 90-day history so you can see what is improving or declining.' },
];

/**
 * Shown on /building-health while no building-monitoring data source is connected.
 * Explains what the page will do and, meanwhile, shows open maintenance per property
 * from live data so the page is still useful.
 */
const BuildingHealthSetupState: React.FC = () => {
  const requests = useQuery({
    queryKey: ['building-health', 'open-maintenance'],
    queryFn: async () => {
      const body = (await api.get('/maintenance', { params: { page: 1, limit: 100 } })).data;
      return (Array.isArray(body?.data) ? body.data : []) as any[];
    },
  });

  const byProperty = useMemo(() => {
    const map = new Map<string, { open: number; urgent: number }>();
    for (const r of requests.data ?? []) {
      if (!OPEN.has(String(r.status).toUpperCase())) continue;
      const name = String(r.Rental?.title ?? 'Unknown property').split(' - ')[0];
      const e = map.get(name) ?? { open: 0, urgent: 0 };
      e.open++;
      if (['EMERGENCY', 'URGENT', 'HIGH'].includes(String(r.priority).toUpperCase())) e.urgent++;
      map.set(name, e);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].urgent - a[1].urgent || b[1].open - a[1].open);
  }, [requests.data]);

  return (
    <PageShell>
      <PageHeader title="Building health" subtitle="Live condition of the systems in your buildings." />

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '14px',
                bgcolor: 'primary.main',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                border: `1px solid var(--color-border-default)`,
                flexShrink: 0,
              }}
            >
              <SensorsIcon fontSize="large" />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
                No building sensors connected yet
              </Typography>
              <Typography sx={{ color: 'text.secondary', maxWidth: 680 }}>
                Building health needs readings from smart meters, thermostats or a building management system. Once a
                source is connected, scores and alerts for each property will appear here automatically.
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ flexShrink: 0, width: { xs: '100%', md: 'auto' } }}>
              <Button variant="contained" component={RouterLink} to="/maintenance-dashboard">
                Maintenance dashboard
              </Button>
              <Button variant="outlined" component={RouterLink} to="/maintenance-requests">
                Open requests
              </Button>
            </Stack>
          </Stack>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, 1fr)' } }}>
            {FEATURES.map((f) => (
              <Stack key={f.title} direction="row" spacing={1.5}>
                <Box sx={{ color: 'primary.main', mt: 0.25 }}>{f.icon}</Box>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{f.title}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {f.text}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Box>
        </CardContent>
      </Card>

      <SectionCard title="Meanwhile: open maintenance by property" to="/maintenance-requests">
        {requests.isLoading ? (
          <Loading />
        ) : requests.isError ? (
          <EmptyState title="Maintenance data is unavailable" text="Try again in a moment." />
        ) : byProperty.length === 0 ? (
          <EmptyState title="No open maintenance" text="Every property is clear of open requests." />
        ) : (
          <Stack divider={<Divider />} spacing={1.5}>
            {byProperty.map(([name, v]) => (
              <ListRow
                key={name}
                primary={name}
                secondary={`${v.open} open ${v.open === 1 ? 'request' : 'requests'}`}
                right={
                  <Typography variant="body2" sx={{ fontWeight: 700, color: v.urgent ? 'error.main' : 'text.secondary' }}>
                    {v.urgent ? `${v.urgent} high priority` : 'Routine only'}
                  </Typography>
                }
              />
            ))}
          </Stack>
        )}
      </SectionCard>
    </PageShell>
  );
};

export default BuildingHealthSetupState;
