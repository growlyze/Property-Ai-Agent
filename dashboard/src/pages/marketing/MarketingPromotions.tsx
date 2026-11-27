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
  DialogContentText,
  DialogTitle,
  FormControl,
  GridLegacy as Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  LocalOffer as OfferIcon,
  Redeem as RedeemIcon,
  Schedule as ScheduleIcon,
  ToggleOff as ToggleOffIcon,
  ToggleOn as ToggleOnIcon,
  EventBusy as EventBusyIcon,
} from '@mui/icons-material';
import { EmptyState, ErrorNote, Loading, PageHeader, PageShell, StatCard, fmtDate, money, pretty } from '../../components/portal/PortalUI';

/** Values match the backend `PromotionType` / `PromotionStatus` / `DiscountType` enums. */
type PromotionType = 'DISCOUNT' | 'FREE_MONTH' | 'REDUCED_DEPOSIT' | 'REFERRAL' | 'EARLY_BIRD' | 'OTHER';
type PromotionStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

interface Promotion {
  id: string;
  name: string;
  type: PromotionType;
  status: PromotionStatus;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  description?: string | null;
  startDate: string;
  endDate: string;
  usageLimit?: number | null;
  usageCount: number;
}

const TYPE_LABEL: Record<PromotionType, string> = {
  DISCOUNT: 'Discount',
  FREE_MONTH: 'Free month',
  REDUCED_DEPOSIT: 'Reduced deposit',
  REFERRAL: 'Referral',
  EARLY_BIRD: 'Early bird',
  OTHER: 'Other',
};

/** Display state: an ACTIVE promotion whose start date is still ahead is "scheduled". */
type View = 'active' | 'scheduled' | 'inactive' | 'expired';
const viewOf = (p: Promotion): View => {
  const now = Date.now();
  if (p.status === 'EXPIRED' || new Date(p.endDate).getTime() < now) return 'expired';
  if (p.status === 'ACTIVE') return new Date(p.startDate).getTime() > now ? 'scheduled' : 'active';
  return 'inactive';
};
const VIEW_CHIP: Record<View, { label: string; color: 'success' | 'info' | 'default' | 'warning' }> = {
  active: { label: 'Active', color: 'success' },
  scheduled: { label: 'Scheduled', color: 'info' },
  inactive: { label: 'Inactive', color: 'warning' },
  expired: { label: 'Expired', color: 'default' },
};

const discountText = (p: Pick<Promotion, 'discountType' | 'discountValue'>) =>
  p.discountType === 'PERCENTAGE' ? `${p.discountValue}% off` : `${money(p.discountValue)} off`;

const toInputDate = (s?: string) => (s ? String(s).slice(0, 10) : '');
const emptyForm = {
  name: '',
  type: 'DISCOUNT' as PromotionType,
  discountType: 'PERCENTAGE' as DiscountType,
  discountValue: 0,
  description: '',
  startDate: '',
  endDate: '',
  usageLimit: '' as number | '',
  code: '',
};

const TABS: { key: View | 'all'; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'expired', label: 'Expired' },
  { key: 'all', label: 'All' },
];

