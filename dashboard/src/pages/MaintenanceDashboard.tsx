import React, { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Timeline as TimelineIcon, TrendingUp, History, Assignment } from '@mui/icons-material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Cell,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../services/api';
import workOrderService, { apiErrorMessage, WorkOrderItem } from '../services/workOrderService';
import {
  EmptyState,
  ErrorNote,
  INK,
  Loading,
  PageHeader,
  PriorityChip,
  StatusChip,
  fmtDate,
  money,
} from '../components/portal/PortalUI';

/**
 * Maintenance dashboard built from live data: maintenance requests (GET /api/maintenance)
 * joined with work orders and their quotes (GET /api/work-orders).
 */

interface RequestRow {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  createdAt: string;
  scheduledDate?: string | null;
  completedDate?: string | null;
  Rental?: { id: string; title?: string | null; unitNumber?: string | null } | null;
}

interface Item extends RequestRow {
  property: string;
  system: string;
  cost: number;
  costIsFinal: boolean;
  workOrder?: WorkOrderItem;
}

const COLORS = { emergency: '#D92D20', high: '#F5A524', routine: '#F25C05', done: '#12A150', blue: '#2E6BE6' };
const SYSTEM_COLORS = ['#F25C05', '#2E6BE6', '#12A150', '#F5A524', '#8E44AD', '#D92D20', '#6B7280'];

