import React, { useState, useEffect } from 'react';
import {
 Container,
 Typography,
 GridLegacy as Grid,
 Box,
 Alert
} from '@mui/material';
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
    <Alert severity="error" sx={{ mb: 3 }}>
     {error}
    </Alert>
   </Container>
  );
 }

 if (!verificationState) {
  return (
   <Container maxWidth="lg" sx={{ py: 4 }}>
    <Alert severity="warning">
     No verification data yet.
    </Alert>
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
    <Grid xs={12}>
     <VerificationStepper
      steps={verificationSteps}
      currentStep={verificationState.currentStep}
      estimatedCompletion={verificationState.estimatedCompletion}
     />
    </Grid>

    {/* Status Details Panel */}
    <Grid xs={12}>
     <StatusDetailsPanel verificationState={verificationState} />
    </Grid>

    {/* Required Actions Panel */}
    <Grid xs={12}>
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
