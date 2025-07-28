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
  Menu,
  Tabs,
  Tab,
  Divider
} from "@mui/material";
import type { SelectChangeEvent } from '@mui/material/Select';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Info as InfoIcon, Calculate as CalculateIcon, ContentCopy as CopyIcon, SwapHoriz as SwapIcon } from "@mui/icons-material";
import { format, addDays, addMonths, addWeeks, addYears, isAfter, isBefore } from "date-fns";
import { API_URL, frequencies, type Frequency } from "../config";
import { useFrequency } from '../contexts/FrequencyContext';
import { useSettings } from '../contexts/SettingsContext';
import { v4 as uuidv4 } from 'uuid';
import { apiCall } from '../utils/api';
import { useSearchParams } from 'react-router-dom';
import ManualAdjustmentModal from './ManualAdjustmentModal';

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
  manualWithdrawalsOnly?: boolean;
}

interface ExpenseVersion {
  id: number;
  expense_id: string;
  version_name: string;
  description: string;
  amount: number;
  frequency: Frequency;
  nextDue: string;
  applyFuzziness: boolean;
  notes: string;
  accountId?: number;
  tags: string[];
  manualWithdrawalsOnly: boolean;
  is_active: boolean;
  created_at: string;
  accountName?: string;
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
  manualWithdrawalsOnly: boolean;
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
  manualWithdrawalsOnly?: boolean;
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
  const { versionChangeTrigger } = useSettings();
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
    manualWithdrawalsOnly: false,
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
  const [hiddenExpenses, setHiddenExpenses] = useState<{[key: string]: boolean}>({});
  const [manualAdjustmentOpen, setManualAdjustmentOpen] = useState(false);
  const [manualAdjustmentAccounts, setManualAdjustmentAccounts] = useState<Account[]>([]);
  const [versions, setVersions] = useState<ExpenseVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [versionFormData, setVersionFormData] = useState<ExpenseFormData>({
    description: "",
    amount: "",
    frequency: "monthly",
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: "",
    accountId: '',
    notes: "",
    tags: [],
    manualWithdrawalsOnly: false,
  });
  const [editingVersion, setEditingVersion] = useState<ExpenseVersion | null>(null);
  const [selectedVersionTab, setSelectedVersionTab] = useState<number>(0); // 0 = main expense, 1+ = versions
  const [originalExpenseData, setOriginalExpenseData] = useState<ExpenseFormData | null>(null);

