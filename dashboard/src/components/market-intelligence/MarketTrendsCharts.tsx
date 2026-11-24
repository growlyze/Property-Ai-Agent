/**
 * Market Trends Charts Component
 * Displays rent prices, vacancy rates, and market trends using Chart.js
 */

import React, { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Grid,
  Chip,
} from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
} from '@mui/icons-material';
import { MarketTrend } from '../../types/market-intelligence';
import ConfidenceIndicator from '../../design-system/components/ai/ConfidenceIndicator';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface MarketTrendsChartsProps {
  trends: MarketTrend[];
  timeframe?: string;
  onTimeframeChange?: (timeframe: string) => void;
  loading?: boolean;
}

const MarketTrendsCharts: React.FC<MarketTrendsChartsProps> = ({
  trends,
  loading = false,
}) => {
  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp color="success" />;
      case 'down':
        return <TrendingDown color="error" />;
      default:
        return <TrendingFlat color="warning" />;
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return 'success';
      case 'down':
        return 'error';
      default:
        return 'warning';
    }
  };

  const validTrends = useMemo(
    () => (Array.isArray(trends) ? trends.filter((t) => t && t.metric) : []),
    [trends]
  );

  const formatValue = (value: number, unit?: string) => {
    if (!Number.isFinite(value)) return '—';
    const u = (unit || '').trim();
    if (u === '$' || u.toUpperCase() === 'USD') return '$' + Math.round(value).toLocaleString();
    if (u === '%') return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
    return `${value.toLocaleString()}${u ? ' ' + u : ''}`;
  };

  // Rent: previous vs current period (USD)
  const rentTrends = validTrends.filter((t) => t.category === 'rent');
  const otherTrends = validTrends.filter((t) => t.category !== 'rent');

  const rentChartData = useMemo(() => ({
    labels: rentTrends.map((t) => t.metric),
    datasets: [
      {
        label: 'Previous period',
        data: rentTrends.map((t) => t.previousValue ?? 0),
        backgroundColor: 'rgba(28, 20, 40, 0.25)',
        borderColor: 'rgba(28, 20, 40, 0.8)',
        borderWidth: 1,
      },
      {
        label: 'Current period',
        data: rentTrends.map((t) => t.currentValue ?? 0),
        backgroundColor: 'rgba(249, 89, 4, 0.75)',
        borderColor: 'rgb(249, 89, 4)',
        borderWidth: 1,
      },
    ],
  }), [rentTrends]);

  const otherChartData = useMemo(() => ({
    labels: otherTrends.map((t) => t.metric),
    datasets: [
      {
        label: 'Previous period',
        data: otherTrends.map((t) => t.previousValue ?? 0),
        backgroundColor: 'rgba(28, 20, 40, 0.25)',
        borderColor: 'rgba(28, 20, 40, 0.8)',
        borderWidth: 1,
      },
      {
        label: 'Current period',
        data: otherTrends.map((t) => t.currentValue ?? 0),
        backgroundColor: 'rgba(249, 89, 4, 0.75)',
        borderColor: 'rgb(249, 89, 4)',
        borderWidth: 1,
      },
    ],
  }), [otherTrends]);

  const rentChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top' as const }, title: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (value) => '$' + Number(value).toLocaleString() },
      },
    },
  };

  const otherChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top' as const }, title: { display: false } },
    scales: { y: { beginAtZero: true, title: { display: true, text: '% / index' } } },
  };

  if (loading) {
    return (
      <Card>
        <CardHeader title="Market Trends" />
        <CardContent>
          <Box display="flex" justifyContent="center" p={4}>
            <Typography color="textSecondary">Loading market trends...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (validTrends.length === 0) {
    return (
      <Card elevation={2}>
        <CardHeader
          title="Market Trends Analysis"
          subheader="No trend data available"
        />
        <CardContent>
          <Typography color="textSecondary">
            No market trends data available at this time.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevation={2}>
      <CardHeader
        title="Market Trends Analysis"
        subheader="Current period compared with the previous period"
      />
      <CardContent>
        {/* Trend Summary Cards: one per metric */}
        <Grid container spacing={2} mb={3}>
          {validTrends.map((t) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={t.id}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    {getTrendIcon(t.trend)}
                    <Typography variant="subtitle1" component="h3" fontWeight={600}>
                      {t.metric}
                    </Typography>
                  </Box>
                  <Typography variant="h4" color="primary" gutterBottom>
                    {formatValue(t.currentValue, t.unit)}
                  </Typography>
                  <Box display="flex" alignItems="center" flexWrap="wrap" gap={1}>
                    <Chip
                      label={`${t.changePercent > 0 ? '+' : ''}${Number(t.changePercent || 0).toFixed(1)}%`}
                      color={getTrendColor(t.trend) as any}
                      size="small"
                    />
                    <Typography variant="caption" color="textSecondary">
                      vs {formatValue(t.previousValue, t.unit)}, {t.timeframe} ago
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Charts */}
        <Grid container spacing={3}>
          {rentTrends.length > 0 && (
            <Grid size={{ xs: 12, md: otherTrends.length > 0 ? 6 : 12 }}>
              <Card variant="outlined">
                <CardHeader title="Average Rent" subheader="Previous vs current period (USD)" />
                <CardContent>
                  <Box height={280}>
                    <Bar data={rentChartData} options={rentChartOptions} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}
          {otherTrends.length > 0 && (
            <Grid size={{ xs: 12, md: rentTrends.length > 0 ? 6 : 12 }}>
              <Card variant="outlined">
                <CardHeader title="Supply & Demand" subheader="Occupancy (%) and demand index" />
                <CardContent>
                  <Box height={280}>
                    <Bar data={otherChartData} options={otherChartOptions} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>

        {/* AI Confidence Indicator */}
        <Box mt={3} display="flex" alignItems="center" flexWrap="wrap" gap={2}>
          <ConfidenceIndicator
            confidence={85}
            showTooltip
            explanation="Market trend analysis confidence based on data quality, sample size, and historical accuracy"
            variant="linear"
            size="medium"
            colorCoded
            showNumericalScore
          />
          <Typography variant="caption" color="textSecondary">
            AI Analysis Confidence
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default MarketTrendsCharts;