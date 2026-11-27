import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  GridLegacy as Grid,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Paid as PaidIcon,
  QueryStats as QueryStatsIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { marketingService } from '../../services/marketingService';
import { EmptyState, ErrorNote, INK, Loading, PageHeader, PageShell, StatCard, money } from '../../components/portal/PortalUI';

/**
 * Marketing analytics, built only from data the API actually has:
 *  - /marketing/analytics/overview      totals across campaigns
 *  - /marketing/campaigns               impressions → clicks → leads funnel
 *  - /marketing/analytics/lead-sources  per-source leads, cost and conversion (0–1 fraction)
 *  - /marketing/analytics/property-performance  applications per listing
 * Website traffic is not tracked yet, so there is no traffic chart.
 */

interface Overview {
  totalLeads: number;
  marketingSpend: number;
  costPerLead: number;
  avgConversionRate: number; // already a percentage
}
interface LeadSource {
  source: string;
  leads: number;
  cost: number;
  conversion: number; // fraction 0–1
}
interface PropertyPerf {
  propertyId: string;
  propertyName: string;
  views: number;
  inquiries: number;
}
interface Campaign {
  impressions: number;
  clicks: number;
  leads: number;
}

const pct = (fraction: number) => `${Math.round(fraction * 1000) / 10}%`;

const MarketingAnalytics: React.FC = () => {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [properties, setProperties] = useState<PropertyPerf[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, s, p, c] = await Promise.all([
        marketingService.getAnalyticsOverview(),
        marketingService.getLeadSources(),
        marketingService.getPropertyPerformance(),
        marketingService.getCampaigns(),
      ]);
      setOverview(o.data ?? null);
      setSources(s.data ?? []);
      setProperties(p.data ?? []);
      setCampaigns(c.data ?? []);
    } catch (e) {
      setError('Could not load marketing analytics. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sourceLeads = sources.reduce((s, x) => s + x.leads, 0);
  const funnel = [
    { label: 'Impressions', value: campaigns.reduce((s, c) => s + c.impressions, 0) },
    { label: 'Clicks', value: campaigns.reduce((s, c) => s + c.clicks, 0) },
    { label: 'Leads', value: campaigns.reduce((s, c) => s + c.leads, 0) },
  ];
  const topProperties = [...properties].filter((p) => p.inquiries > 0).sort((a, b) => b.inquiries - a.inquiries).slice(0, 6);

  return (
    <PageShell>
      <PageHeader title="Marketing Analytics" subtitle="Where your leads come from and what they cost." />

      {error && (
        <Box sx={{ mb: 3 }}>
          <ErrorNote text={error} onRetry={load} />
        </Box>
      )}

      {loading ? (
        <Loading />
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} md={3}>
              <StatCard icon={<PersonAddIcon fontSize="small" />} accent="#2563eb" label="Campaign leads" value={(overview?.totalLeads ?? 0).toLocaleString()} sub={`${sourceLeads} from all sources`} />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard icon={<PaidIcon fontSize="small" />} accent="#f99c00" label="Marketing spend" value={money(overview?.marketingSpend ?? 0)} sub="Spent on campaigns" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard icon={<QueryStatsIcon fontSize="small" />} accent="#7c3aed" label="Cost per lead" value={overview && overview.totalLeads > 0 ? money(overview.costPerLead) : '—'} sub="Spend ÷ leads" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard icon={<TrendingUpIcon fontSize="small" />} accent="#16a34a" label="Click → lead" value={`${(overview?.avgConversionRate ?? 0).toFixed(1)}%`} sub="Of ad clicks became leads" />
            </Grid>
          </Grid>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} lg={7}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
                    Leads by source
                  </Typography>
                  {sources.length === 0 ? (
                    <EmptyState title="No lead sources yet" text="Leads appear here once campaigns and listings start bringing in enquiries." />
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(220, sources.length * 44)}>
                      <BarChart data={sources} layout="vertical" margin={{ left: 8, right: 16, top: 0, bottom: 0 }}>
                        <CartesianGrid horizontal={false} stroke="#e7e1d6" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="#8a8194" />
                        <YAxis type="category" dataKey="source" width={120} tick={{ fontSize: 12 }} stroke="#8a8194" />
                        <Tooltip formatter={(v: number) => [v, 'Leads']} cursor={{ fill: 'rgba(249,115,22,0.08)' }} />
                        <Bar dataKey="leads" fill="#f99c00" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} lg={5}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
                    Campaign funnel
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                    Totals across {campaigns.length} campaigns
                  </Typography>
                  {campaigns.length === 0 ? (
                    <EmptyState title="No campaigns yet" text="Create a campaign to see impressions, clicks and leads." />
                  ) : (
                    <Stack spacing={2.5}>
                      {funnel.map((step, i) => {
                        const prev = i > 0 ? funnel[i - 1].value : 0;
                        return (
                          <Box key={step.label}>
                            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                              <Typography sx={{ fontWeight: 700 }}>{step.label}</Typography>
                              <Typography sx={{ fontWeight: 700 }}>
                                {step.value.toLocaleString()}
                                {i > 0 && prev > 0 && (
                                  <Typography component="span" variant="body2" sx={{ color: 'text.secondary', ml: 1 }}>
                                    {pct(step.value / prev)} of {funnel[i - 1].label.toLowerCase()}
                                  </Typography>
                                )}
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={funnel[0].value > 0 ? Math.max(2, (step.value / funnel[0].value) * 100) : 0}
                              sx={{ height: 10, borderRadius: 5, border: `1px solid var(--color-border-default)`, bgcolor: '#eef3fb' }}
                            />
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            <Grid item xs={12} lg={7}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                    Lead source performance
                  </Typography>
                  {sources.length === 0 ? (
                    <EmptyState title="Nothing to compare yet" />
                  ) : (
                    <TableContainer>
                      <Table size="small" sx={{ minWidth: 480 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell>Source</TableCell>
                            <TableCell align="right">Leads</TableCell>
                            <TableCell align="right">Cost</TableCell>
                            <TableCell align="right">Cost/Lead</TableCell>
                            <TableCell align="right">Conversion</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {sources.map((s) => (
                            <TableRow key={s.source}>
                              <TableCell sx={{ fontWeight: 600 }}>{s.source}</TableCell>
                              <TableCell align="right">{s.leads}</TableCell>
                              <TableCell align="right">{s.cost > 0 ? money(s.cost) : 'Free'}</TableCell>
                              <TableCell align="right">{s.cost > 0 && s.leads > 0 ? money(s.cost / s.leads) : '—'}</TableCell>
                              <TableCell align="right">{pct(s.conversion)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} lg={5}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                    Most-applied listings
                  </Typography>
                  {topProperties.length === 0 ? (
                    <EmptyState title="No applications yet" text="Listings appear here once applicants start applying." />
                  ) : (
                    <Stack divider={<Box sx={{ borderTop: '1px solid #e7e1d6' }} />}>
                      {topProperties.map((p) => (
                        <Stack key={p.propertyId} direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ py: 1.25 }}>
                          <Typography sx={{ fontWeight: 600, minWidth: 0, wordBreak: 'break-word' }}>{p.propertyName}</Typography>
                          <Typography sx={{ flexShrink: 0, color: 'text.secondary' }}>
                            {p.inquiries} {p.inquiries === 1 ? 'application' : 'applications'}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </PageShell>
  );
};

export default MarketingAnalytics;
