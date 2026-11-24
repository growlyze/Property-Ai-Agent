/**
 * Formatting helpers for the market intelligence widgets.
 * The API mixes 0-1 fractions (occupancy, market share, activity confidence)
 * with 0-100 scores and `{ score | value }` objects, so normalise everything
 * to a whole 0-100 percentage before display (same approach as ai-insights).
 */
export const toPercent = (input: unknown): number => {
  let n: number | undefined;
  if (typeof input === 'number') n = input;
  else if (input && typeof input === 'object') {
    const o = input as { score?: unknown; value?: unknown };
    n = Number(o.score ?? o.value);
  } else if (typeof input === 'string') n = Number(input);
  if (n === undefined || !Number.isFinite(n)) return 0;
  return Math.round(Math.min(100, Math.max(0, Math.abs(n) <= 1 ? n * 100 : n)));
};

export const confidenceLabel = (pct: number): 'High' | 'Medium' | 'Low' =>
  pct >= 80 ? 'High' : pct >= 60 ? 'Medium' : 'Low';

/** Signed impact such as 0.25 -> "+25%", -0.1 -> "-10%". */
export const formatSignedPercent = (input: unknown): string => {
  const n = typeof input === 'number' ? input : Number(input);
  if (!Number.isFinite(n)) return '—';
  const pct = Math.round(Math.abs(n) <= 1 ? n * 100 : n);
  return `${pct > 0 ? '+' : ''}${pct}%`;
};

export const formatDateTime = (input: unknown): string | null => {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(input as string);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
};
