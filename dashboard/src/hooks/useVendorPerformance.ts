import { useQuery } from '@tanstack/react-query';
import { vendorPerformanceApi } from '../services/vendorPerformanceApi';
import { apiService } from '../services/apiService';
import { VendorPerformanceRating } from '../types/vendor';
import { asArray, num } from '../utils/safeData';

/**
 * `apiService` never throws: it resolves to `{ data }` or `{ error }`.
 * Unwrap here so react-query sees real data (or a real error).
 */
async function unwrap<T>(promise: Promise<{ data?: T; error?: any }>): Promise<T | undefined> {
  const result = await promise;
  if (result?.error) {
    throw new Error(result.error.message || 'Request failed');
  }
  return result?.data;
}

export interface VendorOption {
  id: string;
  name: string;
  specialty?: string;
}

/** Vendor directory for the picker (GET /api/vendors, operators only). */
export const useVendorList = () =>
  useQuery({
    queryKey: ['vendors', 'list'],
    queryFn: async (): Promise<VendorOption[]> =>
      asArray<VendorOption>(await unwrap(apiService.get('/vendors'))),
    retry: false,
  });

export const useVendorPerformance = (vendorId: string) => {
  const { data: ratings, isLoading: ratingsLoading, error: ratingsError } = useQuery({
    queryKey: ['vendorRatings', vendorId],
    queryFn: async (): Promise<VendorPerformanceRating[]> =>
      asArray<VendorPerformanceRating>(await unwrap(vendorPerformanceApi.getRatingsForVendor(vendorId))),
    enabled: !!vendorId,
    retry: false,
  });

  const { data: averageScore, isLoading: averageScoreLoading, error: averageScoreError } = useQuery({
    queryKey: ['vendorAverageScore', vendorId],
    queryFn: async (): Promise<{ averageScore: number }> => {
      const body: any = await unwrap(vendorPerformanceApi.getAverageScoreForVendor(vendorId));
      return { averageScore: num(body?.averageScore ?? body?.data?.averageScore) };
    },
    enabled: !!vendorId,
    retry: false,
  });

  return {
    ratings,
    ratingsLoading: !!vendorId && ratingsLoading,
    ratingsError,
    averageScore,
    averageScoreLoading: !!vendorId && averageScoreLoading,
    averageScoreError,
  };
};
