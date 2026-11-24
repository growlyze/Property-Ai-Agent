import React, { useMemo, useState } from 'react';
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
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EventIcon from '@mui/icons-material/Event';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '../services/api';

/**
 * Predictive maintenance: looks at the maintenance request history of the
 * caller's properties (GET /api/maintenance, already tenancy-scoped), groups
 * requests by building system and flags systems whose recent failure rate
 * suggests preventive work is due.
 */

interface MaintenanceRow {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  createdAt: string;
  scheduledDate: string | null;
  completedDate: string | null;
  Rental?: { id: string; title: string; unitNumber?: string } | null;
}

type System = 'Plumbing' | 'HVAC' | 'Electrical' | 'Appliances' | 'Doors, windows & exterior' | 'General';

// Ordered: the first match wins (e.g. "roof leak" is exterior, "dishwasher leaking" an appliance).
const SYSTEM_RULES: [System, RegExp][] = [
  ['Doors, windows & exterior', /door|lock|window|screen|roof|paint|patio|gutter|siding/i],
  ['Electrical', /light|outlet|electric|breaker|smoke detector|wiring|power/i],
  ['Appliances', /dishwasher|stove|oven|gas|fridge|refrigerator|washer|dryer|microwave|disposal/i],
  ['Plumbing', /leak|pipe|drain|faucet|sink|toilet|water|clog|vanity/i],
  ['HVAC', /air condition|hvac|thermostat|heating|furnace/i],
];

const PREVENTIVE_ACTION: Record<System, string> = {
  Plumbing: 'Schedule a plumbing inspection: check supply lines, shut-off valves and drains.',
  HVAC: 'Book seasonal HVAC servicing: filters, refrigerant and thermostat calibration.',
  Electrical: 'Have an electrician test outlets, breakers and smoke detector circuits.',
  Appliances: 'Inspect appliance hoses, seals and gas connections; replace worn parts.',
  'Doors, windows & exterior': 'Walk the exterior: roof flashing, door hardware, window tracks.',
  General: 'Review recent requests for recurring issues.',
};

const match = (text: string) => SYSTEM_RULES.find(([, re]) => re.test(text))?.[0];
// The title is the clearest signal; fall back to the description.
const classify = (r: MaintenanceRow): System => match(r.title) ?? match(r.description ?? '') ?? 'General';

const building = (r: MaintenanceRow) => (r.Rental?.title ?? 'Unassigned').split(' - ')[0];
const date = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const pretty = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const OPEN = new Set(['OPEN', 'IN_PROGRESS', 'ON_HOLD']);
const DAY = 86_400_000;

const PRIORITY_COLOR: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  EMERGENCY: 'error',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'default',
};
const STATUS_COLOR: Record<string, 'success' | 'warning' | 'info' | 'default'> = {
  COMPLETED: 'success',
  IN_PROGRESS: 'info',
  OPEN: 'warning',
};
const RISK_COLOR = { High: 'error', Medium: 'warning', Low: 'success' } as const;

function Kpi({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: number; sub: string; accent: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 1.5, display: 'grid', placeItems: 'center', bgcolor: accent, color: '#fff' }}>
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

