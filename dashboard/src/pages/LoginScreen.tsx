import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  TextField,
  Button,
  Divider,
  Alert,
  CircularProgress,
  Link,
} from '@mui/material';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { handleOAuthLogin } from '../services/oauthService';
import authService from '../services/authService';
import { canAccess, homePathFor } from '../auth/roles';

interface LocationState {
  from?: {
    pathname: string;
  };
  message?: string;
}

const LoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Get the page they were trying to access and any messages
  const from = (location.state as LocationState)?.from?.pathname;
  // Land on the page the user was heading to if their role may open it, otherwise on their role home.
  const destinationFor = (role?: string) =>
    from && from !== '/login' && canAccess(role, from) ? from : homePathFor(role);
  const message = (location.state as LocationState)?.message;

  useEffect(() => {
    if (message) {
      setSuccess(message);
    }
  }, [message]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const result = await authService.login(email, password);
      login(result.data.user, result.data.token, result.data.refreshToken);
      navigate(destinationFor(result.data.user?.role), { replace: true });
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLoginSuccess = async (credentialResponse: CredentialResponse) => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const authResult = await handleOAuthLogin('google', credentialResponse);
      
      if (authResult && authResult.user && authResult.token) {
        login(authResult.user, authResult.token);
        navigate(destinationFor(authResult.user?.role), { replace: true });
      } else {
        setError('Google login failed. Please try again or use email login.');
      }
    } catch (err) {
      console.error('Google login error:', err);
      setError('An error occurred during Google login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLoginError = () => {
    setError('Google login failed. Please try again or use email login.');
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          marginTop: { xs: 4, sm: 8 },
          mb: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography component="h1" variant="h4" sx={{ fontWeight: 800, textAlign: 'center', fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
          Property AI Agent
        </Typography>
        <Typography sx={{ color: 'text.secondary', textAlign: 'center', mb: 3 }}>
          Rentals, tenants, payments and maintenance in one place.
        </Typography>
        
        <Paper 
          elevation={0}
          sx={{ 
            p: { xs: 3, sm: 4 }, 
            border: '2px solid #140827',
            boxShadow: '6px 6px 0 #140827',
            borderRadius: '12px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Typography component="h2" variant="h5" sx={{ fontWeight: 800, alignSelf: 'flex-start' }}>
            Sign in
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {success && (
            <Alert severity="success" sx={{ width: '100%', mb: 2 }}>
              {success}
            </Alert>
          )}
          
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={handleEmailChange}
              disabled={loading}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={handlePasswordChange}
              disabled={loading}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Sign In'}
            </Button>
            
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Link component={RouterLink} to="/register" variant="body2">
                Don&apos;t have an account? Sign up
              </Link>
            </Box>
          </Box>
          
          <Divider sx={{ my: 2, width: '100%' }}>OR</Divider>
          
          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <GoogleLogin
              onSuccess={handleGoogleLoginSuccess}
              onError={handleGoogleLoginError}
              useOneTap
            />
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginScreen;
