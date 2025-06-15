import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  DialogContentText,
  CircularProgress,
  Alert,
  Snackbar,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';

interface AccountEntry {
  id: number;
  name: string;
  bank: string;
  currentBalance: number;
  requiredBalance: number;
  isPrimary: boolean;
  diff: number;
}

const API_URL = 'http://localhost:3001/api';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const Accounts = () => {
  const [accounts, setAccounts] = useState<AccountEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountEntry | null>(null);
  const [formData, setFormData] = useState<Partial<AccountEntry>>({
    name: '',
    bank: '',
    currentBalance: 0,
    requiredBalance: 0,
    isPrimary: false,
    diff: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await fetch(`${API_URL}/accounts`);
      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }
      const data = await response.json();
      setAccounts(data);
      setError(null);
    } catch (err) {
      setError('Failed to load accounts');
      console.error('Error fetching accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (account?: AccountEntry) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        name: account.name,
        bank: account.bank,
        currentBalance: account.currentBalance,
        requiredBalance: account.requiredBalance,
        isPrimary: account.isPrimary,
        diff: account.diff,
      });
    } else {
      setEditingAccount(null);
      setFormData({
        name: '',
        bank: '',
        currentBalance: 0,
        requiredBalance: 0,
        isPrimary: false,
        diff: 0
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingAccount(null);
    setFormData({
      name: '',
      bank: '',
      currentBalance: 0,
      requiredBalance: 0,
      isPrimary: false,
      diff: 0
    });
  };

  const handleSubmit = async () => {
    try {
      const url = editingAccount
        ? `${API_URL}/accounts/${editingAccount.id}`
        : `${API_URL}/accounts`;
      const method = editingAccount ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to save account');
      }

      await fetchAccounts();
      handleClose();
      setSnackbar({
        open: true,
        message: `Account ${editingAccount ? 'updated' : 'added'} successfully`,
      });
    } catch (err) {
      setError('Failed to save account');
      console.error('Error saving account:', err);
    }
  };

  const handleDeleteClick = (id: number) => {
    setAccountToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!accountToDelete) return;

    try {
      const response = await fetch(`${API_URL}/accounts/${accountToDelete}`, {
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
    } catch (err) {
      setError('Failed to delete account');
      console.error('Error deleting account:', err);
    } finally {
      setDeleteConfirmOpen(false);
      setAccountToDelete(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      height: '100%',
      p: 3,
      display: 'flex',
      flexDirection: 'column',
      gap: 3
    }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center'
      }}>
        <Typography variant="h4" component="h1">
          Accounts
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
        >
          Add Account
        </Button>
      </Box>

      <TableContainer 
        component={Paper} 
        sx={{ 
          flex: 1,
          overflow: 'auto'
        }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Bank</TableCell>
              <TableCell align="right">Current Balance</TableCell>
              <TableCell align="right">Required Balance</TableCell>
              <TableCell align="right">Diff</TableCell>
              <TableCell>Primary</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell>{account.name}</TableCell>
                <TableCell>{account.bank}</TableCell>
                <TableCell align="right">${(account.currentBalance ?? 0).toFixed(2)}</TableCell>
                <TableCell align="right">${(account.requiredBalance ?? 0).toFixed(2)}</TableCell>
                <TableCell align="right">${(account.diff ?? 0).toFixed(2)}</TableCell>
                <TableCell>{account.isPrimary ? 'Yes' : 'No'}</TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <IconButton
                      size="small"
                      onClick={() => handleOpen(account)}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteClick(account.id)}
                      color="error"
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

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editingAccount ? 'Edit Account' : 'Add Account'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Bank"
              value={formData.bank}
              onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Current Balance"
              type="number"
              value={formData.currentBalance}
              onChange={(e) => setFormData({ ...formData, currentBalance: parseFloat(e.target.value) })}
              fullWidth
              required
              inputProps={{ step: "0.01" }}
            />
            <TextField
              label="Required Balance"
              type="number"
              value={formData.requiredBalance}
              onChange={(e) => setFormData({ ...formData, requiredBalance: parseFloat(e.target.value) })}
              fullWidth
              required
              inputProps={{ step: "0.01" }}
            />
            <TextField
              label="Diff"
              type="number"
              value={formData.diff}
              onChange={(e) => setFormData({ ...formData, diff: parseFloat(e.target.value) })}
              fullWidth
              inputProps={{ step: "0.01" }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isPrimary}
                  onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                />
              }
              label="Primary Account"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {editingAccount ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this account? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
};

export default Accounts; 