import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  DialogContentText,
  Snackbar,
  Tooltip,
  Chip,
  Autocomplete,
  Popper,
  FormControl,
  InputLabel,
  Select,
  Stack
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Info as InfoIcon } from "@mui/icons-material";
import { format, addDays, addMonths, addWeeks, addYears, isAfter, isBefore } from "date-fns";
import { API_URL, frequencies, type Frequency } from "../config";
import axios from "axios";

interface Expense {
  id: number;
  description: string;
  amount: number;
  frequency: Frequency;
  nextDue: string;
  percentage: number;
  notes: string;
  applyFuzziness: boolean;
  accountId?: number;
  tags?: string[];
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

interface ExpenseFormData {
  description: string;
  amount: string;
  frequency: string;
  startDate: string;
  endDate: string;
  accountId: number | '';
  notes: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const Expenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState<ExpenseFormData>({
    description: "",
    amount: "",
    frequency: "monthly",
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: "",
    accountId: '',
    notes: "",
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedFrequency, setSelectedFrequency] = useState<Frequency>("monthly");
  const [selectedAccount, setSelectedAccount] = useState<string>('all');

  type SortField = keyof Expense | 'amountPerFrequency';

  const [sortField, setSortField] = useState<SortField>('amountPerFrequency');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch expenses
        const expensesResponse = await fetch(`${API_URL}/expenses`);
        if (!expensesResponse.ok) {
          throw new Error('Failed to fetch expenses');
        }
        const expensesData = await expensesResponse.json();
        setExpenses(expensesData.map((expense: any) => ({
          ...expense,
          nextDue: new Date(expense.nextDue)
        })));

        // Fetch accounts
        const accountsResponse = await fetch(`${API_URL}/accounts`);
        if (!accountsResponse.ok) {
          throw new Error('Failed to fetch accounts');
        }
        const accountsData = await accountsResponse.json();
        setAccounts(accountsData);

        // Fetch saved frequency
        const frequencyResponse = await fetch(`${API_URL}/settings/frequency`);
        if (!frequencyResponse.ok) {
          console.error('Failed to fetch frequency setting');
          return;
        }
        const { frequency } = await frequencyResponse.json();
        if (frequency) {
          setSelectedFrequency(frequency);
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
        setSelectedFrequency(data.frequency);
      }
    } catch (error) {
      console.error('Error saving frequency:', error);
      setError(error instanceof Error ? error.message : 'Failed to save frequency setting');
    }
  };

  // Calculate total expenses
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/expenses`);
      if (!response.ok) {
        throw new Error("Failed to fetch expenses");
      }
      const data = await response.json();
      setExpenses(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await fetch(`${API_URL}/accounts`);
      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }
      const data = await response.json();
      setAccounts(data);
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchAccounts();
  }, []);

  const handleOpen = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        description: expense.description,
        amount: expense.amount.toString(),
        frequency: expense.frequency,
        startDate: format(new Date(expense.nextDue), "yyyy-MM-dd"),
        endDate: "",
        accountId: expense.accountId || '',
        notes: expense.notes || "",
      });
    } else {
      setEditingExpense(null);
      setFormData({
        description: "",
        amount: "",
        frequency: selectedFrequency,
        startDate: format(new Date(), "yyyy-MM-dd"),
        endDate: "",
        accountId: '',
        notes: "",
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingExpense(null);
    setFormData({
      description: "",
      amount: "",
      frequency: "monthly",
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: "",
      notes: "",
      accountId: '',
    });
  };

  const handleDeleteClick = (id: string) => {
    setExpenseToDelete(expenses.find(e => e.id === id) || null);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!expenseToDelete) return;

    try {
      const response = await fetch(`${API_URL}/expenses/${expenseToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete expense");
      }

      setExpenses(prevExpenses => prevExpenses.filter(expense => expense.id !== expenseToDelete.id));
      setDeleteDialogOpen(false);
      setExpenseToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error deleting expense:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const expenseData = {
        description: formData.description,
        amount: parseFloat(formData.amount),
        frequency: formData.frequency,
        nextDue: formData.startDate,
        notes: formData.notes,
        accountId: formData.accountId === '' ? null : formData.accountId
      };

