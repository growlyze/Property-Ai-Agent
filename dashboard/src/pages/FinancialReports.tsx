import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Container,
  Typography,
  Box,
  Paper,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  AlertTitle,
  IconButton,
  Tooltip,
  Skeleton,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  AccountBalance as AccountBalanceIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';
import { queryKeys } from '../config/queryClient';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { dashboardService, FinancialReport, FinancialReportsParams } from '../services/dashboardService';

const FinancialReports: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<FinancialReportsParams>({
    type: 'monthly',
    period: new Date().toISOString().slice(0, 7), // Current month YYYY-MM
  });

  const { data: report, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.dashboard.financialReports(selectedReport),
    queryFn: () => dashboardService.getFinancialReports(selectedReport),
    refetchInterval: 60000, // Refresh every 60 seconds for financial reports
    refetchIntervalInBackground: false,
  });

  const handleReportTypeChange = (type: 'monthly' | 'quarterly' | 'annual') => {
    setSelectedReport(prev => ({ ...prev, type }));
  };

  const handlePeriodChange = (period: string) => {
    setSelectedReport(prev => ({ ...prev, period }));
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    const current = Array.isArray(report) && report.length > 0 ? report[0] : null;
    if (!current) return;
    if (format === 'pdf') {
      // The browser's print dialog offers "Save as PDF".
      window.print();
      return;
    }
    // Built here from the loaded report, so the export always matches what is on screen.
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows: unknown[][] = [
      ['Property', 'Revenue', 'Overdue'],
      ...(current.propertyBreakdown ?? []).map((p) => [p.propertyName, p.revenue, p.overdue]),
      [],
      ['Total revenue', current.totalRevenue],
      ['Total overdue', current.totalOverdue],
    ];
    const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-report-${selectedReport.type}-${selectedReport.period}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPeriod = (period: string, type: string) => {
    const date = new Date(period + (type === 'monthly' ? '-01' : type === 'quarterly' ? '-01-01' : '-01-01'));
    if (type === 'monthly') {
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    } else if (type === 'quarterly') {
      const quarter = Math.floor((date.getMonth() / 3)) + 1;
      return `Q${quarter} ${date.getFullYear()}`;
    } else {
      return date.getFullYear().toString();
    }
  };

  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Skeleton variant="text" width="40%" height={40} />
          <Skeleton variant="text" width="60%" height={24} />
        </Box>
        <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} sx={{ flex: '1 1 250px' }}>
              <CardContent>
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="40%" height={32} />
              </CardContent>
            </Card>
          ))}
        </Box>
        <Paper sx={{ p: 3 }}>
          <Skeleton variant="rectangular" height={300} />
        </Paper>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">
          <AlertTitle>Failed to load financial reports</AlertTitle>
          {(error as Error).message}
        </Alert>
      </Container>
    );
  }

  const currentReport = Array.isArray(report) && report.length > 0 ? report[0] : null;
  // One row per period bucket, stacked by payment status, for the trends chart.
  const trendRows = (() => {
    const byDate = new Map<string, { date: string; paid: number; pending: number; overdue: number }>();
    for (const t of currentReport?.paymentTrends ?? []) {
      const row = byDate.get(t.date) ?? { date: t.date, paid: 0, pending: 0, overdue: 0 };
      if (t.status === 'paid' || t.status === 'pending' || t.status === 'overdue') row[t.status] += t.amount;
      byDate.set(t.date, row);
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  })();

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'flex-start' } }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontSize: { xs: '1.75rem', md: '2.125rem' }, fontWeight: 800 }}>
            Financial Reports
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Comprehensive financial analysis and reporting for your properties
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => handleExport('csv')}
            disabled={!currentReport}
          >
            Export CSV
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => handleExport('pdf')}
            disabled={!currentReport}
          >
            Export PDF
          </Button>
          <Tooltip title="Refresh data">
            <IconButton onClick={() => refetch()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Report Configuration */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Report Configuration
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl sx={{ minWidth: 150 }} size="small">
            <InputLabel>Report Type</InputLabel>
            <Select
              value={selectedReport.type || 'monthly'}
              onChange={(e) => handleReportTypeChange(e.target.value as 'monthly' | 'quarterly' | 'annual')}
              label="Report Type"
            >
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="quarterly">Quarterly</MenuItem>
              <MenuItem value="annual">Annual</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Period"
            type={selectedReport.type === 'monthly' ? 'month' : selectedReport.type === 'quarterly' ? 'month' : 'number'}
            value={selectedReport.period || ''}
            onChange={(e) => handlePeriodChange(e.target.value)}
            size="small"
            sx={{ minWidth: 150 }}
            inputProps={{
              min: selectedReport.type === 'annual' ? '2000' : undefined,
              max: selectedReport.type === 'annual' ? new Date().getFullYear().toString() : undefined,
            }}
          />
        </Box>
      </Paper>

      {currentReport ? (
        <>
          {/* KPI Cards */}
          <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
            <Card sx={{ flex: '1 1 250px' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <AccountBalanceIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" color="text.secondary">
                    Total Revenue
                  </Typography>
                </Box>
                <Typography variant="h4" color="primary.main">
                  {formatCurrency(currentReport.totalRevenue)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatPeriod(currentReport.period, currentReport.type)}
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ flex: '1 1 250px' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <PaymentIcon sx={{ mr: 1, color: 'error.main' }} />
                  <Typography variant="h6" color="text.secondary">
                    Total Overdue
                  </Typography>
                </Box>
                <Typography variant="h4" color="error.main">
                  {formatCurrency(currentReport.totalOverdue)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Outstanding payments
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ flex: '1 1 250px' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TrendingUpIcon sx={{ mr: 1, color: 'success.main' }} />
                  <Typography variant="h6" color="text.secondary">
                    Collection Rate
                  </Typography>
                </Box>
                <Typography variant="h4" color="success.main">
                  {currentReport.totalRevenue > 0
                    ? Math.round(((currentReport.totalRevenue - currentReport.totalOverdue) / currentReport.totalRevenue) * 100)
                    : 0}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Payments collected
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ flex: '1 1 250px' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <AccountBalanceIcon sx={{ mr: 1, color: 'info.main' }} />
                  <Typography variant="h6" color="text.secondary">
                    Properties
                  </Typography>
                </Box>
                <Typography variant="h4" color="info.main">
                  {(currentReport.propertyBreakdown ?? []).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active properties
                </Typography>
              </CardContent>
            </Card>
          </Box>

          {/* Payment Trends Chart */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Payment Trends
            </Typography>
            {trendRows.length === 0 ? (
              <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="body1" color="text.secondary">
                  No payments in this period.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ height: 300, width: '100%', minWidth: 0, overflow: 'hidden' }}>
                <ResponsiveContainer width="99%" height="100%">
                  <BarChart data={trendRows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d8cdb9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(d: string) =>
                        /^\d{4}-\d{2}-\d{2}$/.test(d)
                          ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
                          : d
                      }
                    />
                    <YAxis tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} tick={{ fontSize: 12 }} />
                    <RechartsTooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="paid" name="Paid" stackId="a" fill="#0db664" stroke="#050d1f" />
                    <Bar dataKey="pending" name="Pending" stackId="a" fill="#ffb900" stroke="#050d1f" />
                    <Bar dataKey="overdue" name="Overdue" stackId="a" fill="#d92d20" stroke="#050d1f" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Showing payment trends over time for the selected period
            </Typography>
          </Paper>

          {/* Property Breakdown */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Property Breakdown
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {(currentReport.propertyBreakdown ?? []).map((property) => (
                <Box
                  key={property.propertyId}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <Box>
                    <Typography variant="subtitle1" fontWeight="medium">
                      {property.propertyName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {property.overdue > 0 ? 'Has overdue rent' : 'Up to date'}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <Typography variant="h6" color="primary.main">
                      {formatCurrency(property.revenue)}
                    </Typography>
                    <Typography variant="body2" color={property.overdue > 0 ? "error.main" : "text.secondary"}>
                      Overdue: {formatCurrency(property.overdue)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </>
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <AccountBalanceIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No financial data available
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your report parameters or check back later
          </Typography>
        </Paper>
      )}
    </Container>
  );
};

export default FinancialReports;