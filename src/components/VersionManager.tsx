import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Box,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  Divider,
  Avatar,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  Share as ShareIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Person as PersonIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import { apiCall } from '../utils/api';

interface Version {
  id: number;
  name: string;
  description: string;
  is_active: number;
  created_at: string;
  owner_name?: string;
  owner_email?: string;
  shared_at?: string;
  shared_with_name?: string;
  shared_with_email?: string;
}

interface User {
  id: number;
  name: string;
  email: string;
}

interface VersionManagerProps {
  open: boolean;
  onClose: () => void;
  onVersionChange: () => void;
}

const VersionManager: React.FC<VersionManagerProps> = ({ open, onClose, onVersionChange }) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [sharedVersions, setSharedVersions] = useState<Version[]>([]);
  const [sharedByMe, setSharedByMe] = useState<Version[]>([]);
  const [activeVersion, setActiveVersion] = useState<Version | null>(null);
  const [defaultVersion, setDefaultVersion] = useState<Version | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<Version | null>(null);
  const [sharingVersion, setSharingVersion] = useState<Version | null>(null);
  
  // Form states
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionDescription, setNewVersionDescription] = useState('');
  const [copyFromVersion, setCopyFromVersion] = useState<number | ''>('');
  const [shareEmail, setShareEmail] = useState('');
  
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        versionsResponse, 
        activeVersionResponse, 
        defaultVersionResponse,
        sharedVersionsResponse,
        sharedByMeResponse,
        usersResponse
      ] = await Promise.all([
        apiCall('/versions'),
        apiCall('/versions/active'),
        apiCall('/versions/default'),
        apiCall('/versions/shared'),
        apiCall('/versions/shared-by-me'),
        apiCall('/users')
      ]);
      
      const versionsData = await versionsResponse.json();
      const activeVersionData = await activeVersionResponse.json();
      const defaultVersionData = await defaultVersionResponse.json();
      const sharedVersionsData = await sharedVersionsResponse.json();
      const sharedByMeData = await sharedByMeResponse.json();
      const usersData = await usersResponse.json();
      
      setVersions(versionsData);
      setActiveVersion(activeVersionData);
      setDefaultVersion(defaultVersionData);
      setSharedVersions(sharedVersionsData);
      setSharedByMe(sharedByMeData);
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading data:', error);
      showSnackbar('Error loading data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!newVersionName.trim()) {
      showSnackbar('Version name is required', 'error');
      return;
    }

    try {
      const payload: any = {
        name: newVersionName.trim(),
        description: newVersionDescription.trim() || null
      };

      if (copyFromVersion) {
        payload.copyFromVersionId = copyFromVersion;
      }

      await apiCall('/versions', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      showSnackbar('Version created successfully', 'success');
      setCreateDialogOpen(false);
      resetForm();
      loadData();
      onVersionChange();
    } catch (error) {
      console.error('Error creating version:', error);
      showSnackbar('Error creating version', 'error');
    }
  };

  const handleActivateVersion = async (versionId: number) => {
    try {
      await apiCall(`/versions/${versionId}/activate`, {
        method: 'PUT'
      });
      
      // Trigger data refresh by calling the onVersionChange callback
      if (onVersionChange) {
        onVersionChange();
      }
      
      // Close the modal
      onClose();
      
      // Navigate to dashboard
      navigate('/');
    } catch (error) {
      console.error('Error activating version:', error);
      showSnackbar('Error activating version', 'error');
    }
  };

  const handleSetDefaultVersion = async (versionId: number) => {
    try {
      await apiCall(`/versions/${versionId}/set-default`, {
        method: 'PUT'
      });
      showSnackbar('Default version set successfully', 'success');
      loadData();
    } catch (error) {
      console.error('Error setting default version:', error);
      showSnackbar('Error setting default version', 'error');
    }
  };

  const handleEditVersion = async () => {
    if (!editingVersion || !newVersionName.trim()) {
      showSnackbar('Version name is required', 'error');
      return;
    }

    try {
      await apiCall(`/versions/${editingVersion.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: newVersionName.trim(),
          description: newVersionDescription.trim() || null
        })
      });
      
      showSnackbar('Version updated successfully', 'success');
      setEditDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error updating version:', error);
      showSnackbar('Error updating version', 'error');
    }
  };

  const handleDeleteVersion = async (version: Version) => {
    if (version.is_active) {
      showSnackbar('Cannot delete the active version. Switch to another version first.', 'error');
      return;
    }

    if (versions.length <= 1) {
      showSnackbar('Cannot delete the only version. Create a new version first.', 'error');
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${version.name}"? This action cannot be undone.`)) {
      try {
        await apiCall(`/versions/${version.id}`, {
          method: 'DELETE'
        });
        showSnackbar('Version deleted successfully', 'success');
        loadData();
      } catch (error) {
        console.error('Error deleting version:', error);
        showSnackbar('Error deleting version', 'error');
      }
    }
  };

  const handleShareVersion = async () => {
    if (!sharingVersion || !shareEmail.trim()) {
      showSnackbar('Please enter an email address', 'error');
      return;
    }

    // Check if the email exists in the users list
    const targetUser = users.find(user => user.email.toLowerCase() === shareEmail.trim().toLowerCase());
    if (!targetUser) {
      showSnackbar('User not found. Please enter a valid email address.', 'error');
      return;
    }

    try {
      await apiCall(`/versions/${sharingVersion.id}/share`, {
        method: 'POST',
        body: JSON.stringify({ email: shareEmail.trim() })
      });
      
      showSnackbar('Version shared successfully', 'success');
      setShareDialogOpen(false);
      setShareEmail('');
      setSharingVersion(null);
      loadData();
    } catch (error) {
      console.error('Error sharing version:', error);
      showSnackbar('Error sharing version', 'error');
    }
  };

  const handleUnshareVersion = async (versionId: number, email: string) => {
    try {
      await apiCall(`/versions/${versionId}/share/${encodeURIComponent(email)}`, {
        method: 'DELETE'
      });
      showSnackbar('Version unshared successfully', 'success');
      loadData();
    } catch (error) {
      console.error('Error unsharing version:', error);
      showSnackbar('Error unsharing version', 'error');
    }
  };

  const openEditDialog = (version: Version) => {
    setEditingVersion(version);
    setNewVersionName(version.name);
    setNewVersionDescription(version.description || '');
    setEditDialogOpen(true);
  };

  const openShareDialog = (version: Version) => {
    setSharingVersion(version);
    setShareEmail('');
    setShareDialogOpen(true);
  };

  const resetForm = () => {
    setNewVersionName('');
    setNewVersionDescription('');
    setCopyFromVersion('');
    setEditingVersion(null);
    setSharingVersion(null);
    setShareEmail('');
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderVersionItem = (version: Version, showActions = true, isShared = false) => {
    return (
      <ListItem key={version.id} divider className="list-item">
        <ListItemText
          primary={
            <Box display="flex" alignItems="center" gap={1} position="relative">
              <Box 
                position="relative" 
                display="flex" 
                alignItems="center"
                sx={{
                  '&:hover': {
                    '& .hover-tick': {
                      opacity: 1,
                      transform: 'scale(1)',
                      animation: 'pulse 0.6s ease-in-out'
                    }
                  }
                }}
              >
                {defaultVersion?.id === version.id && (
                  <StarIcon 
                    sx={{ 
                      color: 'secondary.main', 
                      fontSize: '20px',
                      mr: 0.5
                    }} 
                  />
                )}
                <Typography 
                  variant="subtitle1" 
                  sx={{ 
                    cursor: !version.is_active ? 'pointer' : 'default',
                    textDecoration: !version.is_active ? 'underline' : 'none',
                    '&:hover': !version.is_active ? { color: 'primary.main' } : {}
                  }}
                  onClick={() => !version.is_active && handleActivateVersion(version.id)}
                >
                  {version.name}
                </Typography>
                {version.is_active === 1 && (
                  <Box
                    className="active-tick"
                    sx={{
                      position: 'absolute',
                      top: -6,
                      left: -6,
                      width: 32,
                      height: 32,
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'flex-start',
                      zIndex: 1,
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: 0,
                        height: 0,
                        borderStyle: 'solid',
                        borderWidth: '32px 32px 0 0',
                        borderColor: '#4caf50 transparent transparent transparent',
                      }}
                    />
                    <CheckIcon 
                      sx={{ 
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        fontSize: '20px',
                        color: 'white',
                        filter: 'drop-shadow(0 0 2px #388e3c)'
                      }} 
                    />
                  </Box>
                )}
                {version.is_active !== 1 && (
                  <Box
                    className="hover-tick"
                    sx={{
                      position: 'absolute',
                      top: -6,
                      left: -6,
                      width: 32,
                      height: 32,
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'flex-start',
                      zIndex: 1,
                      opacity: 0,
                      transform: 'scale(0.3)',
                      transition: 'opacity 0.3s ease, transform 0.3s ease',
                      '@keyframes pulse': {
                        '0%': { transform: 'scale(0.3)' },
                        '50%': { transform: 'scale(1.1)' },
                        '100%': { transform: 'scale(1)' }
                      },
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: 0,
                        height: 0,
                        borderStyle: 'solid',
                        borderWidth: '32px 32px 0 0',
                        borderColor: '#4caf50 transparent transparent transparent',
                      }}
                    />
                    <CheckIcon 
                      sx={{ 
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        fontSize: '20px',
                        color: 'white',
                        filter: 'drop-shadow(0 0 2px #388e3c)'
                      }} 
                    />
                  </Box>
                )}
              </Box>
              {isShared && version.owner_name && (
                <Chip
                  label={`Shared by ${version.owner_name}`}
                  color="info"
                  size="small"
                  icon={<PersonIcon />}
                />
              )}
            </Box>
          }
          secondary={
            <Box>
              <Typography variant="body2" color="textSecondary">
                {version.description || 'No description'}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Created: {formatDate(version.created_at)}
                {version.shared_at && ` • Shared: ${formatDate(version.shared_at)}`}
              </Typography>
            </Box>
          }
        />
        {showActions && (
          <ListItemSecondaryAction>
            <Box display="flex" gap={1}>
              {defaultVersion?.id !== version.id && (
                <Tooltip title="Set as default">
                  <IconButton
                    edge="end"
                    onClick={() => handleSetDefaultVersion(version.id)}
                  >
                    <StarBorderIcon />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Share version">
                <IconButton
                  edge="end"
                  onClick={() => openShareDialog(version)}
                >
                  <ShareIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit version">
                <IconButton
                  edge="end"
                  onClick={() => openEditDialog(version)}
                >
                  <EditIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete version">
                <span>
                  <IconButton
                    edge="end"
                    onClick={() => handleDeleteVersion(version)}
                    disabled={!!version.is_active}
                  >
                    <DeleteIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </ListItemSecondaryAction>
        )}
      </ListItem>
    );
  };

  const renderSharedByMeItem = (version: Version) => (
    <ListItem key={`${version.id}-${version.shared_with_email}`} divider>
      <ListItemText
        primary={
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="subtitle1">{version.name}</Typography>
            <Chip
              label={`Shared with ${version.shared_with_name}`}
              color="info"
              size="small"
              icon={<GroupIcon />}
            />
          </Box>
        }
        secondary={
          <Box>
            <Typography variant="body2" color="textSecondary">
              {version.description || 'No description'}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Shared: {formatDate(version.shared_at || '')}
            </Typography>
          </Box>
        }
      />
      <ListItemSecondaryAction>
        <Tooltip title="Unshare version">
          <IconButton
            edge="end"
            onClick={() => handleUnshareVersion(version.id, version.shared_with_email || '')}
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </ListItemSecondaryAction>
    </ListItem>
  );

  return (
    <>
      <style>
        {`
          .version-list:hover .active-tick {
            opacity: 0 !important;
          }
          .version-list .list-item:hover .active-tick {
            opacity: 1 !important;
          }
        `}
      </style>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Budget Versions</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              New Version
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          {loading ? (
            <Typography>Loading versions...</Typography>
          ) : (
            <Box className="version-list">
              <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
                <Tab label={`My Versions (${versions.length})`} />
                <Tab label={`Shared with Me (${sharedVersions.length})`} />
                <Tab label={`Shared by Me (${sharedByMe.length})`} />
              </Tabs>
              
              <Box mt={2}>
                {activeTab === 0 && (
                  <List>
                    {versions.map((version) => renderVersionItem(version))}
                  </List>
                )}
                
                {activeTab === 1 && (
                  <List>
                    {sharedVersions.length === 0 ? (
                      <ListItem>
                        <ListItemText 
                          primary="No shared versions" 
                          secondary="Versions shared with you by other users will appear here"
                        />
                      </ListItem>
                    ) : (
                      sharedVersions.map((version) => renderVersionItem(version, false, true))
                    )}
                  </List>
                )}
                
                {activeTab === 2 && (
                  <List>
                    {sharedByMe.length === 0 ? (
                      <ListItem>
                        <ListItemText 
                          primary="No shared versions" 
                          secondary="Versions you've shared with other users will appear here"
                        />
                      </ListItem>
                    ) : (
                      sharedByMe.map((version) => renderSharedByMeItem(version))
                    )}
                  </List>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create Version Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Version</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Version Name"
            fullWidth
            value={newVersionName}
            onChange={(e) => setNewVersionName(e.target.value)}
            required
          />
          <TextField
            margin="dense"
            label="Description (optional)"
            fullWidth
            multiline
            rows={3}
            value={newVersionDescription}
            onChange={(e) => setNewVersionDescription(e.target.value)}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Copy from existing version (optional)</InputLabel>
            <Select
              value={copyFromVersion === '' ? '' : String(copyFromVersion)}
              onChange={(e) => setCopyFromVersion(e.target.value === '' ? '' : Number(e.target.value))}
              label="Copy from existing version (optional)"
              displayEmpty
            >
              <MenuItem value="">
                <em>Start blank</em>
              </MenuItem>
              {versions.map((version) => (
                <MenuItem key={version.id} value={String(version.id)}>
                  {version.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateVersion} variant="contained">
            Create Version
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Version Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Version</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Version Name"
            fullWidth
            value={newVersionName}
            onChange={(e) => setNewVersionName(e.target.value)}
            required
          />
          <TextField
            margin="dense"
            label="Description (optional)"
            fullWidth
            multiline
            rows={3}
            value={newVersionDescription}
            onChange={(e) => setNewVersionDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditVersion} variant="contained">
            Update Version
          </Button>
        </DialogActions>
      </Dialog>

      {/* Share Version Dialog */}
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Share Version</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Share "{sharingVersion?.name}" with another user
          </Typography>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            placeholder="Enter email address"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            variant="outlined"
            size="small"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleShareVersion} variant="contained" disabled={!shareEmail}>
            Share Version
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default VersionManager; 