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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Switch,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { Add as AddIcon } from '@mui/icons-material';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { apiCall } from '../utils/api';
import VersionManager from './VersionManager';
import { format } from 'date-fns';
import { useTheme } from '@mui/material/styles';

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

interface User {
  id: number;
  name: string;
  email: string;
  admin: boolean;
}

interface ManualAdjustment {
  id: number;
  account_id: number;
  type: 'withdrawal' | 'deposit';
  amount: number;
  date: string;
  description: string;
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
  const { user } = useAuth();
  const theme = useTheme();

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

  // Admin state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userEditDialogOpen, setUserEditDialogOpen] = useState(false);
  const [userDeleteDialogOpen, setUserDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState<Partial<User>>({
    name: '',
    email: '',
    admin: false,
  });

  // Manual Adjustments state
  const [manualAdjustments, setManualAdjustments] = useState<ManualAdjustment[]>([]);
  const [manualAdjustmentsLoading, setManualAdjustmentsLoading] = useState(false);
  const [manualAdjustmentEditDialogOpen, setManualAdjustmentEditDialogOpen] = useState(false);
  const [manualAdjustmentDeleteDialogOpen, setManualAdjustmentDeleteDialogOpen] = useState(false);
  const [editingManualAdjustment, setEditingManualAdjustment] = useState<ManualAdjustment | null>(null);
  const [deletingManualAdjustment, setDeletingManualAdjustment] = useState<ManualAdjustment | null>(null);
  const [manualAdjustmentForm, setManualAdjustmentForm] = useState<Partial<ManualAdjustment>>({
    account_id: 0,
    type: 'withdrawal',
    amount: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
  });

  // Version manager state
  const [versionManagerOpen, setVersionManagerOpen] = useState(false);

  useEffect(() => {
    fetchTags();
    fetchAccounts();
    fetchManualAdjustments();
    console.log('Settings component - Current user:', user);
    console.log('Settings component - user.admin:', user?.admin);
    if (user?.admin) {
      console.log('Settings component - Fetching users because user is admin');
      fetchUsers();
    }
  }, [user?.admin]);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const [tagsResponse, expensesResponse] = await Promise.all([
        apiCall('/tags'),
        apiCall('/expenses?includeHidden=true')
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
      const response = await apiCall('/accounts');
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

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const response = await apiCall('/auth/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchManualAdjustments = async () => {
    try {
      setManualAdjustmentsLoading(true);
      const response = await apiCall('/manual-adjustments');
      if (!response.ok) {
        throw new Error('Failed to fetch manual adjustments');
      }
      const data = await response.json();
      setManualAdjustments(data);
    } catch (error) {
      console.error('Error fetching manual adjustments:', error);
    } finally {
      setManualAdjustmentsLoading(false);
    }
  };

  const handlePlanningPageChange = (checked: boolean) => {
    updateSettings(checked, showSchedulePage, showAccountsPage);
  };

  const handleSchedulePageChange = (checked: boolean) => {
    updateSettings(showPlanningPage, checked, showAccountsPage);
  };

  const handleAccountsPageChange = (checked: boolean) => {
    updateSettings(showPlanningPage, showSchedulePage, checked);
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
      
      const response = await apiCall(`/tags/${editingTag.name}`, {
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
      const response = await apiCall(`/tags/${deletingTag.name}`, {
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
    if (!accountForm.name || !accountForm.bank) return;

    try {
      const url = editingAccount 
        ? `/accounts/${editingAccount.id}`
        : '/accounts';
      const method = editingAccount ? 'PUT' : 'POST';
      const diff = (accountForm.currentBalance || 0) - (accountForm.requiredBalance || 0);

      const response = await apiCall(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...accountForm,
          diff
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save account');
      }

      await fetchAccounts();
      setAccountEditDialogOpen(false);
      setEditingAccount(null);
      setAccountForm({
        name: '',
        bank: '',
        currentBalance: 0,
        requiredBalance: 0,
        isPrimary: false,
      });
      setSnackbar({ open: true, message: `Account ${editingAccount ? 'updated' : 'added'} successfully` });
    } catch (error) {
      console.error('Error saving account:', error);
    }
  };

  const handleAccountDeleteConfirm = async () => {
    if (!deletingAccount) return;

    try {
      const response = await apiCall(`/accounts/${deletingAccount.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      setSnackbar({ open: true, message: 'Account deleted successfully' });
      setAccountDeleteDialogOpen(false);
      setDeletingAccount(null);
      fetchAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      setSnackbar({ open: true, message: 'Failed to delete account' });
    }
  };

  // Admin user management functions
  const handleUserEdit = (user: User) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      admin: user.admin,
    });
    setUserEditDialogOpen(true);
  };

  const handleUserDelete = (user: User) => {
    setDeletingUser(user);
    setUserDeleteDialogOpen(true);
  };

  const handleUserSubmit = async () => {
    if (!editingUser || !userForm.name?.trim() || !userForm.email?.trim()) return;

    try {
      const response = await apiCall(`/auth/users/${editingUser.id}/admin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin: userForm.admin }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      setSnackbar({ open: true, message: 'User updated successfully' });
      setUserEditDialogOpen(false);
      setEditingUser(null);
      setUserForm({ name: '', email: '', admin: false });
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      setSnackbar({ open: true, message: 'Failed to update user' });
    }
  };

  const handleUserDeleteConfirm = async () => {
    if (!deletingUser) return;

    try {
      const response = await apiCall(`/auth/users/${deletingUser.email}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      setSnackbar({ open: true, message: 'User deleted successfully' });
      setUserDeleteDialogOpen(false);
      setDeletingUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      setSnackbar({ open: true, message: 'Failed to delete user' });
    }
  };

  // Manual Adjustment handlers
  const handleManualAdjustmentEdit = (adjustment: ManualAdjustment) => {
    setEditingManualAdjustment(adjustment);
    setManualAdjustmentForm({
      account_id: adjustment.account_id,
      type: adjustment.type,
      amount: adjustment.amount,
      date: adjustment.date,
      description: adjustment.description,
    });
    setManualAdjustmentEditDialogOpen(true);
  };

  const handleManualAdjustmentDelete = (adjustment: ManualAdjustment) => {
    setDeletingManualAdjustment(adjustment);
    setManualAdjustmentDeleteDialogOpen(true);
  };

  const handleManualAdjustmentSubmit = async () => {
    if (!manualAdjustmentForm.account_id || !manualAdjustmentForm.type || !manualAdjustmentForm.amount || !manualAdjustmentForm.date) {
      setSnackbar({ open: true, message: 'Please fill in all required fields' });
      return;
    }

    try {
      if (editingManualAdjustment) {
        // Update existing adjustment
        const response = await apiCall(`/manual-adjustments/${editingManualAdjustment.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(manualAdjustmentForm),
        });

        if (!response.ok) {
          throw new Error('Failed to update manual adjustment');
        }

        setSnackbar({ open: true, message: 'Manual adjustment updated successfully' });
      } else {
        // Create new adjustment
        const response = await apiCall('/manual-adjustments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(manualAdjustmentForm),
        });

        if (!response.ok) {
          throw new Error('Failed to create manual adjustment');
        }

        setSnackbar({ open: true, message: 'Manual adjustment created successfully' });
      }

      setManualAdjustmentEditDialogOpen(false);
      setEditingManualAdjustment(null);
      setManualAdjustmentForm({
        account_id: accounts.length > 0? accounts[0].id : 0,
        type: 'withdrawal',
        amount: 0,
        date: format(new Date(), 'yyyy-MM-dd'),
        description: '',
      });
      fetchManualAdjustments();
    } catch (error) {
      console.error('Error saving manual adjustment:', error);
      setSnackbar({ open: true, message: 'Failed to save manual adjustment' });
    }
  };

  const handleManualAdjustmentDeleteConfirm = async () => {
    if (!deletingManualAdjustment) return;

    try {
      const response = await apiCall(`/manual-adjustments/${deletingManualAdjustment.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete manual adjustment');
      }

      setSnackbar({ open: true, message: 'Manual adjustment deleted successfully' });
      setManualAdjustmentDeleteDialogOpen(false);
      setDeletingManualAdjustment(null);
      fetchManualAdjustments();
    } catch (error) {
      console.error('Error deleting manual adjustment:', error);
      setSnackbar({ open: true, message: 'Failed to delete manual adjustment' });
    }
  };

  const getAccountName = (accountId: number) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? account.name : 'Unknown Account';
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
                Manual Adjustments
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {manualAdjustmentsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Manage Manual Adjustments
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        setEditingManualAdjustment(null);
                        setManualAdjustmentForm({
                          account_id: accounts.length > 0? accounts[0].id : 0,
                          type: 'withdrawal',
                          amount: 0,
                          date: format(new Date(), 'yyyy-MM-dd'),
                          description: '',
                        });
                        setManualAdjustmentEditDialogOpen(true);
                      }}
                    >
                      Add Adjustment
                    </Button>
                  </Box>
                  <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Account</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell align="center">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {manualAdjustments.map((adjustment) => (
                          <TableRow key={adjustment.id}>
                            <TableCell>{format(new Date(adjustment.date), 'MMM dd, yyyy')}</TableCell>
                            <TableCell>{getAccountName(adjustment.account_id)}</TableCell>
                            <TableCell>
                              <Chip
                                label={adjustment.type}
                                color={adjustment.type === 'deposit' ? 'success' : 'error'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="right">
                              ${adjustment.amount.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {adjustment.description || 'No description'}
                            </TableCell>
                            <TableCell align="center">
                              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleManualAdjustmentEdit(adjustment)}
                                  color="primary"
                                >
                                  <EditIcon />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => handleManualAdjustmentDelete(adjustment)}
                                  color="error"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                        {manualAdjustments.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} align="center">
                              <Typography color="text.secondary">
                                No manual adjustments found. Add your first adjustment to get started.
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
                        onChange={(e) => handleAccountsPageChange(e.target.checked)}
                      />
                    }
                    label="Show Accounts page"
                  />
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        </ListItem>

        <ListItem>
          <Accordion sx={{ width: '100%' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', textDecoration: 'underline' }}>
                Budget Versions
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box>
                <Typography variant="h6" gutterBottom>
                  Manage Budget Versions
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Create different versions of your budget to compare scenarios, plan for different time periods, or experiment with different financial strategies.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setVersionManagerOpen(true)}
                >
                  Manage Versions
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>
        </ListItem>
        
        {/* Admin Section - Only visible to admin users */}
        {(() => {
          console.log('Admin section condition - user?.admin:', user?.admin);
          return user?.admin && (
            <ListItem>
              <Accordion sx={{ width: '100%' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AdminPanelSettingsIcon color="primary" />
                    <Typography variant="h6" sx={{ fontWeight: 'bold', textDecoration: 'underline' }}>
                      Admin
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="h6">User Management</Typography>
                      {usersLoading && <CircularProgress size={20} />}
                    </Box>
                    
                    {users.length === 0 ? (
                      <Typography color="text.secondary">No users found.</Typography>
                    ) : (
                      <TableContainer component={Paper}>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Name</TableCell>
                              <TableCell>Email</TableCell>
                              <TableCell>Admin</TableCell>
                              <TableCell>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {users.map((user) => (
                              <TableRow key={user.id}>
                                <TableCell>{user.name}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
                                  {user.admin ? (
                                    <Chip label="Admin" color="primary" size="small" />
                                  ) : (
                                    <Chip label="User" color="default" size="small" />
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', gap: 1 }}>
                                    <IconButton
                                      size="small"
                                      onClick={() => handleUserEdit(user)}
                                      color="primary"
                                    >
                                      <EditIcon />
                                    </IconButton>
                                    <IconButton
                                      size="small"
                                      onClick={() => handleUserDelete(user)}
                                      color="error"
                                      disabled={user.email === 'leverson83@gmail.com'} // Prevent deleting yourself
                                    >
                                      <DeleteIcon />
                                    </IconButton>
                                  </Box>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>
            </ListItem>
          );
        })()}
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

      {/* User Edit Dialog */}
      <Dialog open={userEditDialogOpen} onClose={() => setUserEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="User Name"
              value={userForm.name}
              onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="User Email"
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              fullWidth
              required
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={userForm.admin}
                  onChange={(e) => setUserForm({ ...userForm, admin: e.target.checked })}
                />
              }
              label="Set as admin"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUserSubmit} variant="contained">
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* User Delete Dialog */}
      <Dialog open={userDeleteDialogOpen} onClose={() => setUserDeleteDialogOpen(false)}>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          {deletingUser && (
            <Box sx={{ pt: 2 }}>
              <Typography gutterBottom>
                Are you sure you want to delete the user "{deletingUser.name}"?
              </Typography>
              <Alert severity="warning" sx={{ mt: 2 }}>
                This action cannot be undone. All user data will be permanently deleted.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUserDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manual Adjustment Edit Dialog */}
      <Dialog open={manualAdjustmentEditDialogOpen} onClose={() => setManualAdjustmentEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingManualAdjustment ? 'Edit Manual Adjustment' : 'Add Manual Adjustment'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt:2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Account</InputLabel>
              <Select
                value={manualAdjustmentForm.account_id}
                label="Account"
                onChange={(e) => setManualAdjustmentForm({ ...manualAdjustmentForm, account_id: e.target.value as number })}
              >
                {accounts.map((account) => (
                  <MenuItem key={account.id} value={account.id}>
                    {account.name} ({account.bank})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={manualAdjustmentForm.type}
                label="Type"
                onChange={(e) => setManualAdjustmentForm({ ...manualAdjustmentForm, type: e.target.value as 'withdrawal' | 'deposit' })}
              >
                <MenuItem value="withdrawal">Withdrawal</MenuItem>
                <MenuItem value="deposit">Deposit</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              label="Amount"
              type="number"
              value={manualAdjustmentForm.amount}
              onChange={(e) => setManualAdjustmentForm({ ...manualAdjustmentForm, amount: parseFloat(e.target.value) || 0 })}
              fullWidth
              required
              inputProps={{ step: 0.01, min: 0 }}
            />
            
            <TextField
              label="Date"
              type="date"
              value={manualAdjustmentForm.date}
              onChange={(e) => setManualAdjustmentForm({ ...manualAdjustmentForm, date: e.target.value })}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
            />
            
            <TextField
              label="Description"
              value={manualAdjustmentForm.description}
              onChange={(e) => setManualAdjustmentForm({ ...manualAdjustmentForm, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
              placeholder="Optional description for this adjustment"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManualAdjustmentEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleManualAdjustmentSubmit} variant="contained">
            {editingManualAdjustment ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manual Adjustment Delete Dialog */}
      <Dialog open={manualAdjustmentDeleteDialogOpen} onClose={() => setManualAdjustmentDeleteDialogOpen(false)}>
        <DialogTitle>Delete Manual Adjustment</DialogTitle>
        <DialogContent>
          {deletingManualAdjustment && (
            <Box sx={{ pt: 2 }}>
              <Typography gutterBottom>
                Are you sure you want to delete this manual adjustment?
              </Typography>
              <Box sx={{ mt: 2, p: 2, backgroundColor: theme.palette.background.paper, border: '1px solid', borderColor: theme.palette.divider, borderRadius: 1 }}>
                <Typography variant="body2" sx={{ color: 'text.primary' }}>
                  <strong>Date:</strong> {format(new Date(deletingManualAdjustment.date), 'MMM dd, yyyy')}<br />
                  <strong>Account:</strong> {getAccountName(deletingManualAdjustment.account_id)}<br />
                  <strong>Type:</strong> {deletingManualAdjustment.type}<br />
                  <strong>Amount:</strong> ${deletingManualAdjustment.amount.toFixed(2)}<br />
                  {deletingManualAdjustment.description && (
                    <>
                      <strong>Description:</strong> {deletingManualAdjustment.description}
                    </>
                  )}
                </Typography>
              </Box>
              <Alert severity="warning" sx={{ mt: 2 }}>
                This action cannot be undone. The adjustment will be permanently deleted.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManualAdjustmentDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleManualAdjustmentDeleteConfirm} color="error" variant="contained">
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

      {/* Version Manager */}
      <VersionManager
        open={versionManagerOpen}
        onClose={() => setVersionManagerOpen(false)}
        onVersionChange={() => {
          // Refresh all data when version changes
          fetchTags();
          fetchAccounts();
          fetchManualAdjustments();
          if (user?.admin) {
            fetchUsers();
          }
        }}
      />
    </Box>
  );
};

export default Settings; 