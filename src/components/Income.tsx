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
  MenuItem,
  IconButton,
  DialogContentText,
  CircularProgress,
  Alert,
  Snackbar,
  Checkbox,
  Tooltip,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Info as InfoIcon } from '@mui/icons-material';

interface IncomeEntry {
  id: string;
  description: string;
  amount: number;
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';
  nextDue: Date;
}

const API_URL = 'http://localhost:3001/api';

const frequencies = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const Income = () => {
  const [incomes, setIncomes] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [incomeToDelete, setIncomeToDelete] = useState<string | null>(null);
  const [editingIncome, setEditingIncome] = useState<IncomeEntry | null>(null);
  const [newIncome, setNewIncome] = useState({
    description: '',
    amount: '',
    frequency: 'monthly' as IncomeEntry['frequency'],
    nextDue: new Date().toISOString().split('T')[0],
  });

  // Fetch incomes on component mount
  useEffect(() => {
    fetchIncomes();
  }, []);

  const fetchIncomes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/income`);
      if (!response.ok) throw new Error('Failed to fetch incomes');
      const data = await response.json();
      setIncomes(data.map((income: any) => ({
        ...income,
        nextDue: new Date(income.nextDue),
      })));
    } catch (err) {
      setError('Failed to load income data');
      console.error('Error fetching incomes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (income?: IncomeEntry) => {
    if (income) {
      setEditingIncome(income);
      setNewIncome({
        description: income.description,
        amount: income.amount.toString(),
        frequency: income.frequency,
        nextDue: income.nextDue.toISOString().split('T')[0],
      });
    } else {
      setEditingIncome(null);
      setNewIncome({
        description: '',
        amount: '',
        frequency: 'monthly',
        nextDue: new Date().toISOString().split('T')[0],
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingIncome(null);
    setNewIncome({
      description: '',
      amount: '',
      frequency: 'monthly',
      nextDue: new Date().toISOString().split('T')[0],
    });
  };

  const handleDeleteClick = (id: string) => {
    setIncomeToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!incomeToDelete) return;

    try {
      const response = await fetch(`${API_URL}/income/${incomeToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete income');

      setIncomes(prevIncomes => prevIncomes.filter(income => income.id !== incomeToDelete));
      setDeleteDialogOpen(false);
      setIncomeToDelete(null);
    } catch (error) {
      setError('Failed to delete income');
      console.error('Error deleting income:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      // Validate form
      if (!newIncome.description || !newIncome.amount || !newIncome.nextDue) {
        setError('Please fill in all fields');
        return;
      }

      const amount = parseFloat(newIncome.amount);
      if (isNaN(amount) || amount <= 0) {
        setError('Please enter a valid amount');
        return;
      }

      const incomeData = {
        description: newIncome.description,
        amount: amount,
        frequency: newIncome.frequency,
        nextDue: new Date(newIncome.nextDue).toISOString(),
      };

      if (editingIncome) {
        // Update existing income
        const response = await fetch(`${API_URL}/income/${editingIncome.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...incomeData,
            id: editingIncome.id
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update income');
        }

        setIncomes(prevIncomes =>
          prevIncomes.map(income =>
            income.id === editingIncome.id
              ? { ...income, ...incomeData, nextDue: new Date(incomeData.nextDue) }
              : income
          )
        );
      } else {
        // Create new income
        const newEntry = {
          id: Date.now().toString(),
          ...incomeData,
        };

        const response = await fetch(`${API_URL}/income`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newEntry),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create income');
        }

        setIncomes(prevIncomes => [...prevIncomes, { ...newEntry, nextDue: new Date(newEntry.nextDue) }]);
      }
      
      handleClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save income');
      console.error('Error saving income:', error);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
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
          Income
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
        >
          Add Income
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
              <TableCell>Description</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Frequency</TableCell>
              <TableCell>Next Due</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {incomes.map((income) => (
              <TableRow key={income.id}>
                <TableCell>{income.description}</TableCell>
                <TableCell align="right">{formatCurrency(income.amount)}</TableCell>
                <TableCell>{income.frequency}</TableCell>
                <TableCell>{formatDate(income.nextDue)}</TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <IconButton
                      size="small"
                      onClick={() => handleOpen(income)}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteClick(income.id)}
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

      {/* Add/Edit Income Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingIncome ? 'Edit Income Source' : 'Add Income Source'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Description"
              fullWidth
              value={newIncome.description}
              onChange={(e) => setNewIncome({ ...newIncome, description: e.target.value })}
              required
            />
            <TextField
              label="Amount"
              type="number"
              fullWidth
              value={newIncome.amount}
              onChange={(e) => setNewIncome({ ...newIncome, amount: e.target.value })}
              InputProps={{
                startAdornment: '$',
              }}
              required
            />
            <TextField
              select
              label="Frequency"
              fullWidth
              value={newIncome.frequency}
              onChange={(e) => setNewIncome({ ...newIncome, frequency: e.target.value as IncomeEntry['frequency'] })}
              required
            >
              {frequencies.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Next Due Date"
              type="date"
              fullWidth
              value={newIncome.nextDue}
              onChange={(e) => setNewIncome({ ...newIncome, nextDue: e.target.value })}
              InputLabelProps={{
                shrink: true,
              }}
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingIncome ? 'Save Changes' : 'Add Income'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this income source? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Income; 