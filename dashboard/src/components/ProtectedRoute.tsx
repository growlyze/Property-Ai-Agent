import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CircularProgress, Box, Typography } from '@mui/material';
import { canAccess, homePathFor } from '../auth/roles';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /**
   * When true (the default) the current path is also checked against the role
   * policy in auth/roles.ts. Users who open a page their role may not see are
   * sent to their own home with an "access denied" notice.
   */
  enforceRole?: boolean;
}

/** Location state set when a user is bounced off a page they may not open. */
export interface AccessDeniedState {
  accessDenied?: { from: string };
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, enforceRole = true }) => {
  const { isAuthenticated, token, user } = useAuth();
  const location = useLocation();

  // Auth state is restored from localStorage in an effect; wait for it.
  if (token === null && localStorage.getItem('authToken')) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>
          Loading authentication...
        </Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (enforceRole && !canAccess(user?.role, location.pathname)) {
    const state: AccessDeniedState = { accessDenied: { from: location.pathname } };
    return <Navigate to={homePathFor(user?.role)} state={state} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
