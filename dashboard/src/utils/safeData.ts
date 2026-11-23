/**
 * Helpers for pages whose API responses may be missing, wrapped
 * (`{ success, data }`, `{ data: { items } }`) or failed (`{ error }`).
 * They always return a safe value so the UI can render an empty state.
 */

const LIST_KEYS = ['data', 'items', 'results', 'records', 'rows'];

/** Unwrap a response (or any value) into an array. Never throws. */
export function asArray<T = any>(value: unknown, depth = 0): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== 'object' || depth > 3) return [];
  const obj = value as Record<string, unknown>;
  for (const key of LIST_KEYS) {
    if (key in obj) {
      const inner = asArray<T>(obj[key], depth + 1);
      if (inner.length || Array.isArray(obj[key])) return inner;
    }
  }
  return [];
}

/** Coerce to a finite number (default 0). */
export function num(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}
