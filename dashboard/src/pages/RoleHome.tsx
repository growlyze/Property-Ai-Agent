import React, { Suspense, lazy } from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { isStaff, normalizeRole } from '../auth/roles';
import Dashboard from './Dashboard';

const TenantHome = lazy(() => import('./tenant/TenantHome'));
const VendorHome = lazy(() => import('./vendor/VendorHome'));

const fallback = (
  <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
    <CircularProgress />
  </Box>
);

/** "/" renders a different home per role (see auth/roles.ts). */
const RoleHome: React.FC = () => {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);

  if (isStaff(role)) return <Dashboard />;
  if (role === 'TENANT')
    return (
      <Suspense fallback={fallback}>
        <TenantHome />
      </Suspense>
    );
  if (role === 'VENDOR')
    return (
      <Suspense fallback={fallback}>
        <VendorHome />
      </Suspense>
    );
  return (
    <Alert severity="warning" sx={{ m: 3 }}>
      Your account doesn&apos;t have a role with access to this dashboard yet. Please contact your property manager.
    </Alert>
  );
};

export default RoleHome;
