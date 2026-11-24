import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Alert, Box, Card, CardContent, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import ForumIcon from '@mui/icons-material/Forum';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import SentimentVeryDissatisfiedIcon from '@mui/icons-material/SentimentVeryDissatisfied';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
// Authenticated client (adds the login token; base URL /api).
import api from '../services/api';

/**
 * Tenant sentiment: how tenants feel, from the sentiment scores of their
 * messages (GET /api/tenant/sentiment-trends, common-issues, early-warnings,
 * proactive-suggestions). Scores run from -1 (very negative) to +1.
 */

interface Trend {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
}
interface Issue {
  category: string;
  count: number;
  averageSentiment: number;
  example?: { content: string; property?: string };
}
interface EarlyWarning {
  id: string;
  tenant?: string;
  property?: string;
  message: string;
  category?: string;
  sentimentScore: number;
  date?: string;
  maintenanceRequest?: { title: string; priority: string; status: string } | null;
}
interface Summary {
  totalMessages: number;
  averageScore: number;
  sentimentDistribution: { positive: number; negative: number; neutral: number };
}

// The endpoints answer `{ success, data: {...} }`; anything unexpected becomes empty.
const payload = (body: any) => (body && typeof body === 'object' && 'data' in body ? body.data : body) ?? {};
const arr = (x: any) => (Array.isArray(x) ? x : []);
const get = (url: string) => api.get(url).then((r) => payload(r.data));

const toNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const date = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const pretty = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/** -1..1 score -> words + chip colour. */
const mood = (score: number): { label: string; color: 'success' | 'default' | 'warning' | 'error' } => {
  if (score >= 0.3) return { label: 'Positive', color: 'success' };
  if (score > -0.2) return { label: 'Neutral', color: 'default' };
  if (score > -0.5) return { label: 'Negative', color: 'warning' };
  return { label: 'Very negative', color: 'error' };
};
/** -1..1 score -> 0..100 "satisfaction" index for display. */
const index = (score: number) => Math.round(((score + 1) / 2) * 100);

function Kpi({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub: string; accent: string }) {
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

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            {subtitle}
          </Typography>
        )}
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

