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
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Info as InfoIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import { API_URL, frequencies, type Frequency } from '../config';

interface IncomeEntry {
  id: string;
  description: string;
  amount: number;
  frequency: Frequency;
  nextDue: Date;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const formatDate = (date: string | Date) => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    return format(dateObj, 'MMM d, yyyy');
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
};

const Income = () => {
  const [incomes, setIncomes] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [incomeToDelete, setIncomeToDelete] = useState<string | null>(null);
  const [editingIncome, setEditingIncome] = useState<IncomeEntry | null>(null);
  const [sortField, setSortField] = useState<keyof IncomeEntry | "percentage" | "amountPerFrequency">("description");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filterFrequency, setFilterFrequency] = useState<Frequency>("monthly");
  const [newIncome, setNewIncome] = useState({
    description: '',
    amount: '',
    frequency: 'monthly' as Frequency,
    nextDue: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch incomes
        const incomesResponse = await fetch(`${API_URL}/income`);
        if (!incomesResponse.ok) {
          throw new Error('Failed to fetch incomes');
        }
        const incomesData = await incomesResponse.json();
        setIncomes(incomesData.map((income: any) => ({
          ...income,
          nextDue: new Date(income.nextDue)
        })));

        // Fetch saved frequency
        const frequencyResponse = await fetch(`${API_URL}/settings/frequency`);
        if (!frequencyResponse.ok) {
          console.error('Failed to fetch frequency setting');
          return;
        }
        const { frequency } = await frequencyResponse.json();
        if (frequency) {
          setFilterFrequency(frequency);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const saveFrequency = async (newFrequency: Frequency) => {
    try {
      const response = await fetch(`${API_URL}/settings/frequency`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ frequency: newFrequency }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save frequency setting');
      }

      const data = await response.json();
      if (data.frequency) {
        setFilterFrequency(data.frequency);
      }
    } catch (error) {
      console.error('Error saving frequency:', error);
      setError(error instanceof Error ? error.message : 'Failed to save frequency setting');
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

  const handleSort = (field: keyof IncomeEntry | "percentage" | "amountPerFrequency") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const totalIncome = incomes.reduce((sum, entry) => sum + Number(entry.amount), 0);

  const sortedIncome = [...incomes].sort((a, b) => {
    let aValue: string | number | Date = a[sortField as keyof IncomeEntry] ?? "";
    let bValue: string | number | Date = b[sortField as keyof IncomeEntry] ?? "";

    if (sortField === "percentage") {
      aValue = (Number(a.amount) / totalIncome) * 100;
      bValue = (Number(b.amount) / totalIncome) * 100;
    } else if (sortField === "amountPerFrequency") {
      aValue = calculateFrequencyAmount(a.amount.toString(), a.frequency, filterFrequency);
      bValue = calculateFrequencyAmount(b.amount.toString(), b.frequency, filterFrequency);
    }

    if (aValue instanceof Date && bValue instanceof Date) {
      return sortDirection === "asc" ? aValue.getTime() - bValue.getTime() : bValue.getTime() - aValue.getTime();
    }

    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    }

    return sortDirection === "asc"
      ? String(aValue).localeCompare(String(bValue))
      : String(bValue).localeCompare(String(aValue));
  });

  const calculateFrequencyAmount = (amount: string, expenseFrequency: string, targetFrequency: string) => {
    // First convert to monthly equivalent
    let monthlyAmount = Number(amount);
    switch (expenseFrequency) {
      case "daily":
        monthlyAmount = monthlyAmount * 30;
        break;
      case "weekly":
        monthlyAmount = monthlyAmount * 4;
        break;
      case "quarterly":
        monthlyAmount = monthlyAmount / 3;
        break;
      case "yearly":
        monthlyAmount = monthlyAmount / 12;
        break;
    }

    // Then convert to target frequency
    switch (targetFrequency) {
      case "daily":
        return monthlyAmount / 30;
      case "weekly":
        return monthlyAmount / 4;
      case "monthly":
        return monthlyAmount;
      case "quarterly":
        return monthlyAmount * 3;
      case "yearly":
        return monthlyAmount * 12;
      default:
        return monthlyAmount;
    }
  };

  const handleFilterChange = (event: SelectChangeEvent<Frequency>) => {
    const newFrequency = event.target.value as Frequency;
    saveFrequency(newFrequency);
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
        <Box sx={{ display: "flex", gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Frequency</InputLabel>
            <Select
              value={filterFrequency}
              label="Frequency"
              onChange={handleFilterChange}
            >
              {frequencies.map((freq) => (
                <MenuItem key={freq.value} value={freq.value}>
                  {freq.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => {
              setNewIncome({
                description: "",
                amount: "",
                frequency: "monthly",
                nextDue: format(new Date(), "yyyy-MM-dd"),
              });
              setOpen(true);
            }}
          >
            Add Income
          </Button>
        </Box>
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
              <TableCell 
                onClick={() => handleSort('description')}
                sx={{ cursor: 'pointer' }}
              >
                Description {sortField === 'description' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableCell>
              <TableCell 
                align="right"
                onClick={() => handleSort('amount')}
                sx={{ cursor: 'pointer' }}
              >
                Amount {sortField === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableCell>
              <TableCell 
                onClick={() => handleSort('frequency')}
                sx={{ cursor: 'pointer' }}
              >
                Frequency {sortField === 'frequency' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableCell>
              <TableCell 
                onClick={() => handleSort('nextDue')}
                sx={{ cursor: 'pointer' }}
              >
                Next Due {sortField === 'nextDue' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableCell>
              <TableCell 
                onClick={() => handleSort('percentage')}
                sx={{ cursor: 'pointer' }}
              >
                % {sortField === 'percentage' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableCell>
              <TableCell 
                onClick={() => handleSort('amountPerFrequency')}
                sx={{ cursor: 'pointer' }}
              >
                $ {sortField === 'amountPerFrequency' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedIncome.map((income) => (
              <TableRow key={income.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
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
                <TableCell>{income.description}</TableCell>
                <TableCell align="right">{formatCurrency(income.amount)}</TableCell>
                <TableCell>{income.frequency}</TableCell>
                <TableCell>{formatDate(income.nextDue)}</TableCell>
                <TableCell>{((Number(income.amount) / totalIncome) * 100).toFixed(1)}%</TableCell>
                <TableCell>
                  ${calculateFrequencyAmount(income.amount.toString(), income.frequency, filterFrequency).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow sx={{ backgroundColor: 'rgba(0, 0, 0, 0.04)' }}>
              <TableCell colSpan={6} align="right"><strong>Total</strong></TableCell>
              <TableCell align="right">
                <strong>${calculateFrequencyAmount(totalIncome.toString(), 'monthly', filterFrequency).toFixed(2)}</strong>
              </TableCell>
            </TableRow>
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
              onChange={(e) => setNewIncome({ ...newIncome, frequency: e.target.value as Frequency })}
              required
              SelectProps={{
                inputProps: {
                  'aria-label': 'Select frequency',
                  'aria-required': 'true'
                }
              }}
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
            Are you sure you want to delete this account? This action cannot be undone.
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