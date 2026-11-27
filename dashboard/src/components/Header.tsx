import * as React from 'react';
const { useState } = React;
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  Badge,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountCircle as AccountCircleIcon,
  Notifications as NotificationsIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation, useNavigationBreakpoint } from '../design-system/navigation';
import ThemeSwitcher from './ThemeSwitcher';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { canAccess, isAdmin, isStaff, notificationsPathFor, roleLabel } from '../auth/roles';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  
  // Navigation system integration
  const { toggleDrawer } = useNavigation();
  const { shouldShowDrawer, shouldShowBottomTabs } = useNavigationBreakpoint();

  const role = user?.role;
  const staff = isStaff(role);
  const displayName = user?.name || [(user as any)?.firstName, (user as any)?.lastName].filter(Boolean).join(' ') || user?.email || '';
  const roleName = roleLabel(role);

  // Unread count for the bell. GET /notifications is scoped to the caller.
  const { data: unread } = useQuery({
    queryKey: ['header-unread-notifications', user?.id],
    queryFn: async () => {
      const res = await api.get('/notifications', { params: { page: 1, limit: 1 } });
      const n = Number(res.data?.unread);
      return Number.isFinite(n) ? n : 0;
    },
    enabled: !!user,
    staleTime: 60_000,
    retry: false,
  });

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    logout();
    navigate('/login');
  };

  const handleProfile = () => {
    handleClose();
    navigate('/profile');
  };

  return (
    <AppBar 
      position="fixed" 
      sx={{ 
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
      elevation={0}
    >
      <Toolbar>
        {/* Menu toggle button for tablet drawer */}
        {(shouldShowDrawer || shouldShowBottomTabs) && (
          <IconButton
            color="inherit"
            aria-label="open navigation drawer"
            edge="start"
            onClick={toggleDrawer}
            sx={{ mr: { xs: 1, sm: 2 } }}
          >
            <MenuIcon />
          </IconButton>
        )}
        
        <Typography 
          variant="h6" 
          noWrap 
          component="div" 
          sx={{
            flexGrow: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            fontWeight: 700,
            fontSize: { xs: '1rem', sm: '1.15rem' },
          }}
        >
          <Box
            component="span"
            aria-hidden
            sx={{
              flexShrink: 0,
              width: 30,
              height: 30,
              borderRadius: '9px',
              bgcolor: 'primary.main',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontSize: '1rem',
              fontWeight: 800,
              boxShadow: '0 6px 14px -6px rgba(21,84,224,0.6)',
            }}
          >
            P
          </Box>
          {staff ? (
            <>
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Property AI Agent Dashboard</Box>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Property AI Agent</Box>
            </>
          ) : `${roleName} Portal`}
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0, sm: 1 }, flexShrink: 0 }}>
          {/* Search Icon (staff only) */}
          {staff && (
            <Tooltip title="Search">
              <IconButton color="inherit" size="large" aria-label="Search" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
                <SearchIcon />
              </IconButton>
            </Tooltip>
          )}
          
          {/* Theme Switcher */}
          <ThemeSwitcher />
          
          {/* Notifications */}
          <Tooltip title="Notifications">
            <IconButton
              color="inherit"
              size="large"
              component={RouterLink}
              to={notificationsPathFor(role)}
              aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
            >
              <Badge badgeContent={unread || 0} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          
          {/* Quick Access Links */}
          {staff && canAccess(role, '/rentals') && (
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, ml: 2 }}>
            <Tooltip title="Rental Listings">
              <IconButton 
                color="inherit" 
                component={RouterLink} 
                to="/rentals"
                size="small"
              >
                <Typography variant="body2">Rentals</Typography>
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Tenant Screening">
              <IconButton 
                color="inherit" 
                component={RouterLink} 
                to="/tenant-screening"
                size="small"
              >
                <Typography variant="body2">Screening</Typography>
              </IconButton>
            </Tooltip>
          </Box>
          )}

          {/* Who is signed in */}
          {user && (
            <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right', ml: 1, lineHeight: 1.1 }} data-testid="header-user">
              <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
                {displayName}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85, lineHeight: 1.2 }} data-testid="header-role">
                {roleName}
              </Typography>
            </Box>
          )}
          
          {/* User Menu */}
          <IconButton
            onClick={handleClick}
            size="small"
            sx={{ ml: 1 }}
            aria-label="Account menu"
            aria-controls={open ? 'account-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={open ? 'true' : undefined}
          >
            {user?.name ? (
              <Avatar sx={{ width: 32, height: 32 }}>
                {user.name.charAt(0).toUpperCase()}
              </Avatar>
            ) : (
              <AccountCircleIcon />
            )}
          </IconButton>
        </Box>
        
        <Menu
          anchorEl={anchorEl}
          id="account-menu"
          open={open}
          onClose={handleClose}
          onClick={handleClose}
          PaperProps={{
            elevation: 0,
            sx: {
              overflow: 'visible',
              filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
              mt: 1.5,
              '& .MuiAvatar-root': {
                width: 32,
                height: 32,
                ml: -0.5,
                mr: 1,
              },
              '&:before': {
                content: '""',
                display: 'block',
                position: 'absolute',
                top: 0,
                right: 14,
                width: 10,
                height: 10,
                bgcolor: 'background.paper',
                transform: 'translateY(-50%) rotate(45deg)',
                zIndex: 0,
              },
            },
          }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          {user && (
            <Box sx={{ px: 2, py: 1, minWidth: 200 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{displayName}</Typography>
              {user.email && (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{user.email}</Typography>
              )}
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700 }} data-testid="menu-role">
                {roleName}
              </Typography>
            </Box>
          )}
          <Divider />
          {staff && (
            <MenuItem onClick={handleProfile}>
              <Avatar /> Profile
            </MenuItem>
          )}
          {isAdmin(role) && (
            <MenuItem component={RouterLink} to="/security-settings" onClick={handleClose}>
              Settings
            </MenuItem>
          )}
          <Divider />
          <MenuItem onClick={handleLogout}>Logout</MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
