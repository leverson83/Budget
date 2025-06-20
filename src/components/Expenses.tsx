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
  Stack,
  OutlinedInput,
  ListItemText,
  Checkbox,
  Grid,
  Menu
} from "@mui/material";
import type { SelectChangeEvent } from '@mui/material/Select';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Info as InfoIcon, Calculate as CalculateIcon } from "@mui/icons-material";
import { format, addDays, addMonths, addWeeks, addYears, isAfter, isBefore } from "date-fns";
import { API_URL, frequencies, type Frequency } from "../config";
import axios from "axios";
import { v4 as uuidv4 } from 'uuid';
import { useFrequency } from '../contexts/FrequencyContext';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';

interface Expense {
  id: string;
  description: string;
  amount: number;
  frequency: Frequency;
  nextDue: Date;
  notes: string;
  applyFuzziness: boolean;
  accountId?: number;
  tags: string[];
  calculatedAmounts?: { value: string; frequency: Frequency }[];
  isCalculated: boolean;
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
  tags: string[];
}

interface ExpenseResponse {
  id: string;
  description: string;
  amount: number;
  frequency: Frequency;
  nextDue: string;
  notes: string;
  applyFuzziness: boolean;
  accountId?: number;
  tags?: string[];
  isCalculated?: boolean;
  calculatedAmounts?: { value: string; frequency: Frequency }[];
}

