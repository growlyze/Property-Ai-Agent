import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Card, CardContent, Divider, Stack } from '@mui/material';
import PaymentsIcon from '@mui/icons-material/Payments';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import vendorPortalService from '../../services/vendorPortalService';
import { EmptyState, ErrorNote, ListRow, Loading, PageHeader, PageShell, StatCard, StatusChip, fmtDate, money } from '../../components/portal/PortalUI';

const PAID = ['COMPLETED', 'PAID', 'SUCCEEDED'];

const VendorPayments: React.FC = () => {
  const q = useQuery({ queryKey: ['vendor-payments'], queryFn: () => vendorPortalService.getPayments(1, 100), retry: false });
  const items = q.data?.data ?? [];
  const paid = items.filter((p) => PAID.includes(String(p.status).toUpperCase())).reduce((s, p) => s + Number(p.amount || 0), 0);
  const pending = items.filter((p) => !PAID.includes(String(p.status).toUpperCase()) && String(p.status).toUpperCase() !== 'FAILED').reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <PageShell>
      <PageHeader title="Payments" subtitle="Payouts for your completed work." />
      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <ErrorNote text="Could not load your payments." onRetry={() => q.refetch()} />
      ) : (
        <>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(2, minmax(0, 280px))' }, mb: 2.5 }}>
            <StatCard icon={<PaymentsIcon fontSize="small" />} label="Paid" value={money(paid)} sub={`${items.length} payment${items.length === 1 ? '' : 's'}`} accent="#0db664" />
            <StatCard icon={<HourglassTopIcon fontSize="small" />} label="Pending" value={money(pending)} sub="Not yet paid out" accent="#ffb900" />
          </Box>
          <Card>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              {items.length === 0 ? (
                <EmptyState title="No payments yet" text="Payments for completed jobs will appear here." />
              ) : (
                <Stack divider={<Divider flexItem />} spacing={1.5} data-testid="vendor-payments-list">
                  {items.map((p) => (
                    <ListRow
                      key={p.id}
                      primary={p.workOrder?.title || 'Payment'}
                      secondary={[p.rental?.title, fmtDate(p.paymentDate)].filter(Boolean).join(' · ')}
                      right={
                        <>
                          <Box component="span" sx={{ fontWeight: 800 }}>
                            {money(p.amount, 2)}
                          </Box>
                          <StatusChip status={p.status} />
                        </>
                      }
                    />
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PageShell>
  );
};

export default VendorPayments;
