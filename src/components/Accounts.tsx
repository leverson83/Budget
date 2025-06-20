import React, { useState, useEffect } from 'react';
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
import { API_URL } from '../config';
import { apiCall } from '../utils/api';

interface AccountEntry {
  id: number;
  name: string;
  bank: string;
  currentBalance: number;
  requiredBalance: number;
  isPrimary: boolean;
  diff: number;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const formatDiff = (currentBalance: number, requiredBalance: number) => {
  const diff = currentBalance - requiredBalance;
  const formattedDiff = formatCurrency(Math.abs(diff));
  const sign = diff >= 0 ? '+' : '-';
  const color = diff >= 0 ? 'success.main' : 'error.main';
  
  return { text: `${sign}${formattedDiff}`, color };
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
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  useEffect(() => {
    const fetchAccounts = async () => {
      setLoading(true);
      try {
        const response = await apiCall('/accounts');
        if (!response.ok) {
          throw new Error('Failed to fetch accounts');
        }
        const data = await response.json();
        setAccounts(data);
      } catch (error) {
        console.error('Error fetching accounts:', error);
        setError('Failed to load accounts');
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  const handleOpen = (account?: AccountEntry) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        name: account.name,
        bank: account.bank,
        currentBalance: account.currentBalance,
        requiredBalance: account.requiredBalance,
        isPrimary: account.isPrimary,
      });
    } else {
      setEditingAccount(null);
      setFormData({
        name: '',
        bank: '',
        currentBalance: 0,
        requiredBalance: 0,
        isPrimary: false,
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
    });
  };

  const handleSubmit = async () => {
    try {
      const url = editingAccount
        ? `${API_URL}/accounts/${editingAccount.id}`
        : `${API_URL}/accounts`;
      const method = editingAccount ? 'PUT' : 'POST';

      // Calculate diff automatically
      const diff = (formData.currentBalance || 0) - (formData.requiredBalance || 0);

      const response = await apiCall(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          diff: diff
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save account');
      }

      // Refresh accounts list
      const refreshResponse = await apiCall('/accounts');
      if (refreshResponse.ok) {
        const refreshedData = await refreshResponse.json();
        setAccounts(refreshedData);
      }
      
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
      const response = await apiCall(`/accounts/${accountToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      setAccounts(prevAccounts => prevAccounts.filter(account => account.id !== accountToDelete));
      setDeleteConfirmOpen(false);
      setAccountToDelete(null);
    } catch (error) {
      console.error('Error deleting account:', error);
      setError('Failed to delete account');
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
          display: 'inline-block',
          minWidth: '100%',
          maxWidth: 'fit-content'
        }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Actions</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Bank</TableCell>
              <TableCell align="right">Current Balance</TableCell>
              <TableCell align="right">Required Balance</TableCell>
              <TableCell align="right">Diff</TableCell>
              <TableCell>Primary</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleOpen(account)}
                      sx={{ color: 'primary.main' }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteClick(account.id)}
                      sx={{ color: 'error.main' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </TableCell>
                <TableCell>{account.name}</TableCell>
                <TableCell>{account.bank}</TableCell>
                <TableCell align="right">${(account.currentBalance ?? 0).toFixed(2)}</TableCell>
                <TableCell align="right">${(account.requiredBalance ?? 0).toFixed(2)}</TableCell>
                <TableCell 
                  align="right"
                  sx={{ 
                    color: formatDiff(account.currentBalance, account.requiredBalance).color,
                    fontWeight: 'bold'
                  }}
                >
                  {formatDiff(account.currentBalance, account.requiredBalance).text}
                </TableCell>
                <TableCell>{account.isPrimary ? 'Yes' : 'No'}</TableCell>
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