import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PhoneIcon from '@mui/icons-material/Phone';
import api from '../services/api';
import workOrderService from '../services/workOrderService';
import { CriticalAlertsDashboard } from '../components/emergency-response/CriticalAlertsDashboard';
import CrisisCommunicationHub from '../components/emergency-response/CrisisCommunicationHub';
import { EmptyState, INK, ListRow, Loading, PageHeader, StatusChip, fmtDate, pretty } from '../components/portal/PortalUI';

const OPEN = new Set(['OPEN', 'PENDING', 'IN_PROGRESS', 'ASSIGNED']);
const URGENT = new Set(['EMERGENCY', 'URGENT']);

/** Standard first-response steps. Guidance text, not data. */
const PROTOCOLS: { title: string; steps: string[] }[] = [
  {
    title: 'Gas smell or suspected leak',
    steps: [
      'Tell the tenant to leave the unit now and not to use switches, flames or phones inside.',
      'Call the gas utility emergency line or 911 from outside the building.',
      'Do not re-enter until the utility has cleared the building; log the visit on the request.',
    ],
  },
  {
    title: 'Water leak or flooding',
    steps: [
      'Ask the tenant to shut the nearest valve or the main water shut-off.',
      'Dispatch a plumber as an emergency work order and check the units below.',
      'Photograph damage for the insurance claim and arrange drying within 24 hours.',
    ],
  },
  {
    title: 'Fire or smoke',
    steps: ['Evacuate and call 911 first.', 'Notify all tenants in the building with an emergency alert.', 'Contact the insurer and arrange temporary housing if needed.'],
  },
  {
    title: 'Power outage',
    steps: [
      'Check the utility outage map before sending an electrician.',
      'If only one unit is affected, dispatch an electrician.',
      'Check on tenants who rely on medical equipment.',
    ],
  },
  {
    title: 'Lockout or broken entry door',
    steps: ['Verify the tenant’s identity against the lease.', 'Send a locksmith; secure the door the same day if it cannot be fixed.'],
  },
];

const EmergencyResponseCenterScreen: React.FC = () => {
  const requests = useQuery({
    queryKey: ['emergency', 'requests'],
    queryFn: async () => {
      const body = (await api.get('/maintenance', { params: { page: 1, limit: 100 } })).data;
      return (Array.isArray(body?.data) ? body.data : []) as any[];
    },
  });
  const workOrders = useQuery({
    queryKey: ['emergency', 'work-orders'],
    queryFn: async () => (await workOrderService.list({ page: 1, limit: 100 })).data,
  });
  const vendors = useQuery({
    queryKey: ['emergency', 'vendors'],
    queryFn: async () => {
      const body = (await api.get('/vendors', { params: { limit: 50 } })).data;
      return (Array.isArray(body?.data) ? body.data : []) as any[];
    },
  });

  const active = (requests.data ?? []).filter(
    (r) => OPEN.has(String(r.status).toUpperCase()) && URGENT.has(String(r.priority).toUpperCase())
  );
  const woByRequest = new Map((workOrders.data ?? []).filter((w) => w.maintenanceRequest?.id).map((w) => [w.maintenanceRequest!.id, w]));

  return (
    <Box sx={{ textAlign: 'left' }}>
      <PageHeader title="Emergency response" subtitle="Live emergencies, who to call, and what to do first." />

      <Stack spacing={3}>
        <Card>
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <CriticalAlertsDashboard />
          </CardContent>
        </Card>

        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' } }}>
          <Card>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
                Active emergencies
              </Typography>
              {requests.isLoading ? (
                <Loading />
              ) : active.length === 0 ? (
                <EmptyState title="No active emergencies" text="Emergency requests that are still open will be listed here." />
              ) : (
                <Stack divider={<Divider />} spacing={1.5}>
                  {active.map((r) => {
                    const wo = woByRequest.get(r.id);
                    const vendor = wo?.vendors?.[0]?.name;
                    return (
                      <ListRow
                        key={r.id}
                        primary={r.title}
                        secondary={`${r.Rental?.title ?? 'Property'} · reported ${fmtDate(r.createdAt)} · ${
                          vendor ? `${vendor} assigned` : 'no vendor assigned yet'
                        }`}
                        right={<StatusChip status={r.status} />}
                      />
                    );
                  })}
                </Stack>
              )}
              <Button component={RouterLink} to="/work-orders" size="small" sx={{ mt: 2 }}>
                Manage work orders
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
                Emergency contacts
              </Typography>
              <Box sx={{ p: 1.5, mb: 2, border: `1px solid var(--color-border-default)`, borderRadius: '10px', bgcolor: 'rgba(217, 45, 32, 0.08)' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                  <Box>
                    <Typography sx={{ fontWeight: 800 }}>Fire, police, ambulance</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Life-threatening situations, fire, gas you can smell outside
                    </Typography>
                  </Box>
                  <Button variant="contained" color="error" startIcon={<PhoneIcon />} href="tel:911" sx={{ flexShrink: 0 }}>
                    911
                  </Button>
                </Stack>
              </Box>
              {vendors.isLoading ? (
                <Loading />
              ) : (vendors.data ?? []).length === 0 ? (
                <EmptyState title="No vendors on file" text="Add vendors to see them as emergency contacts." />
              ) : (
                <Stack divider={<Divider />} spacing={1.25}>
                  {(vendors.data ?? []).map((v) => (
                    <ListRow
                      key={v.id}
                      primary={v.name}
                      secondary={pretty(v.specialty) || 'Vendor'}
                      right={
                        v.phone ? (
                          <Link href={`tel:${v.phone}`} underline="hover">
                            {v.phone}
                          </Link>
                        ) : (
                          <Button size="small" component={RouterLink} to="/work-orders">
                            Dispatch
                          </Button>
                        )
                      }
                    />
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Box>

        <Card>
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
              Response protocols
            </Typography>
            {PROTOCOLS.map((p) => (
              <Accordion key={p.title} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', '&:before': { display: 'none' }, mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography sx={{ fontWeight: 700 }}>{p.title}</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0 }}>
                  <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                    {p.steps.map((s) => (
                      <Typography component="li" variant="body2" key={s} sx={{ mb: 0.5 }}>
                        {s}
                      </Typography>
                    ))}
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}
          </CardContent>
        </Card>

        <CrisisCommunicationHub />
      </Stack>
    </Box>
  );
};

export default EmergencyResponseCenterScreen;
