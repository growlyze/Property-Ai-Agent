// Property AI Agent Analytics Dashboard
// Portfolio analytics built from live data: dashboard overview, rentals,
// maintenance requests and the market-intelligence trend/competitor feeds.

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
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
  Typography,
} from '@mui/material';
import {
  AttachMoney as MoneyIcon,
  Build as MaintenanceIcon,
  Home as HomeIcon,
  Refresh as RefreshIcon,
  ReceiptLong as OutstandingIcon,
} from '@mui/icons-material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../services/api';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

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
}

interface RentalRow {
  id: string;
  title?: string | null;
  propertyType?: string | null;
  rent?: number | null;
  isAvailable?: boolean | null;
  status?: string | null;
}

interface MaintenanceRow {
  id: string;
  status: string;
  priority: string;
  createdAt: string;
  completedDate?: string | null;
  Rental?: { title?: string | null } | null;
}

interface MarketTrend {
  id: string;
  metric: string;
  currentValue: number;
  unit?: string;
  category: string;
}

interface Competitor {
  id: string;
  name: string;
  rentRange?: [number, number];
  occupancyRate?: number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const INK = '#140827';
const ORANGE = '#f55809';
const GREEN = '#0db664';
const AMBER = '#ffb900';
const RED = '#e5484d';
const BLUE = '#397ae7';
const PURPLE = '#9a57ff';

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const compactMoney = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`;
const pct = (n: number) => `${Math.round(n)}%`;
const pretty = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const fraction = (n: number | undefined) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.abs(v) <= 1 ? v * 100 : v;
};

/** "Sunrise Apartments - Unit 101" -> "Sunrise Apartments" */
const propertyName = (title?: string | null) => (title || 'Unassigned').split(' - ')[0].trim();

const listOf = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const tooltipStyle = {
  contentStyle: { borderRadius: 8, border: `1.5px solid ${INK}`, fontSize: 13 },
  labelStyle: { fontWeight: 700, color: INK },
};

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */

function Kpi({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: React.ReactNode;
  accent: string;
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
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
        <Typography sx={{ fontSize: '1.9rem', fontWeight: 800, lineHeight: 1.1 }}>{value}</Typography>
        <Typography component="div" variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {sub}
        </Typography>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card sx={{ height: '100%', minWidth: 0 }}>
      <CardHeader
        title={title}
        subheader={subtitle}
        titleTypographyProps={{ variant: 'h6', fontWeight: 800 }}
        sx={{ pb: 0.5 }}
      />
      <CardContent sx={{ pt: 1, '&:last-child': { pb: 2.5 } }}>{children}</CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {text}
      </Typography>
    </Box>
  );
}

function ChartBox({ height = 300, children }: { height?: number; children: React.ReactElement }) {
  return (
    <Box sx={{ width: '100%', height, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </Box>
  );
}

const grid2 = {
  display: 'grid',
  gap: 2.5,
  gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) minmax(0, 1fr)' },
} as const;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const AnalyticsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState(0);

  const overviewQ = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: async () => (await api.get<{ data: Overview }>('/dashboard/overview')).data.data,
  });
  const rentalsQ = useQuery({
    queryKey: ['analytics-rentals'],
    queryFn: async () => listOf<RentalRow>((await api.get('/rentals', { params: { limit: 200 } })).data),
  });
  const maintenanceQ = useQuery({
    queryKey: ['analytics-maintenance'],
    queryFn: async () =>
      listOf<MaintenanceRow>((await api.get('/maintenance', { params: { limit: 200 } })).data),
  });
  const marketQ = useQuery({
    queryKey: ['analytics-market'],
    queryFn: async () => {
      const [trends, competitors] = await Promise.all([
        api.get('/ai/trends').then((r) => listOf<MarketTrend>(r.data)).catch(() => []),
        api.get('/ai/competitors').then((r) => listOf<Competitor>(r.data)).catch(() => []),
      ]);
      return { trends, competitors };
    },
  });

  const refreshing =
    overviewQ.isFetching || rentalsQ.isFetching || maintenanceQ.isFetching || marketQ.isFetching;
  const refreshAll = () => {
    overviewQ.refetch();
    rentalsQ.refetch();
    maintenanceQ.refetch();
    marketQ.refetch();
  };

  const rentals = rentalsQ.data || [];
  const requests = maintenanceQ.data || [];

  /* ---------------- derived data ---------------- */

  const byProperty = React.useMemo(() => {
    const map = new Map<string, { property: string; units: number; occupied: number; rentRoll: number; rents: number[] }>();
    rentals.forEach((r) => {
      const key = propertyName(r.title);
      const row = map.get(key) || { property: key, units: 0, occupied: 0, rentRoll: 0, rents: [] };
      row.units += 1;
      const rent = Number(r.rent) || 0;
      if (rent) row.rents.push(rent);
      if (r.isAvailable === false) {
        row.occupied += 1;
        row.rentRoll += rent;
      }
      map.set(key, row);
    });
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        vacant: r.units - r.occupied,
        occupancy: r.units ? (r.occupied / r.units) * 100 : 0,
        avgRent: r.rents.length ? r.rents.reduce((a, b) => a + b, 0) / r.rents.length : 0,
      }))
      .sort((a, b) => b.rentRoll - a.rentRoll);
  }, [rentals]);

  const maintenanceStats = React.useMemo(() => {
    const priorities = ['EMERGENCY', 'HIGH', 'MEDIUM', 'LOW'];
    const priorityColor: Record<string, string> = { EMERGENCY: RED, HIGH: ORANGE, MEDIUM: AMBER, LOW: BLUE };
    const isOpen = (s: string) => !['COMPLETED', 'CANCELLED', 'CLOSED'].includes(s);
    const open = requests.filter((r) => isOpen(r.status));

    const byPriority = priorities
      .map((p) => ({ name: pretty(p), value: open.filter((r) => r.priority === p).length, color: priorityColor[p] }))
      .filter((d) => d.value > 0);

    const statusCounts = new Map<string, number>();
    requests.forEach((r) => statusCounts.set(r.status, (statusCounts.get(r.status) || 0) + 1));
    const byStatus = Array.from(statusCounts.entries()).map(([status, count]) => ({ name: pretty(status), count }));

    const propCounts = new Map<string, number>();
    open.forEach((r) => {
      const key = propertyName(r.Rental?.title);
      propCounts.set(key, (propCounts.get(key) || 0) + 1);
    });
    const byPropertyOpen = Array.from(propCounts.entries())
      .map(([property, count]) => ({ property, count }))
      .sort((a, b) => b.count - a.count);

    const ages = open.map((r) => (Date.now() - new Date(r.createdAt).getTime()) / 86_400_000).filter((d) => Number.isFinite(d));
    const avgAgeDays = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;

    return { total: requests.length, open: open.length, byPriority, byStatus, byPropertyOpen, avgAgeDays };
  }, [requests]);

  const market = React.useMemo(() => {
    const trends = marketQ.data?.trends || [];
    const competitors = marketQ.data?.competitors || [];
    const marketRent = trends.find((t) => t.category === 'rent')?.currentValue;
    const marketOccupancy = trends.find((t) => /occupancy/i.test(t.metric))?.currentValue;

    const residential = rentals.filter((r) => (r.propertyType || '').toUpperCase() !== 'COMMERCIAL' && Number(r.rent) > 0);
    const ourAvgRent = residential.length
      ? residential.reduce((s, r) => s + Number(r.rent), 0) / residential.length
      : 0;

    const comparison = [
      ...(ourAvgRent ? [{ name: 'Your portfolio', rent: Math.round(ourAvgRent), color: ORANGE }] : []),
      ...(marketRent ? [{ name: 'Market average', rent: Math.round(marketRent), color: INK }] : []),
      ...competitors
        .filter((c) => Array.isArray(c.rentRange))
        .map((c) => ({
          name: c.name,
          rent: Math.round(((c.rentRange as [number, number])[0] + (c.rentRange as [number, number])[1]) / 2),
          color: '#b9b2c4',
        })),
    ];
    return { marketRent, marketOccupancy, ourAvgRent, comparison, competitors };
  }, [marketQ.data, rentals]);

  /* ---------------- render ---------------- */

  const overview = overviewQ.data;
  const monthly = overview?.rent.monthly || [];
  const lastMonth = monthly.length > 1 ? monthly[monthly.length - 2].collected : 0;
  const thisMonth = overview?.rent.collectedThisMonth ?? 0;
  const revenueChange = lastMonth ? ((thisMonth - lastMonth) / lastMonth) * 100 : null;
  const outstanding = (overview?.rent.pendingAmount || 0) + (overview?.rent.failedAmount || 0);

  const rentStatus = overview
    ? [
        { name: 'Collected', value: overview.rent.collectedThisMonth, color: GREEN },
        { name: 'Pending', value: overview.rent.pendingAmount, color: AMBER },
        { name: 'Failed', value: overview.rent.failedAmount, color: RED },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto', textAlign: 'left' }}>
      {/* Header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
            Property Analytics
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            Revenue, occupancy, maintenance and market position across your portfolio.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={refreshAll}
          disabled={refreshing}
          sx={{ flexShrink: 0 }}
        >
          Refresh
        </Button>
      </Stack>

      {overviewQ.error && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={refreshAll}>
              Retry
            </Button>
          }
        >
          Could not load portfolio figures. Check that the API is running, then retry.
        </Alert>
      )}

      {/* KPIs */}
      <Box
        sx={{
          display: 'grid',
          gap: 2.5,
          mb: 3,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
        }}
      >
        {overviewQ.isLoading ? (
          <Box sx={{ gridColumn: '1 / -1', display: 'grid', placeItems: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : overview ? (
          <>
            <Kpi
              icon={<MoneyIcon fontSize="small" />}
              label="Rent collected this month"
              value={money(thisMonth)}
              accent={ORANGE}
              sub={
                revenueChange === null ? (
                  'No previous month to compare'
                ) : (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      size="small"
                      variant="outlined"
                      color={revenueChange >= 0 ? 'success' : 'error'}
                      label={`${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(1)}%`}
                    />
                    <span>vs {money(lastMonth)} last month</span>
                  </Stack>
                )
              }
            />
            <Kpi
              icon={<HomeIcon fontSize="small" />}
              label="Occupancy"
              value={pct(overview.portfolio.occupancyRate)}
              accent={GREEN}
              sub={`${overview.portfolio.occupied} of ${overview.portfolio.totalRentals} units occupied`}
            />
            <Kpi
              icon={<OutstandingIcon fontSize="small" />}
              label="Outstanding rent"
              value={money(outstanding)}
              accent={RED}
              sub={`${overview.rent.pendingCount} pending, ${overview.rent.failedCount} failed`}
            />
            <Kpi
              icon={<MaintenanceIcon fontSize="small" />}
              label="Open maintenance requests"
              value={String(overview.maintenance.open)}
              accent={AMBER}
              sub={`${overview.maintenance.urgent} urgent`}
            />
          </>
        ) : null}
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          aria-label="analytics dashboard tabs"
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          <Tab label="Financial Overview" />
          <Tab label="Property Performance" />
          <Tab label="Maintenance Analytics" />
          <Tab label="Market Insights" />
        </Tabs>
      </Paper>

      {/* Financial */}
      {activeTab === 0 && (
        <Stack spacing={2.5}>
          <Box sx={grid2}>
            <ChartCard title="Rent collected" subtitle="Completed rent payments, last 6 months">
              {monthly.length ? (
                <ChartBox>
                  <BarChart data={monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4ddd0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={compactMoney} tick={{ fontSize: 12 }} width={52} />
                    <Tooltip formatter={(v: any) => money(Number(v))} {...tooltipStyle} />
                    <Bar isAnimationActive={false} dataKey="collected" name="Collected" fill={ORANGE} stroke={INK} strokeWidth={1.5} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartBox>
              ) : (
                <Empty text={overviewQ.isLoading ? 'Loading…' : 'No rent payments recorded yet.'} />
              )}
            </ChartCard>

            <ChartCard title="This month's rent" subtitle="Collected vs pending vs failed">
              {rentStatus.length ? (
                <ChartBox>
                  <PieChart>
                    <Pie isAnimationActive={false} data={rentStatus} dataKey="value" nameKey="name" innerRadius="50%" outerRadius="80%" stroke={INK} strokeWidth={1.5}>
                      {rentStatus.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => money(Number(v))} {...tooltipStyle} />
                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                  </PieChart>
                </ChartBox>
              ) : (
                <Empty text={overviewQ.isLoading ? 'Loading…' : 'No rent due this month.'} />
              )}
            </ChartCard>
          </Box>

          <ChartCard title="Monthly rent roll by property" subtitle="Sum of rent on occupied units">
            {byProperty.some((p) => p.rentRoll > 0) ? (
              <ChartBox height={Math.max(220, byProperty.length * 48)}>
                <BarChart data={byProperty} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4ddd0" />
                  <XAxis type="number" tickFormatter={compactMoney} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="property" width={130} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => money(Number(v))} {...tooltipStyle} />
                  <Bar isAnimationActive={false} dataKey="rentRoll" name="Rent roll" fill={PURPLE} stroke={INK} strokeWidth={1.5} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ChartBox>
            ) : (
              <Empty text={rentalsQ.isLoading ? 'Loading…' : 'No occupied units yet.'} />
            )}
          </ChartCard>
        </Stack>
      )}

      {/* Property performance */}
      {activeTab === 1 && (
        <Stack spacing={2.5}>
          <ChartCard title="Occupancy by property" subtitle="Occupied and vacant units">
            {byProperty.length ? (
              <ChartBox>
                <BarChart data={byProperty} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4ddd0" />
                  <XAxis dataKey="property" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Bar isAnimationActive={false} dataKey="occupied" name="Occupied" stackId="u" fill={GREEN} stroke={INK} strokeWidth={1.5} />
                  <Bar isAnimationActive={false} dataKey="vacant" name="Vacant" stackId="u" fill="#e4ddd0" stroke={INK} strokeWidth={1.5} />
                </BarChart>
              </ChartBox>
            ) : (
              <Empty text={rentalsQ.isLoading ? 'Loading…' : 'No rentals found.'} />
            )}
          </ChartCard>

          <ChartCard title="Property summary">
            {byProperty.length ? (
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 520 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Property</TableCell>
                      <TableCell align="right">Units</TableCell>
                      <TableCell align="right">Occupancy</TableCell>
                      <TableCell align="right">Avg. rent</TableCell>
                      <TableCell align="right">Monthly rent roll</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {byProperty.map((p) => (
                      <TableRow key={p.property}>
                        <TableCell sx={{ fontWeight: 600 }}>{p.property}</TableCell>
                        <TableCell align="right">{p.units}</TableCell>
                        <TableCell align="right">
                          <Chip
                            size="small"
                            variant="outlined"
                            color={p.occupancy >= 90 ? 'success' : p.occupancy >= 50 ? 'warning' : 'error'}
                            label={pct(p.occupancy)}
                          />
                        </TableCell>
                        <TableCell align="right">{p.avgRent ? money(p.avgRent) : '—'}</TableCell>
                        <TableCell align="right">{money(p.rentRoll)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Empty text={rentalsQ.isLoading ? 'Loading…' : 'No rentals found.'} />
            )}
          </ChartCard>
        </Stack>
      )}

      {/* Maintenance */}
      {activeTab === 2 && (
        <Stack spacing={2.5}>
          {maintenanceQ.error && <Alert severity="error">Could not load maintenance requests.</Alert>}
          <Box
            sx={{
              display: 'grid',
              gap: 2.5,
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' },
            }}
          >
            <Kpi icon={<MaintenanceIcon fontSize="small" />} label="All requests" value={String(maintenanceStats.total)} accent={BLUE} sub="Across all properties" />
            <Kpi icon={<MaintenanceIcon fontSize="small" />} label="Open requests" value={String(maintenanceStats.open)} accent={AMBER} sub="Not yet completed" />
            <Kpi
              icon={<MaintenanceIcon fontSize="small" />}
              label="Average age of open requests"
              value={`${maintenanceStats.avgAgeDays.toFixed(1)} days`}
              accent={PURPLE}
              sub="Since the request was raised"
            />
          </Box>

          <Box sx={{ ...grid2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' } }}>
            <ChartCard title="Open requests by priority">
              {maintenanceStats.byPriority.length ? (
                <ChartBox>
                  <PieChart>
                    <Pie isAnimationActive={false} data={maintenanceStats.byPriority} dataKey="value" nameKey="name" innerRadius="50%" outerRadius="80%" stroke={INK} strokeWidth={1.5}>
                      {maintenanceStats.byPriority.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                  </PieChart>
                </ChartBox>
              ) : (
                <Empty text={maintenanceQ.isLoading ? 'Loading…' : 'No open maintenance requests.'} />
              )}
            </ChartCard>

            <ChartCard title="Requests by status">
              {maintenanceStats.byStatus.length ? (
                <ChartBox>
                  <BarChart data={maintenanceStats.byStatus} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4ddd0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
                    <Tooltip {...tooltipStyle} />
                    <Bar isAnimationActive={false} dataKey="count" name="Requests" fill={BLUE} stroke={INK} strokeWidth={1.5} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartBox>
              ) : (
                <Empty text={maintenanceQ.isLoading ? 'Loading…' : 'No maintenance requests yet.'} />
              )}
            </ChartCard>
          </Box>

          <ChartCard title="Open requests by property">
            {maintenanceStats.byPropertyOpen.length ? (
              <ChartBox height={Math.max(200, maintenanceStats.byPropertyOpen.length * 48)}>
                <BarChart data={maintenanceStats.byPropertyOpen} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4ddd0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="property" width={130} tick={{ fontSize: 12 }} />
                  <Tooltip {...tooltipStyle} />
                  <Bar isAnimationActive={false} dataKey="count" name="Open requests" fill={AMBER} stroke={INK} strokeWidth={1.5} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ChartBox>
            ) : (
              <Empty text={maintenanceQ.isLoading ? 'Loading…' : 'No open maintenance requests.'} />
            )}
          </ChartCard>
        </Stack>
      )}

      {/* Market */}
      {activeTab === 3 && (
        <Stack spacing={2.5}>
          <Box sx={grid2}>
            <ChartCard title="Rent comparison" subtitle="Average monthly rent: your residential units vs the local market">
              {market.comparison.length ? (
                <ChartBox height={Math.max(240, market.comparison.length * 48)}>
                  <BarChart data={market.comparison} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4ddd0" />
                    <XAxis type="number" tickFormatter={compactMoney} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: any) => money(Number(v))} {...tooltipStyle} />
                    {market.marketRent ? (
                      <ReferenceLine x={market.marketRent} stroke={INK} strokeDasharray="4 4" />
                    ) : null}
                    <Bar isAnimationActive={false} dataKey="rent" name="Average rent" stroke={INK} strokeWidth={1.5} radius={[0, 6, 6, 0]}>
                      {market.comparison.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartBox>
              ) : (
                <Empty text={marketQ.isLoading ? 'Loading…' : 'No market data available.'} />
              )}
            </ChartCard>

            <ChartCard title="Market position">
              {market.ourAvgRent && market.marketRent ? (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Your average residential rent
                    </Typography>
                    <Typography sx={{ fontSize: '1.6rem', fontWeight: 800 }}>{money(market.ourAvgRent)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Market average
                    </Typography>
                    <Typography sx={{ fontSize: '1.6rem', fontWeight: 800 }}>{money(market.marketRent)}</Typography>
                  </Box>
                  <Alert severity={market.ourAvgRent >= market.marketRent ? 'success' : 'info'}>
                    {(() => {
                      const diff = ((market.ourAvgRent - market.marketRent) / market.marketRent) * 100;
                      return diff >= 0
                        ? `Your rents are ${diff.toFixed(1)}% above the market average.`
                        : `Your rents are ${Math.abs(diff).toFixed(1)}% below the market average, so there may be room to raise rents at renewal.`;
                    })()}
                  </Alert>
                  {market.marketOccupancy !== undefined && overview && (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Occupancy: {pct(overview.portfolio.occupancyRate)} for your portfolio vs{' '}
                      {pct(fraction(market.marketOccupancy))} market-wide.
                    </Typography>
                  )}
                </Stack>
              ) : (
                <Empty text={marketQ.isLoading || rentalsQ.isLoading ? 'Loading…' : 'Not enough data to compare.'} />
              )}
            </ChartCard>
          </Box>
        </Stack>
      )}
    </Box>
  );
};

export default AnalyticsDashboard;