const SYSTEM_RULES: [string, RegExp][] = [
  ['Plumbing', /pipe|leak|drain|sink|toilet|water|faucet|plumb|dishwasher|disposal/i],
  ['HVAC', /hvac|air condition|\bac\b|heat|furnace|thermostat|cooling/i],
  ['Electrical', /electric|outlet|light|fixture|breaker|wiring|smoke detector|batter/i],
  ['Doors & locks', /door|lock|key|window/i],
  ['Appliances', /fridge|refrigerator|oven|stove|washer|dryer|appliance/i],
  ['Safety', /gas|smoke|carbon|fire/i],
];
const systemOf = (r: RequestRow) => {
  const text = `${r.title} ${r.description ?? ''}`;
  // Gas smells are a safety issue first.
  if (/gas/i.test(text)) return 'Safety';
  return SYSTEM_RULES.find(([, re]) => re.test(text))?.[0] ?? 'General';
};
const propertyOf = (title?: string | null) => (title ? title.split(' - ')[0] : 'Unknown property');
const isDone = (s: string) => ['COMPLETED', 'CLOSED', 'RESOLVED', 'CANCELLED'].includes(String(s).toUpperCase());
const isEmergency = (p: string) => ['EMERGENCY', 'URGENT'].includes(String(p).toUpperCase());

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return (
    <div role="tabpanel" hidden={value !== index} id={`maintenance-tabpanel-${index}`} aria-labelledby={`maintenance-tab-${index}`}>
      {value === index && <Box sx={{ p: { xs: 2, md: 3 } }}>{children}</Box>}
    </div>
  );
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const MaintenanceDashboard: React.FC = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [filters, setFilters] = useState({ property: '', system: '', priority: '', status: '' });

  const requests = useQuery({
    queryKey: ['maintenance-dashboard', 'requests'],
    queryFn: async () => {
      const body = (await api.get('/maintenance', { params: { page: 1, limit: 100 } })).data;
      return (Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : []) as RequestRow[];
    },
  });
  const workOrders = useQuery({
    queryKey: ['maintenance-dashboard', 'work-orders'],
    queryFn: async () => (await workOrderService.list({ page: 1, limit: 100 })).data,
  });

  const createWo = useMutation({
    mutationFn: (maintenanceRequestId: string) => workOrderService.create({ maintenanceRequestId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance-dashboard', 'work-orders'] }),
  });

  const items: Item[] = useMemo(() => {
    const byRequest = new Map<string, WorkOrderItem>();
    for (const w of workOrders.data ?? []) if (w.maintenanceRequest?.id) byRequest.set(w.maintenanceRequest.id, w);
    return (requests.data ?? []).map((r) => {
      const wo = byRequest.get(r.id);
      const quotes = wo?.quotes ?? [];
      const accepted = quotes.find((q) => String(q.status).toUpperCase() === 'ACCEPTED');
      const cheapest = quotes.length ? Math.min(...quotes.map((q) => Number(q.amount) || 0)) : 0;
      return {
        ...r,
        property: propertyOf(r.Rental?.title),
        system: systemOf(r),
        cost: accepted ? Number(accepted.amount) : cheapest,
        costIsFinal: Boolean(accepted),
        workOrder: wo,
      };
    });
  }, [requests.data, workOrders.data]);

  const options = useMemo(
    () => ({
      properties: Array.from(new Set(items.map((i) => i.property))).sort(),
      systems: Array.from(new Set(items.map((i) => i.system))).sort(),
      priorities: Array.from(new Set(items.map((i) => String(i.priority).toUpperCase()))),
      statuses: Array.from(new Set(items.map((i) => String(i.status).toUpperCase()))),
    }),
    [items]
  );

  const filtered = items.filter(
    (i) =>
      (!filters.property || i.property === filters.property) &&
      (!filters.system || i.system === filters.system) &&
      (!filters.priority || String(i.priority).toUpperCase() === filters.priority) &&
      (!filters.status || String(i.status).toUpperCase() === filters.status)
  );

  // Requests per week for the last 8 weeks, split by urgency.
  const weekly = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay() - 7 * 7);
    const weeks = Array.from({ length: 8 }, (_, k) => {
      const from = new Date(start);
      from.setDate(start.getDate() + 7 * k);
      return {
        from,
        label: from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        Emergency: 0,
        High: 0,
        Routine: 0,
      };
    });
    for (const i of filtered) {
      const t = new Date(i.createdAt).getTime();
      const w = [...weeks].reverse().find((x) => x.from.getTime() <= t);
      if (!w || t < start.getTime()) continue;
      const p = String(i.priority).toUpperCase();
      if (isEmergency(p)) w.Emergency++;
      else if (p === 'HIGH') w.High++;
      else w.Routine++;
    }
    return weeks;
  }, [filtered]);

  // Quoted / approved spend per month for the last 6 months, from work-order quotes.
  const monthly = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, k) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + k, 1);
      return { key: monthKey(d), month: d.toLocaleDateString('en-US', { month: 'short' }), Emergency: 0, Routine: 0 };
    });
    for (const i of filtered) {
      if (!i.cost) continue;
      const m = months.find((x) => x.key === monthKey(new Date(i.createdAt)));
      if (!m) continue;
      if (isEmergency(i.priority)) m.Emergency += i.cost;
      else m.Routine += i.cost;
    }
    return months;
  }, [filtered]);

  const bySystem = useMemo(() => {
    const map = new Map<string, { system: string; count: number; open: number; cost: number; days: number[] }>();
    for (const i of filtered) {
      const s = map.get(i.system) ?? { system: i.system, count: 0, open: 0, cost: 0, days: [] };
      s.count++;
      if (!isDone(i.status)) s.open++;
      s.cost += i.cost;
      if (i.completedDate) s.days.push((new Date(i.completedDate).getTime() - new Date(i.createdAt).getTime()) / 86400000);
      map.set(i.system, s);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [filtered]);

  const totalCost = filtered.reduce((s, i) => s + i.cost, 0);
  const emergencyCost = filtered.filter((i) => isEmergency(i.priority)).reduce((s, i) => s + i.cost, 0);
  const sixMonthCost = monthly.reduce((s, m) => s + m.Emergency + m.Routine, 0);
  const completed = filtered
    .filter((i) => isDone(i.status))
    .sort((a, b) => new Date(b.completedDate ?? b.createdAt).getTime() - new Date(a.completedDate ?? a.createdAt).getTime());
  const timelineCards = [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 9);

  const loading = requests.isLoading || workOrders.isLoading;
  const select = (key: keyof typeof filters, label: string, values: string[], fmt: (v: string) => string = (v) => v) => (
    <TextField
      select
      size="small"
      label={label}
      value={filters[key]}
      onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
      sx={{ minWidth: 180, flex: { xs: '1 1 100%', sm: '0 1 200px' } }}
    >
      <MenuItem value="">All</MenuItem>
      {values.map((v) => (
        <MenuItem key={v} value={v}>
          {fmt(v)}
        </MenuItem>
      ))}
    </TextField>
  );
  const pretty = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');

  return (
    <Box sx={{ p: { xs: 0, md: 1 }, textAlign: 'left' }}>
      <PageHeader
        title="Maintenance dashboard"
        subtitle="Request volume, spend and patterns across your properties."
        action={
          <Button variant="outlined" component={RouterLink} to="/maintenance-requests">
            All requests
          </Button>
        }
      />

      {(requests.isError || workOrders.isError) && (
        <Box sx={{ mb: 2 }}>
          <ErrorNote
            text="Some maintenance data could not be loaded."
            onRetry={() => {
              requests.refetch();
              workOrders.refetch();
            }}
          />
        </Box>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          <Typography sx={{ fontWeight: 800, mb: 1.5 }}>Filters</Typography>
          <Stack direction="row" spacing={0} sx={{ flexWrap: 'wrap', gap: 2 }}>
            {select('property', 'Property', options.properties)}
            {select('system', 'System', options.systems)}
            {select('priority', 'Priority', options.priorities, pretty)}
            {select('status', 'Status', options.statuses, pretty)}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile sx={{ borderBottom: `1px solid var(--color-border-default)` }}>
          <Tab icon={<TimelineIcon />} iconPosition="start" label="Timeline" id="maintenance-tab-0" />
          <Tab icon={<TrendingUp />} iconPosition="start" label="Costs" id="maintenance-tab-1" />
          <Tab icon={<History />} iconPosition="start" label="History & patterns" id="maintenance-tab-2" />
          <Tab icon={<Assignment />} iconPosition="start" label="Work orders" id="maintenance-tab-3" />
        </Tabs>

        {loading ? (
          <Loading />
        ) : (
          <>
            <TabPanel value={tab} index={0}>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>New requests per week</Typography>
              <Box sx={{ height: 280, mb: 3 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekly} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="Emergency" stackId="a" fill={COLORS.emergency} />
                    <Bar dataKey="High" stackId="a" fill={COLORS.high} />
                    <Bar dataKey="Routine" stackId="a" fill={COLORS.routine} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>

              <Typography sx={{ fontWeight: 800, mb: 1.5 }}>Latest requests</Typography>
              {timelineCards.length === 0 ? (
                <EmptyState title="No requests match these filters" />
              ) : (
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' } }}>
                  {timelineCards.map((i) => (
                    <Paper key={i.id} sx={{ p: 2, border: `1px solid var(--color-border-default)` }}>
                      <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.5 }}>
                        <Typography sx={{ fontWeight: 700 }}>{i.title}</Typography>
                        <PriorityChip priority={i.priority} />
                      </Stack>
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                        {i.Rental?.title ?? i.property} · {i.system}
                      </Typography>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">{fmtDate(i.createdAt)}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {i.cost ? `${money(i.cost)}${i.costIsFinal ? '' : ' quoted'}` : 'No quote yet'}
                        </Typography>
                      </Stack>
                      <Box sx={{ mt: 1 }}>
                        <StatusChip status={i.status} />
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
            </TabPanel>

            <TabPanel value={tab} index={1}>
              <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) minmax(0, 1fr)' } }}>
                <Paper sx={{ p: 2, border: `1px solid var(--color-border-default)` }}>
                  <Typography sx={{ fontWeight: 800, mb: 1 }}>Quoted spend by month</Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(v) => `$${Number(v).toLocaleString()}`} width={70} />
                        <RechartsTooltip formatter={(v: any) => money(Number(v))} />
                        <Legend />
                        <Bar dataKey="Routine" stackId="a" fill={COLORS.routine} />
                        <Bar dataKey="Emergency" stackId="a" fill={COLORS.emergency} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
                <Stack spacing={2}>
                  <Paper sx={{ p: 2, border: `1px solid var(--color-border-default)` }}>
                    <Typography sx={{ fontWeight: 800, mb: 1 }}>Spend by system</Typography>
                    {bySystem.some((s) => s.cost > 0) ? (
                      <Box sx={{ height: 200 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={bySystem.filter((s) => s.cost > 0)} dataKey="cost" nameKey="system" outerRadius={75} innerRadius={40}>
                              {bySystem
                                .filter((s) => s.cost > 0)
                                .map((s, k) => (
                                  <Cell key={s.system} fill={SYSTEM_COLORS[k % SYSTEM_COLORS.length]} stroke={INK} />
                                ))}
                            </Pie>
                            <RechartsTooltip formatter={(v: any) => money(Number(v))} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </Box>
                    ) : (
                      <EmptyState title="No quotes yet" />
                    )}
                  </Paper>
                  <Paper sx={{ p: 2, border: `1px solid var(--color-border-default)` }}>
                    <Typography sx={{ fontWeight: 800, mb: 1 }}>Key figures</Typography>
                    <Stack spacing={0.75}>
                      {[
                        ['Quoted, last 6 months', money(sixMonthCost)],
                        ['Average per month', money(sixMonthCost / 6)],
                        ['Emergency share', totalCost ? `${Math.round((emergencyCost / totalCost) * 100)}%` : '—'],
                      ].map(([k, v]) => (
                        <Stack key={k} direction="row" justifyContent="space-between">
                          <Typography variant="body2">{k}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {v}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Paper>
                </Stack>
              </Box>
            </TabPanel>

            <TabPanel value={tab} index={2}>
              <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' } }}>
                <Paper sx={{ p: 2, border: `1px solid var(--color-border-default)` }}>
                  <Typography sx={{ fontWeight: 800, mb: 1.5 }}>Requests by system</Typography>
                  {bySystem.length === 0 ? (
                    <EmptyState title="No requests match these filters" />
                  ) : (
                    <Stack divider={<Divider />} spacing={1.25}>
                      {bySystem.map((s) => {
                        const avg = s.days.length ? s.days.reduce((a, b) => a + b, 0) / s.days.length : null;
                        return (
                          <Stack key={s.system} direction="row" justifyContent="space-between" spacing={2}>
                            <Box>
                              <Typography sx={{ fontWeight: 700 }}>{s.system}</Typography>
                              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                {s.count} {s.count === 1 ? 'request' : 'requests'} · {s.open} open
                                {avg != null ? ` · resolved in ${avg < 1 ? 'under a day' : `${Math.round(avg)} days`} on average` : ''}
                              </Typography>
                            </Box>
                            <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{s.cost ? money(s.cost) : '—'}</Typography>
                          </Stack>
                        );
                      })}
                    </Stack>
                  )}
                </Paper>
                <Paper sx={{ p: 2, border: `1px solid var(--color-border-default)` }}>
                  <Typography sx={{ fontWeight: 800, mb: 1.5 }}>Recently completed</Typography>
                  {completed.length === 0 ? (
                    <EmptyState title="Nothing completed yet" />
                  ) : (
                    <TableContainer sx={{ overflowX: 'auto' }}>
                      <Table size="small" sx={{ minWidth: 420 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell>Completed</TableCell>
                            <TableCell>Request</TableCell>
                            <TableCell align="right">Cost</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {completed.slice(0, 8).map((i) => (
                            <TableRow key={i.id}>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDate(i.completedDate ?? i.createdAt)}</TableCell>
                              <TableCell>
                                {i.title}
                                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                                  {i.Rental?.title ?? i.property}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">{i.cost ? money(i.cost) : '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Paper>
              </Box>
            </TabPanel>

            <TabPanel value={tab} index={3}>
              {createWo.isError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {apiErrorMessage(createWo.error, 'Could not create the work order.')}
                </Alert>
              )}
              <TableContainer component={Paper} sx={{ overflowX: 'auto', border: `1px solid var(--color-border-default)` }}>
                <Table sx={{ minWidth: 820 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Request</TableCell>
                      <TableCell>System</TableCell>
                      <TableCell>Priority</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Reported</TableCell>
                      <TableCell align="right">Cost</TableCell>
                      <TableCell>Work order</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>
                          {i.title}
                          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                            {i.Rental?.title ?? i.property}
                          </Typography>
                        </TableCell>
                        <TableCell>{i.system}</TableCell>
                        <TableCell>
                          <PriorityChip priority={i.priority} />
                        </TableCell>
                        <TableCell>
                          <StatusChip status={i.status} />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDate(i.createdAt)}</TableCell>
                        <TableCell align="right">{i.cost ? money(i.cost) : '—'}</TableCell>
                        <TableCell>
                          {i.workOrder ? (
                            <StatusChip status={i.workOrder.status} />
                          ) : isDone(i.status) ? (
                            '—'
                          ) : (
                            <Button size="small" variant="outlined" disabled={createWo.isPending} onClick={() => createWo.mutate(i.id)}>
                              Create
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                          No requests match these filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </TabPanel>
          </>
        )}
      </Card>
    </Box>
  );
};

export default MaintenanceDashboard;
