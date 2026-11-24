import React, { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
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
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  ChevronRight as ChevronRightIcon,
  Groups as GroupsIcon,
  Speed as SpeedIcon,
  ReportProblem as ReportProblemIcon,
  HourglassTop as HourglassIcon,
  CompareArrows as CompareIcon,
} from '@mui/icons-material';
import {
  ScreeningApplication,
  RiskLevel,
  STATUS_COLOR,
  RISK_COLOR,
  RISK_LABEL,
  applicantName,
  confidencePct,
  creditColor,
  fetchApplications,
  money,
  pretty,
  recommendationLabel,
  relativeDate,
  rentalLabel,
  riskLevel,
} from '../services/screeningApplications';

/**
 * AI risk assessment: the stored RiskAssessment for each rental application
 * (GET /api/applications, scoped server-side). Scores are 0–100, higher =
 * riskier. Decisions are made on the application page.
 */

const BAR_COLOR: Record<RiskLevel, string> = { low: '#0db664', medium: '#ffb900', high: '#e5484d' };

function Kpi({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub: React.ReactNode; accent: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 1.75, sm: 2.5 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={{ xs: 1, sm: 1.5 }} sx={{ mb: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              bgcolor: accent,
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              border: '1.5px solid #140827',
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
            {label}
          </Typography>
        </Stack>
        <Typography component="div" sx={{ fontSize: '1.9rem', fontWeight: 800, lineHeight: 1.1 }}>
          {value}
        </Typography>
        <Typography component="div" variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {sub}
        </Typography>
      </CardContent>
    </Card>
  );
}

function ScoreBars({ apps }: { apps: ScreeningApplication[] }) {
  return (
    <Stack spacing={1.5}>
      {apps.map((a) => {
        const level = riskLevel(a)!;
        const score = Math.round(a.RiskAssessment!.score);
        return (
          <Box key={a.id}>
            <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 0 }} noWrap>
                {applicantName(a)}
                <Typography component="span" variant="body2" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                  {' '}· {pretty(a.status)}
                </Typography>
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, flexShrink: 0 }}>
                {score}
              </Typography>
            </Stack>
            <Box sx={{ height: 12, bgcolor: 'rgba(20,8,39,0.08)', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(20,8,39,0.2)' }}>
              <Box
                title={`${applicantName(a)}: ${score} (${RISK_LABEL[level]})`}
                sx={{ width: `${Math.max(2, Math.min(100, score))}%`, height: '100%', bgcolor: BAR_COLOR[level] }}
              />
            </Box>
          </Box>
        );
      })}
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ pt: 0.5 }}>
        {(['low', 'medium', 'high'] as RiskLevel[]).map((l) => (
          <Stack key={l} direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: BAR_COLOR[l] }} />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {RISK_LABEL[l]} ({l === 'low' ? '0–34' : l === 'medium' ? '35–59' : '60–100'})
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

function Comparison({ apps }: { apps: ScreeningApplication[] }) {
  const rows: { label: string; render: (a: ScreeningApplication) => React.ReactNode }[] = [
    {
      label: 'Risk',
      render: (a) => {
        const l = riskLevel(a);
        return l ? <Chip size="small" color={RISK_COLOR[l]} label={`${RISK_LABEL[l]} · ${Math.round(a.RiskAssessment!.score)}`} /> : '—';
      },
    },
    { label: 'Recommendation', render: (a) => recommendationLabel(a.RiskAssessment?.details?.recommendation) },
    {
      label: 'Credit score',
      render: (a) => (
        <Typography component="span" variant="body2" sx={{ fontWeight: 700, color: creditColor(a.RiskAssessment?.details?.creditScore) }}>
          {a.RiskAssessment?.details?.creditScore ?? '—'}
        </Typography>
      ),
    },
    {
      label: 'Income',
      render: (a) => money(a.RiskAssessment?.details?.monthlyIncome),
    },
    { label: 'Rental', render: (a) => rentalLabel(a) },
    {
      label: 'Key factors',
      render: (a) => (
        <Box component="ul" sx={{ m: 0, pl: 2 }}>
          {(a.RiskAssessment?.details?.factors ?? []).map((f) => (
            <li key={f}>
              <Typography variant="body2">{f}</Typography>
            </li>
          ))}
        </Box>
      ),
    },
  ];
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ minWidth: 240 + apps.length * 220 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 140 }} />
            {apps.map((a) => (
              <TableCell key={a.id} sx={{ fontWeight: 800 }}>
                {applicantName(a)}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.label}>
              <TableCell sx={{ color: 'text.secondary', fontWeight: 600, verticalAlign: 'top' }}>{r.label}</TableCell>
              {apps.map((a) => (
                <TableCell key={a.id} sx={{ verticalAlign: 'top' }}>
                  {r.render(a)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

const AIRiskAssessmentDashboard: React.FC = () => {
  const [filter, setFilter] = useState<RiskLevel | 'all'>('all');
  const [selected, setSelected] = useState<string[]>([]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['screening-applications'],
    queryFn: fetchApplications,
  });

  const assessed = useMemo(() => (data ?? []).filter((a) => a.RiskAssessment), [data]);
  const filtered = assessed.filter((a) => filter === 'all' || riskLevel(a) === filter);
  const counts = { low: 0, medium: 0, high: 0 } as Record<RiskLevel, number>;
  assessed.forEach((a) => {
    const l = riskLevel(a);
    if (l) counts[l] += 1;
  });
  const avg = assessed.length ? Math.round(assessed.reduce((s, a) => s + a.RiskAssessment!.score, 0) / assessed.length) : 0;
  const pending = assessed.filter((a) => a.status === 'PENDING');
  const pendingHigh = pending.filter((a) => riskLevel(a) === 'high').length;
  const confidences = assessed.map((a) => confidencePct(a.RiskAssessment?.details?.confidence)).filter((c): c is number => c !== null);
  const avgConfidence = confidences.length ? Math.round(confidences.reduce((s, c) => s + c, 0) / confidences.length) : null;
  // Pending first, then most recent.
  const barApps = [...assessed].sort((a, b) => Number(b.status === 'PENDING') - Number(a.status === 'PENDING') || b.RiskAssessment!.score - a.RiskAssessment!.score);
  const compared = assessed.filter((a) => selected.includes(a.id));

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? [...prev.slice(1), id] : [...prev, id]));

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto', textAlign: 'left' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          AI risk assessment
        </Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Risk scores for rental applicants, with the factors behind each score. Compare applicants side by side before you decide.
        </Typography>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          Could not load risk assessments. Check that the API is running, then try again.
        </Alert>
      ) : assessed.length === 0 ? (
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              No risk assessments yet
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              Applicants are scored automatically once their application has been screened.
            </Typography>
            <Button variant="outlined" component={RouterLink} to="/tenant-screening">
              Go to tenant screening
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Box sx={{ display: 'grid', gap: { xs: 1.5, sm: 2.5 }, gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, mb: 2.5 }}>
            <Kpi icon={<GroupsIcon fontSize="small" />} label="Assessed applicants" value={assessed.length} sub={`${pending.length} awaiting a decision`} accent="#397ae7" />
            <Kpi
              icon={<SpeedIcon fontSize="small" />}
              label="Average risk score"
              value={avg}
              sub={avgConfidence !== null ? `Out of 100 · ${avgConfidence}% average confidence` : 'Out of 100, higher is riskier'}
              accent="#f55809"
            />
            <Kpi
              icon={<AutoAwesomeIcon fontSize="small" />}
              label="Risk mix"
              value={
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ pt: 0.5 }}>
                  <Chip size="small" color="success" label={`${counts.low} low`} />
                  <Chip size="small" color="warning" label={`${counts.medium} med`} />
                  <Chip size="small" color="error" label={`${counts.high} high`} />
                </Stack>
              }
              sub="Across all assessed applicants"
              accent="#9a57ff"
            />
            <Kpi
              icon={pendingHigh ? <ReportProblemIcon fontSize="small" /> : <HourglassIcon fontSize="small" />}
              label="Needs attention"
              value={pendingHigh}
              sub="Pending applicants with high risk"
              accent={pendingHigh ? '#e5484d' : '#ffb900'}
            />
          </Box>

          <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, mb: 2.5, alignItems: 'start' }}>
            <Card>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Risk score by applicant
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                  Pending applicants first. Higher scores mean higher risk.
                </Typography>
                <ScoreBars apps={barApps} />
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  How the score works
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                  Each applicant gets a 0–100 risk score built from three groups of signals.
                </Typography>
                <Stack spacing={1.5}>
                  {[
                    ['Financial · 60%', 'Credit score, income-to-rent multiple, debts and payment history.'],
                    ['Employment · 25%', 'Stability of employment and verified income.'],
                    ['Rental history · 15%', 'Previous landlord references, balances and evictions.'],
                  ].map(([title, text]) => (
                    <Box key={title} sx={{ p: 1.5, border: '1.5px solid rgba(20,8,39,0.15)', borderRadius: '8px' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {text}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1.5 }}>
                  The score is advice. You make the final decision on the application page.
                </Typography>
              </CardContent>
            </Card>
          </Box>

          <Card sx={{ mb: 2.5 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Applicants
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Tick up to three applicants to compare them.
                  </Typography>
                </Box>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="risk-filter-label">Risk level</InputLabel>
                  <Select labelId="risk-filter-label" value={filter} label="Risk level" onChange={(e) => setFilter(e.target.value as RiskLevel | 'all')}>
                    <MenuItem value="all">All levels</MenuItem>
                    <MenuItem value="low">Low risk</MenuItem>
                    <MenuItem value="medium">Medium risk</MenuItem>
                    <MenuItem value="high">High risk</MenuItem>
                  </Select>
                </FormControl>
              </Stack>

              {filtered.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', py: 3 }}>
                  No applicants at this risk level.
                </Typography>
              ) : (
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 900 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" />
                        <TableCell>Applicant</TableCell>
                        <TableCell>Risk</TableCell>
                        <TableCell align="right">Credit</TableCell>
                        <TableCell>Recommendation</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Applied</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filtered.map((a) => {
                        const level = riskLevel(a)!;
                        const credit = a.RiskAssessment?.details?.creditScore;
                        return (
                          <TableRow key={a.id} hover selected={selected.includes(a.id)}>
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={selected.includes(a.id)}
                                onChange={() => toggle(a.id)}
                                inputProps={{ 'aria-label': `Compare ${applicantName(a)}` }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                {applicantName(a)}
                              </Typography>
                              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                {rentalLabel(a)}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              <Chip size="small" color={RISK_COLOR[level]} label={`${RISK_LABEL[level]} · ${Math.round(a.RiskAssessment!.score)}`} />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 700, color: creditColor(credit) }}>
                                {typeof credit === 'number' ? credit : '—'}
                              </Typography>
                            </TableCell>
                            <TableCell>{recommendationLabel(a.RiskAssessment?.details?.recommendation)}</TableCell>
                            <TableCell>
                              <Chip size="small" variant="outlined" color={STATUS_COLOR[a.status] ?? 'default'} label={pretty(a.status)} />
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{relativeDate(a.appliedDate)}</TableCell>
                            <TableCell align="right">
                              <Tooltip title="Open application">
                                <IconButton
                                  component={RouterLink}
                                  to={`/tenant-screening/applications/${a.id}`}
                                  size="small"
                                  aria-label={`Open application from ${applicantName(a)}`}
                                >
                                  <ChevronRightIcon />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <CompareIcon color="primary" fontSize="small" />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Side-by-side comparison
                </Typography>
                {compared.length > 0 && (
                  <Button size="small" onClick={() => setSelected([])} sx={{ ml: 'auto !important' }}>
                    Clear
                  </Button>
                )}
              </Stack>
              {compared.length < 2 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {compared.length === 1
                    ? `${applicantName(compared[0])} selected. Tick one or two more applicants to compare.`
                    : 'Tick two or three applicants in the table above to compare their risk, credit, income and key factors.'}
                </Typography>
              ) : (
                <Comparison apps={compared} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
};

export default AIRiskAssessmentDashboard;