const TenantSentimentDashboard: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['tenant-sentiment'],
    queryFn: async () => {
      const [trends, issues, warnings, suggestions] = await Promise.all([
        get('/tenant/sentiment-trends'),
        get('/tenant/common-issues').catch(() => ({})),
        get('/tenant/early-warnings').catch(() => ({})),
        get('/tenant/proactive-suggestions').catch(() => ({})),
      ]);
      return {
        trends: arr(trends.trends).map((t: any) => ({
          date: String(t.date),
          positive: toNum(t.positive),
          neutral: toNum(t.neutral),
          negative: toNum(t.negative),
        })) as Trend[],
        summary: (trends.summary ?? null) as Summary | null,
        issues: arr(issues.commonIssues).map((i: any) => ({
          category: String(i.category),
          count: toNum(i.count),
          averageSentiment: toNum(i.averageSentiment),
          example: arr(i.examples)[0],
        })) as Issue[],
        warnings: arr(warnings.activeWarnings).map((w: any) => ({ ...w, sentimentScore: toNum(w.sentimentScore) })) as EarlyWarning[],
        suggestions: arr(suggestions.suggestions)
          .map((x: any) => (typeof x === 'string' ? x : String(x?.suggestion ?? x?.title ?? x?.message ?? '')))
          .filter(Boolean) as string[],
      };
    },
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
        Could not load tenant sentiment. Check that the API is running, then refresh.
      </Alert>
    );
  }

  const { trends, summary, issues, warnings, suggestions } = data;
  const dist = summary?.sentimentDistribution ?? { positive: 0, negative: 0, neutral: 0 };
  const total = summary?.totalMessages ?? 0;
  const avg = summary?.averageScore ?? 0;
  const pct = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : '0%');
  const grid = { display: 'grid', gap: 2.5 } as const;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto', textAlign: 'left' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Tenant sentiment
        </Typography>
        <Typography sx={{ color: 'text.secondary' }}>How tenants feel, from the tone of their messages to you.</Typography>
      </Box>

      <Box sx={{ ...grid, gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, mb: 2.5 }}>
        <Kpi icon={<ForumIcon fontSize="small" />} label="Messages analysed" value={String(total)} sub="Last 30 days" accent="#FF5A00" />
        <Kpi
          icon={<SentimentSatisfiedAltIcon fontSize="small" />}
          label="Satisfaction index"
          value={total ? `${index(avg)}/100` : '—'}
          sub={total ? `Overall mood: ${mood(avg).label.toLowerCase()}` : 'No messages yet'}
          accent="#2E7D32"
        />
        <Kpi icon={<SentimentVeryDissatisfiedIcon fontSize="small" />} label="Negative messages" value={String(dist.negative)} sub={`${pct(dist.negative)} of all messages`} accent="#D32F2F" />
        <Kpi icon={<WarningAmberIcon fontSize="small" />} label="Early warnings" value={String(warnings.length)} sub="Unhappy tenants to follow up" accent="#ED6C02" />
      </Box>

      <Box sx={{ ...grid, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, mb: 2.5 }}>
        <Section title="Sentiment over time" subtitle="Messages per day by tone">
          {trends.length === 0 ? (
            <Empty text="No tenant messages to chart yet." />
          ) : (
            <Box sx={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends.map((t) => ({ ...t, label: date(t.date) }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="positive" name="Positive" stackId="s" isAnimationActive={false} fill="#2E7D32" />
                  <Bar dataKey="neutral" name="Neutral" stackId="s" isAnimationActive={false} fill="#B0A99F" />
                  <Bar dataKey="negative" name="Negative" stackId="s" isAnimationActive={false} fill="#D32F2F" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Section>

        <Section title="Common issues" subtitle="Topics behind negative messages">
          {issues.length === 0 ? (
            <Empty text="No recurring issues found." />
          ) : (
            <Stack spacing={1.5}>
              {issues.map((i) => (
                <Box key={i.category} sx={{ border: '2px solid', borderColor: 'divider', borderRadius: 2, p: 1.75 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Typography sx={{ fontWeight: 700 }}>{pretty(i.category)}</Typography>
                    <Stack direction="row" spacing={1}>
                      <Chip size="small" variant="outlined" label={`${i.count} message${i.count === 1 ? '' : 's'}`} />
                      <Chip size="small" label={mood(i.averageSentiment).label} color={mood(i.averageSentiment).color} />
                    </Stack>
                  </Stack>
                  {i.example && (
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
                      “{i.example.content}”{i.example.property && i.example.property !== 'General' ? ` · ${i.example.property}` : ''}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </Section>
      </Box>

      <Box sx={{ ...grid, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' } }}>
        <Section title="Early warnings" subtitle="Strongly negative messages that need a reply">
          {warnings.length === 0 ? (
            <Empty text="No warnings at the moment." />
          ) : (
            <Stack spacing={1.5}>
              {warnings.map((w) => {
                const m = mood(w.sentimentScore);
                return (
                  <Box key={w.id} sx={{ border: '2px solid', borderColor: 'divider', borderRadius: 2, p: 1.75 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 0.75 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700 }}>{w.tenant ?? 'Tenant'}</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {[w.property && w.property !== 'General' ? w.property : null, w.category ? pretty(w.category) : null, w.date ? date(w.date) : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </Typography>
                      </Box>
                      <Box>
                        <Chip size="small" label={m.label} color={m.color} />
                      </Box>
                    </Stack>
                    <Typography variant="body2">“{w.message}”</Typography>
                    {w.maintenanceRequest && (
                      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
                        Linked request: {w.maintenanceRequest.title} ({pretty(w.maintenanceRequest.status.toLowerCase())})
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Stack>
          )}
        </Section>

        <Section title="Suggested outreach" subtitle="Proactive messages worth sending">
          {suggestions.length === 0 ? (
            <Empty text="No suggestions right now. Suggestions appear when a tenant's messages trend negative over several days." />
          ) : (
            <Stack spacing={1}>
              {suggestions.map((s, idx) => (
                <Typography key={idx} variant="body2" sx={{ border: '2px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
                  {s}
                </Typography>
              ))}
            </Stack>
          )}
        </Section>
      </Box>
    </Box>
  );
};

export default TenantSentimentDashboard;