interface Tag {
  name: string;
  color?: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const getFrequencyLabel = (frequency: Frequency): string => {
  const freq = frequencies.find(f => f.value === frequency);
  return freq ? freq.label : frequency;
};

const Expenses = () => {
  const { frequency, setFrequency } = useFrequency();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tagColors, setTagColors] = useState<{ [key: string]: string }>({});
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
    tags: [],
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openCalc, setOpenCalc] = useState(false);

  type SortField = keyof Expense | 'amountPerFrequency';

  const [sortField, setSortField] = useState<SortField>('amountPerFrequency');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [calculatedForm, setCalculatedForm] = useState<{
    description: string;
    frequency: Frequency;
    startDate: string;
    endDate: string;
    accountId: string;
    notes: string;
    tags: string[];
    amounts: { value: string; frequency: Frequency }[];
    isCalculated: boolean;
    id: string | undefined;
  }>({
    description: "",
    frequency: frequency,
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: "",
    accountId: '',
    notes: "",
    tags: [],
    amounts: [{ value: '', frequency: frequency }],
    isCalculated: true,
    id: undefined,
  });

  const [editingCalcId, setEditingCalcId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch expenses
        const expensesResponse = await fetch(`${API_URL}/expenses`);
        if (!expensesResponse.ok) {
          throw new Error('Failed to fetch expenses');
        }
        const data = await expensesResponse.json() as ExpenseResponse[];
        const processedExpenses: Expense[] = data.map((expense) => {
          const { isCalculated, calculatedAmounts, tags, ...rest } = expense;
          return {
            ...rest,
          nextDue: new Date(expense.nextDue),
            tags: tags || [],
            isCalculated: Boolean(isCalculated),
            calculatedAmounts: (calculatedAmounts ?? []) as { value: string; frequency: Frequency }[],
          };
        });
        setExpenses(processedExpenses);

        // Fetch accounts
        const accountsResponse = await fetch(`${API_URL}/accounts`);
        if (!accountsResponse.ok) {
          throw new Error('Failed to fetch accounts');
        }
        const accountsData = await accountsResponse.json();
        setAccounts(accountsData);

        // Fetch tags
        const tagsResponse = await fetch(`${API_URL}/tags`);
        if (!tagsResponse.ok) {
          throw new Error('Failed to fetch tags');
        }
        const tagsData = await tagsResponse.json();
        // Extract tag names from the new format (objects with name and color)
        const tagNames = tagsData.map((tag: { name: string; color?: string }) => tag.name);
        setAvailableTags(tagNames);
        
        // Store tag colors
        const colorsMap: { [key: string]: string } = {};
        tagsData.forEach((tag: { name: string; color?: string }) => {
          if (tag.color) {
            colorsMap[tag.name] = tag.color;
          }
        });
        setTagColors(colorsMap);

        // Fetch saved frequency
        const frequencyResponse = await fetch(`${API_URL}/settings/frequency`);
        if (!frequencyResponse.ok) {
          console.error('Failed to fetch frequency setting');
        }
        const { frequency } = await frequencyResponse.json();
        if (frequency) {
          setFrequency(frequency);
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
        setFrequency(data.frequency);
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
      const data = await response.json() as ExpenseResponse[];
      const processedExpenses: Expense[] = data.map((expense) => {
        const { isCalculated, calculatedAmounts, tags, ...rest } = expense;
        return {
          ...rest,
        nextDue: new Date(expense.nextDue),
          tags: tags || [],
          isCalculated: Boolean(isCalculated),
          calculatedAmounts: (calculatedAmounts ?? []) as { value: string; frequency: Frequency }[],
        };
      });
      setExpenses(processedExpenses);
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
        tags: expense.tags || [],
      });
    } else {
      setEditingExpense(null);
      setFormData({
        description: "",
        amount: "",
        frequency: frequency,
        startDate: format(new Date(), "yyyy-MM-dd"),
        endDate: "",
        accountId: '',
        notes: "",
        tags: [],
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
      tags: [],
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
        id: editingExpense ? editingExpense.id : uuidv4(),
        description: formData.description,
        amount: parseFloat(formData.amount),
        frequency: formData.frequency,
        nextDue: formData.startDate,
        notes: formData.notes,
        accountId: formData.accountId === '' ? null : formData.accountId,
        tags: formData.tags || []
      };

      if (editingExpense) {
        const response = await axios.put(`${API_URL}/expenses/${editingExpense.id}`, expenseData);
        console.log('Update response:', response.data);
        setSuccessMessage("Expense updated successfully");
      } else {
        const response = await axios.post(`${API_URL}/expenses`, expenseData);
        console.log('Create response:', response.data);
        setSuccessMessage("Expense added successfully");
      }

      setShowSuccess(true);
      handleClose();
      fetchExpenses();
    } catch (error) {
      console.error('Error saving expense:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save expense');
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
      return total + calculateFrequencyAmount(expense.amount, expense.frequency, frequency);
    }, 0);
  };

  const calculatePercentage = (amount: number, frequency: Frequency) => {
    // Calculate the monthly amount for this expense
    const monthlyAmount = calculateFrequencyAmount(amount, frequency, 'monthly');
    
    // Calculate the total monthly amount for all expenses
    const totalMonthlyAmount = expenses.reduce((sum, expense) => {
      return sum + calculateFrequencyAmount(expense.amount, expense.frequency, 'monthly');
    }, 0);
    
    return totalMonthlyAmount > 0 ? (monthlyAmount / totalMonthlyAmount) * 100 : 0;
  };

  const sortedExpenses = [...expenses].sort((a, b) => {
    if (sortField === 'amountPerFrequency') {
      const amountA = calculateFrequencyAmount(a.amount, a.frequency, frequency);
      const amountB = calculateFrequencyAmount(b.amount, b.frequency, frequency);
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

  const filteredExpenses = sortedExpenses.filter((expense) => {
    // Handle account filtering
    let matchesAccount = true;
    if (selectedAccount !== "") {
      matchesAccount = expense.accountId === Number(selectedAccount);
    }

    // Handle tag filtering
    const matchesTags = selectedTags.length === 0 || 
      selectedTags.some(tag => expense.tags.includes(tag));

    return matchesAccount && matchesTags;
  });

  const handleFrequencyChange = (event: SelectChangeEvent) => {
    setFrequency(event.target.value as Frequency);
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

  const getTagColor = (tag: string) => {
    // First check if we have a custom color stored for this tag
    if (tagColors[tag]) {
      return tagColors[tag];
    }
    
    // Fall back to calculated color if no custom color is set
    const colors = [
      '#1976d2', // Blue
      '#9c27b0', // Purple
      '#2e7d32', // Green
      '#f57c00', // Orange
      '#c2185b', // Pink
      '#00838f', // Teal
      '#7b1fa2', // Deep Purple
      '#d32f2f', // Red
      '#5d4037', // Brown
      '#455a64', // Blue Grey
      '#388e3c', // Dark Green
      '#fbc02d', // Yellow
      '#0288d1', // Light Blue
      '#e64a19', // Deep Orange
      '#6d4c41', // Coffee
      '#512da8', // Indigo
      '#0097a7', // Cyan
      '#afb42b', // Lime
      '#f06292', // Light Pink
      '#8d6e63', // Taupe
      '#00bcd4', // Cyan Bright
      '#ffb300', // Amber
      '#43a047', // Green Bright
      '#e53935', // Red Bright
      '#8e24aa', // Purple Bright
    ];
    
    // Use the tag name to consistently assign the same color to the same tag
    const index = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  const renderTags = (tags: string[]) => {
    return tags.map((tag, index) => {
      const props = {
        label: tag,
        className: "mr-1 mb-1",
        disabled: false,
        'data-tag-index': index,
        tabIndex: -1,
        size: "small" as const,
        sx: {
          backgroundColor: getTagColor(tag),
          color: '#ffffff',
          '&:hover': {
            backgroundColor: getTagColor(tag),
            opacity: 0.8
          }
        }
      };
      return <Chip key={tag} {...props} />;
    });
  };

  // Dropdown handlers
  const handleAddExpenseClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  const handleSimpleExpense = () => {
    setAnchorEl(null);
    setFormData({
      description: "",
      amount: "",
      frequency: frequency,
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: "",
      accountId: '',
      notes: "",
      tags: [],
    });
    setOpen(true);
  };
  const handleCalculatedExpense = () => {
    setAnchorEl(null);
    setOpenCalc(true);
  };

  const handleAddAmountRow = () => {
    setCalculatedForm((prev) => ({
      ...prev,
      amounts: [...prev.amounts, { value: '', frequency: frequency }],
    }));
  };
  const handleRemoveAmountRow = (idx: number) => {
    setCalculatedForm((prev) => ({
      ...prev,
      amounts: prev.amounts.filter((_, i) => i !== idx),
    }));
  };
  const handleAmountChange = (idx: number, field: 'value' | 'frequency', val: string) => {
    setCalculatedForm((prev) => ({
      ...prev,
      amounts: prev.amounts.map((row, i) => i === idx ? { ...row, [field]: val } : row),
    }));
  };
  const handleCalcFieldChange = (field: string, val: any) => {
    setCalculatedForm((prev) => ({ ...prev, [field]: val }));
  };
  const handleOpenCalc = (expense?: Expense) => {
    if (expense) {
      // Editing existing calculated expense
      setEditingCalcId(expense.id);
      setCalculatedForm({
        description: expense.description,
        frequency: expense.frequency,
        startDate: format(new Date(expense.nextDue), "yyyy-MM-dd"),
        endDate: '',
        accountId: typeof expense.accountId === 'number' ? String(expense.accountId) : '',
        notes: expense.notes,
        tags: expense.tags,
        amounts: expense.calculatedAmounts || [{ value: '', frequency: frequency }],
        isCalculated: true,
        id: expense.id,
      });
    } else {
      setEditingCalcId(null);
      setCalculatedForm({
        description: "",
        frequency: frequency,
        startDate: format(new Date(), "yyyy-MM-dd"),
        endDate: "",
        accountId: '',
        notes: "",
        tags: [],
        amounts: [{ value: '', frequency: frequency }],
        isCalculated: true,
        id: undefined,
      });
    }
    setOpenCalc(true);
  };
  const handleSaveCalculatedExpense = async () => {
    // Convert all amounts to annual, average, then convert to selected frequency
    const annualAmounts = calculatedForm.amounts
      .map(a => {
        const v = parseFloat(a.value);
        if (isNaN(v)) return 0;
        switch (a.frequency) {
          case 'daily': return v * 365;
          case 'weekly': return v * 52;
          case 'biweekly': return v * 26;
          case 'monthly': return v * 12;
          case 'quarterly': return v * 4;
          case 'annually': return v;
          default: return v;
        }
      });
    const avgAnnual = annualAmounts.reduce((a, b) => a + b, 0) / (annualAmounts.length || 1);
    let finalAmount = avgAnnual;
    switch (calculatedForm.frequency) {
      case 'daily': finalAmount = avgAnnual / 365; break;
      case 'weekly': finalAmount = avgAnnual / 52; break;
      case 'biweekly': finalAmount = avgAnnual / 26; break;
      case 'monthly': finalAmount = avgAnnual / 12; break;
      case 'quarterly': finalAmount = avgAnnual / 4; break;
      case 'annually': finalAmount = avgAnnual; break;
      default: finalAmount = avgAnnual; break;
    }
    const payload = {
      id: calculatedForm.id || uuidv4(),
      description: calculatedForm.description,
      amount: finalAmount,
      frequency: calculatedForm.frequency,
      nextDue: new Date(calculatedForm.startDate),
      notes: calculatedForm.notes,
      accountId: calculatedForm.accountId === '' ? undefined : Number(calculatedForm.accountId),
      tags: calculatedForm.tags as string[],
      calculatedAmounts: calculatedForm.amounts,
      isCalculated: true,
      applyFuzziness: false,
    };
    if (editingCalcId) {
      // Update
      await axios.put(`${API_URL}/expenses/${editingCalcId}`, payload);
      setExpenses(prev => prev.map(e => e.id === editingCalcId ? { ...e, ...payload, applyFuzziness: false, tags: payload.tags as string[] } : e));
    } else {
      // Create
      await axios.post(`${API_URL}/expenses`, payload);
      setExpenses(prev => [...prev, { ...payload, applyFuzziness: false, tags: payload.tags as string[] }]);
    }
    setOpenCalc(false);
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Expenses
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box display="flex" alignItems="center" gap={2}>
            <FormControl size="small" variant="outlined" sx={{ minWidth: 200 }}>
              <InputLabel id="account-label" shrink>Account</InputLabel>
              <Select
                labelId="account-label"
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                label="Account"
                displayEmpty
              >
                <MenuItem value="">All</MenuItem>
                {accounts.map((account) => (
                  <MenuItem key={account.id} value={account.id.toString()}>
                    {account.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" variant="outlined" sx={{ minWidth: 200 }}>
              <InputLabel id="tags-label" shrink>Tags</InputLabel>
              <Select
                labelId="tags-label"
                multiple
                value={selectedTags}
                onChange={(e) => setSelectedTags(e.target.value as string[])}
                label="Tags"
                displayEmpty
                renderValue={(selected) => {
                  if (selected.length === 0) {
                    return "All";
                  }
                  return (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {selected.map((value) => (
                        <Chip 
                          key={value} 
                          label={value} 
                          size="small"
                          sx={{
                            backgroundColor: getTagColor(value),
                            color: '#ffffff',
                            fontWeight: 'medium'
                          }}
                        />
                    ))}
                  </Box>
                  );
                }}
              >
                <MenuItem value="" disabled>
                  All
                </MenuItem>
                {Array.from(new Set(expenses.flatMap(expense => expense.tags))).map((tag) => (
                  <MenuItem key={tag} value={tag}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          backgroundColor: getTagColor(tag),
                          flexShrink: 0
                        }}
                      />
                    {tag}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box display="flex" alignItems="center" gap={2}>
            <FormControl size="small" variant="outlined" sx={{ minWidth: 120 }}>
              <InputLabel id="frequency-label" shrink>Frequency</InputLabel>
              <Select
                labelId="frequency-label"
                value={frequency}
                onChange={handleFrequencyChange}
                label="Frequency"
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
              onClick={handleAddExpenseClick}
              aria-controls={Boolean(anchorEl) ? 'add-expense-menu' : undefined}
              aria-expanded={Boolean(anchorEl) ? 'true' : undefined}
            >
              Add Expense
            </Button>
            <Menu
              id="add-expense-menu"
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
              <MenuItem onClick={handleSimpleExpense}>Simple Expense</MenuItem>
              <MenuItem onClick={handleCalculatedExpense}>Calculated Expense</MenuItem>
            </Menu>
          </Box>
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
                  Frequency {sortField === 'frequency' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableCell>
                <TableCell onClick={() => handleSort('nextDue')} style={{ cursor: 'pointer' }}>
                  Initially due {sortField === 'nextDue' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableCell>
                <TableCell onClick={() => handleSort('accountId')} style={{ cursor: 'pointer' }}>
                  Account {sortField === 'accountId' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableCell>
                <TableCell>Tags</TableCell>
                <TableCell>%</TableCell>
                <TableCell onClick={() => handleSort('amountPerFrequency')} style={{ cursor: 'pointer' }} align="right">
                  {frequencies.find(f => f.value === frequency)?.label || frequency} {sortField === 'amountPerFrequency' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {expense.isCalculated ? (
                        <IconButton onClick={() => handleOpenCalc(expense)} size="small" color="primary">
                          <CalculateIcon />
                        </IconButton>
                      ) : (
                      <IconButton onClick={() => handleOpen(expense)} size="small" color="primary">
                        <EditIcon />
                      </IconButton>
                      )}
                      <IconButton onClick={() => handleDeleteClick(expense.id)} size="small" color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={expense.notes || ''} arrow placement="top">
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        {expense.description}
                        {expense.notes && (
                          <Box 
                            sx={{ 
                              width: '25%', 
                              height: '2px', 
                              backgroundColor: 'warning.main',
                              marginTop: 0.5,
                              borderRadius: '1px'
                            }} 
                          />
                        )}
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell>${expense.amount.toFixed(2)}</TableCell>
                  <TableCell>{getFrequencyLabel(expense.frequency)}</TableCell>
                  <TableCell>{format(new Date(expense.nextDue), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    {expense.accountId ? accounts.find(acc => acc.id === expense.accountId)?.name || 'N/A' : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {renderTags(expense.tags)}
                    </Box>
                  </TableCell>
                  <TableCell>{calculatePercentage(expense.amount, expense.frequency).toFixed(1)}%</TableCell>
                  <TableCell align="right">
                    {formatCurrency(calculateFrequencyAmount(expense.amount, expense.frequency, frequency))}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={8} align="right">
                  <strong>Total</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>{formatCurrency(filteredExpenses.reduce((total, expense) => 
                    total + calculateFrequencyAmount(expense.amount, expense.frequency, frequency), 0))}</strong>
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
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Amount"
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                fullWidth
                inputProps={{ step: "0.01", min: "0" }}
                InputLabelProps={{ shrink: true }}
              />
              <FormControl fullWidth variant="outlined">
                <InputLabel id="dialog-frequency-label" shrink>Frequency</InputLabel>
                <Select
                  labelId="dialog-frequency-label"
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                  label="Frequency"
                >
                  {frequencies.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                select
                label="Account"
                value={formData.accountId === '' ? '' : String(formData.accountId)}
                onChange={(e) => setFormData({ ...formData, accountId: e.target.value === '' ? '' : Number(e.target.value) })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {accounts.map((account) => (
                  <MenuItem key={account.id} value={String(account.id)}>
                    {account.name} ({account.bank})
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Initial Due Date"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <FormControl fullWidth variant="outlined">
                <Autocomplete
                  multiple
                  freeSolo
                  options={availableTags}
                  value={formData.tags}
                  onChange={(event, newValue) => {
                    setFormData({ ...formData, tags: newValue });
                  }}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        label={option}
                        size="small"
                        {...getTagProps({ index })}
                        sx={{
                          backgroundColor: getTagColor(option),
                          color: '#ffffff',
                          '&:hover': {
                            backgroundColor: getTagColor(option),
                            opacity: 0.8
                          }
                        }}
                      />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Tags"
                      placeholder="Add tags"
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                />
              </FormControl>
              <TextField
                label="Notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                multiline
                rows={2}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary">
              {editingExpense ? "Update" : "Add"}
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

      <Dialog open={openCalc} onClose={() => setOpenCalc(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCalcId ? 'Edit Calculated Expense' : 'Add Calculated Expense'}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Description"
              value={calculatedForm.description}
              onChange={e => handleCalcFieldChange('description', e.target.value)}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              select
              label="Account"
              value={calculatedForm.accountId === '' ? '' : String(calculatedForm.accountId)}
              onChange={e => handleCalcFieldChange('accountId', e.target.value === '' ? '' : Number(e.target.value))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {accounts.map((account) => (
                <MenuItem key={account.id} value={String(account.id)}>
                  {account.name} ({account.bank})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Initial Due Date"
              type="date"
              value={calculatedForm.startDate}
              onChange={e => handleCalcFieldChange('startDate', e.target.value)}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <Typography variant="subtitle1" sx={{ mt: 2 }}>Amounts to Average</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              {calculatedForm.amounts.map((row, idx) => (
                <Box key={idx} display="flex" gap={1} alignItems="flex-end" mb={1}>
                  <TextField
                    label="Amount"
                    type="number"
                    value={row.value}
                    onChange={e => handleAmountChange(idx, 'value', e.target.value)}
                    required
                    sx={{ flex: 1 }}
                    size="small"
                    inputProps={{ step: "0.01", min: "0" }}
                    InputLabelProps={{ shrink: true }}
                  />
                  <FormControl sx={{ minWidth: 100 }} size="small">
                    <InputLabel shrink>Frequency</InputLabel>
                    <Select
                      value={row.frequency}
                      onChange={e => handleAmountChange(idx, 'frequency', e.target.value)}
                      label="Frequency"
                    >
                      {frequencies.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <IconButton 
                    onClick={() => handleRemoveAmountRow(idx)} 
                    disabled={calculatedForm.amounts.length === 1}
                    size="small"
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ))}
              <Button 
                onClick={handleAddAmountRow} 
                size="small"
                startIcon={<AddIcon />}
                sx={{ 
                  height: 40, 
                  border: '2px dashed',
                  borderColor: 'grey.300',
                  color: 'grey.600',
                  '&:hover': {
                    borderColor: 'primary.main',
                    color: 'primary.main'
                  }
                }}
              >
                Add Amount
              </Button>
            </Box>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="dialog-frequency-label-calc" shrink>Overall Frequency</InputLabel>
              <Select
                labelId="dialog-frequency-label-calc"
                value={calculatedForm.frequency}
                onChange={e => handleCalcFieldChange('frequency', e.target.value)}
                label="Overall Frequency"
              >
                {frequencies.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Notes"
              value={calculatedForm.notes}
              onChange={e => handleCalcFieldChange('notes', e.target.value)}
              fullWidth
              multiline
              minRows={2}
              InputLabelProps={{ shrink: true }}
            />
            <Autocomplete
              multiple
              freeSolo
              options={availableTags}
              value={calculatedForm.tags as string[]}
              onChange={(_, newValue) => handleCalcFieldChange('tags', newValue as string[])}
              renderInput={(params) => <TextField {...params} label="Tags" InputLabelProps={{ shrink: true }} />}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCalc(false)}>Cancel</Button>
          <Button onClick={handleSaveCalculatedExpense} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Expenses; 