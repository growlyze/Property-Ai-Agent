import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  GridLegacy as Grid,
  LinearProgress,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Assessment as AssessmentIcon,
  TouchApp as TouchAppIcon,
  PhoneAndroid as PhoneAndroidIcon,
  Speed as SpeedIcon,
  Accessibility as AccessibilityIcon
} from '@mui/icons-material';
import MobileAudit, { MobileAuditResult } from '../utils/mobileAudit';

/** Human-readable value for one audit metric (objects, floats and 0-sized bundles used to leak through raw). */
const formatValue = (key: string, value: unknown): string => {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value && typeof value === 'object') {
    const on = Object.entries(value as Record<string, unknown>).filter(([, v]) => Boolean(v)).map(([k]) => k);
    return on.length ? on.map((k) => k.charAt(0).toUpperCase() + k.slice(1)).join(', ') : 'None detected';
  }
  if (typeof value === 'number') {
    if (/time/i.test(key)) return `${Math.round(value)} ms`;
    if (/size/i.test(key)) return value > 0 ? `${Math.round(value / 1024)} KB` : 'Not measured';
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
  return String(value ?? '—');
};

/** Collapse repeated issues into one line with a count, and name bare tags. */
const summarizeIssues = (issues: string[]) => {
  const counts = new Map<string, number>();
  issues.forEach((raw) => {
    const text = raw.replace(/ for a$/, ' for a link').replace(/ for button$/, ' for a button');
    counts.set(text, (counts.get(text) ?? 0) + 1);
  });
  return Array.from(counts.entries()).map(([text, n]) => (n > 1 ? `${text} (${n} elements)` : text));
};

const MAX_ISSUES = 6;