const MarketingPromotions: React.FC = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<View | 'all'>('active');
  const [openDialog, setOpenDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Promotion | null>(null);
  const [toDelete, setToDelete] = useState<Promotion | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [copied, setCopied] = useState<string | null>(null);
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('md'));

  const load = async () => {
    setError(null);
    try {
      const response = await marketingService.getPromotions();
      setPromotions(response.data || []);
    } catch (e) {
      setError('Could not load promotions. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = () => {
    setSelected(null);
    setFormData(emptyForm);
    setOpenDialog(true);
  };

  const handleEdit = (p: Promotion) => {
    setSelected(p);
    setFormData({
      name: p.name,
      type: p.type,
      discountType: p.discountType,
      discountValue: p.discountValue,
      description: p.description ?? '',
      startDate: toInputDate(p.startDate),
      endDate: toInputDate(p.endDate),
      usageLimit: p.usageLimit ?? '',
      code: p.code,
    });
    setOpenDialog(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...formData, usageLimit: formData.usageLimit === '' ? undefined : Number(formData.usageLimit) };
    try {
      if (selected) await marketingService.updatePromotion(selected.id, payload);
      else await marketingService.createPromotion(payload);
      setOpenDialog(false);
      await load();
    } catch (e) {
      setError('The promotion could not be saved. Promotion codes must be unique.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p: Promotion) => {
    try {
      if (p.status === 'ACTIVE') await marketingService.deactivatePromotion(p.id);
      else await marketingService.activatePromotion(p.id);
      await load();
    } catch (e) {
      setError(`Could not update "${p.name}".`);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await marketingService.deletePromotion(toDelete.id);
      setToDelete(null);
      await load();
    } catch (e) {
      setToDelete(null);
      setError(`Could not delete "${toDelete.name}".`);
    }
  };

  const copy = (code: string) => {
    navigator.clipboard?.writeText(code).then(
      () => {
        setCopied(code);
        setTimeout(() => setCopied(null), 1500);
      },
      () => undefined
    );
  };

  const generateCode = () => setFormData({ ...formData, code: Math.random().toString(36).substring(2, 10).toUpperCase() });

  const counts = promotions.reduce<Record<View, number>>(
    (acc, p) => ({ ...acc, [viewOf(p)]: acc[viewOf(p)] + 1 }),
    { active: 0, scheduled: 0, inactive: 0, expired: 0 }
  );
  const limited = promotions.filter((p) => p.usageLimit && p.usageLimit > 0);
  const avgUsage = limited.length ? Math.round((limited.reduce((s, p) => s + p.usageCount / (p.usageLimit as number), 0) / limited.length) * 100) : null;
  const visible = tab === 'all' ? promotions : promotions.filter((p) => viewOf(p) === tab);
  const canSave = formData.name.trim() && formData.code.trim() && formData.startDate && formData.endDate;

  const renderActions = (p: Promotion) => (
    <>
              <Tooltip title="Edit">
                <IconButton size="small" aria-label={`Edit ${p.name}`} onClick={() => handleEdit(p)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {viewOf(p) !== 'expired' && (
                <Tooltip title={p.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}>
                  <IconButton size="small" aria-label={`${p.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} ${p.name}`} onClick={() => toggle(p)}>
                    {p.status === 'ACTIVE' ? <ToggleOnIcon fontSize="small" color="success" /> : <ToggleOffIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Delete">
                <IconButton size="small" aria-label={`Delete ${p.name}`} onClick={() => setToDelete(p)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
    </>
  );

  return (
    <PageShell>
      <PageHeader
        title="Promotions & Offers"
        subtitle="Discount codes and move-in specials for prospective and current residents."
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate} fullWidth>
            Create Promotion
          </Button>
        }
      />

      {error && (
        <Box sx={{ mb: 3 }}>
          <ErrorNote text={error} onRetry={load} />
        </Box>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <StatCard icon={<OfferIcon fontSize="small" />} accent="#16a34a" label="Active" value={counts.active} sub={`${promotions.length} promotions in total`} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard icon={<RedeemIcon fontSize="small" />} accent="#f99c00" label="Redemptions" value={promotions.reduce((s, p) => s + p.usageCount, 0)} sub="All time" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard icon={<ScheduleIcon fontSize="small" />} accent="#2563eb" label="Avg. usage" value={avgUsage === null ? '—' : `${avgUsage}%`} sub="Of each code's limit" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard icon={<EventBusyIcon fontSize="small" />} accent="#7c3aed" label="Expired" value={counts.expired} sub="Past their end date" />
        </Grid>
      </Grid>

      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile sx={{ px: 1, borderBottom: 1, borderColor: 'divider' }}>
          {TABS.map((t) => (
            <Tab key={t.key} value={t.key} label={t.key === 'all' ? `All (${promotions.length})` : `${t.label} (${counts[t.key]})`} />
          ))}
        </Tabs>
        {loading ? (
          <Loading />
        ) : visible.length === 0 ? (
          <EmptyState
            title={promotions.length === 0 ? 'No promotions yet' : `No ${tab} promotions`}
            text={promotions.length === 0 ? 'Create a promotion code to offer move-in specials.' : 'Switch tabs to see other promotions.'}
          />
        ) : isPhone ? (
          <Stack divider={<Box sx={{ borderTop: '1px solid #e7e1d6' }} />}>
            {visible.map((p) => {
              const v = VIEW_CHIP[viewOf(p)];
              return (
                <Box key={p.id} sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Typography sx={{ fontWeight: 800 }}>{p.name}</Typography>
                    <Chip label={v.label} color={v.color} size="small" sx={{ flexShrink: 0 }} />
                  </Stack>
                  {p.description && (
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                      {p.description}
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <b>{discountText(p)}</b> · {TYPE_LABEL[p.type] ?? pretty(p.type)} · {p.usageLimit ? `${p.usageCount} / ${p.usageLimit} used` : `${p.usageCount} used`}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {fmtDate(p.startDate)} – {fmtDate(p.endDate)}
                  </Typography>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, wordBreak: 'break-all' }}>
                        {p.code}
                      </Typography>
                      <IconButton size="small" aria-label={`Copy code ${p.code}`} onClick={() => copy(p.code)}>
                        <CopyIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <Box sx={{ flexShrink: 0 }}>{renderActions(p)}</Box>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <TableContainer>
            <Table sx={{ minWidth: 820 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Promotion</TableCell>
                  <TableCell>Offer</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Used</TableCell>
                  <TableCell>Valid</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visible.map((p) => {
                  const v = VIEW_CHIP[viewOf(p)];
                  return (
                    <TableRow key={p.id} hover>
                      <TableCell sx={{ maxWidth: 280 }}>
                        <Typography sx={{ fontWeight: 700 }}>{p.name}</Typography>
                        {p.description && (
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {p.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {discountText(p)}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {TYPE_LABEL[p.type] ?? pretty(p.type)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {p.code}
                          </Typography>
                          <Tooltip title={copied === p.code ? 'Copied' : 'Copy code'}>
                            <IconButton size="small" aria-label={`Copy code ${p.code}`} onClick={() => copy(p.code)}>
                              <CopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip label={v.label} color={v.color} size="small" />
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {p.usageLimit ? `${p.usageCount} / ${p.usageLimit}` : p.usageCount}
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {p.usageLimit ? `${Math.round((p.usageCount / p.usageLimit) * 100)}%` : 'No limit'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2">{fmtDate(p.startDate)}</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          to {fmtDate(p.endDate)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {renderActions(p)}
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
        <DialogTitle>{selected ? 'Edit Promotion' : 'Create Promotion'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField fullWidth label="Promotion name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select value={formData.type} label="Type" onChange={(e) => setFormData({ ...formData, type: e.target.value as PromotionType })}>
                  {(Object.keys(TYPE_LABEL) as PromotionType[]).map((t) => (
                    <MenuItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
                <TextField fullWidth label="Code" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} />
                <Button onClick={generateCode} variant="outlined" sx={{ flexShrink: 0 }}>
                  Generate
                </Button>
              </Stack>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Discount type</InputLabel>
                <Select value={formData.discountType} label="Discount type" onChange={(e) => setFormData({ ...formData, discountType: e.target.value as DiscountType })}>
                  <MenuItem value="PERCENTAGE">Percentage</MenuItem>
                  <MenuItem value="FIXED_AMOUNT">Fixed amount</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Discount value"
                type="number"
                value={formData.discountValue}
                onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                InputProps={{
                  startAdornment: formData.discountType === 'FIXED_AMOUNT' ? '$' : undefined,
                  endAdornment: formData.discountType === 'PERCENTAGE' ? '%' : undefined,
                }}
              />
            </Stack>
            <TextField fullWidth label="Description" multiline rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField fullWidth label="Start date" type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} InputLabelProps={{ shrink: true }} />
              <TextField fullWidth label="End date" type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Stack>
            <TextField
              fullWidth
              label="Usage limit"
              type="number"
              helperText="Leave empty for unlimited use"
              value={formData.usageLimit}
              onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value === '' ? '' : Number(e.target.value) })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!canSave || saving}>
            {selected ? 'Save changes' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!toDelete} onClose={() => setToDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete promotion?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            "{toDelete?.name}" ({toDelete?.code}) will be removed. Residents will no longer be able to use this code.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
};

export default MarketingPromotions;
