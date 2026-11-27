import React, { useState } from 'react';
import {
 Dialog,
 DialogTitle,
 DialogContent,
 DialogActions,
 Box,
 Typography,
 Chip,
 IconButton,
 GridLegacy as Grid,
 List,
 ListItem,
 ListItemText,
 ListItemIcon,
 Button,
 Divider,
 Card,
 CardContent,
 LinearProgress,
 Avatar,
 Badge,
 Accordion,
 AccordionSummary,
 AccordionDetails,
 useTheme,
 useMediaQuery
} from '@mui/material';
import {
 Close as CloseIcon,
 Refresh as RefreshIcon,
 ThumbUp as ThumbUpIcon,
 ThumbDown as ThumbDownIcon,
 Timeline as TimelineIcon,
 TrendingUp as TrendingUpIcon,
 TrendingDown as TrendingDownIcon,
 CheckCircle as CheckIcon,
 Warning as WarningIcon,
 ExpandMore as ExpandMoreIcon,
 Insights as InsightsIcon
} from '@mui/icons-material';
import { Insight, AIRecommendation, InsightPriority } from '../../types/ai-insights';
import { aiInsightsService } from '../../services/aiInsightsService';
// Removed recharts imports as chartData is no longer in Insight

interface InsightDetailModalProps {
 open: boolean;
 insight: Insight | null;
 onClose: () => void;
 onRefresh?: (insightId: string) => void;
}

interface FeedbackState {
 helpful: boolean | null;
 comment: string;
 actionTaken: boolean;
}

