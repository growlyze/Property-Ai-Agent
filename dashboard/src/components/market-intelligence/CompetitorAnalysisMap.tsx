import React, { useState, useRef, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from '@mui/material';
import {
  Business,
  Close,
} from '@mui/icons-material';
import { CompetitorData } from '../../types/market-intelligence';
import ConfidenceIndicator from '../../design-system/components/ai/ConfidenceIndicator';
import { toPercent } from './format';

interface CompetitorAnalysisMapProps {
  competitors: CompetitorData[];
  onCompetitorSelect?: (competitor: CompetitorData) => void;
  loading?: boolean;
}

const CompetitorAnalysisMap: React.FC<CompetitorAnalysisMapProps> = ({
  competitors,
  onCompetitorSelect,
  loading = false,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [selectedCompetitor, setSelectedCompetitor] = useState<CompetitorData | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [mapFilter, setMapFilter] = useState<string>('all');
  // Project competitor [lng, lat] onto the panel, padded so markers stay inside
  const projected = useMemo(() => {
    const valid = (competitors || []).filter(
      (c) => c && Array.isArray(c.location) && c.location.length >= 2
    );
    if (valid.length === 0) return {} as Record<string, { x: number; y: number }>;
    const xs = valid.map((c) => Number(c.location[0]));
    const ys = valid.map((c) => Number(c.location[1]));
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    return valid.reduce((acc, c) => {
      acc[c.id] = {
        x: 15 + ((Number(c.location[0]) - minX) / spanX) * 70,
        // latitude grows northwards, screen y grows downwards
        y: 20 + (1 - (Number(c.location[1]) - minY) / spanY) * 55,
      };
      return acc;
    }, {} as Record<string, { x: number; y: number }>);
  }, [competitors]);

  const getMarkerColor = (competitor: CompetitorData): string => {
    const occupancy = toPercent(competitor.occupancyRate);
    if (occupancy >= 95) return '#4caf50'; // Green - High occupancy
    if (occupancy >= 85) return '#f99c00'; // Orange - Medium occupancy
    return '#f44336'; // Red - Low occupancy
  };

  const getMarkerSize = (competitor: CompetitorData): number => {
    const marketShare = toPercent(competitor.marketShare);
    if (marketShare >= 15) return 32; // Large
    if (marketShare >= 8) return 26;  // Medium
    return 20; // Small
  };

  const filteredCompetitors = useMemo(() => {
    if (!competitors || !Array.isArray(competitors)) {
      return [];
    }
    
    return competitors.filter(competitor => {
      if (!competitor) return false; // Skip null/undefined competitors
      
      if (mapFilter === 'all') return true;
      if (mapFilter === 'high-occupancy') return toPercent(competitor.occupancyRate) >= 90;
      if (mapFilter === 'low-occupancy') return toPercent(competitor.occupancyRate) < 90;
      if (mapFilter === 'premium') return (competitor.rentRange?.[1] || 0) > 3000;
      if (mapFilter === 'budget') return (competitor.rentRange?.[1] || 0) <= 2000;
      return true;
    });
  }, [competitors, mapFilter]);

  const handleMarkerClick = (competitor: CompetitorData) => {
    setSelectedCompetitor(competitor);
    setDetailDialogOpen(true);
    if (onCompetitorSelect) {
      onCompetitorSelect(competitor);
    }
  };

  const handleFilterChange = (event: SelectChangeEvent) => {
    setMapFilter(event.target.value);
  };

  const formatRentRange = (range: [number, number] | undefined) => {
    if (!range || !Array.isArray(range) || range.length < 2) {
      return 'Range not available';
    }
    return `$${(range[0] || 0).toLocaleString()} - $${(range[1] || 0).toLocaleString()}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader title="Competitor Analysis Map" />
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" height={400}>
            <Typography color="textSecondary">Loading competitor map...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Add check for empty competitors data
  if (!competitors || !Array.isArray(competitors) || competitors.length === 0) {
    return (
      <Card elevation={2}>
        <CardHeader
          title="Competitor Analysis Map"
          subheader="No competitor data available"
        />
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" height={400}>
            <Typography color="textSecondary">
              No competitor data available at this time.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevation={2}>
      <CardHeader
        title="Competitor Analysis Map"
        subheader={`${filteredCompetitors.length} of ${competitors?.length || 0} competitors shown, positioned by location`}
        sx={{ flexWrap: 'wrap', gap: 1, '& .MuiCardHeader-action': { m: 0 } }}
        action={
          <Box display="flex" gap={1} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Filter</InputLabel>
              <Select
                value={mapFilter}
                label="Filter"
                onChange={handleFilterChange}
              >
                <MenuItem value="all">All Properties</MenuItem>
                <MenuItem value="high-occupancy">High Occupancy (90%+)</MenuItem>
                <MenuItem value="low-occupancy">Below 90% Occupancy</MenuItem>
                <MenuItem value="premium">Premium ($3000+)</MenuItem>
                <MenuItem value="budget">Budget (≤$2000)</MenuItem>
              </Select>
            </FormControl>
          </Box>
        }
      />
      <CardContent>
        {/* Map Container */}
        <Box
          ref={mapRef}
          sx={{
            height: { xs: 300, sm: 400 },
            width: '100%',
            bgcolor: '#f6f8fc',
            borderRadius: 1,
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid #e0e0e0',
          }}
        >
          {/* Simulated Map Background */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `
                linear-gradient(90deg, #e8f5e8 1px, transparent 1px),
                linear-gradient(#e8f5e8 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px',
              opacity: 0.3,
            }}
          />

          {/* Map Markers */}
          {filteredCompetitors.map((competitor, index) => {
            const pos = projected[competitor.id] || { x: 20 + index * 25, y: 50 };
            const { x, y } = pos;
            const markerSize = getMarkerSize(competitor);
            const markerColor = getMarkerColor(competitor);

            return (
              <Tooltip
                key={competitor.id}
                title={
                  <Box>
                    <Typography variant="subtitle2">{competitor.name}</Typography>
                    <Typography variant="body2">
                      Occupancy: {toPercent(competitor.occupancyRate)}%
                    </Typography>
                    <Typography variant="body2">
                      Rent: {formatRentRange(competitor.rentRange)}
                    </Typography>
                  </Box>
                }
                placement="top"
              >
                <Box
                  sx={{
                    position: 'absolute',
                    left: `${x}%`,
                    top: `${y}%`,
                    width: markerSize,
                    height: markerSize,
                    bgcolor: markerColor,
                    borderRadius: '50%',
                    border: '2px solid white',
                    boxShadow: 2,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: 'translate(-50%, -50%)',
                    '&:hover': {
                      transform: 'translate(-50%, -50%) scale(1.2)',
                      zIndex: 10,
                    },
                    transition: 'transform 0.2s ease-in-out',
                  }}
                  onClick={() => handleMarkerClick(competitor)}
                >
                  <Business
                    sx={{
                      color: 'white',
                      fontSize: markerSize * 0.6,
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      position: 'absolute',
                      top: '100%',
                      mt: 0.5,
                      whiteSpace: 'nowrap',
                      fontWeight: 600,
                      color: 'text.primary',
                      bgcolor: 'rgba(255,255,255,0.85)',
                      px: 0.5,
                      borderRadius: 0.5,
                    }}
                  >
                    {competitor.name}
                  </Typography>
                </Box>
              </Tooltip>
            );
          })}

        </Box>

        {/* Legend */}
        <Box mt={2}>
          <Typography variant="subtitle2" gutterBottom>
            Map Legend
          </Typography>
          <Box display="flex" gap={3} flexWrap="wrap">
            <Box display="flex" alignItems="center" gap={1}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  bgcolor: '#4caf50',
                  borderRadius: '50%',
                  border: '2px solid white',
                  boxShadow: 1,
                }}
              />
              <Typography variant="body2">Occupancy 95%+</Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  bgcolor: '#f99c00',
                  borderRadius: '50%',
                  border: '2px solid white',
                  boxShadow: 1,
                }}
              />
              <Typography variant="body2">Occupancy 85–94%</Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  bgcolor: '#f44336',
                  borderRadius: '50%',
                  border: '2px solid white',
                  boxShadow: 1,
                }}
              />
              <Typography variant="body2">Occupancy below 85%</Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2">Marker size indicates market share</Typography>
            </Box>
          </Box>
        </Box>
      </CardContent>

      {/* Competitor Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        {selectedCompetitor && (
          <>
            <DialogTitle>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar sx={{ bgcolor: getMarkerColor(selectedCompetitor) }}>
                    <Business />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">
                      {selectedCompetitor.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {selectedCompetitor.address}
                    </Typography>
                  </Box>
                </Box>
                <IconButton onClick={() => setDetailDialogOpen(false)}>
                  <Close />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent>
              {/* Key Metrics */}
              <Box display="flex" gap={2} mb={3}>
                <Box textAlign="center" flex={1}>
                  <Typography variant="h5" color="primary">
                    {toPercent(selectedCompetitor.occupancyRate)}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Occupancy
                  </Typography>
                </Box>
                <Box textAlign="center" flex={1}>
                  <Typography variant="h5" color="primary">
                    {selectedCompetitor.units}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Units
                  </Typography>
                </Box>
                <Box textAlign="center" flex={1}>
                  <Typography variant="h5" color="primary">
                    {toPercent(selectedCompetitor.marketShare)}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Market Share
                  </Typography>
                </Box>
              </Box>

              {/* Rent Range */}
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom>
                  Rent Range
                </Typography>
                <Typography variant="h6" color="primary">
                  {formatRentRange(selectedCompetitor.rentRange)}
                </Typography>
              </Box>

              {/* Amenities */}
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom>
                  Amenities
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {selectedCompetitor.amenities.map((amenity) => (
                    <Chip
                      key={amenity}
                      label={amenity}
                      variant="outlined"
                      size="small"
                    />
                  ))}
                </Box>
              </Box>

              {/* Recent Activity */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Recent Activity
                </Typography>
                <List dense>
                  {selectedCompetitor.recentActivity.slice(0, 3).map((activity) => (
                    <ListItem key={activity.id} divider>
                      <ListItemText
                        primary={activity.description}
                        secondary={activity.date ? new Date(activity.date as any).toLocaleDateString() : undefined}
                      />
                      <ConfidenceIndicator
                        confidence={toPercent(activity.confidence)}
                        variant="circular"
                        size="small"
                        colorCoded
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Card>
  );
};

export default CompetitorAnalysisMap;