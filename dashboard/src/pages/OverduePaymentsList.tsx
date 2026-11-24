import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Container,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  AlertTitle,
  Button,
  GridLegacy as Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Skeleton,
  Snackbar,
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  Payment as PaymentIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { queryKeys } from '../config/queryClient';
import { dashboardService, OverduePayment } from '../services/dashboardService';

interface OverduePaymentsFilters {
  propertyId?: string;
  tenantId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minDaysOverdue?: number;
  maxDaysOverdue?: number;
}

const OverduePaymentsList: React.FC = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filters, setFilters] = useState<OverduePaymentsFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [notice, setNotice] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);

  // Filter options come from the live property (unit) and tenant lists.
  const { data: propertyOptions = [] } = useQuery({
    queryKey: ['overdue-filter', 'properties'],
    queryFn: async () => {
      const res = await dashboardService.getProperties(1, 100);
      return (res.data ?? [])
        .map((p: any) => ({ id: String(p.id), title: String(p.title || p.address || 'Untitled property') }))
        .sort((x: { title: string }, y: { title: string }) => x.title.localeCompare(y.title));
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: tenantOptions = [] } = useQuery({
    queryKey: ['overdue-filter', 'tenants'],
    queryFn: async () => {
      const res: any = await dashboardService.getTenants(1, 100);
      const rows: any[] = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      return rows
        .map((t) => ({ id: String(t.id), name: String(t.name || [t.firstName, t.lastName].filter(Boolean).join(' ') || t.email) }))
        .sort((x, y) => x.name.localeCompare(y.name));
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: overduePayments, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.dashboard.overduePayments(filters),
    queryFn: () => dashboardService.getOverduePayments(filters),
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchIntervalInBackground: false, // Only refetch when tab is active
  });

  const filteredPayments = useMemo(() => {
    if (!overduePayments) return [];

    return overduePayments.filter((payment) => {
      if (filters.propertyId && payment.propertyId !== filters.propertyId) return false;
      if (filters.tenantId && payment.tenantId !== filters.tenantId) return false;
      if (filters.minDaysOverdue && payment.daysOverdue < filters.minDaysOverdue) return false;
      if (filters.maxDaysOverdue && payment.daysOverdue > filters.maxDaysOverdue) return false;
      if (filters.dateFrom && new Date(payment.dueDate) < filters.dateFrom) return false;
      if (filters.dateTo && new Date(payment.dueDate) > filters.dateTo) return false;
      return true;
    });
  }, [overduePayments, filters]);

  const paginatedPayments = filteredPayments.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handlePageChange = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (field: keyof OverduePaymentsFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(0);
  };

  const getSeverityColor = (daysOverdue: number) => {
    if (daysOverdue >= 30) return 'error';
    if (daysOverdue >= 14) return 'warning';
    return 'info';
  };

  const getSeverityLabel = (daysOverdue: number) => {
    if (daysOverdue >= 30) return 'Critical';
    if (daysOverdue >= 14) return 'Warning';
    return 'Minor';
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    if (format === 'pdf') {
      // The browser's print dialog offers "Save as PDF".
      window.print();
      return;
    }
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Tenant', 'Property', 'Unit', 'Amount', 'Due date', 'Days overdue', 'Status'];
    const lines = filteredPayments.map((p: any) =>
      [p.tenantName, p.propertyName, p.unitNumber, p.amount, new Date(p.dueDate).toISOString().slice(0, 10), p.daysOverdue, p.status]
        .map(esc)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `overdue-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalOverdueAmount = filteredPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const criticalCount = filteredPayments.filter(p => p.daysOverdue >= 30).length;
  const warningCount = filteredPayments.filter(p => p.daysOverdue >= 14 && p.daysOverdue < 30).length;

  const handleSendReminder = async (paymentId: string) => {
    try {
      await dashboardService.triggerPaymentReminder(paymentId);
      setNotice({ severity: 'success', text: 'Payment reminder sent.' });
    } catch (error) {
      setNotice({ severity: 'error', text: 'Could not send the reminder. Please try again.' });
    }
  };

  const handleMarkAsPaid = async (paymentId: string) => {
    try {
      await dashboardService.markPaymentPaid(paymentId);
      setNotice({ severity: 'success', text: 'Payment marked as paid.' });
      refetch(); // Refresh the data
    } catch (error) {
      setNotice({ severity: 'error', text: 'Could not mark the payment as paid. Please try again.' });
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
          {[1, 2, 3].map((i) => (
            <Card key={i} sx={{ flex: '1 1 300px' }}>
              <CardContent>
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="40%" />
              </CardContent>
            </Card>
          ))}
        </Box>
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {['Tenant', 'Unit', 'Amount', 'Due Date', 'Days Overdue', 'Status'].map((header) => (
                    <TableCell key={header}>
                      <Skeleton variant="text" width="100%" />
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton variant="text" width="80%" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">
          <AlertTitle>Failed to load overdue payments</AlertTitle>
          {(error as Error).message}
        </Alert>
      </Container>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h3" component="h1" gutterBottom>
              Overdue Payments
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Track and manage overdue rent payments across all properties
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => handleExport('csv')}
            >
              Export CSV
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => handleExport('pdf')}
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

        {/* KPI Cards */}
        <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
          <Card sx={{ flex: '1 1 300px' }}>
            <CardContent>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Total Overdue Amount
              </Typography>
              <Typography variant="h4" color="error">
                ${totalOverdueAmount.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: '1 1 300px' }}>
            <CardContent>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Critical Overdue (30+ days)
              </Typography>
              <Typography variant="h4" color="error">
                {criticalCount}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: '1 1 300px' }}>
            <CardContent>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Warning Overdue (14-29 days)
              </Typography>
              <Typography variant="h4" color="warning.main">
                {warningCount}
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Button
              startIcon={<FilterIcon />}
              onClick={() => setShowFilters(!showFilters)}
              variant="outlined"
              size="small"
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </Button>
          </Box>

          {showFilters && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControl sx={{ minWidth: 200, flex: 1 }} size="small">
                <InputLabel>Property</InputLabel>
                <Select
                  value={filters.propertyId || ''}
                  onChange={(e) => handleFilterChange('propertyId', e.target.value || undefined)}
                  label="Property"
                >
                  <MenuItem value="">
                    <em>All Properties</em>
                  </MenuItem>
                  {propertyOptions.map((property: { id: string; title: string }) => (
                    <MenuItem key={property.id} value={property.id}>
                      {property.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 200, flex: 1 }} size="small">
                <InputLabel>Tenant</InputLabel>
                <Select
                  value={filters.tenantId || ''}
                  onChange={(e) => handleFilterChange('tenantId', e.target.value || undefined)}
                  label="Tenant"
                >
                  <MenuItem value="">
                    <em>All Tenants</em>
                  </MenuItem>
                  {tenantOptions.map((tenant) => (
                    <MenuItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <DatePicker
                label="From Date"
                value={filters.dateFrom || null}
                onChange={(date) => handleFilterChange('dateFrom', date)}
                slotProps={{ textField: { size: 'small', sx: { minWidth: 150, flex: 1 } } }}
              />
              <DatePicker
                label="To Date"
                value={filters.dateTo || null}
                onChange={(date) => handleFilterChange('dateTo', date)}
                slotProps={{ textField: { size: 'small', sx: { minWidth: 150, flex: 1 } } }}
              />
              <TextField
                sx={{ minWidth: 150, flex: 1 }}
                size="small"
                label="Min Days Overdue"
                type="number"
                value={filters.minDaysOverdue || ''}
                onChange={(e) => handleFilterChange('minDaysOverdue', e.target.value ? parseInt(e.target.value) : undefined)}
              />
            </Box>
          )}
        </Paper>

        {/* Table */}
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Tenant</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell align="right">Days Overdue</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <PaymentIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                          No overdue payments found
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          All payments are current
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPayments.map((payment: OverduePayment) => (
                    <TableRow key={payment.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {payment.tenantName}
                        </Typography>
                      </TableCell>
                      <TableCell>{payment.unitNumber}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          ${payment.amount.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {new Date(payment.dueDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${payment.daysOverdue} days`}
                          color={getSeverityColor(payment.daysOverdue)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getSeverityLabel(payment.daysOverdue)}
                          color={getSeverityColor(payment.daysOverdue)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Send reminder">
                          <IconButton
                            size="small"
                            onClick={() => handleSendReminder(payment.id)}
                          >
                            <WarningIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Mark as paid">
                          <IconButton
                            size="small"
                            onClick={() => handleMarkAsPaid(payment.id)}
                          >
                            <PaymentIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredPayments.length}
            page={page}
            onPageChange={handlePageChange}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </Paper>
        <Snackbar open={Boolean(notice)} autoHideDuration={4000} onClose={() => setNotice(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert severity={notice?.severity ?? 'success'} onClose={() => setNotice(null)} variant="filled">
            {notice?.text}
          </Alert>
        </Snackbar>
      </Container>
    </LocalizationProvider>
  );
};

export default OverduePaymentsList;