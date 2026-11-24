import React, { useEffect, useState } from 'react';
import { marketingService } from '../../services/marketingService';
import {
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  GridLegacy as Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Campaign as CampaignIcon,
  Paid as PaidIcon,
  PersonAdd as PersonAddIcon,
  QueryStats as QueryStatsIcon,
} from '@mui/icons-material';
import { EmptyState, ErrorNote, Loading, PageHeader, PageShell, StatCard, fmtDate, money, pretty } from '../../components/portal/PortalUI';

/** Values match the backend `CampaignType` / `CampaignStatus` enums. */
type CampaignType = 'GOOGLE_ADS' | 'FACEBOOK' | 'INSTAGRAM' | 'ZILLOW' | 'APARTMENTS_COM' | 'EMAIL' | 'OTHER';
type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  leads: number;
  startDate: string;
  endDate: string;
  description?: string | null;
}

const TYPE_LABEL: Record<CampaignType, string> = {
  GOOGLE_ADS: 'Google Ads',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  ZILLOW: 'Zillow',
  APARTMENTS_COM: 'Apartments.com',
  EMAIL: 'Email',
  OTHER: 'Other',
};

const STATUS_COLOR: Record<CampaignStatus, 'success' | 'warning' | 'default' | 'info'> = {
  ACTIVE: 'success',
  PAUSED: 'warning',
  DRAFT: 'default',
  COMPLETED: 'info',
  CANCELLED: 'default',
};

const toInputDate = (s?: string) => (s ? String(s).slice(0, 10) : '');
const emptyForm = { name: '', type: 'GOOGLE_ADS' as CampaignType, budget: 0, startDate: '', endDate: '' };

