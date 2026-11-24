import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CircularProgress,
  IconButton,
  List,
  ListItemButton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ForumIcon from '@mui/icons-material/Forum';
import { dashboardService } from '../services/dashboardService';
import { apiErrorMessage } from '../services/workOrderService';
import { EmptyState, ErrorNote, INK, Loading, PageHeader } from '../components/portal/PortalUI';

const initials = (name?: string) =>
  (name || '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const when = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Communications: a chat-style view of the same conversations as /messages
 * (GET /api/message-threads). Pick a conversation on the left, reply on the right.
 */
const CommunicationHub: React.FC = () => {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('md'));
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const threads = useQuery({
    queryKey: ['messageThreads', ''],
    queryFn: () => dashboardService.getMessageThreads(1, 50),
    retry: 1,
  });
  const list = threads.data?.data ?? [];

  // Desktop opens the newest conversation straight away.
  useEffect(() => {
    if (!isPhone && !selected && list.length) setSelected(list[0].id);
  }, [isPhone, selected, list]);

  const thread = useQuery({
    queryKey: ['messageThread', selected],
    queryFn: () => dashboardService.getMessageThread(selected as string),
    enabled: Boolean(selected),
  });

  const send = useMutation({
    mutationFn: (content: string) =>
      dashboardService.sendMessage({ recipientIds: [], subject: '', content, threadId: selected as string }),
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['messageThread', selected] });
      qc.invalidateQueries({ queryKey: ['messageThreads'] });
    },
  });

  const messages = useMemo(() => (thread.data?.messages ?? []) as any[], [thread.data]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = draft.trim();
    if (text && selected && !send.isPending) send.mutate(text);
  };

  const listPane = (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: `2px solid ${INK}` }}>
        <Typography sx={{ fontWeight: 800 }}>Conversations</Typography>
      </Box>
      {threads.isLoading ? (
        <Loading />
      ) : threads.isError ? (
        <Box sx={{ p: 2 }}>
          <ErrorNote text="Conversations could not be loaded." onRetry={() => threads.refetch()} />
        </Box>
      ) : list.length === 0 ? (
        <EmptyState title="No conversations yet" text="Messages between staff and tenants will appear here." />
      ) : (
        <List disablePadding sx={{ overflowY: 'auto', flex: 1 }}>
          {list.map((t: any) => {
            const other = t.participantNames?.[0] ?? 'Conversation';
            return (
              <ListItemButton
                key={t.id}
                selected={t.id === selected}
                onClick={() => setSelected(t.id)}
                sx={{
                  alignItems: 'flex-start',
                  gap: 1.5,
                  py: 1.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'rgba(242, 92, 5, 0.12)', color: 'text.primary' },
                }}
              >
                <Badge color="primary" badgeContent={t.unreadCount} invisible={!t.unreadCount}>
                  <Avatar sx={{ width: 36, height: 36, fontSize: 14, bgcolor: 'primary.main' }}>{initials(other)}</Avatar>
                </Badge>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography sx={{ fontWeight: 700 }} noWrap>
                      {other}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0 }}>
                      {when(t.lastMessageAt)}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {t.subject}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                    {t.lastMessagePreview}
                  </Typography>
                </Box>
              </ListItemButton>
            );
          })}
        </List>
      )}
    </Card>
  );

  const header = thread.data?.thread as any;
  const chatPane = (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {!selected ? (
        <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <EmptyState title="Select a conversation" text="Choose a conversation to read and reply." />
        </Box>
      ) : (
        <>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 1.5, borderBottom: `2px solid ${INK}` }}>
            {isPhone && (
              <IconButton aria-label="Back to conversations" onClick={() => setSelected(null)} size="small">
                <ArrowBackIcon />
              </IconButton>
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800 }} noWrap>
                {header?.participantNames?.join(' · ') ?? 'Conversation'}
              </Typography>
              {header?.subject && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                  {header.subject}
                </Typography>
              )}
            </Box>
          </Stack>

          <Box sx={{ flex: 1, overflowY: 'auto', p: 2, minHeight: 0 }}>
            {thread.isLoading ? (
              <Loading />
            ) : thread.isError ? (
              <ErrorNote text="This conversation could not be loaded." onRetry={() => thread.refetch()} />
            ) : (
              <Stack spacing={1.5}>
                {messages.map((m) => {
                  // Staff replies sit on the right, tenant messages on the left.
                  const right = m.isMine || (m.senderRole && m.senderRole !== 'TENANT');
                  return (
                  <Box key={m.id} sx={{ alignSelf: right ? 'flex-end' : 'flex-start', maxWidth: { xs: '88%', md: '70%' } }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textAlign: right ? 'right' : 'left', mb: 0.25 }}>
                      {m.senderName} · {when(m.sentAt)}
                    </Typography>
                    <Box
                      sx={{
                        px: 1.75,
                        py: 1.25,
                        borderRadius: '12px',
                        border: `1.5px solid ${INK}`,
                        bgcolor: right ? 'rgba(242, 92, 5, 0.12)' : 'background.paper',
                        color: 'text.primary',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {m.content}
                    </Box>
                  </Box>
                  );
                })}
                <div ref={endRef} />
              </Stack>
            )}
          </Box>

          <Box component="form" onSubmit={submit} sx={{ p: 2, borderTop: `2px solid ${INK}` }}>
            {send.isError && (
              <Alert severity="error" sx={{ mb: 1.5 }}>
                {apiErrorMessage(send.error, 'Message not sent.')}
              </Alert>
            )}
            <Stack direction="row" spacing={1.5} alignItems="flex-end">
              <TextField
                size="small"
                fullWidth
                multiline
                maxRows={4}
                placeholder="Write a reply…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                inputProps={{ 'aria-label': 'Reply' }}
              />
              <Button
                type="submit"
                variant="contained"
                endIcon={send.isPending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                disabled={!draft.trim() || send.isPending || thread.isError}
                sx={{ flexShrink: 0 }}
              >
                Send
              </Button>
            </Stack>
          </Box>
        </>
      )}
    </Card>
  );

  return (
    <Box sx={{ textAlign: 'left' }}>
      <PageHeader
        title="Communications"
        subtitle="Conversations with tenants, in one place."
        action={
          <Button variant="outlined" startIcon={<ForumIcon />} component={RouterLink} to="/messages">
            Full inbox
          </Button>
        }
      />
      <Box
        sx={{
          display: 'grid',
          gap: 2.5,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(260px, 340px) minmax(0, 1fr)' },
          height: { xs: 'auto', md: 'calc(100vh - 230px)' },
          minHeight: { md: 480 },
        }}
      >
        {(!isPhone || !selected) && <Box sx={{ minHeight: 0, height: { xs: 'auto', md: '100%' } }}>{listPane}</Box>}
        {(!isPhone || selected) && <Box sx={{ minHeight: 0, height: { xs: '70vh', md: '100%' } }}>{chatPane}</Box>}
      </Box>
    </Box>
  );
};

export default CommunicationHub;
