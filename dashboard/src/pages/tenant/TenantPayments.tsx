import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Box, Card, CardContent, Divider, Pagination, Stack, Typography } from '@mui/material';
import tenantPortalService from '../../services/tenantPortalService';
import {
  EmptyState,
  ErrorNote,
  ListRow,
  Loading,
  PageHeader,
  PageShell,
  StatusChip,
  fmtDate,
  money,
  pretty,
} from '../../components/portal/PortalUI';

const PAGE_SIZE = 12;

const TenantPayments: React.FC = () => {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['tenant-payments', page, PAGE_SIZE],
    queryFn: () => tenantPortalService.getPayments(page, PAGE_SIZE),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const payments = q.data?.data ?? [];
  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paidOnPage = payments
    .filter((p) => String(p.status).toUpperCase() === 'COMPLETED')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <PageShell>
      <PageHeader title="Payments" subtitle="Your rent payment history." />
      <Card>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          {q.isLoading ? (
            <Loading />
          ) : q.isError ? (
            <ErrorNote text="Could not load your payments." onRetry={() => q.refetch()} />
          ) : payments.length === 0 ? (
            <EmptyState title="No payments yet" text="When you pay rent, each payment will be listed here." />
          ) : (
            <>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                {total} payment{total === 1 ? '' : 's'} · {money(paidOnPage, 2)} paid on this page
              </Typography>
              <Stack divider={<Divider flexItem />} spacing={1.5} data-testid="tenant-payments-list">
                {payments.map((p) => (
                  <ListRow
                    key={p.id}
                    primary={
                      <>
                        {money(p.amount, 2)}{' '}
                        <Typography component="span" variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                          · {fmtDate(p.paymentDate)}
                        </Typography>
                      </>
                    }
                    secondary={[p.notes || p.leaseDetails, p.paymentMethod ? pretty(p.paymentMethod) : null]
                      .filter(Boolean)
                      .join(' · ')}
                    right={<StatusChip status={p.status} />}
                  />
                ))}
              </Stack>
              {pages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2.5 }}>
                  <Pagination count={pages} page={page} onChange={(_, v) => setPage(v)} size="small" />
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
};

export default TenantPayments;
