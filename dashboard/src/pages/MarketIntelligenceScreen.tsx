import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Box,
  Snackbar,
  Button,
} from '@mui/material';
import {
  MarketSummaryCard,
  CompetitorActivityAnalysis,
  MarketOpportunityAlerts,
  MarketTrendsCharts,
  DemandForecastCharts,
  CompetitorAnalysisMap,
} from '../components/market-intelligence';
import { marketIntelligenceService } from '../services/marketIntelligenceService';
import { apiService } from '../services/apiService';
import type {
  AISummary,
  CompetitorData,
  MarketOpportunity,
  MarketTrend,
  DemandForecast,
} from '../types/market-intelligence';
import type { AIFeedback } from '../types/ai';

const MarketIntelligenceScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marketSummary, setMarketSummary] = useState<AISummary | null>(null);
  const [competitors, setCompetitors] = useState<CompetitorData[]>([]);
  const [opportunities, setOpportunities] = useState<MarketOpportunity[]>([]);
  const [marketTrends, setMarketTrends] = useState<MarketTrend[]>([]);
  const [demandForecasts, setDemandForecasts] = useState<DemandForecast[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    loadMarketData();
  }, []);

  const loadMarketData = async () => {
    try {
      setLoading(true);
      setError(null);
  
      // Use sequential loading with delays to prevent rate limiting
      const requests = [
        () => marketIntelligenceService.fetchMarketSummary(),
        () => marketIntelligenceService.fetchCompetitorActivity(),
        () => marketIntelligenceService.fetchMarketOpportunities(),
        () => marketIntelligenceService.fetchMarketTrends(),
        () => marketIntelligenceService.fetchDemandForecasts(),
      ];

      const results = await apiService.batchRequests(requests);
      
      // Handle results with proper error checking
      const [summaryResult, competitorResult, opportunityResult, trendsResult, forecastsResult] = results;
      
      setMarketSummary(summaryResult.data || null);
      setCompetitors(competitorResult.data || []);
      setOpportunities(opportunityResult.data || []);
      setMarketTrends(trendsResult.data || []);
      setDemandForecasts(forecastsResult.data || []);
  
      // Check for errors and show warnings
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        console.warn(`${errors.length} API requests failed:`, errors);
        setError(`Some data could not be loaded. ${errors.length} of 5 requests failed.`);
      }
    } catch (err) {
      console.error('Error loading market data:', err);
      setError('Failed to load market intelligence data. Please try again.');
  
      // Set fallback empty data
      setMarketSummary(null);
      setCompetitors([]);
      setOpportunities([]);
      setMarketTrends([]);
      setDemandForecasts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSummaryFeedback = async (feedback: AIFeedback) => {
    if (marketSummary) {
      try {
        await marketIntelligenceService.submitMarketFeedback(
          marketSummary.id,
          { type: feedback.type, comment: feedback.comment }
        );
      } catch (error) {
        console.error('Error submitting feedback:', error);
      }
    }
  };

  const handleCompetitorFeedback = async (feedback: AIFeedback) => {
    try {
      await marketIntelligenceService.submitMarketFeedback(
        'competitor-analysis',
        { type: feedback.type, comment: feedback.comment }
      );
    } catch (error) {
      console.error('Error submitting competitor feedback:', error);
    }
  };

  const handleOpportunityFeedback = async (feedback: AIFeedback) => {
    try {
      await marketIntelligenceService.submitMarketFeedback(
        'market-opportunities',
        { type: feedback.type, comment: feedback.comment }
      );
    } catch (error) {
      console.error('Error submitting opportunity feedback:', error);
    }
  };

  const handleOpportunityAction = (opportunity: MarketOpportunity, action: string) => {
    switch (action) {
      case 'implement':
        setNotice(`"${opportunity.title}" added to your action plan`);
        break;
      case 'save':
        setNotice(`"${opportunity.title}" saved for later`);
        break;
      case 'share': {
        const text = `${opportunity.title}: ${opportunity.description} (${opportunity.potentialImpact})`;
        navigator.clipboard?.writeText(text).then(
          () => setNotice('Opportunity summary copied to clipboard'),
          () => setNotice('Could not copy to clipboard')
        );
        break;
      }
      default:
        break;
    }
  };

  const handleCompetitorSelect = (_competitor: CompetitorData) => {
    // Detail dialogs are handled inside the competitor components
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <Box textAlign="center">
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="h6" color="textSecondary">
              Loading Market Intelligence...
            </Typography>
          </Box>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Market Intelligence
        </Typography>
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={<Button color="inherit" size="small" onClick={loadMarketData}>Retry</Button>}
        >
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Market Intelligence
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        AI-powered market analysis with competitor insights and opportunity identification
      </Typography>

      <Grid container spacing={{ xs: 2, md: 4 }}>
        {/* AI-Generated Market Summary */}
        {marketSummary && (
          <Grid size={12}>
            <MarketSummaryCard
              summary={marketSummary}
              onFeedback={handleSummaryFeedback}
              loading={loading}
            />
          </Grid>
        )}

        {/* Market Trends Charts */}
        <Grid size={12}>
          <MarketTrendsCharts
            trends={marketTrends}
            loading={loading}
          />
        </Grid>

        {/* Competitor Analysis Map and Activity */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <CompetitorAnalysisMap
            competitors={competitors}
            onCompetitorSelect={handleCompetitorSelect}
            loading={loading}
          />
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <CompetitorActivityAnalysis
            competitors={competitors}
            onCompetitorSelect={handleCompetitorSelect}
            onFeedback={handleCompetitorFeedback}
            loading={loading}
          />
        </Grid>

        {/* Demand Forecast Charts */}
        <Grid size={12}>
          <DemandForecastCharts
            forecasts={demandForecasts}
            loading={loading}
          />
        </Grid>

        {/* Market Opportunity Alerts */}
        <Grid size={12}>
          <MarketOpportunityAlerts
            opportunities={opportunities}
            onOpportunityAction={handleOpportunityAction}
            onFeedback={handleOpportunityFeedback}
            loading={loading}
          />
        </Grid>
      </Grid>
      <Snackbar
        open={!!notice}
        autoHideDuration={3500}
        onClose={() => setNotice(null)}
        message={notice}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
};

export default MarketIntelligenceScreen;