function Section({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {action}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

const Empty = ({ text }: { text: string }) => (
  <Typography variant="body2" sx={{ color: 'text.secondary', py: 2 }}>
    {text}
  </Typography>
);

const PredictiveMaintenanceDashboard: React.FC = () => {
  const [property, setProperty] = useState('all');
  const [system, setSystem] = useState('all');
  const [priority, setPriority] = useState('all');

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['predictive-maintenance-requests'],
    queryFn: async () => (await api.get<{ data: MaintenanceRow[] }>('/maintenance', { params: { limit: 200 } })).data.data ?? [],
  });

  const rows = useMemo(() => (data ?? []).map((r) => ({ ...r, system: classify(r), building: building(r) })), [data]);
  const properties = useMemo(() => Array.from(new Set(rows.map((r) => r.building))).sort(), [rows]);

  const filtered = rows.filter(
    (r) =>
      (property === 'all' || r.building === property) &&
      (system === 'all' || r.system === system) &&
      (priority === 'all' || r.priority === priority),
  );

  const now = Date.now();
  const recent = filtered.filter((r) => now - new Date(r.createdAt).getTime() <= 90 * DAY);
  const open = filtered.filter((r) => OPEN.has(r.status));
  const urgent = open.filter((r) => r.priority === 'EMERGENCY' || r.priority === 'HIGH');
  const upcoming = filtered
    .filter((r) => r.scheduledDate && OPEN.has(r.status) && new Date(r.scheduledDate).getTime() >= now - DAY)
    .sort((a, b) => new Date(a.scheduledDate!).getTime() - new Date(b.scheduledDate!).getTime());
  const completed90 = recent.filter((r) => r.status === 'COMPLETED').length;

  // Risk per building system, from request frequency and severity in the last 90 days.
  const risks = (Object.keys(PREVENTIVE_ACTION) as System[])
    .map((s) => {
      const list = recent.filter((r) => r.system === s);
      const severe = list.filter((r) => r.priority === 'EMERGENCY' || r.priority === 'HIGH').length;
      const score = list.length + severe * 2;
      const level: keyof typeof RISK_COLOR = score >= 6 ? 'High' : score >= 3 ? 'Medium' : 'Low';
      const units = Array.from(new Set(list.map((r) => r.Rental?.title).filter(Boolean))) as string[];
      return { system: s, count: list.length, severe, level, units, score };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.score - a.score);

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        Could not load maintenance history. Check that the API is running, then refresh.
      </Alert>
    );
  }

  const grid = { display: 'grid', gap: 2.5 } as const;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto', textAlign: 'left' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Predictive maintenance
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            Building systems at risk, based on the maintenance history of your properties.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()} disabled={isFetching}>
          Refresh
        </Button>
      </Stack>

      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ p: 2.5, display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
          <FormControl size="small" fullWidth>
            <InputLabel id="pm-property">Property</InputLabel>
            <Select labelId="pm-property" label="Property" value={property} onChange={(e) => setProperty(e.target.value)}>
              <MenuItem value="all">All properties</MenuItem>
              {properties.map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel id="pm-system">Building system</InputLabel>
            <Select labelId="pm-system" label="Building system" value={system} onChange={(e) => setSystem(e.target.value)}>
              <MenuItem value="all">All systems</MenuItem>
              {Object.keys(PREVENTIVE_ACTION).map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel id="pm-priority">Priority</InputLabel>
            <Select labelId="pm-priority" label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <MenuItem value="all">All priorities</MenuItem>
              {['EMERGENCY', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
                <MenuItem key={p} value={p}>
                  {pretty(p)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      <Box sx={{ ...grid, gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, mb: 2.5 }}>
        <Kpi icon={<BuildIcon fontSize="small" />} label="Open requests" value={open.length} sub="Open, in progress or on hold" accent="#FF5A00" />
        <Kpi icon={<WarningAmberIcon fontSize="small" />} label="Urgent" value={urgent.length} sub="Emergency or high priority, still open" accent="#D32F2F" />
        <Kpi icon={<EventIcon fontSize="small" />} label="Scheduled" value={upcoming.length} sub="Visits booked from today" accent="#0288D1" />
        <Kpi icon={<TaskAltIcon fontSize="small" />} label="Completed" value={completed90} sub="In the last 90 days" accent="#2E7D32" />
      </Box>

      <Box sx={{ ...grid, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, mb: 2.5 }}>
        <Section title="Systems at risk" subtitle="Request frequency and severity over the last 90 days">
          {risks.length === 0 ? (
            <Empty text="No maintenance requests in the last 90 days for this selection." />
          ) : (
            <Stack spacing={1.5}>
              {risks.map((r) => (
                <Box key={r.system} sx={{ border: '2px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 700 }}>{r.system}</Typography>
                    <Chip size="small" label={`${r.level} risk`} color={RISK_COLOR[r.level]} />
                  </Stack>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {r.count} request{r.count === 1 ? '' : 's'}
                    {r.severe ? `, ${r.severe} urgent` : ''} · {r.units.slice(0, 3).join(', ')}
                    {r.units.length > 3 ? ` +${r.units.length - 3} more` : ''}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {PREVENTIVE_ACTION[r.system]}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Section>

        <Section
          title="Upcoming visits"
          subtitle="Scheduled maintenance, soonest first"
          action={
            <Button component={RouterLink} to="/work-orders" size="small" sx={{ flexShrink: 0, whiteSpace: "nowrap" }}>
              Work orders
            </Button>
          }
        >
          {upcoming.length === 0 ? (
            <Empty text="Nothing scheduled for this selection." />
          ) : (
            <Stack divider={<Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}>
              {upcoming.slice(0, 8).map((r) => {
                const days = Math.ceil((new Date(r.scheduledDate!).getTime() - now) / DAY);
                return (
                  <Stack key={r.id} direction="row" justifyContent="space-between" spacing={2} sx={{ py: 1.25 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }} noWrap>
                        {r.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                        {r.Rental?.title ?? 'Unassigned'}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {date(r.scheduledDate!)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}
                      </Typography>
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </Section>
      </Box>

      <Section
        title="Maintenance history"
        subtitle="All requests for this selection, newest first"
        action={
          <Button component={RouterLink} to="/maintenance-requests" size="small" sx={{ flexShrink: 0, whiteSpace: "nowrap" }}>
            View all
          </Button>
        }
      >
        {filtered.length === 0 ? (
          <Empty text="No maintenance requests match these filters." />
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Reported</TableCell>
                  <TableCell>Issue</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>System</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{date(r.createdAt)}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{r.title}</TableCell>
                    <TableCell>{r.Rental?.title ?? '—'}</TableCell>
                    <TableCell>{r.system}</TableCell>
                    <TableCell>
                      <Chip size="small" label={pretty(r.priority)} color={PRIORITY_COLOR[r.priority] ?? 'default'} />
                    </TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={pretty(r.status)} color={STATUS_COLOR[r.status] ?? 'default'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Section>
    </Box>
  );
};

export default PredictiveMaintenanceDashboard;
