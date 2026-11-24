import React, { useState } from 'react';
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { apiService } from '../services/apiService';

interface RequestOption {
  id: string;
  label: string;
}

interface PhotoAnalysisProps {
  /** Pre-selected maintenance request. When `requests` is given the user can change it. */
  maintenanceRequestId?: string;
  requests?: RequestOption[];
}

/**
 * Ask the AI service to look at a photo of a maintenance issue.
 * The backend endpoint (POST /api/maintenance/photo-analysis) is optional; when it is not
 * deployed the card says so instead of failing silently.
 */
const PhotoAnalysis: React.FC<PhotoAnalysisProps> = ({ maintenanceRequestId = '', requests }) => {
  const [requestId, setRequestId] = useState(maintenanceRequestId);
  const [imageUrl, setImageUrl] = useState('');
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ severity: 'error' | 'info'; text: string } | null>(null);

  const handleAnalyze = async () => {
    if (!imageUrl.trim()) {
      setError({ severity: 'error', text: 'Enter the URL of a photo to analyse.' });
      return;
    }
    if (requests && !requestId) {
      setError({ severity: 'error', text: 'Choose the maintenance request this photo belongs to.' });
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const result: any = await apiService.analyzePhoto(requestId, imageUrl.trim());
      setAnalysisResult(result?.data ?? result);
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status;
      setError(
        status === 404
          ? { severity: 'info', text: 'Photo analysis is not enabled on this server yet. The request was not sent.' }
          : { severity: 'error', text: 'Could not analyse the photo. Check the URL and try again.' }
      );
    } finally {
      setLoading(false);
    }
  };

  const issues: string[] = Array.isArray(analysisResult?.issuesDetected) ? analysisResult.issuesDetected : [];

  return (
    <Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Paste a link to a photo from a tenant or vendor and the assistant will suggest the likely issue and its severity.
      </Typography>
      <Stack spacing={2}>
        {requests && (
          <TextField
            select
            size="small"
            label="Maintenance request"
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
            fullWidth
          >
            {requests.length === 0 && (
              <MenuItem value="" disabled>
                No open requests
              </MenuItem>
            )}
            {requests.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                {r.label}
              </MenuItem>
            ))}
          </TextField>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            size="small"
            label="Photo URL"
            placeholder="https://…"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            fullWidth
          />
          <Button
            variant="contained"
            startIcon={<PhotoCameraIcon />}
            onClick={handleAnalyze}
            disabled={loading}
            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            {loading ? 'Analysing…' : 'Analyse photo'}
          </Button>
        </Stack>
        {error && <Alert severity={error.severity}>{error.text}</Alert>}
        {analysisResult && (
          <Alert severity="success" icon={false}>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Analysis result</Typography>
            <Typography variant="body2">
              <strong>Issues detected:</strong> {issues.length ? issues.join(', ') : 'None'}
            </Typography>
            {analysisResult.severity && (
              <Typography variant="body2">
                <strong>Severity:</strong> {analysisResult.severity}
              </Typography>
            )}
            {analysisResult.recommendations && (
              <Typography variant="body2">
                <strong>Recommendations:</strong> {String(analysisResult.recommendations)}
              </Typography>
            )}
          </Alert>
        )}
      </Stack>
    </Box>
  );
};

export default PhotoAnalysis;
