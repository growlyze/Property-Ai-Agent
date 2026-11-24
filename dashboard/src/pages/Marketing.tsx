import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Box, Button, Card, CardActions, CardContent, Chip, GridLegacy as Grid, Typography } from '@mui/material';
import {
  Campaign as CampaignIcon,
  Analytics as AnalyticsIcon,
  LocalOffer as PromotionIcon,
  Sync as SyndicationIcon,
  TrendingUp,
  MonetizationOn,
} from '@mui/icons-material';
import { marketingService } from '../services/marketingService';
import { INK, PageHeader, PageShell, StatCard, money } from '../components/portal/PortalUI';

interface Summary {
  leads: number;
  spend: number;
  activeCampaigns: number;
  campaigns: number;
  activePromotions: number;
  connectedPlatforms: number;
  leadSources: number;
}

/** Real figures for the hub. Each call is independent, so one failure leaves the rest. */
const useMarketingSummary = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      marketingService.getAnalyticsOverview(),
      marketingService.getCampaigns(),
      marketingService.getPromotions(),
      marketingService.getSyndicationPlatforms(),
      marketingService.getLeadSources(),
    ]).then(([o, c, p, s, l]) => {
      if (!alive) return;
      const val = (r: PromiseSettledResult<any>) => (r.status === 'fulfilled' ? r.value?.data : null);
      const campaigns: any[] = val(c) ?? [];
      const now = Date.now();
      setSummary({
        leads: val(o)?.totalLeads ?? 0,
        spend: val(o)?.marketingSpend ?? 0,
        activeCampaigns: campaigns.filter((x) => x.status === 'ACTIVE').length,
        campaigns: campaigns.length,
        activePromotions: (val(p) ?? []).filter((x: any) => x.status === 'ACTIVE' && new Date(x.endDate).getTime() >= now).length,
        connectedPlatforms: (val(s) ?? []).filter((x: any) => x.status === 'CONNECTED').length,
        leadSources: (val(l) ?? []).length,
      });
    });
    return () => {
      alive = false;
    };
  }, []);
  return summary;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const Marketing = () => {
  const s = useMarketingSummary();
  const dash = (fn: (x: Summary) => string) => (s ? fn(s) : '…');

  const marketingModules = [
    {
      title: 'Advertising Campaigns',
      description: 'Create and manage advertising campaigns across Google Ads, Instagram, Zillow and other channels',
      icon: <CampaignIcon />,
      path: '/marketing/campaigns',
      color: '#f55809',
      stats: dash((x) => `${plural(x.activeCampaigns, 'active campaign')} of ${x.campaigns}`),
      features: ['Google Ads', 'Instagram', 'Zillow', 'Performance Tracking'],
    },
    {
      title: 'Marketing Analytics',
      description: 'See where leads come from, what they cost and how campaigns convert',
      icon: <AnalyticsIcon />,
      path: '/marketing/analytics',
      color: '#16a34a',
      stats: dash((x) => `${plural(x.leadSources, 'lead source')} tracked`),
      features: ['Lead Sources', 'Cost per Lead', 'Campaign Funnel', 'Top Listings'],
    },
    {
      title: 'Promotions & Offers',
      description: 'Create discount codes and move-in specials to attract and keep residents',
      icon: <PromotionIcon />,
      path: '/marketing/promotions',
      color: '#f59e0b',
      stats: dash((x) => plural(x.activePromotions, 'live promotion')),
      features: ['Discount Codes', 'Move-in Specials', 'Usage Tracking', 'Referral Offers'],
    },
    {
      title: 'Listing Syndication',
      description: 'Publish your vacant units to rental portals and keep them in sync',
      icon: <SyndicationIcon />,
      path: '/marketing/syndication',
      color: '#7c3aed',
      stats: dash((x) => (x.connectedPlatforms ? plural(x.connectedPlatforms, 'connected portal') : 'No portals connected yet')),
      features: ['Auto-Sync', 'Multi-Portal', 'Sync Activity', 'Listing Counts'],
    },
  ];

  return (
    <PageShell>
      <PageHeader title="Marketing" subtitle="Campaigns, promotions and listing portals that bring in new residents." />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <StatCard icon={<TrendingUp fontSize="small" />} accent="#16a34a" label="Campaign leads" value={s ? s.leads : '…'} sub="All campaigns" to="/marketing/analytics" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard icon={<MonetizationOn fontSize="small" />} accent="#f97316" label="Marketing spend" value={s ? money(s.spend) : '…'} sub="Spent on campaigns" to="/marketing/campaigns" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard icon={<CampaignIcon fontSize="small" />} accent="#2563eb" label="Active campaigns" value={s ? s.activeCampaigns : '…'} sub={s ? `of ${s.campaigns} total` : 'Loading'} to="/marketing/campaigns" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard icon={<PromotionIcon fontSize="small" />} accent="#7c3aed" label="Live promotions" value={s ? s.activePromotions : '…'} sub="Codes in use now" to="/marketing/promotions" />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {marketingModules.map((module) => (
          <Grid item xs={12} md={6} key={module.path}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1, p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: module.color, mr: 2, border: `1.5px solid ${INK}` }}>{module.icon}</Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" component="h2" sx={{ fontWeight: 800 }}>
                      {module.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {module.stats}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {module.description}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {module.features.map((feature) => (
                    <Chip key={feature} label={feature} size="small" variant="outlined" />
                  ))}
                </Box>
              </CardContent>
              <CardActions sx={{ p: 2.5, pt: 0 }}>
                <Button component={Link} to={module.path} variant="contained" fullWidth>
                  Open {module.title}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </PageShell>
  );
};

export default Marketing;
