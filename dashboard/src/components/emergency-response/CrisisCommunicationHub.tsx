import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Card, CardContent, Divider, Stack, TextField, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import PhoneIcon from '@mui/icons-material/Phone';
import { dashboardService } from '../../services/dashboardService';
import { apiErrorMessage } from '../../services/workOrderService';
import { EmptyState, ListRow } from '../portal/PortalUI';

const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

/**
 * Urgent announcement to every tenant with an active lease, delivered as an in-app
 * notification (POST /api/announcements + publish). Recent announcements are read back
 * from the notification log, one row per announcement.
 */
const CrisisCommunicationHub: React.FC = () => {
  const qc = useQueryClient();
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sent, setSent] = useState<string | null>(null);

  const recent = useQuery({
    queryKey: ['crisis-hub', 'announcements'],
    queryFn: () => dashboardService.getNotifications(1, 100, { type: 'announcement' } as any),
  });

  const history = useMemo(() => {
    const seen = new Map<string, { message: string; sentAt: string; count: number }>();
    for (const n of (recent.data?.data ?? []) as any[]) {
      const e = seen.get(n.message);
      if (e) e.count++;
      else seen.set(n.message, { message: n.message, sentAt: n.sentAt ?? n.createdAt, count: 1 });
    }
    return Array.from(seen.values()).slice(0, 5);
  }, [recent.data]);

  const send = useMutation({
    mutationFn: async () => {
      const draft: any = await dashboardService.createAnnouncement({
        title: subject.trim(),
        content: content.trim(),
        recipientGroups: ['all-tenants'],
        priority: 'urgent',
      });
      return (await dashboardService.publishAnnouncement(draft.id)) as any;
    },
    onSuccess: (res: any) => {
      setSent(`Alert sent to ${res?.recipientCount ?? 'all'} tenant${res?.recipientCount === 1 ? '' : 's'}.`);
      setSubject('');
      setContent('');
      qc.invalidateQueries({ queryKey: ['crisis-hub', 'announcements'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const canSend = subject.trim().length > 0 && content.trim().length > 0 && !send.isPending;

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Crisis communication
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Send an urgent in-app alert to every tenant with an active lease.
        </Typography>

        <Stack spacing={2}>
          <TextField
            fullWidth
            size="small"
            label="Subject"
            placeholder="e.g. Water shut-off at Sunrise Apartments"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Message"
            placeholder="What is happening, what tenants should do, and when you will update them."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          {send.isError && <Alert severity="error">{apiErrorMessage(send.error, 'The alert was not sent.')}</Alert>}
          {sent && (
            <Alert severity="success" onClose={() => setSent(null)}>
              {sent}
            </Alert>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button variant="contained" color="error" startIcon={<SendIcon />} disabled={!canSend} onClick={() => send.mutate()}>
              {send.isPending ? 'Sending…' : 'Send emergency alert'}
            </Button>
            <Button variant="outlined" startIcon={<PhoneIcon />} href="tel:911">
              Call 911
            </Button>
          </Stack>
        </Stack>

        <Divider sx={{ my: 3 }} />
        <Typography sx={{ fontWeight: 800, mb: 1.5 }}>Recent announcements</Typography>
        {recent.isLoading ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Loading…
          </Typography>
        ) : history.length === 0 ? (
          <EmptyState title="No announcements sent yet" text="Alerts you send from here will be listed for reference." />
        ) : (
          <Stack divider={<Divider />} spacing={1.25}>
            {history.map((h) => (
              <Box key={h.message}>
                <ListRow
                  primary={h.message.split(': ')[0]}
                  secondary={`Sent to ${h.count} recipient${h.count === 1 ? '' : 's'} · ${ago(h.sentAt)}`}
                />
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default CrisisCommunicationHub;
