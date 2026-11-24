import React, { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Card, CardContent, Chip, Divider, Pagination, Stack, Typography } from '@mui/material';
import tenantPortalService from '../../services/tenantPortalService';
import { EmptyState, ErrorNote, Loading, PageHeader, PageShell, fmtDate, pretty } from '../../components/portal/PortalUI';

/**
 * Simple per-user inbox for tenants and vendors (GET /api/notifications is scoped to the caller).
 * The staff /notifications page is an announcement manager (compose, edit, delete), so it is not reused here.
 */
const PAGE_SIZE = 15;

const PortalNotifications: React.FC = () => {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['portal-notifications', page],
    queryFn: () => tenantPortalService.getNotifications(page, PAGE_SIZE),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const markRead = useMutation({
    mutationFn: tenantPortalService.markNotificationRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-notifications'] });
      qc.invalidateQueries({ queryKey: ['header-unread-notifications'] });
      qc.invalidateQueries({ queryKey: ['tenant-summary'] });
    },
  });

  const items = q.data?.data ?? [];
  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageShell>
      <PageHeader
        title="Notifications"
        subtitle={q.data?.unread ? `${q.data.unread} unread` : q.data ? 'You are all caught up.' : 'Updates about your home and requests.'}
      />
      <Card>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          {q.isLoading ? (
            <Loading />
          ) : q.isError ? (
            <ErrorNote text="Could not load your notifications." onRetry={() => q.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState title="You're all caught up" text="New updates will appear here." />
          ) : (
            <>
              <Stack divider={<Divider flexItem />} spacing={1.5} data-testid="portal-notifications-list">
                {items.map((n) => (
                  <Box key={n.id} sx={{ pl: 1.5, borderLeft: '4px solid', borderColor: n.isRead ? 'transparent' : 'primary.main' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: n.isRead ? 600 : 800, wordBreak: 'break-word' }}>{n.title}</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', wordBreak: 'break-word' }}>
                          {n.message}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
                          {n.type && <Chip size="small" variant="outlined" label={pretty(n.type)} />}
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {fmtDate(n.sentAt || n.createdAt)}
                          </Typography>
                        </Stack>
                      </Box>
                      {!n.isRead && (
                        <Button
                          size="small"
                          onClick={() => markRead.mutate(n.id)}
                          disabled={markRead.isPending}
                          sx={{ flexShrink: 0 }}
                        >
                          Mark read
                        </Button>
                      )}
                    </Stack>
                  </Box>
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

export default PortalNotifications;
