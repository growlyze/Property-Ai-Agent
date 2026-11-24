import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Chip,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import {
  Insights as InsightsIcon,
  AttachMoney as AttachMoneyIcon,
  Settings as SettingsIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { aiInsightsService } from '../services/aiInsightsService';
import { InsightsDashboardState, InsightCategoryGroup, Insight, InsightCategory } from '../types/ai-insights';
import CategorySection from '../components/ai-insights/CategorySection';
import InsightCard from '../components/ai-insights/InsightCard';
import { InsightDetailModal } from '../components/ai-insights/InsightDetailModal';

const AIInsightsDashboard: React.FC = () => {
  const [state, setState] = useState<InsightsDashboardState>({
    categories: [],
    selectedInsight: null,
    filters: {
      categories: [],
      priorities: [],
      timeRange: '30d',
      searchQuery: '',
      sortBy: 'priority',
      sortOrder: 'desc'
    },
    loading: true,
    error: null,
    lastUpdated: null
  });

  const [activeTab, setActiveTab] = useState<number>(0);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Category icons mapping
  const categoryIcons = {
    financial: AttachMoneyIcon,
    operational: SettingsIcon,
    tenant_satisfaction: PeopleIcon
  };

  useEffect(() => {
    const loadInsights = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const insightsResponse = await aiInsightsService.getInsights(state.filters);

        // Add null check to prevent undefined access
        if (insightsResponse && insightsResponse.data) {
          // Group insights by category for display
          const groupedInsights = insightsResponse.data.reduce((acc: Record<string, Insight[]>, insight: Insight) => {
            if (!acc[insight.category]) {
              acc[insight.category] = [];
            }
            acc[insight.category].push(insight);
            return acc;
          }, {});

          const categories: InsightCategoryGroup[] = Object.keys(groupedInsights).map(category => ({
            id: category,
            name: category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), // Format category name
            category: category as InsightCategory,
            insights: groupedInsights[category],
            totalCount: groupedInsights[category].length,
            priority: 0,
            icon: category,
            color: '',
          }));

          setState(prev => ({
            ...prev,
            categories: categories,
            loading: false,
            lastUpdated: new Date()
          }));
        } else {
          throw new Error('Invalid response format from API');
        }
      } catch (error) {
        console.error("Error loading insights:", error);
        setState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load insights'
        }));
      }
    };

    loadInsights();
  }, [state.filters]);

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    if (newValue === 0) {
      setState(prev => ({ ...prev, filters: { ...prev.filters, categories: [] } }));
    } else {
      const category = state.categories[newValue - 1]?.category;
      if (category) {
        setState(prev => ({ ...prev, filters: { ...prev.filters, categories: [category] } }));
      }
    }
  };

  // Handle category expansion
  const handleCategoryToggle = (categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  // Handle insight click to show detail modal
  const handleInsightClick = (insight: Insight) => {
    setState(prev => ({ ...prev, selectedInsight: insight }));
  };

  // Handle modal close
  const handleCloseModal = () => {
    setState(prev => ({ ...prev, selectedInsight: null }));
  };

  // Initialize expanded categories
  useEffect(() => {
    if (state.categories.length > 0) {
      const initialExpanded = state.categories.reduce((acc, category) => {
        acc[category.id] = true;
        return acc;
      }, {} as Record<string, boolean>);
      setExpandedCategories(initialExpanded);
    }
  }, [state.categories]);


  if (state.loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (state.error) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto', textAlign: 'left' }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => window.location.reload()}>
              Retry
            </Button>
          }
        >
          {state.error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto', textAlign: 'left' }}>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <InsightsIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
            AI insights
          </Typography>
        </Box>
        <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
          What the AI has spotted across tenant satisfaction, finances and operations, with recommended actions.
        </Typography>
      </Box>

      {/* Category Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
          <Tab label="All Insights" />
          {state.categories.map((category: InsightCategoryGroup, index: number) => {
            const IconComponent = categoryIcons[category.category];
            return (
              <Tab
                key={category.id}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconComponent sx={{ fontSize: 18 }} />
                    {category.name}
                    <Chip size="small" color="primary" label={category.totalCount} sx={{ height: 20, minWidth: 20, '& .MuiChip-label': { px: 0.75 } }} />
                  </Box>
                }
              />
            );
          })}
        </Tabs>
      </Box>

      {/* Main Content */}
      <Box>
          {state.categories.length === 0 ? (
            <Box sx={{ py: 5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                No insights yet
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Insights appear here as the AI analyses your rent, maintenance and tenant activity.
              </Typography>
            </Box>
          ) : activeTab === 0 ? (
            // All categories view
            <Box>
              {state.categories.map((category: InsightCategoryGroup) => (
                <CategorySection
                  key={category.id}
                  category={category}
                  onInsightClick={handleInsightClick}
                  expanded={expandedCategories[category.id] ?? true}
                  onToggleExpanded={() => handleCategoryToggle(category.id)}
                />
              ))}
            </Box>
          ) : (
            // Single category view
            <Box
              sx={{
                display: 'grid',
                gap: 2.5,
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
              }}
            >
              {state.categories
                .filter((category: InsightCategoryGroup) => activeTab > 0 && state.categories[activeTab - 1]?.id === category.id)
                .flatMap((category: InsightCategoryGroup) => category.insights)
                .sort((a, b) => {
                  // Apply sorting based on state.filters.sortBy and state.filters.sortOrder
                  const sortBy = state.filters.sortBy;
                  const sortOrder = state.filters.sortOrder;

                  let valA: any = a[sortBy as keyof Insight];
                  let valB: any = b[sortBy as keyof Insight];

                  if (sortBy === 'timestamp') {
                    valA = new Date(valA).getTime();
                    valB = new Date(valB).getTime();
                  } else if (typeof valA === 'string' && typeof valB === 'string') {
                    valA = valA.toLowerCase();
                    valB = valB.toLowerCase();
                  }

                  if (sortOrder === 'asc') {
                    return valA < valB ? -1 : valA > valB ? 1 : 0;
                  } else {
                    return valA > valB ? -1 : valA < valB ? 1 : 0;
                  }
                })
                .map((insight: Insight) => {
                  if (!insight) return null; // Defensive check
                  return (
                    <Box key={insight.id} sx={{ minWidth: 0 }}>
                      <InsightCard
                        insight={insight}
                        onClick={handleInsightClick}
                        showCategory={false}
                      />
                    </Box>
                  );
                })}
            </Box>
          )}
      </Box>

      {/* Insight Detail Modal */}
      {state.selectedInsight && (
        <InsightDetailModal
          insight={state.selectedInsight}
          open={!!state.selectedInsight}
          onClose={handleCloseModal}
        />
      )}
    </Box>
  );
};

export default AIInsightsDashboard;