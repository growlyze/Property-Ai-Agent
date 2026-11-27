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
  IconButton,
  InputAdornment,
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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  ChevronRight as ChevronRightIcon,
  AssignmentInd as AssignmentIndIcon,
  HourglassTop as HourglassIcon,
  CheckCircle as CheckCircleIcon,
  ReportProblem as ReportProblemIcon,
} from '@mui/icons-material';
import {
  ScreeningApplication,
  STATUS_COLOR,
  RISK_COLOR,
  RISK_LABEL,
  applicantName,
  checkColor,
  creditColor,
  fetchApplications,
  money,
  pretty,
  relativeDate,
  rentalLabel,
  riskLevel,
} from '../services/screeningApplications';

/**
 * Tenant screening: every rental application the caller can see
 * (GET /api/applications, scoped server-side), with screening status, AI risk
 * level, credit score and income.
 */

function Kpi({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: number; sub: string; accent: string }) {
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
              border: '1px solid var(--color-border-default)',
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
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {sub}
        </Typography>
      </CardContent>
    </Card>
  );
}

const TenantScreening: React.FC = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['screening-applications'],
    queryFn: fetchApplications,
  });
  const applications = data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications.filter((a) => {
      const haystack = [applicantName(a), a.User?.email ?? '', rentalLabel(a)].join(' ').toLowerCase();
      return (!q || haystack.includes(q)) && (!status || a.status === status);
    });
  }, [applications, search, status]);

  const pending = applications.filter((a) => a.status === 'PENDING');
  const screeningOpen = pending.filter((a) => (a.Screening?.status ?? 'PENDING') !== 'COMPLETED').length;
  const highRisk = pending.filter((a) => riskLevel(a) === 'high').length;
  const approved = applications.filter((a) => a.status === 'APPROVED').length;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto', textAlign: 'left' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Tenant screening
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            Rental applications with screening, background check and AI risk results.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} component={RouterLink} to="/tenant-screening/applications/new" sx={{ flexShrink: 0 }}>
          New application
        </Button>
      </Stack>

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
          Could not load applications. Check that the API is running, then try again.
        </Alert>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gap: { xs: 1.5, sm: 2.5 },
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
              mb: 2.5,
            }}
          >
            <Kpi icon={<AssignmentIndIcon fontSize="small" />} label="Applications" value={applications.length} sub="All time" accent="#397ae7" />
            <Kpi icon={<HourglassIcon fontSize="small" />} label="Awaiting decision" value={pending.length} sub={`${screeningOpen} still being screened`} accent="#ffb900" />
            <Kpi icon={<ReportProblemIcon fontSize="small" />} label="High risk" value={highRisk} sub="Pending applications flagged by AI" accent="#e5484d" />
            <Kpi icon={<CheckCircleIcon fontSize="small" />} label="Approved" value={approved} sub="Applications approved" accent="#0db664" />
          </Box>

          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                  size="small"
                  placeholder="Search by applicant, email or property"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  sx={{ flex: 1, maxWidth: { md: 420 } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                  inputProps={{ 'aria-label': 'Search applications' }}
                />
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel id="screening-status-label">Status</InputLabel>
                  <Select labelId="screening-status-label" value={status} label="Status" onChange={(e) => setStatus(String(e.target.value))}>
                    <MenuItem value="">All statuses</MenuItem>
                    <MenuItem value="PENDING">Pending</MenuItem>
                    <MenuItem value="APPROVED">Approved</MenuItem>
                    <MenuItem value="REJECTED">Rejected</MenuItem>
                    <MenuItem value="WITHDRAWN">Withdrawn</MenuItem>
                  </Select>
                </FormControl>
              </Stack>

              {filtered.length === 0 ? (
                <Box sx={{ py: 5 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    No applications found
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {search || status ? 'Try a different search or status filter.' : 'Applications will appear here when someone applies for one of your rentals.'}
                  </Typography>
                </Box>
              ) : (
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 960, '& th, & td': { px: 1, whiteSpace: 'nowrap' }, '& td:nth-of-type(1), & td:nth-of-type(2)': { whiteSpace: 'normal' } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Applicant</TableCell>
                        <TableCell>Property</TableCell>
                        <TableCell>Applied</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Screening</TableCell>
                        <TableCell>AI risk</TableCell>
                        <TableCell align="right">Credit</TableCell>
                        <TableCell align="right">Income / mo</TableCell>
                        <TableCell align="right" />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filtered.map((a: ScreeningApplication) => {
                        const level = riskLevel(a);
                        const credit = a.RiskAssessment?.details?.creditScore;
                        const to = `/tenant-screening/applications/${a.id}`;
                        return (
                          <TableRow key={a.id} hover>
                            <TableCell>
                              <Typography
                                component={RouterLink}
                                to={to}
                                variant="subtitle2"
                                sx={{ fontWeight: 700, color: 'inherit', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                              >
                                {applicantName(a)}
                              </Typography>
                              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                {a.User?.email ?? ''}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ minWidth: 150 }}>{rentalLabel(a)}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{relativeDate(a.appliedDate)}</TableCell>
                            <TableCell>
                              <Chip size="small" label={pretty(a.status)} color={STATUS_COLOR[a.status] ?? 'default'} />
                            </TableCell>
                            <TableCell>
                              {a.Screening ? (
                                <Chip size="small" variant="outlined" label={pretty(a.Screening.status)} color={checkColor(a.Screening.status)} />
                              ) : (
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                  Not started
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              {level ? (
                                <Chip size="small" label={`${RISK_LABEL[level]} · ${Math.round(a.RiskAssessment!.score)}`} color={RISK_COLOR[level]} variant="outlined" />
                              ) : (
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                  Not assessed
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 700, color: creditColor(credit) }}>
                                {typeof credit === 'number' ? credit : '—'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">{money(a.RiskAssessment?.details?.monthlyIncome)}</TableCell>
                            <TableCell align="right">
                              <Tooltip title="Open application">
                                <IconButton component={RouterLink} to={to} size="small" aria-label={`Open application from ${applicantName(a)}`}>
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
        </>
      )}
    </Box>
  );
};

export default TenantScreening;
