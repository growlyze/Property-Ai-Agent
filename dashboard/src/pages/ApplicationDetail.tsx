import React, { useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  LinearProgress,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import {
  STATUS_COLOR,
  RISK_COLOR,
  RISK_LABEL,
  applicantName,
  checkColor,
  confidencePct,
  creditColor,
  fetchApplication,
  formatDate,
  money,
  pretty,
  recommendationLabel,
  relativeDate,
  rentalAddress,
  rentalLabel,
  riskLevel,
  updateApplicationStatus,
} from '../services/screeningApplications';

/** One rental application: applicant, rental, screening checks and AI risk. */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </Typography>
      <Box sx={{ mt: 0.25, overflowWrap: 'anywhere' }}>{children}</Box>
    </Box>
  );
}

const fieldGrid = { display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } } as const;

const ApplicationDetail: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const { data: app, isLoading, error, refetch } = useQuery({
    queryKey: ['screening-application', id],
    queryFn: () => fetchApplication(id),
    enabled: !!id,
    retry: (count, err: any) => err?.response?.status !== 404 && err?.response?.status !== 403 && count < 2,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['screening-application', id] });
    queryClient.invalidateQueries({ queryKey: ['screening-applications'] });
  };

  const decide = useMutation({
    mutationFn: ({ status, note }: { status: 'APPROVED' | 'REJECTED'; note?: string }) => {
      const notes = note ? [app?.notes, `Decision note: ${note}`].filter(Boolean).join('\n\n') : undefined;
      return updateApplicationStatus(id, status, notes);
    },
    onSuccess: () => {
      setRejectOpen(false);
      setReason('');
      invalidate();
    },
  });

  const back = (
    <Button component={RouterLink} to="/tenant-screening" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
      All applications
    </Button>
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !app) {
    const status = (error as any)?.response?.status;
    return (
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto', textAlign: 'left' }}>
        {back}
        <Alert
          severity={status === 404 || status === 403 ? 'warning' : 'error'}
          action={
            status === 404 || status === 403 ? undefined : (
              <Button color="inherit" size="small" onClick={() => refetch()}>
                Retry
              </Button>
            )
          }
        >
          {status === 404
            ? 'This application does not exist or has been deleted.'
            : status === 403
              ? 'You do not have access to this application.'
              : 'Could not load this application. Check that the API is running, then try again.'}
        </Alert>
      </Box>
    );
  }

  const risk = app.RiskAssessment;
  const level = riskLevel(app);
  const details = risk?.details ?? {};
  const confidence = confidencePct(details.confidence);
  const actionError = decide.error as any;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto', textAlign: 'left' }}>
      {back}

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {applicantName(app)}
            </Typography>
            <Chip label={pretty(app.status)} color={STATUS_COLOR[app.status] ?? 'default'} />
          </Stack>
          <Typography sx={{ color: 'text.secondary' }}>
            Applied {relativeDate(app.appliedDate).toLowerCase()} for {rentalLabel(app)}
          </Typography>
        </Box>
        {app.status === 'PENDING' && (
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircleIcon />}
              disabled={decide.isPending}
              onClick={() => decide.mutate({ status: 'APPROVED' })}
            >
              Approve
            </Button>
            <Button variant="outlined" color="error" startIcon={<CancelIcon />} disabled={decide.isPending} onClick={() => setRejectOpen(true)}>
              Reject
            </Button>
          </Stack>
        )}
      </Stack>

      {actionError && (
        <Alert severity="error" sx={{ mb: 2.5 }}>
          {actionError?.response?.status === 403
            ? 'You do not have permission to change this application.'
            : 'The change could not be saved. Please try again.'}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '3fr 2fr' }, alignItems: 'start' }}>
        <Stack spacing={2.5}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
                Applicant and rental
              </Typography>
              <Box sx={fieldGrid}>
                <Field label="Email">
                  {app.User?.email ? <Link href={`mailto:${app.User.email}`}>{app.User.email}</Link> : '—'}
                </Field>
                <Field label="Phone">{app.User?.phone || '—'}</Field>
                <Field label="Rental">{rentalLabel(app)}</Field>
                <Field label="Address">{rentalAddress(app) || '—'}</Field>
                <Field label="Monthly rent">{money(app.Rental?.rent)}</Field>
                <Field label="Applied on">{formatDate(app.appliedDate)}</Field>
              </Box>
              {app.notes && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Field label="Notes">
                    <Typography sx={{ whiteSpace: 'pre-line' }}>{app.notes}</Typography>
                  </Field>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
                Screening checks
              </Typography>
              <Box sx={fieldGrid}>
                <Field label="Tenant screening">
                  {app.Screening ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" variant="outlined" label={pretty(app.Screening.status)} color={checkColor(app.Screening.status)} />
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        updated {relativeDate(app.Screening.updatedAt).toLowerCase()}
                      </Typography>
                    </Stack>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Not started
                    </Typography>
                  )}
                </Field>
                <Field label="Background check">
                  {app.BackgroundCheck ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" variant="outlined" label={pretty(app.BackgroundCheck.status)} color={checkColor(app.BackgroundCheck.status)} />
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        updated {relativeDate(app.BackgroundCheck.updatedAt).toLowerCase()}
                      </Typography>
                    </Stack>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Not requested
                    </Typography>
                  )}
                </Field>
                <Field label="Credit score">
                  <Typography sx={{ fontWeight: 700, color: creditColor(details.creditScore) }}>
                    {typeof details.creditScore === 'number' ? details.creditScore : '—'}
                  </Typography>
                </Field>
                <Field label="Monthly income">
                  <Typography>
                    {money(details.monthlyIncome)}
                  </Typography>
                </Field>
              </Box>
            </CardContent>
          </Card>
        </Stack>

        <Card>
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <AutoAwesomeIcon color="primary" fontSize="small" />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                AI risk assessment
              </Typography>
            </Stack>
            {risk && level ? (
              <>
                <Stack direction="row" alignItems="baseline" spacing={1}>
                  <Typography sx={{ fontSize: '2.4rem', fontWeight: 800, lineHeight: 1 }}>{Math.round(risk.score)}</Typography>
                  <Typography sx={{ color: 'text.secondary' }}>/ 100 risk score</Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, Math.max(0, risk.score))}
                  color={RISK_COLOR[level]}
                  sx={{ height: 8, borderRadius: 4, my: 1.5 }}
                  aria-label="Risk score"
                />
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                  <Chip size="small" label={RISK_LABEL[level]} color={RISK_COLOR[level]} />
                  {confidence !== null && (
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${confidence}% confidence · ${confidence >= 80 ? 'High' : confidence >= 60 ? 'Medium' : 'Low'}`}
                    />
                  )}
                </Stack>
                <Field label="Recommendation">
                  <Typography sx={{ fontWeight: 700 }}>{recommendationLabel(details.recommendation)}</Typography>
                </Field>
                {Array.isArray(details.factors) && details.factors.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Key factors
                    </Typography>
                    <Box component="ul" sx={{ pl: 2.5, mt: 0.5, mb: 0 }}>
                      {details.factors.map((f) => (
                        <li key={f}>
                          <Typography variant="body2">{f}</Typography>
                        </li>
                      ))}
                    </Box>
                  </Box>
                )}
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 2 }}>
                  Higher scores mean higher risk. Assessed {relativeDate(risk.updatedAt).toLowerCase()}. The final decision is yours.
                </Typography>
              </>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No AI risk assessment has been run for this application yet.
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Reject application</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            The reason is saved to the application notes so your team can see why it was declined.
          </DialogContentText>
          <TextField autoFocus fullWidth multiline minRows={3} label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={!reason.trim() || decide.isPending}
            onClick={() => decide.mutate({ status: 'REJECTED', note: reason.trim() })}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default ApplicationDetail;
