/**
 * Keeps the user signed in.
 *
 * The API issues a short-lived access token (15 min) plus a refresh token.
 * Previously the dashboard never used the refresh token, so every user was
 * sent back to /login after 15 minutes. `refreshSession()` exchanges the stored
 * refresh token for a new pair (POST /api/auth/refresh-token) and updates
 * localStorage. Concurrent callers share one in-flight request, because the
 * server rotates the refresh token and a second parallel refresh would fail.
 */

let inFlight: Promise<string | null> | null = null;

export function refreshSession(): Promise<string | null> {
  if (inFlight) return inFlight;
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return Promise.resolve(null);

  inFlight = (async () => {
    try {
      const res = await fetch('/api/auth/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const body = await res.json();
      const data = body?.data ?? body;
      if (!data?.token) return null;
      localStorage.setItem('authToken', data.token);
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
      window.dispatchEvent(new CustomEvent('auth:token-refreshed', { detail: { token: data.token } }));
      return data.token as string;
    } catch {
      return null;
    } finally {
      // Let a later caller start a fresh refresh.
      setTimeout(() => {
        inFlight = null;
      }, 0);
    }
  })();
  return inFlight;
}

/** Clear the session and go to the login page (keeps the page the user was on). */
export function endSession(): void {
  localStorage.removeItem('authToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

const isAuthCall = (url?: string) => !!url && /\/auth\/(login|refresh-token|register)/.test(url);

/**
 * Axios response-error handler: on a 401, refresh once and retry the request;
 * if that is not possible, end the session.
 */
export async function handleAuthError(error: any, client: (config: any) => Promise<any>): Promise<any> {
  const status = error?.response?.status;
  const config = error?.config;
  if (status !== 401 || !config || isAuthCall(config.url)) {
    return Promise.reject(error);
  }
  if (config.__retriedAfterRefresh) {
    endSession();
    return Promise.reject(error);
  }
  const token = await refreshSession();
  if (!token) {
    endSession();
    return Promise.reject(error);
  }
  config.__retriedAfterRefresh = true;
  config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
  return client(config);
}

/** Refresh proactively before the 15-minute token expires, and after the tab wakes up. */
export function startSessionKeepAlive(): () => void {
  const REFRESH_EVERY_MS = 10 * 60 * 1000;
  let last = Date.now();
  const tick = () => {
    if (!localStorage.getItem('refreshToken')) return;
    last = Date.now();
    void refreshSession();
  };
  const timer = window.setInterval(tick, REFRESH_EVERY_MS);
  const onVisible = () => {
    if (document.visibilityState === 'visible' && Date.now() - last > 5 * 60 * 1000) tick();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
