import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  GridLegacy as Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Switch,
  FormControlLabel,
  FormGroup,
  Divider,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Tooltip
} from '@mui/material';
import {
  Security as SecurityIcon,
  DeviceHub as DeviceIcon,
  Notifications as NotificationsIcon,
  LocationOn as LocationIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Shield as ShieldIcon,
  Computer as ComputerIcon,
  Smartphone as SmartphoneIcon,
  Tablet as TabletIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon
} from '@mui/icons-material';

interface Device {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'tablet';
  lastAccess: string;
  location: string;
  trusted: boolean;
}

interface LoginAttempt {
  id: string;
  timestamp: string;
  location: string;
  success: boolean;
  ipAddress: string;
}

interface NotificationSettings {
  loginAlerts: boolean;
  deviceChanges: boolean;
  securityUpdates: boolean;
  suspiciousActivity: boolean;
  weeklyReports: boolean;
}

/**
 * Device and sign-in history are sample data until session tracking is wired to
 * the API. Timestamps are generated relative to now so the page never looks stale.
 */
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
const fmtWhen = (d: Date) =>
  d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtAgo = (d: Date) => {
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const days = Math.round(h / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const SecuritySettingsDashboard: React.FC = () => {
  const [securityLevel, setSecurityLevel] = useState(75);
  const [devices, setDevices] = useState<Device[]>([
    {
      id: '1',
      name: 'MacBook Pro (office)',
      type: 'desktop',
      lastAccess: fmtAgo(minutesAgo(125)),
      location: 'San Francisco, CA',
      trusted: true
    },
    {
      id: '2',
      name: 'iPhone 14',
      type: 'mobile',
      lastAccess: fmtAgo(minutesAgo(26 * 60)),
      location: 'San Francisco, CA',
      trusted: true
    },
    {
      id: '3',
      name: 'Windows PC (Chrome)',
      type: 'desktop',
      lastAccess: fmtAgo(minutesAgo(3 * 24 * 60 + 40)),
      location: 'New York, NY',
      trusted: false
    }
  ]);
  
  const [loginAttempts] = useState<LoginAttempt[]>([
    {
      id: '1',
      timestamp: fmtWhen(minutesAgo(125)),
      location: 'San Francisco, CA',
      success: true,
      ipAddress: '192.168.1.1'
    },
    {
      id: '2',
      timestamp: fmtWhen(minutesAgo(26 * 60)),
      location: 'San Francisco, CA',
      success: true,
      ipAddress: '192.168.1.1'
    },
    {
      id: '3',
      timestamp: fmtWhen(minutesAgo(3 * 24 * 60 + 40)),
      location: 'New York, NY',
      success: false,
      ipAddress: '203.0.113.1'
    }
  ]);
  
  const [notifications, setNotifications] = useState<NotificationSettings>({
    loginAlerts: true,
    deviceChanges: true,
    securityUpdates: true,
    suspiciousActivity: true,
    weeklyReports: false
  });
  
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const saveDevice = () => {
    if (selectedDevice) setDevices((prev) => prev.map((d) => (d.id === selectedDevice.id ? selectedDevice : d)));
    setDeviceDialogOpen(false);
  };

  const getSecurityLevelColor = (level: number) => {
    if (level >= 80) return 'success';
    if (level >= 60) return 'warning';
    return 'error';
  };

  const getSecurityLevelText = (level: number) => {
    if (level >= 80) return 'Strong';
    if (level >= 60) return 'Moderate';
    return 'Weak';
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <SmartphoneIcon />;
      case 'tablet':
        return <TabletIcon />;
      default:
        return <ComputerIcon />;
    }
  };

  const handleDeviceAction = (device: Device, action: 'edit' | 'delete') => {
    if (action === 'edit') {
      setSelectedDevice(device);
      setDeviceDialogOpen(true);
    } else {
      setDevices(devices.filter(d => d.id !== device.id));
    }
  };

  const handleNotificationChange = (setting: keyof NotificationSettings) => {
    setNotifications(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 3 }, px: { xs: 2, md: 3 } }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 800, fontSize: { xs: '1.6rem', md: '2.125rem' } }}>
        Security Settings
      </Typography>
      <Typography sx={{ color: 'text.secondary', mb: 3 }}>
        Review sign-ins and devices on your account and choose which security alerts you receive.
      </Typography>

      <Grid container spacing={3}>
        {/* Account Security Level */}
        <Grid item xs={12}>
          <Card sx={{ p: { xs: 2, md: 3 } }}>
            <Box display="flex" alignItems="center" mb={3}>
              <ShieldIcon sx={{ mr: 2, color: 'primary.main' }} />
              <Typography variant="h6" component="h2" fontWeight={800}>
                Account Security Level
              </Typography>
            </Box>
            
            <Box sx={{ mb: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body1" color="text.secondary">
                  Current Security Level: {getSecurityLevelText(securityLevel)}
                </Typography>
                <Chip 
                  label={`${securityLevel}%`} 
                  color={getSecurityLevelColor(securityLevel) as any}
                  variant="filled"
                />
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={securityLevel} 
                color={getSecurityLevelColor(securityLevel) as any}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
            
            <Typography variant="body2" color="text.secondary">
              Strong password and verified email are in place. Turn on two-factor authentication and review unrecognised devices to reach Strong.
            </Typography>
          </Card>
        </Grid>

        {/* Login Attempts */}
        <Grid item xs={12}>
          <Card sx={{ p: { xs: 2, md: 3 } }}>
            <Box display="flex" alignItems="center" mb={3}>
              <LocationIcon sx={{ mr: 2, color: 'primary.main' }} />
              <Typography variant="h6" component="h2" fontWeight={800}>
                Sign-in Activity
              </Typography>
            </Box>
            
            {/* Recent Login Attempts Table */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Recent sign-ins to your account. Sample history until session tracking is connected.
            </Typography>
            <TableContainer>
              <Table size="small" sx={{ minWidth: 560 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>IP Address</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loginAttempts.map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{attempt.timestamp}</TableCell>
                      <TableCell>{attempt.location}</TableCell>
                      <TableCell>{attempt.ipAddress}</TableCell>
                      <TableCell>
                        <Chip
                          icon={attempt.success ? <CheckCircleIcon /> : <WarningIcon />}
                          label={attempt.success ? 'Success' : 'Failed'}
                          color={attempt.success ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>

        {/* Authorized Devices */}
        <Grid item xs={12}>
          <Card sx={{ p: { xs: 2, md: 3 } }}>
            <Box display="flex" alignItems="center" mb={3}>
              <DeviceIcon sx={{ mr: 2, color: 'primary.main' }} />
              <Typography variant="h6" component="h2" fontWeight={800}>
                Authorized Devices
              </Typography>
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Devices that have signed in to your account. Remove any you don't recognise.
            </Typography>
            
            <List>
              {devices.map((device, index) => (
                <React.Fragment key={device.id}>
                  <ListItem sx={{ px: 0, pr: 12 }}>
                    <Avatar sx={{ mr: 2, bgcolor: device.trusted ? 'success.main' : 'warning.main' }}>
                      {getDeviceIcon(device.type)}
                    </Avatar>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{device.name}</Typography>
                          {!device.trusted && (
                            <Chip label="Unverified" color="warning" size="small" />
                          )}
                        </Box>
                      }
                      secondary={
                        <Typography variant="body2" color="text.secondary">
                          Last access: {device.lastAccess} • {device.location}
                        </Typography>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title="Edit Device">
                        <IconButton 
                          edge="end" 
                          onClick={() => handleDeviceAction(device, 'edit')}
                          sx={{ mr: 1 }}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove Device">
                        <IconButton 
                          edge="end" 
                          onClick={() => handleDeviceAction(device, 'delete')}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < devices.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Card>
        </Grid>

        {/* Notification Preferences */}
        <Grid item xs={12}>
          <Card sx={{ p: { xs: 2, md: 3 } }}>
            <Box display="flex" alignItems="center" mb={3}>
              <NotificationsIcon sx={{ mr: 2, color: 'primary.main' }} />
              <Typography variant="h6" component="h2" fontWeight={800}>
                Notification Preferences
              </Typography>
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choose which account activity sends you an alert.
            </Typography>
            
            <FormGroup>
              <FormControlLabel
                sx={{ alignItems: 'flex-start', mb: 1.5, mx: 0, gap: 1.5 }}
                control={
                  <Switch
                    checked={notifications.loginAlerts}
                    onChange={() => handleNotificationChange('loginAlerts')}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="subtitle1">Login Alerts</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Get notified when someone logs into your account
                    </Typography>
                  </Box>
                }
              />
              
              <FormControlLabel
                sx={{ alignItems: 'flex-start', mb: 1.5, mx: 0, gap: 1.5 }}
                control={
                  <Switch
                    checked={notifications.deviceChanges}
                    onChange={() => handleNotificationChange('deviceChanges')}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="subtitle1">Device Changes</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Alerts when new devices are added or removed
                    </Typography>
                  </Box>
                }
              />
              
              <FormControlLabel
                sx={{ alignItems: 'flex-start', mb: 1.5, mx: 0, gap: 1.5 }}
                control={
                  <Switch
                    checked={notifications.securityUpdates}
                    onChange={() => handleNotificationChange('securityUpdates')}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="subtitle1">Security Updates</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Important security announcements and updates
                    </Typography>
                  </Box>
                }
              />
              
              <FormControlLabel
                sx={{ alignItems: 'flex-start', mb: 1.5, mx: 0, gap: 1.5 }}
                control={
                  <Switch
                    checked={notifications.suspiciousActivity}
                    onChange={() => handleNotificationChange('suspiciousActivity')}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="subtitle1">Suspicious Activity</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Immediate alerts for unusual account activity
                    </Typography>
                  </Box>
                }
              />
              
              <FormControlLabel
                sx={{ alignItems: 'flex-start', mb: 1.5, mx: 0, gap: 1.5 }}
                control={
                  <Switch
                    checked={notifications.weeklyReports}
                    onChange={() => handleNotificationChange('weeklyReports')}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="subtitle1">Weekly Security Reports</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Summary of account activity and security status
                    </Typography>
                  </Box>
                }
              />
            </FormGroup>
          </Card>
        </Grid>
      </Grid>

      {/* Device Edit Dialog */}
      <Dialog open={deviceDialogOpen} onClose={() => setDeviceDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Device</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Device Name"
            fullWidth
            variant="outlined"
            value={selectedDevice?.name ?? ''}
            onChange={(e) => selectedDevice && setSelectedDevice({ ...selectedDevice, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={!!selectedDevice?.trusted}
                onChange={(e) => selectedDevice && setSelectedDevice({ ...selectedDevice, trusted: e.target.checked })}
                color="primary"
              />
            }
            label="Mark as trusted device"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeviceDialogOpen(false)}>Cancel</Button>
          <Button onClick={saveDevice} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SecuritySettingsDashboard;
