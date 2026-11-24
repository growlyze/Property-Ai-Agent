import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import EngineeringIcon from '@mui/icons-material/Engineering';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import StarIcon from '@mui/icons-material/Star';
import { useVendorList, useVendorPerformance } from '../hooks/useVendorPerformance';
import workOrderService, { WorkOrderItem } from '../services/workOrderService';
import { EmptyState, ErrorNote, INK, ListRow, Loading, PageHeader, StatCard, StatusChip, fmtDate, money, pretty } from '../components/portal/PortalUI';

interface VendorStats {
  id: string;
  name: string;
  specialty?: string;
  jobs: number;
  completed: number;
  active: number;
  quotes: number;
  accepted: number;
  acceptedValue: number;
  avgQuote: number;
  avgDaysToComplete: number | null;
}

const ACTIVE = new Set(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD']);

function statsFor(vendor: { id: string; name: string; specialty?: string }, orders: WorkOrderItem[]): VendorStats {
  const mine = orders.filter((w) => (w.vendors ?? []).some((v) => v.id === vendor.id));
  const quotes = orders.flatMap((w) => (w.quotes ?? []).filter((q) => q.vendorId === vendor.id));
  const accepted = quotes.filter((q) => String(q.status).toUpperCase() === 'ACCEPTED');
  const done = mine.filter((w) => w.status === 'COMPLETED');
  const durations = done
    .filter((w) => w.completedAt)
    .map((w) => (new Date(w.completedAt as string).getTime() - new Date(w.createdAt).getTime()) / 86400000);
  return {
    ...vendor,
    jobs: mine.length,
    completed: done.length,
    active: mine.filter((w) => ACTIVE.has(w.status)).length,
    quotes: quotes.length,
    accepted: accepted.length,
    acceptedValue: accepted.reduce((s, q) => s + Number(q.amount || 0), 0),
    avgQuote: quotes.length ? quotes.reduce((s, q) => s + Number(q.amount || 0), 0) / quotes.length : 0,
    avgDaysToComplete: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
  };
}

/**
 * Vendor performance from live work orders and quotes (GET /api/work-orders), plus
 * manager ratings where they exist (GET /api/vendor-performance).
 */
const VendorPerformanceAnalyticsScreen: React.FC = () => {
  const { data: vendorList, isLoading: vendorsLoading, error: vendorsError } = useVendorList();
  const vendors = vendorList ?? [];
  const [selectedVendor, setSelectedVendor] = useState<string>('');

  useEffect(() => {
    if (!selectedVendor && vendors.length > 0) setSelectedVendor(vendors[0].id);
  }, [vendors, selectedVendor]);

  const orders = useQuery({
    queryKey: ['vendor-performance', 'work-orders'],
    queryFn: async () => (await workOrderService.list({ page: 1, limit: 100 })).data,
  });

  const { ratings, averageScore } = useVendorPerformance(selectedVendor);

  const all = useMemo(() => vendors.map((v) => statsFor(v, orders.data ?? [])), [vendors, orders.data]);
  const current = all.find((v) => v.id === selectedVendor);
  const recentJobs = (orders.data ?? [])
    .filter((w) => (w.vendors ?? []).some((v) => v.id === selectedVendor))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  // Best fit per specialty: the vendor with the most completed jobs, then the best quote win rate.
  const bestFit = useMemo(() => {
    const bySpecialty = new Map<string, VendorStats>();
    for (const v of all) {
      const key = v.specialty || 'GENERAL';
      const cur = bySpecialty.get(key);
      const score = (s: VendorStats) => s.completed * 10 + (s.quotes ? s.accepted / s.quotes : 0);
      if (!cur || score(v) > score(cur)) bySpecialty.set(key, v);
    }
    return Array.from(bySpecialty.entries());
  }, [all]);

  const ratingCount = Array.isArray(ratings) ? ratings.length : 0;
  const avgRating = Number(averageScore?.averageScore ?? 0);

  return (
    <Box sx={{ textAlign: 'left' }}>
      <PageHeader
        title="Vendor performance"
        subtitle="Jobs, quotes and turnaround for each vendor, from your work orders."
        action={
          <TextField
            select
            size="small"
            label="Vendor"
            value={selectedVendor}
            onChange={(e) => setSelectedVendor(e.target.value)}
            sx={{ minWidth: 240 }}
            disabled={vendors.length === 0}
          >
            {vendors.map((v) => (
              <MenuItem key={v.id} value={v.id}>
                {v.name}
              </MenuItem>
            ))}
          </TextField>
        }
      />

      {(vendorsError || orders.isError) && (
        <Box sx={{ mb: 2 }}>
          <ErrorNote text="Some vendor data could not be loaded." onRetry={() => orders.refetch()} />
        </Box>
      )}

      {vendorsLoading || orders.isLoading ? (
        <Loading />
      ) : vendors.length === 0 ? (
        <Card>
          <EmptyState title="No vendors yet" text="Add a vendor to see performance metrics." />
        </Card>
      ) : (
        <Stack spacing={3}>
          <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
            <StatCard
              icon={<EngineeringIcon fontSize="small" />}
              label="Jobs assigned"
              value={current?.jobs ?? 0}
              sub={`${current?.active ?? 0} in progress`}
              accent="#F25C05"
            />
            <StatCard
              icon={<TaskAltIcon fontSize="small" />}
              label="Completed"
              value={current?.completed ?? 0}
              sub={
                current?.avgDaysToComplete != null
                  ? `${current.avgDaysToComplete < 1 ? 'Under a day' : `${Math.round(current.avgDaysToComplete)} days`} on average`
                  : 'No completion times yet'
              }
              accent="#12A150"
            />
            <StatCard
              icon={<RequestQuoteIcon fontSize="small" />}
              label="Quotes won"
              value={current?.quotes ? `${current.accepted} of ${current.quotes}` : '0'}
              sub={current?.acceptedValue ? `${money(current.acceptedValue)} approved` : 'No approved quotes yet'}
              accent="#2E6BE6"
            />
            <StatCard
              icon={<StarIcon fontSize="small" />}
              label="Manager rating"
              value={ratingCount ? `${avgRating.toFixed(1)} / 5` : '—'}
              sub={ratingCount ? `${ratingCount} rating${ratingCount === 1 ? '' : 's'}` : 'Not rated yet'}
              accent="#F5A524"
            />
          </Box>

          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 3fr) minmax(0, 2fr)' } }}>
            <Card>
              <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                  All vendors compared
                </Typography>
                <Box sx={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={all} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="completed" name="Completed" fill="#12A150" stroke={INK} />
                      <Bar dataKey="active" name="In progress" fill="#F25C05" stroke={INK} />
                      <Bar dataKey="accepted" name="Quotes won" fill="#2E6BE6" stroke={INK} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>

            <Card>
              <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
                  Suggested vendor by trade
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                  Most completed jobs, then best quote win rate.
                </Typography>
                <Stack divider={<Divider />} spacing={1.25}>
                  {bestFit.map(([specialty, v]) => (
                    <ListRow
                      key={specialty}
                      primary={pretty(specialty)}
                      secondary={`${v.name} · ${v.completed} completed`}
                      right={
                        <Button size="small" variant="outlined" onClick={() => setSelectedVendor(v.id)}>
                          View
                        </Button>
                      }
                    />
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Box>

          <Card>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Recent jobs for {current?.name ?? 'this vendor'}
                </Typography>
                <Button component={RouterLink} to="/work-orders" size="small">
                  All work orders
                </Button>
              </Stack>
              {recentJobs.length === 0 ? (
                <EmptyState title="No jobs yet" text="Work orders assigned to this vendor will appear here." />
              ) : (
                <TableContainer component={Paper} sx={{ overflowX: 'auto', border: `1.5px solid ${INK}` }}>
                  <Table size="small" sx={{ minWidth: 640 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Job</TableCell>
                        <TableCell>Property</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Quote</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentJobs.map((w) => {
                        const q = (w.quotes ?? []).find((x) => x.vendorId === selectedVendor);
                        return (
                          <TableRow key={w.id}>
                            <TableCell>{w.title.replace(/^WO:\s*/, '')}</TableCell>
                            <TableCell>{w.rental?.title ?? '—'}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDate(w.createdAt)}</TableCell>
                            <TableCell>
                              <StatusChip status={w.status} />
                            </TableCell>
                            <TableCell align="right">{q ? money(q.amount) : '—'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Stack>
      )}
    </Box>
  );
};

export default VendorPerformanceAnalyticsScreen;
