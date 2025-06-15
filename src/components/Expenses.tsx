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
  id: string;
  description: string;
  amount: number;
  frequency: string;
  nextDue: string;
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
  accountId: string;
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
    accountId: "",
    notes: "",
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sortField, setSortField] = useState<"description" | "amount" | "frequency" | "account" | "nextDue" | "percentage" | "amountPerFrequency">("description");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filterFrequency, setFilterFrequency] = useState<Frequency>("monthly");

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
        startDate: expense.nextDue,
        endDate: "",
        notes: expense.notes || '',
        accountId: expense.accountId?.toString() || '',
      });
    } else {
      setEditingExpense(null);
      setFormData({
        description: "",
        amount: "",
        frequency: "monthly",
        startDate: format(new Date(), "yyyy-MM-dd"),
        endDate: "",
        notes: "",
        accountId: "",
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
      accountId: "",
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
        id: editingExpense?.id || Date.now().toString(),
        description: formData.description,
        amount: parseFloat(formData.amount),
        frequency: formData.frequency,
        nextDue: formData.startDate,
        notes: formData.notes,
        accountId: formData.accountId ? parseInt(formData.accountId) : null,
        applyFuzziness: false
      };

      if (editingExpense) {
        await axios.put(`${API_URL}/expenses/${editingExpense.id}`, expenseData);
        setSuccessMessage("Expense updated successfully!");
      } else {
        await axios.post(`${API_URL}/expenses`, expenseData);
        setSuccessMessage("Expense added successfully!");
      }

      setShowSuccess(true);
      handleClose();
      fetchExpenses();
    } catch (err) {
      console.error("Error saving expense:", err);
      setErrorMessage("Failed to save expense. Please try again.");
      setShowError(true);
    }
  };

  const handleSort = (field: "description" | "amount" | "frequency" | "account" | "nextDue" | "percentage" | "amountPerFrequency") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const calculateFrequencyAmount = (amount: string, expenseFrequency: string, targetFrequency: string): number => {
    // First convert to monthly amount
    let monthlyAmount = Number(amount);
    switch (expenseFrequency) {
      case "daily":
        monthlyAmount *= 30;
        break;
      case "weekly":
        monthlyAmount *= 4;
        break;
      case "quarterly":
        monthlyAmount /= 3;
        break;
      case "yearly":
        monthlyAmount /= 12;
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

  const sortedExpenses = [...expenses].sort((a, b) => {
    switch (sortField) {
      case "description":
        return sortDirection === "asc" ? a.description.localeCompare(b.description) : b.description.localeCompare(a.description);
      case "amount":
        return sortDirection === "asc" 
          ? Number(a.amount) - Number(b.amount)
          : Number(b.amount) - Number(a.amount);
      case "frequency":
        return sortDirection === "asc" 
          ? a.frequency.localeCompare(b.frequency)
          : b.frequency.localeCompare(a.frequency);
      case "account":
        const aAccount = a.accountId?.toString() || "";
        const bAccount = b.accountId?.toString() || "";
        return sortDirection === "asc"
          ? aAccount.localeCompare(bAccount)
          : bAccount.localeCompare(aAccount);
      case "nextDue":
        return sortDirection === "asc"
          ? new Date(a.nextDue).getTime() - new Date(b.nextDue).getTime()
          : new Date(b.nextDue).getTime() - new Date(a.nextDue).getTime();
      case "percentage":
        const aPercentage = (Number(a.amount) / totalExpenses) * 100;
        const bPercentage = (Number(b.amount) / totalExpenses) * 100;
        return sortDirection === "asc"
          ? aPercentage - bPercentage
          : bPercentage - aPercentage;
      case "amountPerFrequency":
        const aAmount = calculateFrequencyAmount(a.amount.toString(), a.frequency, formData.frequency);
        const bAmount = calculateFrequencyAmount(b.amount.toString(), b.frequency, formData.frequency);
        return sortDirection === "asc"
          ? aAmount - bAmount
          : bAmount - aAmount;
      default:
        return 0;
    }
  });

  const handleFilterChange = (event: SelectChangeEvent<Frequency>) => {
    const newFrequency = event.target.value as Frequency;
    saveFrequency(newFrequency);
  };

  const filteredExpenses = sortedExpenses.filter(expense => 
    expense.frequency === filterFrequency || filterFrequency === 'monthly'
  );

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
              setFormData({
                description: "",
                amount: "",
                frequency: filterFrequency,
                startDate: format(new Date(), "yyyy-MM-dd"),
                endDate: "",
                accountId: "",
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
                <TableCell onClick={() => handleSort("description")} style={{ cursor: "pointer" }}>
                  Description {sortField === "description" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableCell>
                <TableCell onClick={() => handleSort("amount")} style={{ cursor: "pointer" }}>
                  Amount {sortField === "amount" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableCell>
                <TableCell onClick={() => handleSort("frequency")} style={{ cursor: "pointer" }}>
                  Frequency {sortField === "frequency" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableCell>
                <TableCell onClick={() => handleSort("account")} style={{ cursor: "pointer" }}>
                  Account {sortField === "account" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableCell>
                <TableCell onClick={() => handleSort("nextDue")} style={{ cursor: "pointer" }}>
                  Next Due {sortField === "nextDue" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableCell>
                <TableCell onClick={() => handleSort("percentage")} style={{ cursor: "pointer" }}>
                  % {sortField === "percentage" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableCell>
                <TableCell onClick={() => handleSort("amountPerFrequency")} style={{ cursor: "pointer" }}>
                  $ {sortField === "amountPerFrequency" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleOpen(expense)}
                        sx={{ color: 'primary.main' }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteClick(expense.id)}
                        sx={{ color: 'error.main' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                  <TableCell>{expense.description}</TableCell>
                  <TableCell>${Number(expense.amount).toFixed(2)}</TableCell>
                  <TableCell>{expense.frequency}</TableCell>
                  <TableCell>
                    {accounts.find((acc) => acc.id === expense.accountId)?.name || "Unknown"}
                  </TableCell>
                  <TableCell>
                    {expense.nextDue ? format(calculateNextDue(expense.nextDue, expense.frequency), "MMM d") : "N/A"}
                  </TableCell>
                  <TableCell>
                    {((Number(expense.amount) / totalExpenses) * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell>
                    ${calculateFrequencyAmount(expense.amount.toString(), expense.frequency, formData.frequency).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={6} align="right" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                  Total:
                </TableCell>
                <TableCell colSpan={2} align="right" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                  {formatCurrency(
                    expenses.reduce((sum, expense) => sum + calculateFrequencyAmount(expense.amount.toString(), expense.frequency, filterFrequency), 0)
                  )}
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
                label="Next Due Date"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <FormControl fullWidth margin="normal">
                <InputLabel id="account-label">Account</InputLabel>
                <Select
                  labelId="account-label"
                  id="account"
                  name="accountId"
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                  label="Account"
                  required
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {accounts.map((account) => (
                    <MenuItem key={account.id} value={account.id}>
                      {account.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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