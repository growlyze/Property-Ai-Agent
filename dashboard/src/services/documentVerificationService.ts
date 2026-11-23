/**
 * Document Verification Service
 * Handles API calls and data management for document verification
 */

import { 
  VerificationState, 
  RequiredAction, 
  VerificationDocument, 
  VerificationStep,
  DocumentSubmissionResponse,
  DocumentAnalysisResult
} from '../types/document-verification';
import { apiService } from './api';

/**
 * Get current verification state for a tenant
 */
export const getVerificationState = async (tenantId: string): Promise<VerificationState | null> => {
  // Never call the API without an id (it used to request `/verification/undefined/state`).
  if (!tenantId) return null;
  try {
    // apiService resolves to `{ data }` or `{ error }` instead of throwing.
    const response: any = await apiService.get(`/verification/${encodeURIComponent(tenantId)}/state`);
    if (response?.error) {
      // 404 = no verification record (the backend has no state endpoint yet).
      if (response.error.status === 404) return null;
      throw new Error(response.error.message);
    }
    const body = response?.data;
    const state = body && typeof body === 'object' && 'data' in body && !('currentStep' in body) ? body.data : body;
    return state && typeof state === 'object'
      ? { ...state, requiredActions: Array.isArray(state.requiredActions) ? state.requiredActions : [] }
      : null;
  } catch (error) {
    console.error('Error fetching verification state:', error);
    throw new Error('Failed to fetch verification state');
  }
};

/**
 * Get verification steps for a tenant
 */
export const getVerificationSteps = async (tenantId: string): Promise<VerificationStep[]> => {
  if (!tenantId) return [];
  try {
    const response: any = await apiService.get(`/verification/${encodeURIComponent(tenantId)}/steps`);
    if (response?.error) {
      if (response.error.status === 404) return [];
      throw new Error(response.error.message);
    }
    const body = response?.data;
    return Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
  } catch (error) {
    console.error('Error fetching verification steps:', error);
    throw new Error('Failed to fetch verification steps');
  }
};

/**
 * Update required action status
 */
export const updateRequiredAction = async (
  tenantId: string,
  actionId: string,
  completed: boolean
): Promise<RequiredAction> => {
  try {
    const response = await apiService.put(`/verification/${tenantId}/actions/${actionId}`, {
      completed
    });
    return response.data;
  } catch (error) {
    console.error('Error updating required action:', error);
    throw new Error('Failed to update required action');
  }
};

/**
 * Submit additional document
 */
export const submitDocument = async (
  tenantId: string,
  file: File,
  type: string,
  metadata?: Record<string, any>
): Promise<DocumentSubmissionResponse> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const response = await apiService.post(`/verification/${tenantId}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error submitting document:', error);
    throw new Error('Failed to submit document');
  }
};

/**
 * Get document analysis results
 */
export const getDocumentAnalysis = async (
  tenantId: string,
  documentId: string
): Promise<DocumentAnalysisResult> => {
  try {
    const response = await apiService.get(`/verification/${tenantId}/documents/${documentId}/analysis`);
    return response.data;
  } catch (error) {
    console.error('Error fetching document analysis:', error);
    throw new Error('Failed to fetch document analysis');
  }
};

/**
 * Delete a document
 */
export const deleteDocument = async (
  tenantId: string,
  documentId: string
): Promise<void> => {
  try {
    await apiService.delete(`/verification/${tenantId}/documents/${documentId}`);
  } catch (error) {
    console.error('Error deleting document:', error);
    throw new Error('Failed to delete document');
  }
};

/**
 * Re-analyze a document
 */
export const reanalyzeDocument = async (
  tenantId: string,
  documentId: string
): Promise<DocumentAnalysisResult> => {
  try {
    const response = await apiService.post(`/verification/${tenantId}/documents/${documentId}/reanalyze`);
    return response.data;
  } catch (error) {
    console.error('Error re-analyzing document:', error);
    throw new Error('Failed to re-analyze document');
  }
};

/**
 * Get verification history
 */
export const getVerificationHistory = async (
  tenantId: string,
  limit?: number,
  offset?: number
): Promise<{
  history: Array<{
    id: string;
    action: string;
    timestamp: string;
    user: string;
    details: Record<string, any>;
  }>;
  total: number;
}> => {
  try {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());

    const response = await apiService.get(`/verification/${tenantId}/history?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching verification history:', error);
    throw new Error('Failed to fetch verification history');
  }
};

/**
 * Request manual review
 */
export const requestManualReview = async (
  tenantId: string,
  reason: string,
  priority?: 'low' | 'medium' | 'high'
): Promise<void> => {
  try {
    await apiService.post(`/verification/${tenantId}/review-request`, {
      reason,
      priority: priority || 'medium'
    });
  } catch (error) {
    console.error('Error requesting manual review:', error);
    throw new Error('Failed to request manual review');
  }
};

/**
 * Get verification statistics
 */
export const getVerificationStats = async (
  tenantId: string
): Promise<{
  totalDocuments: number;
  verifiedDocuments: number;
  pendingDocuments: number;
  rejectedDocuments: number;
  averageProcessingTime: number;
  completionPercentage: number;
}> => {
  try {
    const response = await apiService.get(`/verification/${tenantId}/stats`);
    return response.data;
  } catch (error) {
    console.error('Error fetching verification stats:', error);
    throw new Error('Failed to fetch verification stats');
  }
};

/**
 * Download document
 */
export const downloadDocument = async (
  tenantId: string,
  documentId: string
): Promise<Blob> => {
  try {
    const response = await apiService.get(`/verification/${tenantId}/documents/${documentId}/download`, {
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    console.error('Error downloading document:', error);
    throw new Error('Failed to download document');
  }
};

/**
 * Get document templates
 */
export const getDocumentTemplates = async (): Promise<Array<{
  id: string;
  name: string;
  description: string;
  required: boolean;
  acceptedFormats: string[];
  maxSize: number;
}>> => {
  try {
    const response = await apiService.get('/verification/templates');
    return response.data;
  } catch (error) {
    console.error('Error fetching document templates:', error);
    throw new Error('Failed to fetch document templates');
  }
};

/**
 * Check verification eligibility
 */
export const checkVerificationEligibility = async (
  tenantId: string
): Promise<{
  eligible: boolean;
  reasons: string[];
  nextSteps: string[];
}> => {
  try {
    const response = await apiService.get(`/verification/${tenantId}/eligibility`);
    return response.data;
  } catch (error) {
    console.error('Error checking verification eligibility:', error);
    throw new Error('Failed to check verification eligibility');
  }
};