const MarketingCampaigns: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('md'));

  const loadCampaigns = async () => {
    setError(null);
    try {
      const response = await marketingService.getCampaigns();
      setCampaigns(response.data || []);
    } catch (e) {
      setError('Could not load campaigns. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const handleCreateCampaign = () => {
    setSelectedCampaign(null);
    setFormData(emptyForm);
    setOpenDialog(true);
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setFormData({
      name: campaign.name,
      type: campaign.type,
      budget: campaign.budget,
      startDate: toInputDate(campaign.startDate),
      endDate: toInputDate(campaign.endDate),
    });
    setOpenDialog(true);
  };

  const handleSaveCampaign = async () => {
    setSaving(true);
    try {
      if (selectedCampaign) await marketingService.updateCampaign(selectedCampaign.id, formData);
      else await marketingService.createCampaign(formData);
      setOpenDialog(false);
      await loadCampaigns();
    } catch (e) {
      setError('The campaign could not be saved. Check the fields and try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleCampaign = async (c: Campaign) => {
    try {
      if (c.status === 'ACTIVE') await marketingService.pauseCampaign(c.id);
      else await marketingService.resumeCampaign(c.id);
      await loadCampaigns();
    } catch (e) {
      setError(`Could not ${c.status === 'ACTIVE' ? 'pause' : 'resume'} "${c.name}".`);
    }
  };

  const totalSpent = campaigns.reduce((s, c) => s + c.spent, 0);
  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);
  const canSave = formData.name.trim() && formData.startDate && formData.endDate;

  const renderActions = (c: Campaign) => {
    const canToggle = c.status === 'ACTIVE' || c.status === 'PAUSED';
    return (
      <>
        <Tooltip title="Edit">
          <IconButton size="small" aria-label={`Edit ${c.name}`} onClick={() => handleEditCampaign(c)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {canToggle && (
          <Tooltip title={c.status === 'ACTIVE' ? 'Pause' : 'Resume'}>
            <IconButton size="small" aria-label={`${c.status === 'ACTIVE' ? 'Pause' : 'Resume'} ${c.name}`} onClick={() => toggleCampaign(c)}>
              {c.status === 'ACTIVE' ? <PauseIcon fontSize="small" /> : <PlayIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
      </>
    );
  };

  return (
    <PageShell>
      <PageHeader
        title="Advertising Campaigns"
        subtitle="Paid and owned campaigns that bring in leads for your listings."
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateCampaign} fullWidth>
            Create Campaign
          </Button>
        }
      />

      {error && (
        <Box sx={{ mb: 3 }}>
          <ErrorNote text={error} onRetry={loadCampaigns} />
        </Box>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <StatCard icon={<CampaignIcon fontSize="small" />} accent="#16a34a" label="Active" value={campaigns.filter((c) => c.status === 'ACTIVE').length} sub={`${campaigns.length} campaigns in total`} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard icon={<PaidIcon fontSize="small" />} accent="#f97316" label="Total budget" value={money(campaigns.reduce((s, c) => s + c.budget, 0))} sub={`${money(totalSpent)} spent`} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard icon={<PersonAddIcon fontSize="small" />} accent="#2563eb" label="Total leads" value={totalLeads} sub="Across all campaigns" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard icon={<QueryStatsIcon fontSize="small" />} accent="#7c3aed" label="Cost per lead" value={totalLeads > 0 ? money(totalSpent / totalLeads) : '—'} sub="Spend ÷ leads" />
        </Grid>
      </Grid>

      <Card>
        {loading ? (
          <Loading />
        ) : campaigns.length === 0 ? (
          <EmptyState
            title="No campaigns yet"
            text="Create a campaign to start tracking spend and leads for your listings."
            action={
              <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreateCampaign}>
                Create Campaign
              </Button>
            }
          />
        ) : isPhone ? (
          <Stack divider={<Box sx={{ borderTop: '1px solid #e7e1d6' }} />}>
            {campaigns.map((c) => (
              <Box key={c.id} sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800 }}>{c.name}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {TYPE_LABEL[c.type] ?? pretty(c.type)} · {fmtDate(c.startDate)} – {fmtDate(c.endDate)}
                    </Typography>
                  </Box>
                  <Chip label={pretty(c.status)} color={STATUS_COLOR[c.status] ?? 'default'} size="small" sx={{ flexShrink: 0 }} />
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    {money(c.spent)} of {money(c.budget)} · <b>{c.leads} leads</b>
                    {c.leads > 0 ? ` · ${money(c.spent / c.leads)}/lead` : ''}
                  </Typography>
                  <Box sx={{ flexShrink: 0 }}>{renderActions(c)}</Box>
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : (
          <TableContainer>
            <Table sx={{ minWidth: 760 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Campaign</TableCell>
                  <TableCell>Channel</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Budget</TableCell>
                  <TableCell align="right">Spent</TableCell>
                  <TableCell align="right">Leads</TableCell>
                  <TableCell align="right">Cost/Lead</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {campaigns.map((c) => {
                  return (
                    <TableRow key={c.id} hover>
                      <TableCell>
                        <Typography sx={{ fontWeight: 700 }}>{c.name}</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {fmtDate(c.startDate)} – {fmtDate(c.endDate)}
                        </Typography>
                      </TableCell>
                      <TableCell>{TYPE_LABEL[c.type] ?? pretty(c.type)}</TableCell>
                      <TableCell>
                        <Chip label={pretty(c.status)} color={STATUS_COLOR[c.status] ?? 'default'} size="small" />
                      </TableCell>
                      <TableCell align="right">{money(c.budget)}</TableCell>
                      <TableCell align="right">{money(c.spent)}</TableCell>
                      <TableCell align="right">{c.leads}</TableCell>
                      <TableCell align="right">{c.leads > 0 ? money(c.spent / c.leads) : '—'}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {renderActions(c)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedCampaign ? 'Edit Campaign' : 'Create Campaign'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField fullWidth label="Campaign name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Channel</InputLabel>
                <Select value={formData.type} label="Channel" onChange={(e) => setFormData({ ...formData, type: e.target.value as CampaignType })}>
                  {(Object.keys(TYPE_LABEL) as CampaignType[]).map((t) => (
                    <MenuItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Budget"
                type="number"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) })}
                InputProps={{ startAdornment: '$' }}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField fullWidth label="Start date" type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} InputLabelProps={{ shrink: true }} />
              <TextField fullWidth label="End date" type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveCampaign} variant="contained" disabled={!canSave || saving}>
            {selectedCampaign ? 'Save changes' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
};

export default MarketingCampaigns;
