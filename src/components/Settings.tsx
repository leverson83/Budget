import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Checkbox,
  FormControlLabel,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Snackbar,
  IconButton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { Add as AddIcon } from '@mui/icons-material';
import { useSettings } from '../contexts/SettingsContext';

const API_URL = 'http://localhost:3001/api';

interface Tag {
  id: string;
  name: string;
  color?: string;
}

interface TagWithUsage extends Tag {
  usageCount: number;
}

interface Account {
  id: number;
  name: string;
  bank: string;
  currentBalance: number;
  requiredBalance: number;
  isPrimary: boolean;
  diff: number;
}

const predefinedColors = [
  '#1976d2', '#9c27b0', '#2e7d32', '#f57c00', '#c2185b',
  '#00838f', '#7b1fa2', '#d32f2f', '#5d4037', '#455a64',
  '#388e3c', '#fbc02d', '#0288d1', '#e64a19', '#6d4c41',
  '#512da8', '#0097a7', '#afb42b', '#f06292', '#8d6e63',
  '#00bcd4', '#ffb300', '#43a047', '#e53935', '#8e24aa',
];

const getTagColor = (tag: string) => {
  const index = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return predefinedColors[index % predefinedColors.length];
};

const Settings = () => {
  const [tags, setTags] = useState<TagWithUsage[]>([]);
  const [loading, setLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deletingTag, setDeletingTag] = useState<TagWithUsage | null>(null);
  const [editForm, setEditForm] = useState({ name: '', color: '', useCustomColor: false });
  const { showPlanningPage, showSchedulePage, showAccountsPage, updateSettings } = useSettings();

  // Accounts state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountEditDialogOpen, setAccountEditDialogOpen] = useState(false);
  const [accountDeleteDialogOpen, setAccountDeleteDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [accountForm, setAccountForm] = useState<Partial<Account>>({
    name: '',
    bank: '',
    currentBalance: 0,
    requiredBalance: 0,
    isPrimary: false,
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  useEffect(() => {
    fetchTags();
    fetchAccounts();
  }, []);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const [tagsResponse, expensesResponse] = await Promise.all([
        fetch(`${API_URL}/tags`),
        fetch(`${API_URL}/expenses`)
      ]);

      if (tagsResponse.ok && expensesResponse.ok) {
        const tagsData = await tagsResponse.json();
        const expensesData = await expensesResponse.json();

        const tagUsage: { [key: string]: number } = {};
        expensesData.forEach((expense: any) => {
          if (expense.tags) {
            expense.tags.forEach((tag: string) => {
              tagUsage[tag] = (tagUsage[tag] || 0) + 1;
            });
          }
        });

        const tagsWithUsage = tagsData.map((tag: { name: string; color?: string }) => ({
          id: tag.name,
          name: tag.name,
          usageCount: tagUsage[tag.name] || 0,
          color: tag.color || getTagColor(tag.name)
        }));

        const sortedTags = tagsWithUsage.sort((a: TagWithUsage, b: TagWithUsage) => b.usageCount - a.usageCount);
        setTags(sortedTags);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      setAccountsLoading(true);
      const response = await fetch(`${API_URL}/accounts`);
      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }
      const data = await response.json();
      setAccounts(data);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setAccountsLoading(false);
    }
  };

  const handlePlanningPageChange = (checked: boolean) => {
    updateSettings(checked, showSchedulePage, showAccountsPage);
  };

  const handleSchedulePageChange = (checked: boolean) => {
    updateSettings(showPlanningPage, checked, showAccountsPage);
  };

  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setEditForm({
      name: tag.name,
      color: tag.color || getTagColor(tag.name),
      useCustomColor: !!tag.color
    });
    setEditDialogOpen(true);
  };

  const handleDeleteTag = (tag: TagWithUsage) => {
    setDeletingTag(tag);
    setDeleteDialogOpen(true);
  };

  const saveTagEdit = async () => {
    if (!editingTag || !editForm.name.trim()) return;

    try {
      const color = editForm.color || null;
      
      const response = await fetch(`${API_URL}/tags/${editingTag.name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editForm.name, color })
      });

      if (!response.ok) {
        throw new Error('Failed to update tag');
      }

      await fetchTags();
      setEditDialogOpen(false);
      setEditingTag(null);
    } catch (error) {
      console.error('Error updating tag:', error);
    }
  };

  const confirmDeleteTag = async () => {
    if (!deletingTag) return;

    try {
      const response = await fetch(`${API_URL}/tags/${deletingTag.name}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete tag');
      }

      await fetchTags();
      setDeleteDialogOpen(false);
      setDeletingTag(null);
    } catch (error) {
      console.error('Error deleting tag:', error);
    }
  };

  const handleAccountEdit = (account: Account) => {
    setEditingAccount(account);
    setAccountForm({
      name: account.name,
      bank: account.bank,
      currentBalance: account.currentBalance,
      requiredBalance: account.requiredBalance,
      isPrimary: account.isPrimary,
    });
    setAccountEditDialogOpen(true);
  };

  const handleAccountDelete = (account: Account) => {
    setDeletingAccount(account);
    setAccountDeleteDialogOpen(true);
  };

  const handleAccountSubmit = async () => {
    try {
      const url = editingAccount
        ? `${API_URL}/accounts/${editingAccount.id}`
        : `${API_URL}/accounts`;
      const method = editingAccount ? 'PUT' : 'POST';

      const diff = (accountForm.currentBalance || 0) - (accountForm.requiredBalance || 0);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...accountForm,
          diff: diff
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save account');
      }

      await fetchAccounts();
      setAccountEditDialogOpen(false);
      setEditingAccount(null);
      setSnackbar({
        open: true,
        message: `Account ${editingAccount ? 'updated' : 'added'} successfully`,
      });
    } catch (error) {
      console.error('Error saving account:', error);
    }
  };

  const handleAccountDeleteConfirm = async () => {
    if (!deletingAccount) return;

    try {
      const response = await fetch(`${API_URL}/accounts/${deletingAccount.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      await fetchAccounts();
      setSnackbar({
        open: true,
        message: 'Account deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting account:', error);
    } finally {
      setAccountDeleteDialogOpen(false);
      setDeletingAccount(null);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      <List>
        <ListItem>
          <Accordion sx={{ width: '100%' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', textDecoration: 'underline' }}>
                Accounts
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {accountsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Manage Accounts
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        setEditingAccount(null);
                        setAccountForm({
                          name: '',
                          bank: '',
                          currentBalance: 0,
                          requiredBalance: 0,
                          isPrimary: false,
                        });
                        setAccountEditDialogOpen(true);
                      }}
                    >
                      Add Account
                    </Button>
                  </Box>
                  <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell>Bank</TableCell>
                          <TableCell align="center">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {accounts.map((account) => (
                          <TableRow key={account.id}>
                            <TableCell>{account.name}</TableCell>
                            <TableCell>{account.bank}</TableCell>
                            <TableCell align="center">
                              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleAccountEdit(account)}
                                  color="primary"
                                >
                                  <EditIcon />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => handleAccountDelete(account)}
                                  color="error"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                        {accounts.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} align="center">
                              <Typography color="text.secondary">
                                No accounts found. Add your first account to get started.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        </ListItem>
        
        <ListItem>
          <Accordion sx={{ width: '100%' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', textDecoration: 'underline' }}>
                Tags
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {loading ? (
                <Typography>Loading tags...</Typography>
              ) : (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Manage Tags
                  </Typography>
                  <List>
                    {tags.map((tag) => (
                      <ListItem key={tag.id} sx={{ border: '1px solid #e0e0e0', borderRadius: 1, mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Chip
                              label={tag.name}
                              sx={{
                                backgroundColor: tag.color || getTagColor(tag.name),
                                color: '#ffffff',
                                fontWeight: 'medium'
                              }}
                            />
                            <Typography 
                              variant="caption" 
                              color={tag.usageCount === 0 ? 'error' : 'text.secondary'}
                            >
                              Used in {tag.usageCount} expense{tag.usageCount !== 1 ? 's' : ''}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton
                              size="small"
                              onClick={() => handleEditTag(tag)}
                              color="primary"
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteTag(tag)}
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </Box>
                      </ListItem>
                    ))}
                    {tags.length === 0 && (
                      <Typography color="text.secondary">
                        No tags found. Tags will appear here when you create them in the Expenses page.
                      </Typography>
                    )}
                  </List>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        </ListItem>
        
        <ListItem>
          <Accordion sx={{ width: '100%' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', textDecoration: 'underline' }}>
                Advanced Settings
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box>
                <Typography variant="h6" gutterBottom>
                  Page Visibility
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={showPlanningPage}
                        onChange={(e) => handlePlanningPageChange(e.target.checked)}
                      />
                    }
                    label="Show Planning page"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={showSchedulePage}
                        onChange={(e) => handleSchedulePageChange(e.target.checked)}
                      />
                    }
                    label="Show Schedule page"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={showAccountsPage}
                        onChange={(e) => updateSettings(showPlanningPage, showSchedulePage, e.target.checked)}
                      />
                    }
                    label="Show Accounts page"
                  />
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        </ListItem>
      </List>

      {/* Edit Tag Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Tag</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Tag Name"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              fullWidth
            />
            <Typography variant="subtitle1" gutterBottom>
              Tag Color
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Choose from predefined colors:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {predefinedColors.map((color) => (
                    <Box
                      key={color}
                      onClick={() => {
                        setEditForm({ ...editForm, color, useCustomColor: false });
                      }}
                      sx={{
                        width: 40,
                        height: 40,
                        backgroundColor: color,
                        borderRadius: '50%',
                        cursor: 'pointer',
                        border: editForm.color === color && !editForm.useCustomColor ? '3px solid #000' : '2px solid #ccc',
                        position: 'relative',
                        '&:hover': {
                          border: '3px solid #666',
                          transform: 'scale(1.1)'
                        },
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {editForm.color === color && !editForm.useCustomColor && (
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            backgroundColor: '#fff',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: '#000'
                          }}
                        >
                          ✓
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>
              </Box>
              
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Or use a custom color:
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <TextField
                    label="Custom Color"
                    value={editForm.useCustomColor ? editForm.color : ''}
                    onChange={(e) => setEditForm({ ...editForm, color: e.target.value, useCustomColor: true })}
                    placeholder="#000000"
                    fullWidth
                    size="small"
                    disabled={!editForm.useCustomColor}
                    helperText="Enter a hex color code (e.g., #ff0000)"
                  />
                </Box>
              </Box>
              
              <Box sx={{ mt: 1, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Live Preview:
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Chip
                    label={editForm.name || 'Tag Name'}
                    sx={{
                      backgroundColor: editForm.color || getTagColor(editForm.name),
                      color: '#ffffff',
                      fontWeight: 'medium',
                      fontSize: '0.875rem',
                      padding: '4px 12px'
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    This is how your tag will appear in the Expenses page
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={saveTagEdit} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Tag Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Tag</DialogTitle>
        <DialogContent>
          {deletingTag && (
            <Box sx={{ pt: 2 }}>
              <Typography gutterBottom>
                Are you sure you want to delete the tag "{deletingTag.name}"?
              </Typography>
              {deletingTag.usageCount > 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  This tag is currently used in {deletingTag.usageCount} expense{deletingTag.usageCount !== 1 ? 's' : ''}. 
                  Deleting it will remove the tag from all associated expenses.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDeleteTag} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Account Edit Dialog */}
      <Dialog open={accountEditDialogOpen} onClose={() => setAccountEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingAccount ? 'Edit Account' : 'Add Account'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Account Name"
              value={accountForm.name}
              onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Bank"
              value={accountForm.bank}
              onChange={(e) => setAccountForm({ ...accountForm, bank: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Current Balance"
              type="number"
              value={accountForm.currentBalance}
              onChange={(e) => setAccountForm({ ...accountForm, currentBalance: parseFloat(e.target.value) || 0 })}
              fullWidth
              required
              inputProps={{ step: 0.01, min: 0 }}
            />
            <TextField
              label="Required Balance"
              type="number"
              value={accountForm.requiredBalance}
              onChange={(e) => setAccountForm({ ...accountForm, requiredBalance: parseFloat(e.target.value) || 0 })}
              fullWidth
              required
              inputProps={{ step: 0.01, min: 0 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={accountForm.isPrimary}
                  onChange={(e) => setAccountForm({ ...accountForm, isPrimary: e.target.checked })}
                />
              }
              label="Set as primary account"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAccountEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAccountSubmit} variant="contained">
            {editingAccount ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Account Delete Dialog */}
      <Dialog open={accountDeleteDialogOpen} onClose={() => setAccountDeleteDialogOpen(false)}>
        <DialogTitle>Delete Account</DialogTitle>
        <DialogContent>
          {deletingAccount && (
            <Box sx={{ pt: 2 }}>
              <Typography gutterBottom>
                Are you sure you want to delete the account "{deletingAccount.name}"?
              </Typography>
              <Alert severity="warning" sx={{ mt: 2 }}>
                This action cannot be undone. All account data will be permanently deleted.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAccountDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAccountDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        message={snackbar.message}
      />
    </Box>
  );
};

export default Settings; 