      if (editingExpense) {
        await axios.put(`${API_URL}/expenses/${editingExpense.id}`, expenseData);
        setSuccessMessage("Expense updated successfully");
      } else {
        await axios.post(`${API_URL}/expenses`, expenseData);
        setSuccessMessage("Expense added successfully");
      }

      setShowSuccess(true);
      handleClose();
      fetchExpenses();
    } catch (error) {
      console.error("Error saving expense:", error);
      setErrorMessage("Failed to save expense. Please try again.");
      setShowError(true);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const calculateFrequencyAmount = (amount: number | string, frequency: string, targetFrequency: string): number => {
    // First convert to annual amount
    let annualAmount = Number(amount);
    switch (frequency) {
      case "daily":
        annualAmount *= 365;
        break;
      case "weekly":
        annualAmount *= 52;
        break;
      case "biweekly":
        annualAmount *= 26;
        break;
      case "monthly":
        annualAmount *= 12;
        break;
      case "quarterly":
        annualAmount *= 4;
        break;
      case "annually":
        // already annual
        break;
    }

    // Then convert to target frequency
    switch (targetFrequency) {
      case "daily":
        return annualAmount / 365;
      case "weekly":
        return annualAmount / 52;
      case "biweekly":
        return annualAmount / 26;
      case "monthly":
        return annualAmount / 12;
      case "quarterly":
        return annualAmount / 4;
      case "annually":
        return annualAmount;
      default:
        return annualAmount;
    }
  };

  const calculateTotal = () => {
    return expenses.reduce((total, expense) => {
      return total + calculateFrequencyAmount(expense.amount, expense.frequency, selectedFrequency);
    }, 0);
  };

  const calculatePercentage = (amount: number, frequency: Frequency) => {
    const convertedAmount = calculateFrequencyAmount(amount, frequency, selectedFrequency);
    const total = calculateTotal();
    return total > 0 ? (convertedAmount / total) * 100 : 0;
  };

  const sortedExpenses = [...expenses].sort((a, b) => {
    if (sortField === 'amountPerFrequency') {
      const amountA = calculateFrequencyAmount(a.amount, a.frequency, selectedFrequency);
      const amountB = calculateFrequencyAmount(b.amount, b.frequency, selectedFrequency);
      return sortDirection === 'asc' ? amountA - amountB : amountB - amountA;
    }

    const aValue = a[sortField as keyof Expense];
    const bValue = b[sortField as keyof Expense];
    const direction = sortDirection === 'asc' ? 1 : -1;

    if (sortField === 'description' || sortField === 'frequency' || sortField === 'nextDue') {
      return direction * String(aValue).localeCompare(String(bValue));
    }
    return direction * (Number(aValue) - Number(bValue));
  });

  const handleFilterChange = (event: SelectChangeEvent<Frequency>) => {
    const newFrequency = event.target.value as Frequency;
    saveFrequency(newFrequency);
  };

  const calculateNextDue = (startDate: string, frequency: string) => {
    const today = new Date();
    const start = new Date(startDate);
    let nextDue = new Date(start);

    // If the start date is in the future, that's the next due date
    if (isAfter(start, today)) {
      return start;
    }

    // Calculate next occurrence based on frequency
    while (isBefore(nextDue, today) || nextDue.getTime() === today.getTime()) {
      switch (frequency) {
        case "daily":
          nextDue = addDays(nextDue, 1);
          break;
        case "weekly":
          nextDue = addWeeks(nextDue, 1);
          break;
        case "monthly":
          nextDue = addMonths(nextDue, 1);
          break;
        case "quarterly":
          nextDue = addMonths(nextDue, 3);
          break;
        case "yearly":
          nextDue = addYears(nextDue, 1);
          break;
        default:
          return nextDue;
      }
    }

    return nextDue;
  };

  const filteredExpenses = selectedAccount === 'all'
    ? sortedExpenses
    : sortedExpenses.filter(exp => exp.accountId && exp.accountId.toString() === selectedAccount);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" component="h2">
          Expenses
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <FormControl>
              <InputLabel>Frequency</InputLabel>
              <Select
                value={selectedFrequency}
                label="Frequency"
                onChange={(e) => setSelectedFrequency(e.target.value as Frequency)}
                size="small"
              >
                {frequencies.map((freq) => (
                  <MenuItem key={freq.value} value={freq.value}>
                    {freq.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Account</InputLabel>
              <Select
                value={selectedAccount}
                label="Account"
                onChange={(e) => setSelectedAccount(e.target.value)}
                size="small"
              >
                <MenuItem value="all">All</MenuItem>
                {accounts.map((account) => (
                  <MenuItem key={account.id} value={account.id.toString()}>
                    {account.name} ({account.bank})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => {
              setFormData({
                description: "",
                amount: "",
                frequency: selectedFrequency,
                startDate: format(new Date(), "yyyy-MM-dd"),
                endDate: "",
                accountId: '',
                notes: "",
              });
              setOpen(true);
            }}
          >
            Add Expense
          </Button>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Actions</TableCell>
                <TableCell onClick={() => handleSort('description')} style={{ cursor: 'pointer' }}>
                  Description {sortField === 'description' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableCell>
                <TableCell onClick={() => handleSort('amount')} style={{ cursor: 'pointer' }}>
                  Amount {sortField === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableCell>
                <TableCell 
                  onClick={() => handleSort('frequency')}
                  style={{ cursor: 'pointer' }}
                >
                  {selectedFrequency.charAt(0).toUpperCase() + selectedFrequency.slice(1)} {sortField === 'frequency' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableCell>
                <TableCell onClick={() => handleSort('nextDue')} style={{ cursor: 'pointer' }}>
                  Next Due {sortField === 'nextDue' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableCell>
                <TableCell onClick={() => handleSort('accountId')} style={{ cursor: 'pointer' }}>
                  Account {sortField === 'accountId' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableCell>
                <TableCell onClick={() => handleSort('percentage')} style={{ cursor: 'pointer' }}>
                  % {sortField === 'percentage' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableCell>
                <TableCell onClick={() => handleSort('amountPerFrequency')} style={{ cursor: 'pointer' }} align="right">
                  $({selectedFrequency}) {sortField === 'amountPerFrequency' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>
                    <IconButton onClick={() => handleOpen(expense)} size="small" color="primary">
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => handleDeleteClick(expense.id)} size="small" color="error">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                  <TableCell>{expense.description}</TableCell>
                  <TableCell>${expense.amount.toFixed(2)}</TableCell>
                  <TableCell>{expense.frequency}</TableCell>
                  <TableCell>{format(new Date(expense.nextDue), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    {expense.accountId ? accounts.find(acc => acc.id === expense.accountId)?.name || 'N/A' : 'N/A'}
                  </TableCell>
                  <TableCell>{calculatePercentage(expense.amount, expense.frequency).toFixed(1)}%</TableCell>
                  <TableCell align="right">
                    {formatCurrency(calculateFrequencyAmount(expense.amount, expense.frequency, selectedFrequency))}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={7} align="right">
                  <strong>Total</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>{formatCurrency(totalExpenses)}</strong>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>
            {editingExpense ? "Edit Expense" : "Add New Expense"}
          </DialogTitle>
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={2} mt={1}>
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Amount"
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                fullWidth
                inputProps={{ step: "0.01", min: "0" }}
              />
              <TextField
                select
                label="Frequency"
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                required
                fullWidth
              >
                {frequencies.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Account"
                value={formData.accountId}
                onChange={(e) => setFormData({ ...formData, accountId: e.target.value === '' ? '' : Number(e.target.value) })}
                fullWidth
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {accounts.map((account) => (
                  <MenuItem key={account.id} value={account.id}>
                    {account.name} ({account.bank})
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Next Due Date"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                fullWidth
                multiline
                rows={3}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary">
              {editingExpense ? "Save Changes" : "Add Expense"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Expense</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this expense?<br />
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Expenses; 