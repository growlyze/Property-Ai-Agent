import React, { useState, useEffect } from 'react';
import {
 Container,
 Typography,
 GridLegacy as Grid,
 Box,
 Alert,
 Button,
 Card,
 CardContent,
 Stack
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import { EmptyPanel } from '../components/empty/EmptyStates';

/** The verification steps, shown on the empty state so it explains the feature. */
const HOW_IT_WORKS = [
 { title: 'Documents submitted', text: 'ID, proof of income and references are uploaded by the applicant.' },
 { title: 'Automated checks', text: 'Documents are checked for completeness, legibility and expiry dates.' },
 { title: 'Manager review', text: 'A property manager reviews flagged items and requests anything missing.' },
 { title: 'Verified', text: 'The applicant is notified and the result is added to their screening file.' },
];

const PageTitle = () => (
 <Box sx={{ mb: 3 }}>
  <Typography variant="h4" component="h1" sx={{ fontWeight: 800, fontSize: { xs: '1.6rem', md: '2.125rem' } }}>
   Document Verification
  </Typography>
  <Typography sx={{ color: 'text.secondary' }}>
   Track identity and income document checks for applicants and tenants.
  </Typography>
 </Box>
);
import { VerificationState, VerificationStep } from '../types/document-verification';
import { getVerificationState, getVerificationSteps } from '../services/documentVerificationService';
import StatusDetailsPanel from '../components/document-verification/StatusDetailsPanel';
import RequiredActionsPanel from '../components/document-verification/RequiredActionsPanel';
import VerificationStepper from '../components/document-verification/VerificationStepper';
import LoadingStateIndicator from '../design-system/components/ai/LoadingStateIndicator';
import { useAuth } from '../contexts/AuthContext';

const DocumentVerificationStatusScreen: React.FC = () => {
 // Verification records are per tenant: use the logged-in user's id.
 const { user } = useAuth();
 const tenantId = user?.id;
 const [verificationState, setVerificationState] = useState<VerificationState | null>(null);
 const [verificationSteps, setVerificationSteps] = useState<VerificationStep[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 useEffect(() => {
  if (!tenantId) {
   // No user id (yet): don't call the API with `undefined`.
   setVerificationState(null);
   setVerificationSteps([]);
   setLoading(false);
   return;
  }

  const loadVerificationData = async () => {
   try {
    setLoading(true);
    setError(null);
    const [state, steps] = await Promise.all([
     getVerificationState(tenantId),
     getVerificationSteps(tenantId)
    ]);
    setVerificationState(state);
    setVerificationSteps(Array.isArray(steps) ? steps : []);
   } catch (err) {
    setError('Failed to load verification status. Please try again.');
    console.error('Error loading verification data:', err);
   } finally {
    setLoading(false);
   }
  };

  loadVerificationData();
 }, [tenantId]);

 const handleActionUpdate = (actionId: string, completed: boolean) => {
  if (!verificationState) return;

  setVerificationState(prev => {
   if (!prev) return prev;
   
   return {
    ...prev,
    requiredActions: prev.requiredActions.map(action =>
     action.id === actionId ? { ...action, completed } : action
    ),
    lastUpdated: new Date()
   };
  });
 };

 if (loading) {
  return (
   <Container maxWidth="lg" sx={{ py: 4 }}>
    <LoadingStateIndicator
     message="Loading document verification status..."
     variant="skeleton"
    />
   </Container>
  );
 }

 if (error) {
  return (
   <Container maxWidth="lg" sx={{ py: 4 }}>
    <PageTitle />
    <Alert severity="error" sx={{ mb: 3, border: '1px solid var(--color-border-default)' }}>
     {error}
    </Alert>
   </Container>
  );
 }

 if (!verificationState) {
  return (
   <Container maxWidth="lg" sx={{ py: { xs: 2, md: 3 }, px: { xs: 2, md: 3 } }}>
    <PageTitle />
    <Card sx={{ mb: 3 }}>
     <CardContent>
      <EmptyPanel
       icon={<FactCheckOutlinedIcon />}
       title="No verifications in progress"
       text="When an applicant or tenant submits documents for verification, their progress through the steps below will appear here."
       action={
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
         <Button component={RouterLink} to="/tenant-screening" variant="contained">
          Go to Tenant Screening
         </Button>
         <Button component={RouterLink} to="/documents" variant="outlined">
          Open Documents
         </Button>
        </Stack>
       }
      />
     </CardContent>
    </Card>
    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
     How verification works
    </Typography>
    <Grid container spacing={2}>
     {HOW_IT_WORKS.map((step, i) => (
      <Grid item xs={12} sm={6} md={3} key={step.title}>
       <Card sx={{ height: '100%' }}>
        <CardContent sx={{ p: 2.5 }}>
         <Box
          sx={{
           width: 32,
           height: 32,
           borderRadius: '50%',
           border: '1px solid var(--color-border-default)',
           bgcolor: 'primary.main',
           color: '#fff',
           fontWeight: 800,
           display: 'grid',
           placeItems: 'center',
           mb: 1.5,
          }}
         >
          {i + 1}
         </Box>
         <Typography sx={{ fontWeight: 800, mb: 0.5 }}>{step.title}</Typography>
         <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {step.text}
         </Typography>
        </CardContent>
       </Card>
      </Grid>
     ))}
    </Grid>
   </Container>
  );
 }

 return (
  <Container maxWidth="lg" sx={{ py: 4 }}>
   <Box sx={{ mb: 4 }}>
    <Typography variant="h4" component="h1" gutterBottom>
     Document Verification Status
    </Typography>
    <Typography variant="body1" color="text.secondary">
     Track your document verification progress and complete required actions
    </Typography>
   </Box>

   <Grid container spacing={3}>
    {/* Verification Process Stepper */}
    <Grid item xs={12}>
     <VerificationStepper
      steps={verificationSteps}
      currentStep={verificationState.currentStep}
      estimatedCompletion={verificationState.estimatedCompletion}
     />
    </Grid>

    {/* Status Details Panel */}
    <Grid item xs={12}>
     <StatusDetailsPanel verificationState={verificationState} />
    </Grid>

    {/* Required Actions Panel */}
    <Grid item xs={12}>
     <RequiredActionsPanel
      actions={verificationState.requiredActions}
      tenantId={tenantId}
      onActionUpdate={handleActionUpdate}
     />
    </Grid>
   </Grid>
  </Container>
 );
};

export default DocumentVerificationStatusScreen;