const MobileAuditDashboard: React.FC = () => {
  const [auditResult, setAuditResult] = useState<MobileAuditResult | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [lastAuditTime, setLastAuditTime] = useState<Date | null>(null);

  const runAudit = async () => {
    setIsAuditing(true);
    try {
      const result = await MobileAudit.performAudit();
      setAuditResult(result);
      setLastAuditTime(new Date());

      // Log results to console for debugging
      MobileAudit.logResults(result);
    } catch (error) {
      console.error('Audit failed:', error);
    } finally {
      setIsAuditing(false);
    }
  };

  useEffect(() => {
    // Auto-run audit on component mount
    runAudit();
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircleIcon color="success" />;
    if (score >= 60) return <WarningIcon color="warning" />;
    return <ErrorIcon color="error" />;
  };

  const renderAuditSection = (
    title: string,
    icon: React.ReactNode,
    data: any,
    issues: string[] = []
  ) => (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          {icon}
          <Typography variant="h6" sx={{ ml: 1 }}>
            {title}
          </Typography>
        </Box>

        {issues.length > 0 && (
          <Alert severity="warning" sx={{ mb: 1 }}>
            <Typography variant="body2">
              {issues.length} issue{issues.length !== 1 ? 's' : ''} found
            </Typography>
          </Alert>
        )}

        <List dense>
          {Object.entries(data).map(([key, value]) => {
            if (key === 'issues') return null;
            return (
              <ListItem key={key}>
                <ListItemText
                  primary={
                    <Box display="flex" justifyContent="space-between" gap={2}>
                      <Typography variant="body2" sx={{ '&::first-letter': { textTransform: 'uppercase' } }}>
                        {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        sx={{ textAlign: 'right', color: typeof value === 'boolean' ? (value ? 'success.main' : 'error.main') : 'text.primary' }}
                      >
                        {formatValue(key, value)}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            );
          })}
        </List>

        {issues.length > 0 && (
          <Box mt={2}>
            <Typography variant="subtitle2" color="error" gutterBottom>
              Issues to Address:
            </Typography>
            {summarizeIssues(issues).slice(0, MAX_ISSUES).map((issue, index) => (
              <Typography key={index} variant="body2" color="text.secondary" sx={{ mb: 0.5, wordBreak: 'break-word' }}>
                • {issue}
              </Typography>
            ))}
            {summarizeIssues(issues).length > MAX_ISSUES && (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                and {summarizeIssues(issues).length - MAX_ISSUES} more
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto', width: '100%', textAlign: 'left' }}>
      <Box display="flex" alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" flexDirection={{ xs: 'column', sm: 'row' }} gap={2} mb={3}>
        <Box display="flex" alignItems="center">
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 800, fontSize: { xs: '1.6rem', md: '2.125rem' } }}>
              Mobile Compatibility Audit
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Comprehensive assessment of mobile responsiveness and user experience
            </Typography>
          </Box>
        </Box>

        <Box display="flex" alignItems="center" gap={2}>
          {lastAuditTime && (
            <Typography variant="body2" color="text.secondary">
              Last audit: {lastAuditTime.toLocaleTimeString()}
            </Typography>
          )}
          <Button
            variant="contained"
            onClick={runAudit}
            disabled={isAuditing}
            startIcon={<AssessmentIcon />}
          >
            {isAuditing ? 'Running Audit...' : 'Run Audit'}
          </Button>
        </Box>
      </Box>

      {isAuditing && (
        <Box mb={3}>
          <Typography variant="body2" mb={1}>Running mobile compatibility audit...</Typography>
          <LinearProgress />
        </Box>
      )}

      {auditResult && (
        <>
          {/* Overall Score */}
          <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h5" component="h2" gutterBottom>
                    Overall Mobile Score
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Based on viewport, touch targets, responsive design, performance, and accessibility
                  </Typography>
                </Box>
                <Box textAlign="center">
                  <Typography variant="h3" color={`${getScoreColor(auditResult.overallScore)}.main`}>
                    {auditResult.overallScore}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    out of 100
                  </Typography>
                  <Box mt={1}>
                    {getScoreIcon(auditResult.overallScore)}
                  </Box>
                </Box>
              </Box>

              <Box mt={2}>
                <Chip
                  label={
                    auditResult.overallScore >= 80 ? 'Excellent' :
                    auditResult.overallScore >= 60 ? 'Good' : 'Needs Improvement'
                  }
                  color={getScoreColor(auditResult.overallScore)}
                  variant="outlined"
                />
              </Box>
            </CardContent>
          </Card>

          {/* Detailed Sections */}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
            <Box sx={{ flex: 1 }}>
              {renderAuditSection(
                'Viewport Configuration',
                <PhoneAndroidIcon />,
                auditResult.viewport,
                auditResult.viewport.issues
              )}

              {renderAuditSection(
                'Touch Targets',
                <TouchAppIcon />,
                auditResult.touchTargets,
                auditResult.touchTargets.issues.map(issue =>
                  `<${issue.element}> smaller than 44px (${Math.round(issue.size.width)}×${Math.round(issue.size.height)}px)`
                )
              )}
            </Box>

            <Box sx={{ flex: 1 }}>
              {renderAuditSection(
                'Responsive Design',
                <PhoneAndroidIcon />,
                auditResult.responsiveDesign,
                auditResult.responsiveDesign.issues
              )}

              {renderAuditSection(
                'Performance',
                <SpeedIcon />,
                auditResult.performance,
                auditResult.performance.issues
              )}

              {renderAuditSection(
                'Accessibility',
                <AccessibilityIcon />,
                auditResult.accessibility,
                auditResult.accessibility.issues
              )}
            </Box>
          </Box>

          {/* Recommendations */}
          {auditResult.recommendations.length > 0 && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Action items and recommendations
                </Typography>
                <List>
                  {auditResult.recommendations.map((recommendation, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={
                          <Typography variant="body2">
                            {index + 1}. {recommendation}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}

          {/* Touch Target Details */}
          {auditResult.touchTargets.issues.length > 0 && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Touch target details
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Elements that don&apos;t meet the 44px minimum touch target size (WCAG AA requirement)
                </Typography>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>
                      {auditResult.touchTargets.issues.length} Non-compliant Touch Targets
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <List dense>
                      {auditResult.touchTargets.issues.map((issue, index) => (
                        <ListItem key={index}>
                          <ListItemText
                            primary={
                              <Typography variant="body2" fontWeight="bold">
                                {'<'}{issue.element}{'>'} {Math.round(issue.size.width)}×{Math.round(issue.size.height)}px
                              </Typography>
                            }
                            secondary={
                              <Typography variant="body2" color="text.secondary" noWrap title={issue.selector}>
                                {issue.selector}
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </AccordionDetails>
                </Accordion>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!auditResult && !isAuditing && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <AssessmentIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Ready to Run Mobile Audit
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Click the &quot;Run Audit&quot; button to perform a comprehensive assessment of mobile compatibility
            </Typography>
            <Button
              variant="contained"
              onClick={runAudit}
              startIcon={<AssessmentIcon />}
              size="large"
            >
              Start Mobile Audit
            </Button>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default MobileAuditDashboard;