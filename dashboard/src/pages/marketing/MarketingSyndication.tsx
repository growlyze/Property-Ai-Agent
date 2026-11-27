import React, { useEffect, useState } from 'react';
import { marketingService } from '../../services/marketingService';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  GridLegacy as Grid,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Hub as HubIcon,
  ListAlt as ListAltIcon,
  Paid as PaidIcon,
  Settings as SettingsIcon,
  Sync as SyncIcon,
  Update as UpdateIcon,
  LinkOff as LinkOffIcon,
} from '@mui/icons-material';
import { EmptyState, ErrorNote, INK, Loading, PageHeader, PageShell, StatCard, money, pretty } from '../../components/portal/PortalUI';

/** Shape returned by GET /marketing/syndication/platforms (secrets are never returned). */
interface Platform {
  id: string;
  name: string;
  enabled: boolean;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'SYNCING';
  lastSync?: string | null;
  totalListings: number;
  activeListings: number;
  monthlyFee?: number | null;
}

interface Activity {
  id: string;
  platform: string;
  action: string;
  status: string;
  timestamp: string;
  details?: string | null;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

/**
 * Shown only while no listing portal has been connected, so the page explains
 * itself instead of rendering empty. Clearly labelled as a preview; dates are
 * relative to now and listings reference the demo portfolio.
 */
const SAMPLE_PLATFORMS: Platform[] = [
  { id: 's1', name: 'Zillow', enabled: true, status: 'CONNECTED', lastSync: hoursAgo(2), totalListings: 9, activeListings: 8, monthlyFee: 299 },
  { id: 's2', name: 'Apartments.com', enabled: true, status: 'CONNECTED', lastSync: hoursAgo(3), totalListings: 9, activeListings: 7, monthlyFee: 249 },
  { id: 's3', name: 'Realtor.com', enabled: false, status: 'DISCONNECTED', lastSync: null, totalListings: 0, activeListings: 0, monthlyFee: 199 },
  { id: 's4', name: 'Facebook Marketplace', enabled: true, status: 'ERROR', lastSync: hoursAgo(26), totalListings: 6, activeListings: 4, monthlyFee: 0 },
];
const SAMPLE_ACTIVITY: Activity[] = [
  { id: 'a1', platform: 'Zillow', action: 'sync', status: 'success', timestamp: hoursAgo(2), details: 'Updated rent for Sunrise Apartments - Unit 201' },
  { id: 'a2', platform: 'Apartments.com', action: 'create', status: 'success', timestamp: hoursAgo(3), details: 'Published Bayview Condos - Unit 2B' },
  { id: 'a3', platform: 'Facebook Marketplace', action: 'sync', status: 'error', timestamp: hoursAgo(26), details: 'Photo upload failed for Parkview Townhomes - Unit A1' },
  { id: 'a4', platform: 'Zillow', action: 'delete', status: 'success', timestamp: hoursAgo(30), details: 'Removed leased listing Oakridge House' },
];

const STATUS: Record<Platform['status'], { label: string; color: 'success' | 'default' | 'error' | 'info'; icon: React.ReactElement }> = {
  CONNECTED: { label: 'Connected', color: 'success', icon: <CheckCircleIcon fontSize="small" /> },
  DISCONNECTED: { label: 'Not connected', color: 'default', icon: <LinkOffIcon fontSize="small" /> },
  ERROR: { label: 'Error', color: 'error', icon: <ErrorIcon fontSize="small" /> },
  SYNCING: { label: 'Syncing', color: 'info', icon: <SyncIcon fontSize="small" /> },
};

const relative = (s?: string | null) => {
  if (!s) return 'Never';
  const mins = Math.round((Date.now() - new Date(s).getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h}h ago`;
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const MarketingSyndication: React.FC = () => {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsFor, setSettingsFor] = useState<Platform | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const [p, a] = await Promise.all([marketingService.getSyndicationPlatforms(), marketingService.getSyncActivity()]);
      setPlatforms(p.data ?? []);
      setActivity(a.data ?? []);
    } catch (e) {
      setError('Could not load syndication platforms. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sample = !loading && !error && platforms.length === 0;
  const shownPlatforms = sample ? SAMPLE_PLATFORMS : platforms;
  const shownActivity = sample ? SAMPLE_ACTIVITY : activity;

  const run = async (fn: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  const connected = shownPlatforms.filter((p) => p.status === 'CONNECTED').length;
  const lastSync = shownPlatforms
    .map((p) => p.lastSync)
    .filter(Boolean)
    .sort()
    .pop();

  return (
    <PageShell>
      <PageHeader
        title="Listing Syndication"
        subtitle="Publish your vacant units to rental portals and keep them in sync."
        action={
          <Button
            variant="contained"
            startIcon={<SyncIcon />}
            disabled={sample || busy || platforms.every((p) => !p.enabled)}
            onClick={() => run(() => marketingService.syncAllPlatforms(), 'Could not start the sync.')}
            fullWidth
          >
            Sync All
          </Button>
        }
      />

      {error && (
        <Box sx={{ mb: 3 }}>
          <ErrorNote text={error} onRetry={load} />
        </Box>
      )}

      {sample && (
        <Alert severity="info" sx={{ mb: 3, border: `1px solid var(--color-border-default)` }}>
          No listing portals are connected yet. The cards below are a preview with sample data showing how syndication will look once a portal is set up.
        </Alert>
      )}

      {loading ? (
        <Loading />
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} md={3}>
              <StatCard icon={<HubIcon fontSize="small" />} accent="#16a34a" label="Connected" value={connected} sub={`of ${shownPlatforms.length} portals`} />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard icon={<ListAltIcon fontSize="small" />} accent="#2563eb" label="Live listings" value={shownPlatforms.reduce((s, p) => s + p.activeListings, 0)} sub="Across all portals" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard icon={<PaidIcon fontSize="small" />} accent="#f99c00" label="Monthly cost" value={money(shownPlatforms.filter((p) => p.enabled).reduce((s, p) => s + (p.monthlyFee ?? 0), 0))} sub="Enabled portals" />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard icon={<UpdateIcon fontSize="small" />} accent="#7c3aed" label="Last sync" value={relative(lastSync)} sub="Most recent portal" />
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            {shownPlatforms.map((p) => {
              const st = STATUS[p.status] ?? STATUS.DISCONNECTED;
              return (
                <Grid item xs={12} sm={6} lg={3} key={p.id}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ mb: 1.5 }}>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              flexShrink: 0,
                              borderRadius: '8px',
                              border: `1px solid var(--color-border-default)`,
                              bgcolor: '#e2ecff',
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 800,
                            }}
                          >
                            {p.name.charAt(0)}
                          </Box>
                          <Typography sx={{ fontWeight: 800, lineHeight: 1.2, minWidth: 0 }}>{p.name}</Typography>
                        </Stack>
                        <Tooltip title={p.enabled ? 'Publishing on' : 'Publishing off'}>
                          <Switch
                            checked={p.enabled}
                            disabled={sample || busy}
                            inputProps={{ 'aria-label': `Publish to ${p.name}` }}
                            onChange={() => run(() => marketingService.updateSyndicationPlatform(p.id, { enabled: !p.enabled }), `Could not update ${p.name}.`)}
                          />
                        </Tooltip>
                      </Stack>

                      <Box sx={{ mb: 1.5 }}>
                        <Chip size="small" icon={st.icon} label={st.label} color={st.color} />
                      </Box>

                      <Stack direction="row" spacing={3} sx={{ mb: 1.5 }}>
                        <Box>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Live listings
                          </Typography>
                          <Typography sx={{ fontWeight: 800, fontSize: '1.25rem' }}>
                            {p.activeListings}
                            <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
                              {' '}
                              / {p.totalListings}
                            </Typography>
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Monthly fee
                          </Typography>
                          <Typography sx={{ fontWeight: 800, fontSize: '1.25rem' }}>{p.monthlyFee ? money(p.monthlyFee) : 'Free'}</Typography>
                        </Box>
                      </Stack>

                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                        Last sync: {relative(p.lastSync)}
                      </Typography>

                      <Stack direction="row" spacing={1} sx={{ mt: 'auto' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<SettingsIcon />}
                          disabled={sample}
                          onClick={() => {
                            setApiKey('');
                            setSettingsFor(p);
                          }}
                        >
                          Settings
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<SyncIcon />}
                          disabled={sample || busy || !p.enabled}
                          onClick={() => run(() => marketingService.syncPlatform(p.id), `Could not sync ${p.name}.`)}
                        >
                          Sync now
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          <Card>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                Recent sync activity
              </Typography>
              {shownActivity.length === 0 ? (
                <EmptyState title="No sync activity yet" text="Syncs and listing changes will be logged here." />
              ) : (
                <TableContainer>
                  <Table size="small" sx={{ minWidth: 640 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Portal</TableCell>
                        <TableCell>Action</TableCell>
                        <TableCell>Result</TableCell>
                        <TableCell>When</TableCell>
                        <TableCell>Details</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {shownActivity.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{a.platform}</TableCell>
                          <TableCell>{pretty(a.action)}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={pretty(a.status)}
                              color={a.status === 'success' ? 'success' : a.status === 'error' ? 'error' : 'default'}
                            />
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{relative(a.timestamp)}</TableCell>
                          <TableCell>{a.details || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!settingsFor} onClose={() => setSettingsFor(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{settingsFor?.name} settings</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Enter a new API key to connect or reconnect this portal. Saved keys are never shown again.
          </Typography>
          <TextField fullWidth label="API key" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsFor(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!apiKey.trim() || busy}
            onClick={() => {
              const p = settingsFor;
              setSettingsFor(null);
              if (p) run(() => marketingService.updateSyndicationPlatform(p.id, { apiKey: apiKey.trim() }), `Could not save the key for ${p.name}.`);
            }}
          >
            Save key
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
};

export default MarketingSyndication;
