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
  Menu,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Info as InfoIcon, Calculate as CalculateIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import { API_URL, frequencies, type Frequency } from '../config';
import { useFrequency } from '../contexts/FrequencyContext';
import { useSettings } from '../contexts/SettingsContext';
import { v4 as uuidv4 } from 'uuid';
import { apiCall } from '../utils/api';

interface IncomeEntry {
  id: string;
  description: string;
  amount: number;
  frequency: Frequency;
  nextDue: Date;
  isCalculated?: boolean;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const formatDate = (date: string | Date) => {
  return format(new Date(date), 'MMM d, yyyy');
};

const getFrequencyLabel = (frequency: string) => {
  const freq = frequencies.find(f => f.value === frequency);
  return freq ? freq.label : frequency;
};

const Income = () => {
  const { frequency, setFrequency } = useFrequency();
  const { versionChangeTrigger } = useSettings();
  const [incomes, setIncomes] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [incomeToDelete, setIncomeToDelete] = useState<string | null>(null);
  const [editingIncome, setEditingIncome] = useState<IncomeEntry | null>(null);
  const [sortField, setSortField] = useState<keyof IncomeEntry | "percentage" | "amountPerFrequency">("description");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [newIncome, setNewIncome] = useState({
    description: '',
    amount: '',
    frequency: 'monthly' as Frequency,
    nextDue: new Date().toISOString().split('T')[0],
  });
  const [openCalc, setOpenCalc] = useState(false);
  const [editingCalcId, setEditingCalcId] = useState<string | null>(null);
  const [calculatedForm, setCalculatedForm] = useState({
    description: '',
    frequency: frequency,
    startDate: new Date().toISOString().split('T')[0],
    amounts: [{ value: '', frequency: frequency }],
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch incomes
      const incomesResponse = await apiCall('/income');
      if (!incomesResponse.ok) {
        throw new Error('Failed to fetch incomes');
      }
      const incomesData = await incomesResponse.json();
      setIncomes(incomesData.map((income: any) => ({
        ...income,
        nextDue: new Date(income.nextDue)
      })));
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Listen for version changes and refresh data
  useEffect(() => {
    if (versionChangeTrigger > 0) {
      fetchData();
    }
  }, [versionChangeTrigger]);

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
      const response = await apiCall(`/income/${incomeToDelete}`, {
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
        const response = await apiCall(`/income/${editingIncome.id}`, {
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

        const response = await apiCall('/income', {
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
    let aValue: string | number | boolean | Date = a[sortField as keyof IncomeEntry] ?? "";
    let bValue: string | number | boolean | Date = b[sortField as keyof IncomeEntry] ?? "";

    // Skip sorting for boolean fields
    if (typeof aValue === "boolean" || typeof bValue === "boolean") {
      return 0;
    }

    if (sortField === "percentage") {
      aValue = (Number(a.amount) / totalIncome) * 100;
      bValue = (Number(b.amount) / totalIncome) * 100;
    } else if (sortField === "amountPerFrequency") {
      aValue = calculateFrequencyAmount(a.amount.toString(), a.frequency, frequency);
      bValue = calculateFrequencyAmount(b.amount.toString(), b.frequency, frequency);
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

  const calculateFrequencyAmount = (amount: string, incomeFrequency: string, targetFrequency: string) => {
    // First convert to monthly equivalent
    let monthlyAmount = Number(amount);
    switch (incomeFrequency) {
      case "daily":
        monthlyAmount = monthlyAmount * 30;
        break;
      case "weekly":
        monthlyAmount = monthlyAmount * 4;
        break;
      case "biweekly":
        monthlyAmount = monthlyAmount * 2;
        break;
      case "quarterly":
        monthlyAmount = monthlyAmount / 3;
        break;
      case "annually":
        monthlyAmount = monthlyAmount / 12;
        break;
    }

    // Then convert to target frequency
    switch (targetFrequency) {
      case "daily":
        return monthlyAmount / 30;
      case "weekly":
        return monthlyAmount / 4;
      case "biweekly":
        return monthlyAmount / 2;
      case "monthly":
        return monthlyAmount;
      case "quarterly":
        return monthlyAmount * 3;
      case "annually":
        return monthlyAmount * 12;
      default:
        return monthlyAmount;
    }
  };

  const handleFrequencyChange = (event: SelectChangeEvent) => {
    setFrequency(event.target.value as Frequency);
  };

  const handleAddIncomeClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSimpleIncome = () => {
    setAnchorEl(null);
    setNewIncome({
      description: "",
      amount: "",
      frequency: "monthly",
      nextDue: format(new Date(), "yyyy-MM-dd"),
    });
    setOpen(true);
  };

  const handleCalculatedIncome = () => {
    setAnchorEl(null);
    handleOpenCalc();
  };

  const handleOpenCalc = () => {
    setEditingCalcId(null);
    setCalculatedForm({
      description: '',
      frequency: frequency,
      startDate: new Date().toISOString().split('T')[0],
      amounts: [{ value: '', frequency: frequency }],
    });
    setOpenCalc(true);
  };

  const handleAddAmountRow = () => {
    setCalculatedForm((prev) => ({
      ...prev,
      amounts: [...prev.amounts, { value: '', frequency: prev.frequency }],
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

  const handleSaveCalculatedIncome = async () => {
    try {
      if (!calculatedForm.description || calculatedForm.amounts.length === 0) {
        setError('Please fill in all fields');
        return;
      }

      // Calculate average amount
      const totalAmount = calculatedForm.amounts.reduce((sum, amount) => sum + parseFloat(amount.value), 0);
      const averageAmount = totalAmount / calculatedForm.amounts.length;

      const newEntry = {
        id: Date.now().toString(),
        description: calculatedForm.description,
        amount: averageAmount,
        frequency: calculatedForm.frequency,
        nextDue: new Date(calculatedForm.startDate).toISOString(),
        isCalculated: true,
      };

      const response = await apiCall('/income', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newEntry),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create calculated income');
      }

      setIncomes(prevIncomes => [...prevIncomes, { ...newEntry, nextDue: new Date(newEntry.nextDue) }]);
      setOpenCalc(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save calculated income');
      console.error('Error saving calculated income:', error);
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
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Frequency</InputLabel>
            <Select
              value={frequency}
              label="Frequency"
              onChange={handleFrequencyChange}
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
            onClick={handleAddIncomeClick}
            aria-controls={Boolean(anchorEl) ? 'add-income-menu' : undefined}
            aria-expanded={Boolean(anchorEl) ? 'true' : undefined}
          >
            Add Income
          </Button>
          <Menu
            id="add-income-menu"
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          >
            <MenuItem onClick={handleSimpleIncome}>Simple Income</MenuItem>
            <MenuItem onClick={handleCalculatedIncome}>Calculated Income</MenuItem>
          </Menu>
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
                align="right"
                onClick={() => handleSort('amountPerFrequency')}
                sx={{ cursor: 'pointer' }}
              >
                {getFrequencyLabel(frequency)}
                {sortField === 'amountPerFrequency' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedIncome.map((income) => (
              <TableRow key={income.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title={income.isCalculated ? "Calculated Income" : "Edit Income"}>
                      <IconButton
                        size="small"
                        onClick={() => handleOpen(income)}
                        color="primary"
                      >
                        {income.isCalculated ? <CalculateIcon /> : <EditIcon />}
                      </IconButton>
                    </Tooltip>
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
                <TableCell>
                  ${calculateFrequencyAmount(income.amount.toString(), income.frequency, frequency).toFixed(2)}
                </TableCell>
                <TableCell>{income.frequency}</TableCell>
                <TableCell>{formatDate(income.nextDue)}</TableCell>
                <TableCell>{((Number(income.amount) / totalIncome) * 100).toFixed(1)}%</TableCell>
                <TableCell align="right">
                  ${calculateFrequencyAmount(income.amount.toString(), income.frequency, frequency).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow sx={{ backgroundColor: 'rgba(0, 0, 0, 0.04)' }}>
              <TableCell colSpan={6} align="right"><strong>Total</strong></TableCell>
              <TableCell colSpan={2} align="right" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                {formatCurrency(
                  incomes.reduce((sum, income) => sum + calculateFrequencyAmount(income.amount.toString(), income.frequency, frequency), 0)
                )}
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

      {/* Calculated Income Dialog */}
      <Dialog open={openCalc} onClose={() => setOpenCalc(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCalcId ? 'Edit Calculated Income' : 'Add Calculated Income'}</DialogTitle>
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
              label="Initial Due Date"
              type="date"
              value={calculatedForm.startDate}
              onChange={e => handleCalcFieldChange('startDate', e.target.value)}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Amounts to Average</Typography>
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
                    <TextField
                      select
                      label="Frequency"
                      value={row.frequency}
                      onChange={e => handleAmountChange(idx, 'frequency', e.target.value)}
                      size="small"
                      sx={{ minWidth: 100 }}
                      InputLabelProps={{ shrink: true }}
                    >
                      {frequencies.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
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
            </Box>
            <TextField
              select
              label="Overall Frequency"
              value={calculatedForm.frequency}
              onChange={e => handleCalcFieldChange('frequency', e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            >
              {frequencies.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCalc(false)}>Cancel</Button>
          <Button onClick={handleSaveCalculatedIncome} variant="contained" color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Income; 