  // Helper function to get the next version number
  const getNextVersionNumber = () => {
    const versionNumbers = versions
      .map(v => {
        const match = v.version_name.match(/v(\d+)/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(num => num > 0);
    return versionNumbers.length > 0 ? Math.max(...versionNumbers) + 1 : 2;
  };

  // Helper function to sort versions by version number
  const sortVersionsByNumber = (versionsList: ExpenseVersion[]) => {
    return versionsList.sort((a, b) => {
      const aMatch = a.version_name.match(/v(\d+)/);
      const bMatch = b.version_name.match(/v(\d+)/);
      const aNum = aMatch ? parseInt(aMatch[1]) : 0;
      const bNum = bMatch ? parseInt(bMatch[1]) : 0;
      return aNum - bNum;
    });
  };

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

  const searchParams = useSearchParams()[0];

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch expenses (including hidden ones)
      const expensesResponse = await apiCall('/expenses?includeHidden=true');
      if (!expensesResponse.ok) {
        throw new Error('Failed to fetch expenses');
      }
      const data = await expensesResponse.json() as ExpenseResponse[];
      const processedExpenses: Expense[] = data.map((expense) => {
        const { isCalculated, calculatedAmounts, tags, manualWithdrawalsOnly, ...rest } = expense;
        return {
          ...rest,
        nextDue: new Date(expense.nextDue),
        tags: tags || [],
        isCalculated: Boolean(isCalculated),
        calculatedAmounts: (calculatedAmounts ?? []) as { value: string; frequency: Frequency }[],
        manualWithdrawalsOnly: manualWithdrawalsOnly || false,
        };
      });
              setExpenses(processedExpenses);

      // Fetch hidden expenses status
      const hiddenExpensesResponse = await apiCall('/hidden-expenses');
      if (hiddenExpensesResponse.ok) {
        const hiddenData = await hiddenExpensesResponse.json();
        const hiddenMap: {[key: string]: boolean} = {};
        hiddenData.forEach((item: any) => {
          hiddenMap[item.expense_id] = item.is_hidden === 1;
        });
        setHiddenExpenses(hiddenMap);
      }

      // Fetch accounts
      const accountsResponse = await apiCall('/accounts');
      if (!accountsResponse.ok) {
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsResponse.json();
      setAccounts(accountsData);

      // Fetch tags
      const tagsResponse = await apiCall('/tags');
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
      const frequencyResponse = await apiCall('/settings/frequency');
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

  useEffect(() => {
    fetchData();
    // Fetch accounts for manual adjustment modal
    apiCall('/accounts').then(async (res) => {
      if (res.ok) {
        setManualAdjustmentAccounts(await res.json());
      }
    });
  }, []);

  // Listen for version changes and refresh data
  useEffect(() => {
    if (versionChangeTrigger > 0) {
      fetchData();
    }
  }, [versionChangeTrigger]);

  useEffect(() => {
    const searchTags = searchParams.get('tags');
    if (searchTags) {
      setSelectedTags(searchTags.split(','));
    }
  }, [searchParams]);

  useEffect(() => {
    const searchAccount = searchParams.get('account');
    if (searchAccount) {
      setSelectedAccount(searchAccount);
    }
  }, [searchParams]);

  const saveFrequency = async (newFrequency: Frequency) => {
    try {
      const response = await apiCall('/settings/frequency', {
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
      const response = await apiCall('/expenses');
      if (!response.ok) {
        throw new Error("Failed to fetch expenses");
      }
      const data = await response.json() as ExpenseResponse[];
      const processedExpenses: Expense[] = data.map((expense) => {
        const { isCalculated, calculatedAmounts, tags, manualWithdrawalsOnly, ...rest } = expense;
        return {
          ...rest,
        nextDue: new Date(expense.nextDue),
          tags: tags || [],
          isCalculated: Boolean(isCalculated),
          calculatedAmounts: (calculatedAmounts ?? []) as { value: string; frequency: Frequency }[],
          manualWithdrawalsOnly: manualWithdrawalsOnly || false,
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
      const response = await apiCall('/accounts');
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

  const handleDeleteConfirm = async () => {
    if (!expenseToDelete) return;

    try {
      const response = await apiCall(`/expenses/${expenseToDelete.id}`, {
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
        tags: formData.tags || [],
        manualWithdrawalsOnly: formData.manualWithdrawalsOnly
      };

      console.log('Frontend sending expense data:', expenseData);

      if (editingExpense) {
        const response = await apiCall(`/expenses/${editingExpense.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(expenseData),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update expense');
        }
        setSuccessMessage("Expense updated successfully");
      } else {
        const response = await apiCall('/expenses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(expenseData),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create expense');
        }
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

  const handleOpen = (expense?: Expense) => {
          if (expense) {
        console.log('Opening expense for editing:', expense);
        setEditingExpense(expense);
        
        // Create the original expense data for the main form
        const originalData = {
          description: expense.description,
          amount: expense.amount.toString(),
          frequency: expense.frequency,
          startDate: format(new Date(expense.nextDue), "yyyy-MM-dd"),
          endDate: "",
          accountId: expense.accountId || '',
          notes: expense.notes || "",
          tags: expense.tags || [],
          manualWithdrawalsOnly: expense.manualWithdrawalsOnly || false,
        } as ExpenseFormData;
        
        // Store the original data and set it as the initial form data
        setOriginalExpenseData(originalData);
        setFormData(originalData);
      
      // Fetch versions for this expense and set the active tab
      fetchVersions(expense.id).then(async (versionsData) => {
        // Ensure Version 1 exists for this expense
        await ensureVersion1Exists(expense.id);
        
        // After fetching versions, determine which tab should be active
        // If there are versions and one is active, select that tab
        // Otherwise, default to Version 1 (tab 0)
        if (versionsData && versionsData.length > 0) {
          const activeVersion = versionsData.find((v: ExpenseVersion) => v.is_active);
          if (activeVersion) {
            const activeIndex = versionsData.findIndex((v: ExpenseVersion) => v.id === activeVersion.id);
            setSelectedVersionTab(activeIndex + 1);
            handleLoadVersion(activeVersion);
          } else {
            setSelectedVersionTab(0);
            setEditingVersion(null);
          }
        } else {
          setSelectedVersionTab(0);
          setEditingVersion(null);
        }
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
        manualWithdrawalsOnly: false,
      });
      setVersions([]);
      setSelectedVersionTab(0);
      setEditingVersion(null);
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
      manualWithdrawalsOnly: false,
    });
    setVersions([]);
    setSelectedVersionTab(0);
    setEditingVersion(null);
    setOriginalExpenseData(null);
  };

  const handleDeleteClick = (id: string) => {
    setExpenseToDelete(expenses.find(e => e.id === id) || null);
    setDeleteDialogOpen(true);
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
      case "fortnightly":
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
      case "fortnightly":
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
        case "fortnightly":
          nextDue = addDays(nextDue, 14);
          break;
        case "monthly":
          nextDue = addMonths(nextDue, 1);
          break;
        case "quarterly":
          nextDue = addMonths(nextDue, 3);
          break;
        case "annually":
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
      manualWithdrawalsOnly: false,
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
          case 'fortnightly': return v * 26;
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
      case 'fortnightly': finalAmount = avgAnnual / 26; break;
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
      await apiCall(`/expenses/${editingCalcId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      setExpenses(prev => prev.map(e => e.id === editingCalcId ? { ...e, ...payload, applyFuzziness: false, tags: payload.tags as string[] } : e));
    } else {
      // Create
      await apiCall('/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      setExpenses(prev => [...prev, { ...payload, applyFuzziness: false, tags: payload.tags as string[] }]);
    }
    setOpenCalc(false);
  };

  const handleManualAdjustmentSave = async (data: any) => {
    try {
      const response = await apiCall('/manual-adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to save manual adjustment');
      setManualAdjustmentOpen(false);
      fetchData();
    } catch (err) {
      alert('Failed to save manual adjustment');
    }
  };

  // Fetch versions for a specific expense
  const fetchVersions = async (expenseId: string) => {
    try {
      const response = await apiCall(`/expenses/${expenseId}/versions`);
      if (response.ok) {
        const versionsData = await response.json();
        setVersions(versionsData);
        if (versionsData.length > 0) {
          setSelectedVersion(versionsData[0].id);
        }
        return versionsData;
      }
      return [];
    } catch (err) {
      console.error('Error fetching versions:', err);
      return [];
    }
  };



  // Activate version
  const handleActivateVersion = async (versionId: number) => {
    if (!editingExpense) return;

    try {
      // If we're on a version tab, update the version data first with current form data
      if (selectedVersionTab > 0 && editingVersion) {
        const updateData = {
          description: versionFormData.description,
          amount: parseFloat(versionFormData.amount),
          frequency: versionFormData.frequency,
          nextDue: versionFormData.startDate,
          notes: versionFormData.notes,
          accountId: versionFormData.accountId === '' ? null : versionFormData.accountId,
          tags: versionFormData.tags || [],
          manualWithdrawalsOnly: versionFormData.manualWithdrawalsOnly
        };

        const updateResponse = await apiCall(`/expenses/${editingExpense.id}/versions/${versionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        });

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          throw new Error(errorData.error || 'Failed to update version');
        }
      }

      // If we're on Current (main expense), we need to activate it
      if (selectedVersionTab === 0) {
        // Find the v1 entry and activate it
        const version1 = versions.find(v => v.version_name === 'v1');
        if (version1) {
          const response = await apiCall(`/expenses/${editingExpense.id}/versions/${version1.id}/activate`, {
            method: 'POST',
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to activate version');
          }

          setSuccessMessage("Version activated successfully");
          setShowSuccess(true);
          fetchExpenses();
          fetchVersions(editingExpense.id);
          handleClose();
          return;
        }
      }

      const response = await apiCall(`/expenses/${editingExpense.id}/versions/${versionId}/activate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to activate version');
      }

      setSuccessMessage("Version activated successfully");
      setShowSuccess(true);
      fetchExpenses();
      fetchVersions(editingExpense.id);
      
      // Close the modal after activating the version
      handleClose();
    } catch (error) {
      console.error('Error activating version:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to activate version');
      setShowError(true);
    }
  };

  // Delete version
  const handleDeleteVersion = async (versionId: number) => {
    if (!editingExpense) return;

    try {
      const response = await apiCall(`/expenses/${editingExpense.id}/versions/${versionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete version');
      }

      setSuccessMessage("Version deleted successfully");
      setShowSuccess(true);
      fetchVersions(editingExpense.id);
    } catch (error) {
      console.error('Error deleting version:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete version');
      setShowError(true);
    }
  };

  // Load version data into form
  const handleLoadVersion = (version: ExpenseVersion) => {
    setVersionFormData({
      description: version.description,
      amount: version.amount.toString(),
      frequency: version.frequency,
      startDate: format(new Date(version.nextDue), "yyyy-MM-dd"),
      endDate: "",
      accountId: version.accountId || '',
      notes: version.notes || "",
      tags: version.tags || [],
      manualWithdrawalsOnly: version.manualWithdrawalsOnly || false,
    });
    setEditingVersion(version);
    // Find the tab index for this version in the sorted list
    const sortedVersions = sortVersionsByNumber(versions);
    const versionIndex = sortedVersions.findIndex(v => v.id === version.id);
    if (versionIndex !== -1) {
      setSelectedVersionTab(versionIndex + 1);
    }
  };

  // Handle clicking on Version 1 tab to restore original data
  const handleVersion1Click = () => {
    if (originalExpenseData) {
      setFormData(originalExpenseData);
    }
    setEditingVersion(null);
  };

  // Create Version 1 for new expenses if it doesn't exist
  const ensureVersion1Exists = async (expenseId: string) => {
    try {
      const response = await apiCall(`/expenses/${expenseId}/versions`);
      if (response.ok) {
        const versions = await response.json();
        // If no versions exist, create v1 with the original expense data
        if (versions.length === 0 && originalExpenseData) {
          const versionData = {
            version_name: 'v1',
            description: originalExpenseData.description,
            amount: parseFloat(originalExpenseData.amount),
            frequency: originalExpenseData.frequency,
            nextDue: originalExpenseData.startDate,
            notes: originalExpenseData.notes,
            accountId: originalExpenseData.accountId === '' ? null : originalExpenseData.accountId,
            tags: originalExpenseData.tags || [],
            manualWithdrawalsOnly: originalExpenseData.manualWithdrawalsOnly
          };

          const createResponse = await apiCall(`/expenses/${expenseId}/versions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(versionData),
          });

          if (createResponse.ok) {
            // Refresh versions list
            await fetchVersions(expenseId);
          }
        }
      }
    } catch (error) {
      console.error('Error ensuring Version 1 exists:', error);
    }
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
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setManualAdjustmentOpen(true)}
            >
              Manual Adjustment
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {expense.description}
                        </Box>
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
                <TableCell colSpan={7} align="right">
                  <strong>Total</strong>
                </TableCell>
                <TableCell align="center">
                  <strong>{filteredExpenses.reduce((sum, expense) => sum + calculatePercentage(expense.amount, expense.frequency), 0).toFixed(1)}%</strong>
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
          
          {/* Version Tabs - Only show when editing an existing expense */}
          {editingExpense && (
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
              <Tabs 
                value={selectedVersionTab} 
                onChange={(e, newValue) => setSelectedVersionTab(newValue)}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab 
                  label="Current" 
                  value={0} 
                  onClick={handleVersion1Click}
                />
                {sortVersionsByNumber(versions)
                  .map((version, index) => (
                    <Tab 
                      key={version.id} 
                      label={version.version_name} 
                      value={index + 1}
                      onClick={() => handleLoadVersion(version)}
                    />
                  ))}
                <Tab 
                  label="+" 
                  value={versions.length + 1}
                  onClick={async () => {
                                      // Automatically create the next version when plus is clicked
                  const nextVersionNumber = getNextVersionNumber();
                  const versionName = `v${nextVersionNumber}`;
                  console.log(`Creating new version: ${versionName} (current versions: ${versions.map(v => v.version_name).join(', ')})`);
                    
                    // If this is the first version being created, we need to create v1 first
                    if (versions.length === 0) {
                      // Create v1 with the original expense data
                      const v1Data = {
                        version_name: 'v1',
                        description: originalExpenseData?.description || formData.description,
                        amount: parseFloat(originalExpenseData?.amount || formData.amount),
                        frequency: originalExpenseData?.frequency || formData.frequency,
                        nextDue: originalExpenseData?.startDate || formData.startDate,
                        notes: originalExpenseData?.notes || formData.notes,
                        accountId: originalExpenseData?.accountId === '' ? null : (originalExpenseData?.accountId || formData.accountId),
                        tags: originalExpenseData?.tags || formData.tags || [],
                        manualWithdrawalsOnly: originalExpenseData?.manualWithdrawalsOnly || formData.manualWithdrawalsOnly
                      };

                      const v1Response = await apiCall(`/expenses/${editingExpense!.id}/versions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(v1Data),
                      });

                      if (!v1Response.ok) {
                        const errorData = await v1Response.json();
                        throw new Error(errorData.error || 'Failed to create v1');
                      }

                      console.log('Created v1 with original data');
                    }

                    const requestData = {
                      version_name: versionName,
                      description: formData.description,
                      amount: parseFloat(formData.amount),
                      frequency: formData.frequency,
                      nextDue: formData.startDate,
                      notes: formData.notes,
                      accountId: formData.accountId === '' ? null : formData.accountId,
                      tags: formData.tags || [],
                      manualWithdrawalsOnly: formData.manualWithdrawalsOnly
                    };

                    try {
                      const response = await apiCall(`/expenses/${editingExpense!.id}/versions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestData),
                      });

                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Failed to create version');
                      }

                      // Fetch the updated versions list
                      await fetchVersions(editingExpense!.id);
                      
                      // Find the newly created version and switch to its tab
                      const versionsResponse = await apiCall(`/expenses/${editingExpense!.id}/versions`);
                      if (versionsResponse.ok) {
                        const updatedVersions = await versionsResponse.json();
                        const newVersion = updatedVersions.find((v: any) => v.version_name === versionName);
                        if (newVersion) {
                          // Switch to the new version's tab
                          const sortedVersions = sortVersionsByNumber(updatedVersions);
                          const newVersionIndex = sortedVersions.findIndex((v: any) => v.id === newVersion.id);
                          if (newVersionIndex !== -1) {
                            setSelectedVersionTab(newVersionIndex + 1);
                            handleLoadVersion(newVersion);
                          }
                        }
                      }

                      setSuccessMessage("Version created successfully");
                      setShowSuccess(true);
                    } catch (error) {
                      console.error('Error creating version:', error);
                      setErrorMessage(error instanceof Error ? error.message : 'Failed to create version');
                      setShowError(true);
                    }
                  }}
                />
              </Tabs>
            </Box>
          )}
          
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={2} mt={1}>
              {/* Show different form data based on selected tab */}
              {selectedVersionTab === 0 ? (
                // Version 1 (main expense) form
                <>
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
                    value.map((option, index) => {
                      const tagProps = getTagProps({ index });
                      const { key, ...otherProps } = tagProps;
                      return (
                        <Chip
                          key={key}
                          label={option}
                          size="small"
                          {...otherProps}
                          sx={{
                            backgroundColor: getTagColor(option),
                            color: '#ffffff',
                            '&:hover': {
                              backgroundColor: getTagColor(option),
                              opacity: 0.8
                            }
                          }}
                        />
                      );
                    })
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
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Checkbox
                  checked={formData.manualWithdrawalsOnly}
                  onChange={(e) => setFormData({ ...formData, manualWithdrawalsOnly: e.target.checked })}
                  color="primary"
                />
                <Typography variant="body2" color="text.secondary">
                  Long-term savings
                </Typography>
              </Box>
            </>
          ) : (
            // Version form
            <>
              <TextField
                label="Description"
                value={versionFormData.description}
                onChange={(e) => setVersionFormData({ ...versionFormData, description: e.target.value })}
                required
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Amount"
                type="number"
                value={versionFormData.amount}
                onChange={(e) => setVersionFormData({ ...versionFormData, amount: e.target.value })}
                required
                fullWidth
                inputProps={{ step: "0.01", min: "0" }}
                InputLabelProps={{ shrink: true }}
              />
              <FormControl fullWidth variant="outlined">
                <InputLabel id="dialog-frequency-label" shrink>Frequency</InputLabel>
                <Select
                  labelId="dialog-frequency-label"
                  value={versionFormData.frequency}
                  onChange={(e) => setVersionFormData({ ...versionFormData, frequency: e.target.value })}
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
                value={versionFormData.accountId === '' ? '' : String(versionFormData.accountId)}
                onChange={(e) => setVersionFormData({ ...versionFormData, accountId: e.target.value === '' ? '' : Number(e.target.value) })}
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
                value={versionFormData.startDate}
                onChange={(e) => setVersionFormData({ ...versionFormData, startDate: e.target.value })}
                required
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <FormControl fullWidth variant="outlined">
                <Autocomplete
                  multiple
                  freeSolo
                  options={availableTags}
                  value={versionFormData.tags}
                  onChange={(event, newValue) => {
                    setVersionFormData({ ...versionFormData, tags: newValue });
                  }}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => {
                      const tagProps = getTagProps({ index });
                      const { key, ...otherProps } = tagProps;
                      return (
                        <Chip
                          key={key}
                          label={option}
                          size="small"
                          {...otherProps}
                          sx={{
                            backgroundColor: getTagColor(option),
                            color: '#ffffff',
                            '&:hover': {
                              backgroundColor: getTagColor(option),
                              opacity: 0.8
                            }
                          }}
                        />
                      );
                    })
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
                value={versionFormData.notes}
                onChange={(e) => setVersionFormData({ ...versionFormData, notes: e.target.value })}
                multiline
                rows={2}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Checkbox
                  checked={versionFormData.manualWithdrawalsOnly}
                  onChange={(e) => setVersionFormData({ ...versionFormData, manualWithdrawalsOnly: e.target.checked })}
                  color="primary"
                />
                <Typography variant="body2" color="text.secondary">
                  Long-term savings
                </Typography>
              </Box>
            </>
          )}
            </Box>
          </DialogContent>
                  <DialogActions>
          {selectedVersionTab === 0 ? (
            <>
              <Button onClick={handleClose} variant="outlined">
                Cancel
              </Button>
              <Button type="submit" variant="contained" color="primary">
                Update
              </Button>
            </>
          ) : (
            <>
              <Button 
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this version?')) {
                    handleDeleteVersion(editingVersion?.id || 0);
                  }
                }} 
                variant="outlined"
                color="error"
              >
                Delete
              </Button>
              <Button onClick={handleClose} variant="outlined">
                Cancel
              </Button>
              <Button 
                onClick={() => handleActivateVersion(editingVersion?.id || 0)} 
                variant="contained" 
                color="primary"
                disabled={editingVersion?.is_active}
              >
                Activate
              </Button>
            </>
          )}
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

      <ManualAdjustmentModal
        open={manualAdjustmentOpen}
        onClose={() => setManualAdjustmentOpen(false)}
        onSave={handleManualAdjustmentSave}
        accounts={manualAdjustmentAccounts}
        allowedType="withdrawal"
      />


    </Box>
  );
};

export default Expenses; 