import React, { useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Avatar, Box, Button, Card, Chip, CircularProgress, IconButton, Stack, TextField, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { apiService } from '../services/apiService';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  link?: { label: string; to: string };
}

const INK = '#140827';

/**
 * Built-in answers used when the AI chat service (POST /api/ai/chat) is not
 * available, so common questions still get a useful reply and a link.
 */
const LOCAL_ANSWERS: { match: RegExp; text: string; link: { label: string; to: string } }[] = [
  {
    match: /maint|repair|fix|leak|broken/i,
    text: 'You can log a repair from Maintenance Requests. Add the unit, a short description and a priority; urgent issues such as leaks are flagged to the on-call team.',
    link: { label: 'Open Maintenance Requests', to: '/maintenance-requests' },
  },
  {
    match: /rent|pay|payment|balance|late/i,
    text: 'Rent payments, outstanding balances and receipts are on the Payments page. Overdue amounts are listed under Overdue Payments.',
    link: { label: 'Open Payments', to: '/payments' },
  },
  {
    match: /lease|renew|move.?out|contract/i,
    text: 'Lease terms, renewal dates and rent amounts are on the Leases page. Leases ending in the next 60 days are also shown on the dashboard.',
    link: { label: 'Open Leases', to: '/leases' },
  },
  {
    match: /contact|manager|message|call|email/i,
    text: 'You can message residents, owners and vendors from Messages, or send a building-wide notice from Notifications.',
    link: { label: 'Open Messages', to: '/messages' },
  },
];

const localAnswer = (q: string): Pick<Message, 'text' | 'link'> => {
  const hit = LOCAL_ANSWERS.find((a) => a.match.test(q));
  if (hit) return { text: hit.text, link: hit.link };
  return {
    text: "I can help with maintenance requests, rent payments, leases and contacting people. Try one of the quick questions, or ask about one of those topics.",
  };
};

const QUICK_ACTIONS = [
  { label: 'Submit a maintenance request', prompt: 'How do I submit a maintenance request?' },
  { label: 'Rent payments', prompt: 'How do rent payments work?' },
  { label: 'Lease information', prompt: 'Where can I see lease information?' },
  { label: 'Contact someone', prompt: 'How can I contact a resident or vendor?' },
];

const DigitalConciergeScreen: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: "Hello! I'm your property assistant. Ask me about maintenance, rent, leases or getting in touch with someone.",
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll only the message list; scrollIntoView used to scroll the whole page
  // and push the app header off screen.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || isLoading) return;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, text, sender: 'user', timestamp: new Date() }]);
    setInputText('');
    setIsLoading(true);

    let reply: Pick<Message, 'text' | 'link'> | null = null;
    try {
      const res: any = await apiService.post('/ai/chat', { message: text, ...(conversationId ? { conversationId } : {}) });
      const data = res?.data?.data ?? res?.data;
      const answer = data?.message ?? data?.response ?? data?.text;
      if (!res?.error && typeof answer === 'string' && answer.trim()) {
        reply = { text: answer.trim() };
        if (data?.conversationId) setConversationId(data.conversationId);
      }
    } catch {
      // fall through to the built-in answer
    }
    const final = reply ?? localAnswer(text);
    setMessages((prev) => [...prev, { id: `a-${Date.now()}`, sender: 'ai', timestamp: new Date(), ...final }]);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(inputText);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto', width: '100%' }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 800, fontSize: { xs: '1.6rem', md: '2.125rem' } }}>
        Digital Concierge
      </Typography>
      <Typography sx={{ color: 'text.secondary', mb: 3 }}>
        Quick answers about maintenance, rent, leases and contacts, with links to the right page.
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
        <Card sx={{ order: { xs: 1, md: 2 }, width: { md: 300 }, flexShrink: 0, p: 2, alignSelf: 'flex-start' }}>
          <Typography sx={{ fontWeight: 800, mb: 1.5 }}>Quick questions</Typography>
          <Stack direction={{ xs: 'row', md: 'column' }} spacing={1} useFlexGap flexWrap="wrap">
            {QUICK_ACTIONS.map((a) => (
              <Chip key={a.label} label={a.label} variant="outlined" onClick={() => send(a.prompt)} disabled={isLoading} sx={{ justifyContent: 'flex-start' }} />
            ))}
          </Stack>
        </Card>

        <Card sx={{ order: { xs: 2, md: 1 }, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: { xs: '60vh', md: 'calc(100vh - 260px)' }, minHeight: 380 }}>
          <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
            <Stack spacing={2}>
              {messages.map((m) => {
                const mine = m.sender === 'user';
                return (
                  <Stack key={m.id} direction={mine ? 'row-reverse' : 'row'} spacing={1.25} alignItems="flex-start">
                    <Avatar sx={{ width: 34, height: 34, bgcolor: mine ? '#2563eb' : 'primary.main', border: `1.5px solid ${INK}` }}>
                      {mine ? <PersonIcon fontSize="small" /> : <SmartToyIcon fontSize="small" />}
                    </Avatar>
                    <Box sx={{ maxWidth: { xs: '82%', md: '70%' }, textAlign: 'left' }}>
                      <Box
                        sx={{
                          px: 1.75,
                          py: 1.25,
                          borderRadius: '12px',
                          border: `1.5px solid ${INK}`,
                          bgcolor: mine ? '#fde7d6' : '#fffdf8',
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        <Typography variant="body2">{m.text}</Typography>
                        {m.link && (
                          <Button component={RouterLink} to={m.link.to} size="small" endIcon={<ArrowForwardIcon />} sx={{ mt: 1, px: 0 }}>
                            {m.link.label}
                          </Button>
                        )}
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, textAlign: mine ? 'right' : 'left' }}>
                        {m.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </Typography>
                    </Box>
                  </Stack>
                );
              })}
              {isLoading && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
                  <CircularProgress size={18} />
                  <Typography variant="body2">Thinking…</Typography>
                </Stack>
              )}
            </Stack>
          </Box>

          <Stack direction="row" spacing={1} alignItems="flex-end" sx={{ p: 2, borderTop: '1px solid #e7e1d6' }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              size="small"
              placeholder="Type your question…"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              inputProps={{ 'aria-label': 'Message' }}
            />
            <IconButton onClick={() => send(inputText)} disabled={isLoading || !inputText.trim()} color="primary" aria-label="Send">
              <SendIcon />
            </IconButton>
          </Stack>
        </Card>
      </Stack>
    </Box>
  );
};

export default DigitalConciergeScreen;
