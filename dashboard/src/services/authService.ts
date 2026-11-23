interface LoginResponse {
  data: {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
    token: string;
    refreshToken: string;
  };
}

class AuthService {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      // Show the server's message (e.g. 401 bad credentials, 403 deactivated account).
      const errorData = await response.json().catch(() => ({} as any));
      const message =
        errorData?.message ||
        errorData?.error ||
        (response.status === 403
          ? 'Your account is not allowed to sign in. Please contact your property manager.'
          : response.status === 401
            ? 'Invalid email or password. Please try again.'
            : `Sign-in failed (HTTP ${response.status}). Please try again.`);
      throw new Error(message);
    }

    return response.json();
  }

  async oauthLogin(provider: 'google' | 'facebook', token: string) {
    const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/${provider}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
    return response.json();
  }
}

export default new AuthService();
