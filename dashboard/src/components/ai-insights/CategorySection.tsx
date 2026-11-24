import React from 'react';
import {
 Box,
 Typography,
 Chip,
 Collapse,
 IconButton,
 Divider
} from '@mui/material';
import {
 ExpandMore as ExpandMoreIcon,
 ExpandLess as ExpandLessIcon,
 AttachMoney as AttachMoneyIcon,
 Settings as SettingsIcon,
 People as PeopleIcon
} from '@mui/icons-material';
import { CategorySectionProps } from '../../types/ai-insights';
import InsightCard from './InsightCard';

const CategorySection: React.FC<CategorySectionProps> = ({
 category,
 onInsightClick,
 expanded = true,
 onToggleExpanded
}) => {
 // Category icons
 const categoryIcons = {
  financial: AttachMoneyIcon,
  operational: SettingsIcon,
  tenant_satisfaction: PeopleIcon
 };

 // Category colors
 const categoryColors = {
  financial: '#4caf50',
  operational: '#f55809',
  tenant_satisfaction: '#ff9800'
 };

 const IconComponent = categoryIcons[category.category];
 const categoryColor = categoryColors[category.category];

 // Get priority counts
 const priorityCounts = category.insights.reduce((acc, insight) => {
  acc[insight.priority] = (acc[insight.priority] || 0) + 1;
  return acc;
 }, {} as Record<string, number>);

 const highPriorityCount = (priorityCounts.critical || 0) + (priorityCounts.high || 0);

 return (
  <Box sx={{ mb: 4 }}>
   {/* Category Header */}
   <Box
    sx={{
     display: 'flex',
     alignItems: 'center',
     mb: 2,
     cursor: onToggleExpanded ? 'pointer' : 'default',
     p: 1,
     borderRadius: 1,
     '&:hover': onToggleExpanded ? {
      backgroundColor: 'action.hover'
     } : {}
    }}
    onClick={onToggleExpanded}
   >
    <Box
     sx={{
      display: 'flex',
      alignItems: 'center',
      backgroundColor: categoryColor,
      color: 'white',
      borderRadius: '50%',
      width: 40,
      height: 40,
      justifyContent: 'center',
      mr: 2
     }}
    >
     <IconComponent sx={{ fontSize: 20 }} />
    </Box>

    <Box sx={{ flexGrow: 1 }}>
     <Typography variant="h6" component="h2" sx={{ mb: 0.5 }}>
      {category.name}
     </Typography>
     <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
       {category.totalCount} insight{category.totalCount !== 1 ? 's' : ''}
      </Typography>
      {highPriorityCount > 0 && (
       <Chip
        size="small"
        color="error"
        variant="outlined"
        label={`${highPriorityCount} high priority`}
        sx={{ height: 22, fontSize: '0.75rem' }}
       />
      )}
     </Box>
    </Box>

    {onToggleExpanded && (
     <IconButton size="small">
      {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
     </IconButton>
    )}
   </Box>

   {/* Category Content */}
   <Collapse in={expanded}>
    {category.insights.length > 0 ? (
     <Box
      sx={{
       display: 'grid',
       gap: 2.5,
       gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
      }}
     >
      {category.insights.map((insight) => (
       <Box key={insight.id} sx={{ minWidth: 0 }}>
        <InsightCard
         insight={insight}
         onClick={onInsightClick}
         showCategory={false}
        />
       </Box>
      ))}
     </Box>
    ) : (
     <Box
      sx={{
       py: 4,
       px: 2,
       borderRadius: 1,
       border: '1.5px dashed',
       borderColor: 'divider'
      }}
     >
      <IconComponent sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
      <Typography variant="body1" color="text.secondary" gutterBottom>
       No insights in this category
      </Typography>
      <Typography variant="body2" color="text.secondary">
       Check back later for new {category.name.toLowerCase()}.
      </Typography>
     </Box>
    )}
   </Collapse>

   <Divider sx={{ mt: 3 }} />
  </Box>
 );
};

export default CategorySection;