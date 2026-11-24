import * as React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Box, Snackbar } from '@mui/material';
import Header from './Header';
import {
  NavigationProvider,
  DesktopSidebar,
  TabletDrawer,
  MobileBottomTabs,
  useNavigationBreakpoint,
} from '../design-system/navigation';
import { Landmark } from '../design-system/accessibility';
import OfflineIndicator from './OfflineIndicator';
import { useAuth } from '../contexts/AuthContext';
import { navItemsFor } from '../auth/roles';
import type { AccessDeniedState } from './ProtectedRoute';

/** Shows "You don't have access to that page" after the route guard bounced the user home. */
const AccessDeniedNotice: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const denied = (location.state as AccessDeniedState | null)?.accessDenied;

  React.useEffect(() => {
    if (denied) {
      setOpen(true);
      // Drop the flag so a refresh or back-navigation does not show it again.
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [denied, location.pathname, location.search, navigate]);

  return (
    <Snackbar
      open={open}
      autoHideDuration={6000}
      onClose={() => setOpen(false)}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ top: { xs: 72, sm: 80 } }}
    >
      <Alert severity="warning" variant="filled" onClose={() => setOpen(false)} data-testid="access-denied-notice">
        You don&apos;t have access to that page.
      </Alert>
    </Snackbar>
  );
};

// Internal Layout component that uses navigation hooks
const LayoutContent: React.FC = () => {
  const {
    shouldShowSidebar,
    shouldShowDrawer,
    shouldShowBottomTabs
  } = useNavigationBreakpoint();

  return (
    <Box sx={{
      display: 'flex',
      minHeight: '100vh',
      flexDirection: 'column'
    }}>
      {/* Header - always shown */}
      <Header />

      {/* Offline Indicator - always shown */}
      <OfflineIndicator />

      <AccessDeniedNotice />

      {/* Desktop Sidebar */}
      {shouldShowSidebar && <DesktopSidebar />}

      {/* Slide-out drawer: tablets, and phones (opened from the header menu button) so
          every page is reachable, not only the five bottom tabs. */}
      {(shouldShowDrawer || shouldShowBottomTabs) && <TabletDrawer />}

      {/* Main Content Area */}
      <Landmark role="main" aria-label="Main content">
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            // Dynamic padding based on navigation type
            paddingLeft: shouldShowSidebar ? '280px' : 0,
            paddingBottom: shouldShowBottomTabs ? '80px' : 0, // Increased for better mobile nav
            paddingTop: '64px', // Header height
            minHeight: '100vh',
          }}
        >
          <Box
            className="container-mobile"
            sx={{
              flexGrow: 1,
              py: { xs: 2, sm: 3 },
              width: '100%',
              maxWidth: '100%',
            }}
          >
            <Outlet />
          </Box>
        </Box>
      </Landmark>

      {/* Mobile bottom navigation (MobileBottomTabs positions itself; the old fixed
          wrapper doubled it into an 80px band with an empty strip under the tabs). */}
      {shouldShowBottomTabs && <MobileBottomTabs />}
    </Box>
  );
};

// Main Layout component with NavigationProvider
const Layout: React.FC = () => {
  const { user } = useAuth();
  // The menu comes from the role policy, so it only ever lists pages the role may open.
  const items = React.useMemo(() => navItemsFor(user?.role), [user?.role]);
  return (
    <NavigationProvider items={items}>
      <LayoutContent />
    </NavigationProvider>
  );
};

export default Layout;