export const InsightDetailModal: React.FC<InsightDetailModalProps> = ({
 open,
 insight,
 onClose,
 onRefresh
}) => {
 const theme = useTheme();
 const isMobile = useMediaQuery(theme.breakpoints.down('md'));
 
 const [feedback, setFeedback] = useState<FeedbackState>({
  helpful: null,
  comment: '',
  actionTaken: false
 });
 const [submittingFeedback, setSubmittingFeedback] = useState(false);
 const [activeTab, setActiveTab] = useState<'overview' | 'data' | 'recommendations' | 'history'>('overview');

 const priorityColors = {
  critical: '#f44336',
  high: '#f99c00',
  medium: '#1e6bff',
  low: '#4caf50'
 };

 if (!insight) return null;

 const handleFeedbackSubmit = async () => {
  if (feedback.helpful === null) return;

  setSubmittingFeedback(true);
  try {
   await aiInsightsService.submitInsightFeedback(insight.id, {
    helpful: feedback.helpful,
    comment: feedback.comment || undefined,
    actionTaken: feedback.actionTaken
   });

   // Reset feedback
   setFeedback({ helpful: null, comment: '', actionTaken: false });
   onClose();
  } catch (error) {
   console.error('Error submitting feedback:', error);
  } finally {
   setSubmittingFeedback(false);
  }
 };

 const handleRecommendationAction = async (recommendationId: string, actionId: string, completed: boolean) => {
  try {
   await aiInsightsService.updateRecommendationAction(
    insight.id,
    recommendationId,
    actionId,
    completed
   );
   
   // Refresh insight if callback provided
   if (onRefresh) {
    onRefresh(insight.id);
   }
  } catch (error) {
   console.error('Error updating recommendation action:', error);
  }
 };

 const handleRegenerate = async () => {
  try {
   const regenerated = await aiInsightsService.regenerateInsight(insight.id);
   if (onRefresh) {
    onRefresh(insight.id);
   }
  } catch (error) {
   console.error('Error regenerating insight:', error);
  }
 };

 // The API sends confidence and impact as 0–1 fractions (e.g. 0.92); older
 // data may already be 0–100. Normalise both to whole percentages.
 const toPercent = (value: number | undefined | null) => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(100, Math.max(0, n <= 1 ? n * 100 : n)));
 };
 const levelFor = (pct: number) => (pct >= 75 ? 'High' : pct >= 45 ? 'Medium' : 'Low');
 const confidencePct = toPercent(insight.confidence);
 const impactPct = toPercent(insight.impact);
 const trendLabel = insight.trend === 'up' ? 'Rising' : insight.trend === 'down' ? 'Declining' : 'Stable';
 const recommendations = Array.isArray(insight.recommendations) ? insight.recommendations : [];
 const keyFindings = [
  `Category: ${String(insight.category ?? 'general').replace(/_/g, ' ')}, ${String(insight.priority ?? 'medium')} priority`,
  `Trend: ${trendLabel}`,
  `AI confidence: ${confidencePct}% (${levelFor(confidencePct)})`,
  `Estimated business impact: ${levelFor(impactPct)} (${impactPct}%)`,
  recommendations.length
   ? `${recommendations.length} recommended action${recommendations.length === 1 ? '' : 's'} available`
   : 'No recommended actions yet',
 ];
 const priorityColor = (p?: string) => priorityColors[(p ?? 'medium') as InsightPriority] ?? priorityColors.medium;

 const renderConfidenceScore = (confidence: number) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
   <LinearProgress
    variant="determinate"
    value={confidence}
    sx={{
     flex: 1,
     height: 10,
     borderRadius: 5,
     backgroundColor: theme.palette.action.hover,
     '& .MuiLinearProgress-bar': {
      borderRadius: 5,
      backgroundColor: confidence >= 75 ? '#0db664'
       : confidence >= 45 ? '#ffb900' : '#d92d20'
     }
    }}
   />
   <Typography variant="h6" sx={{ fontWeight: 800, minWidth: 56, textAlign: 'right' }}>
    {confidence}%
   </Typography>
  </Box>
 );

 const renderTrendIcon = (trend: string) => {
  switch (trend) {
   case 'up':
    return <TrendingUpIcon sx={{ color: '#4caf50', fontSize: 20 }} />;
   case 'down':
    return <TrendingDownIcon sx={{ color: '#f44336', fontSize: 20 }} />;
   default:
    return null;
  }
 };

 return (
  <Dialog 
   open={open} 
   onClose={onClose} 
   maxWidth="lg" 
   fullWidth
   fullScreen={isMobile}
   scroll="paper"
  >
   <DialogTitle sx={{ m: 0, p: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
     <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Avatar sx={{ bgcolor: priorityColors[insight.priority] }}>
       <InsightsIcon />
      </Avatar>
      <Box>
       <Typography variant="h6" component="div">
        {insight.title}
       </Typography>
       <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
        <Chip 
         label={insight.priority.toUpperCase()} 
         size="small"
         sx={{ 
          bgcolor: priorityColors[insight.priority],
          color: 'white',
          fontWeight: 'bold'
         }}
        />
        <Chip 
         label={insight.category} 
         size="small"
         variant="outlined"
        />
        {renderTrendIcon(insight.trend)}
       </Box>
      </Box>
     </Box>

     <Box>
      <IconButton onClick={handleRegenerate} title="Regenerate insight">
       <RefreshIcon />
      </IconButton>
      <IconButton onClick={onClose}>
       <CloseIcon />
      </IconButton>
     </Box>
    </Box>
   </DialogTitle>

   <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
    <Box sx={{ px: 3, py: 1 }}>
     <Box sx={{ display: 'flex', gap: 1 }}>
      {['overview', 'data', 'recommendations', 'history'].map((tab) => (
       <Button
        key={tab}
        size="small"
        variant={activeTab === tab ? 'contained' : 'text'}
        onClick={() => setActiveTab(tab as any)}
        sx={{ textTransform: 'capitalize' }}
       >
        {tab.replace('_', ' ')}
       </Button>
      ))}
     </Box>
    </Box>
   </Box>

   <DialogContent dividers sx={{ p: { xs: 2, md: 3 }, textAlign: 'left' }}>
    {activeTab === 'overview' && (
     <Box>
      <Box
       sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
        gap: 3,
        alignItems: 'start',
       }}
      >
       <Box sx={{ minWidth: 0 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700 }}>
         AI summary
        </Typography>
        <Typography variant="body1" sx={{ fontSize: '1.05rem', lineHeight: 1.7, mb: 3 }}>
         {insight.description}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
         Key Findings
        </Typography>
        <List dense disablePadding>
         {keyFindings.map((finding) => (
          <ListItem key={finding} disableGutters sx={{ alignItems: 'flex-start' }}>
           <ListItemIcon sx={{ minWidth: 32, mt: 0.25 }}>
            <CheckIcon fontSize="small" sx={{ color: 'primary.main' }} />
           </ListItemIcon>
           <ListItemText primary={finding} primaryTypographyProps={{ sx: { textTransform: 'none' } }} />
          </ListItem>
         ))}
        </List>
       </Box>

       <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <Card variant="outlined">
         <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.5 }}>
           Confidence Score
          </Typography>
          {renderConfidenceScore(confidencePct)}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
           {levelFor(confidencePct)} confidence in this recommendation
          </Typography>
         </CardContent>
        </Card>

        <Card variant="outlined">
         <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
           Estimated Impact
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
           <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main' }}>
            {levelFor(impactPct)}
           </Typography>
           <Typography variant="body1" color="text.secondary">
            {impactPct}%
           </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
           Expected effect on your portfolio if acted on
          </Typography>
         </CardContent>
        </Card>
       </Box>
      </Box>

      {recommendations.length > 0 && (
       <Box sx={{ mt: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
         Recommendations
        </Typography>
        <Grid container spacing={2}>
         {recommendations.slice(0, 3).map((rec) => (
          <Grid item xs={12} md={6} key={rec.id}>
           <Card variant="outlined">
            <CardContent>
             <Typography variant="subtitle1" gutterBottom>
              {rec.title}
             </Typography>
             <Typography variant="body2" color="text.secondary" paragraph>
              {rec.description}
             </Typography>
             <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Chip
               label={String(rec.priority ?? 'medium').toUpperCase()}
               size="small"
               sx={{
                bgcolor: priorityColor(rec.priority),
                color: 'white',
                fontWeight: 'bold'
               }}
              />
              {/* Removed timeline as it's not in the new AIRecommendation interface */}
             </Box>
            </CardContent>
           </Card>
          </Grid>
         ))}
        </Grid>
       </Box>
      )}
     </Box>
    )}

    {activeTab === 'data' && (
     <Box>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
       Supporting Data
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
       {[
        ['Category', String(insight.category ?? '—').replace(/_/g, ' ')],
        ['Priority', String(insight.priority ?? '—')],
        ['Trend', trendLabel],
        ['AI confidence', `${confidencePct}%`],
        ['Estimated impact', `${levelFor(impactPct)} (${impactPct}%)`],
        ['Recommendations', String(recommendations.length)],
       ].map(([label, value]) => (
        <Card key={label} variant="outlined">
         <CardContent>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, textTransform: 'capitalize' }}>{value}</Typography>
         </CardContent>
        </Card>
       ))}
      </Box>
     </Box>
    )}

    {activeTab === 'recommendations' && (
     <Box>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
       Detailed Recommendations
      </Typography>
      {recommendations.length === 0 && (
       <Typography color="text.secondary">No recommendations for this insight yet.</Typography>
      )}
      {recommendations.map((rec) => (
       <Card key={rec.id} sx={{ mb: 2 }}>
        <CardContent>
         <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
           <Typography variant="h6" gutterBottom>
            {rec.title}
           </Typography>
           <Typography variant="body2" color="text.secondary" paragraph>
            {rec.description}
           </Typography>
          </Box>
          {/* Removed priority, timeline, expectedOutcome as they are not in the new AIRecommendation interface */}
         </Box>

         {rec.actions?.map((action) => (
          <Box key={action.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
           <CheckIcon
            color={action.completed ? 'success' : 'disabled'}
            fontSize="small"
           />
           <Typography
            variant="body2"
            sx={{
             textDecoration: action.completed ? 'line-through' : 'none',
             color: action.completed ? 'text.secondary' : 'text.primary'
            }}
           >
            {(action as { description?: string; text?: string }).description ?? (action as { text?: string }).text}
           </Typography>
          </Box>
         ))}
        </CardContent>
       </Card>
      ))}
     </Box>
    )}

    {activeTab === 'history' && (
     <Box>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
       Insight History
      </Typography>
      <List disablePadding>
       <ListItem disableGutters>
        <ListItemIcon sx={{ minWidth: 32 }}><TimelineIcon fontSize="small" sx={{ color: 'primary.main' }} /></ListItemIcon>
        <ListItemText
         primary="Insight generated by AI"
         secondary={insight.timestamp && !Number.isNaN(new Date(insight.timestamp).getTime())
          ? new Date(insight.timestamp).toLocaleString()
          : 'Date not available'}
        />
       </ListItem>
       <ListItem disableGutters>
        <ListItemIcon sx={{ minWidth: 32 }}><InsightsIcon fontSize="small" sx={{ color: 'primary.main' }} /></ListItemIcon>
        <ListItemText
         primary={`Assessed at ${confidencePct}% confidence, ${levelFor(impactPct).toLowerCase()} impact`}
         secondary="Use Regenerate (top right) to refresh this insight with the latest data"
        />
       </ListItem>
      </List>
      
      {/* Removed updatedAt and methodology as they are not in the new Insight interface */}
     </Box>
    )}
   </DialogContent>

   <DialogActions sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
     <Typography variant="body2" color="text.secondary">
      Was this insight helpful?
     </Typography>
     <Box sx={{ display: 'flex', gap: 1 }}>
      <IconButton
       onClick={() => setFeedback(prev => ({ ...prev, helpful: true }))}
       color={feedback.helpful === true ? 'success' : 'default'}
       size="small"
      >
       <ThumbUpIcon />
      </IconButton>
      <IconButton
       onClick={() => setFeedback(prev => ({ ...prev, helpful: false }))}
       color={feedback.helpful === false ? 'error' : 'default'}
       size="small"
      >
       <ThumbDownIcon />
      </IconButton>
     </Box>
    </Box>

    <Box sx={{ display: 'flex', gap: 1 }}>
     <Button onClick={onClose}>
      Close
     </Button>
     <Button
      variant="contained"
      onClick={handleFeedbackSubmit}
      disabled={feedback.helpful === null || submittingFeedback}
     >
      {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
     </Button>
    </Box>
   </DialogActions>
  </Dialog>
 );
};