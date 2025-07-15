import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
} from '@mui/material';
import { format, subDays, addDays, subMonths, addMonths, subWeeks, addWeeks, differenceInDays } from 'date-fns';
import { API_URL, frequencies, type Frequency } from '../config';
import { apiCall } from '../utils/api';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';

interface Expense {
  id: string;
  description: string;
  amount: number;
  frequency: Frequency;
  nextDue: string;
  accountId: number | null;
}

interface Account {
  id: number;
  name: string;
  bank: string;
  currentBalance: number;
  requiredBalance: number;
  isPrimary: number;
  diff: number;
}

const Planning = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFrequency, setSelectedFrequency] = useState<string>('daily');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [showUpdateAllModal, setShowUpdateAllModal] = useState(false);
  const [updateAllFrequency, setUpdateAllFrequency] = useState<string>('daily');
  const [updateLog, setUpdateLog] = useState<string[]>([]);
  const [showAutoUpdateModal, setShowAutoUpdateModal] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const [displayedLog, setDisplayedLog] = useState<string[]>([]);
  const [showProgressBar, setShowProgressBar] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [expensesResponse, accountsResponse] = await Promise.all([
          apiCall('/expenses'),
          apiCall('/accounts')
        ]);
        
        if (expensesResponse.ok && accountsResponse.ok) {
          const expensesData = await expensesResponse.json();
          const accountsData = await accountsResponse.json();
          setExpenses(expensesData);
          setAccounts(accountsData);
        } else {
          throw new Error('Failed to fetch data');
        }
      } catch (err) {
        setError('Failed to fetch data');
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    // Fetch frequency from /settings/frequency and trigger update all on mount
    const autoUpdateAll = async () => {
      try {
        const freqRes = await apiCall('/settings/frequency');
        let freq = 'daily';
        if (freqRes.ok) {
          const data = await freqRes.json();
          freq = data.frequency || 'daily';
          setSelectedFrequency(freq);
          setUpdateAllFrequency(freq);
        }
        setShowAutoUpdateModal(true);
        setUpdateLog([`Starting required balance update for all accounts (frequency: ${freq})...`]);
        for (const account of accounts) {
          setUpdateLog((log: string[]) => [...log, `\nUpdating account: ${account.name} (${account.bank})`]);
          let accountTotal = 0;
          const accountExpenses = expenses.filter(e => e.accountId === account.id);
          if (accountExpenses.length === 0) {
            setUpdateLog((log: string[]) => [...log, '  No expenses for this account.']);
          }
          for (const expense of accountExpenses) {
            const { lastScheduled } = calculateScheduledDates(expense.nextDue, expense.frequency);
            // Use the frequency from /settings/frequency (freq) for both rate and periods
            const rate = calculateRate(expense.amount, expense.frequency, freq);
            const periods = calculateTimeSinceLastDueWithFrequency(lastScheduled, freq);
            const accrued = parseFloat(calculateAccruedAmount(rate, periods));
            accountTotal += accrued;
            // Use freq for labels
            const freqLabel = getFrequencyLabel(freq as Frequency).toLowerCase();
            let perLabel = freqLabel;
            if (freq === 'daily') perLabel = 'day';
            else if (freq === 'weekly') perLabel = 'week';
            else if (freq === 'monthly') perLabel = 'month';
            else if (freq === 'quarterly') perLabel = 'quarter';
            else if (freq === 'annually') perLabel = 'year';
            let periodLabel = freqLabel;
            if (freq === 'daily') periodLabel = 'days';
            else if (freq === 'weekly') periodLabel = 'weeks';
            else if (freq === 'monthly') periodLabel = 'months';
            else if (freq === 'quarterly') periodLabel = 'quarters';
            else if (freq === 'annually') periodLabel = 'years';
            else if (!freqLabel.endsWith('s')) periodLabel = freqLabel + 's';
            // Fix rate for fortnightly->weekly log
            let logRate = rate;
            let logAccrued = accrued;
            if ((expense.frequency === 'biweekly' || expense.frequency === 'fortnightly') && freq === 'weekly') {
              logRate = expense.amount * 26 / 52;
              // periods should be 2 for 2 weeks, so accrued = amount
              if (periods === 2) {
                logAccrued = expense.amount;
              } else {
                logAccrued = logRate * periods;
              }
            }
            setUpdateLog((log: string[]) => [
              ...log,
              `  - ${expense.description}: $${expense.amount.toFixed(2)} (${expense.frequency === 'biweekly' ? 'fortnightly' : expense.frequency}), Rate: $${logRate.toFixed(2)} per ${perLabel} x ${periods} ${periodLabel} = $${logAccrued.toFixed(2)}`
            ]);
          }
          try {
            const response = await apiCall(`/accounts/${account.id}`, {
              method: 'PUT',
              body: JSON.stringify({
                name: account.name,
                bank: account.bank,
                currentBalance: account.currentBalance,
                requiredBalance: accountTotal,
                isPrimary: account.isPrimary,
                diff: account.diff
              })
            });
            if (response.ok) {
              setUpdateLog((log: string[]) => [...log, `✔️ Updated ${account.name}: $${accountTotal.toFixed(2)}`, '--------------------']);
            } else {
              setUpdateLog((log: string[]) => [...log, `❌ Failed to update ${account.name}`]);
            }
          } catch (err) {
            setUpdateLog((log: string[]) => [...log, `❌ Error updating ${account.name}`]);
          }
        }
        setUpdateLog((log: string[]) => [...log, '\nAll updates complete.']);
        // Refresh accounts data
        const accountsResponse = await apiCall('/accounts');
        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json();
          setAccounts(accountsData);
        }
      } catch (err) {
        setUpdateLog((log: string[]) => [...log, '❌ Error during auto update.']);
      }
    };
    if (accounts.length > 0 && expenses.length > 0) {
      autoUpdateAll();
    }
    // eslint-disable-next-line
  }, [accounts.length, expenses.length]);

  // Animate log lines in modal
  useEffect(() => {
    if (!showAutoUpdateModal || updateLog.length === 0) {
      setDisplayedLog([]);
      return;
    }
    let cancelled = false;
    // Only animate forward: start from 0 and incrementally add lines
    setDisplayedLog([updateLog[0]]);
    const totalDuration = 3000; // 3 seconds (much faster)
    const interval = updateLog.length > 1 ? totalDuration / updateLog.length : totalDuration;
    let idx = 1;
    function showNext() {
      if (cancelled) return;
      setDisplayedLog((prev) => updateLog.slice(0, idx + 1));
      idx++;
      if (idx < updateLog.length) {
        setTimeout(showNext, interval);
      }
    }
    if (updateLog.length > 1) setTimeout(showNext, interval);
    return () => { cancelled = true; };
  }, [showAutoUpdateModal, updateLog]);

  // Update the scroll-to-bottom logic to always scroll to the very bottom after each new line
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight - logRef.current.clientHeight + 40;
    }
  }, [displayedLog]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getFrequencyLabel = (frequency: Frequency) => {
    const freq = frequencies.find(f => f.value === frequency);
    return freq ? freq.label : frequency;
  };

  const calculateDailyAmount = (amount: number, frequency: Frequency) => {
    switch (frequency) {
      case 'daily':
        return amount;
      case 'weekly':
        return amount / 7;
      case 'biweekly':
        return amount / 14;
      case 'monthly':
        return amount / 30.44; // Average days in a month
      case 'quarterly':
        return amount / 91.31; // Average days in a quarter
      case 'annually':
        return amount / 365.25; // Account for leap years
      default:
        return amount;
    }
  };

  const calculateAccruedAmount = (rate: number, timeSinceLastDue: number): string => {
    const result = rate * timeSinceLastDue;
    return result.toFixed(2);
  };

  const calculateScheduledDates = (nextDueDate: string, frequency: string) => {
    const today = new Date();
    const nextDue = new Date(nextDueDate);
    let lastScheduled: Date;
    let nextScheduled: Date;
    let lastDue: Date;

    // Get the day of the week (0-6, where 0 is Sunday)
    const dayOfWeek = nextDue.getDay();
    // Get the month and day for date-based calculations
    const month = nextDue.getMonth();
    const day = nextDue.getDate();

    // Calculate the last scheduled date (most recent past occurrence)
    switch (frequency) {
      case 'daily':
        lastScheduled = subDays(today, 1);
        break;
      case 'weekly': {
        // Find the most recent occurrence of the same day of week
        const daysSinceLast = (today.getDay() - dayOfWeek + 7) % 7;
        lastScheduled = subDays(today, daysSinceLast || 7);
        break;
      }
      case 'biweekly': {
        // Find the most recent occurrence of the same day of week, 2 weeks apart
        const daysSinceLast = (today.getDay() - dayOfWeek + 14) % 14;
        lastScheduled = subDays(today, daysSinceLast || 14);
        break;
      }
      case 'monthly': {
        // Find the most recent occurrence of the same day of month
        lastScheduled = new Date(today.getFullYear(), today.getMonth(), day);
        if (lastScheduled > today) {
          lastScheduled = new Date(today.getFullYear(), today.getMonth() - 1, day);
        }
        break;
      }
      case 'quarterly': {
        // Find the most recent occurrence of the same day in the quarter
        const currentQuarter = Math.floor(today.getMonth() / 3);
        const targetMonth = currentQuarter * 3 + (month % 3);
        lastScheduled = new Date(today.getFullYear(), targetMonth, day);
        if (lastScheduled > today) {
          lastScheduled = new Date(today.getFullYear(), targetMonth - 3, day);
        }
        break;
      }
      case 'annually': {
        // Find the most recent occurrence of the same month and day
        lastScheduled = new Date(today.getFullYear(), month, day);
        if (lastScheduled > today) {
          lastScheduled = new Date(today.getFullYear() - 1, month, day);
        }
        break;
      }
      default:
        lastScheduled = today;
    }

    // Calculate the next scheduled date based on the last scheduled date
    switch (frequency) {
      case 'daily':
        nextScheduled = addDays(lastScheduled, 1);
        break;
      case 'weekly':
        nextScheduled = addDays(lastScheduled, 7);
        break;
      case 'biweekly':
        nextScheduled = addDays(lastScheduled, 14);
        break;
      case 'monthly':
        nextScheduled = new Date(lastScheduled.getFullYear(), lastScheduled.getMonth() + 1, lastScheduled.getDate());
        break;
      case 'quarterly':
        nextScheduled = new Date(lastScheduled.getFullYear(), lastScheduled.getMonth() + 3, lastScheduled.getDate());
        break;
      case 'annually':
        nextScheduled = new Date(lastScheduled.getFullYear() + 1, lastScheduled.getMonth(), lastScheduled.getDate());
        break;
      default:
        nextScheduled = today;
    }

    // Set lastDue to lastScheduled
    lastDue = lastScheduled;

    return {
      lastScheduled,
      nextScheduled,
      lastDue
    };
  };

  const calculateDaysSinceLastDue = (lastDueDate: Date) => {
    const today = new Date();
    return Math.max(0, differenceInDays(today, lastDueDate));
  };

  const getRateColumnTitle = () => {
    switch (selectedFrequency) {
      case 'daily': return 'Daily Rate';
      case 'weekly': return 'Weekly Rate';
      case 'fortnightly': return 'Fortnightly Rate';
      case 'monthly': return 'Monthly Rate';
      case 'annually': return 'Annual Rate';
      default: return 'Daily Rate';
    }
  };

  const calculateRate = (amount: number, frequency: string, selectedFreq: string): number => {
    // Convert to annual amount first
    let annualAmount = amount;
    switch (frequency) {
      case 'daily':
        annualAmount = amount * 365;
        break;
      case 'weekly':
        annualAmount = amount * 52;
        break;
      case 'fortnightly':
        annualAmount = amount * 26;
        break;
      case 'monthly':
        annualAmount = amount * 12;
        break;
      case 'quarterly':
        annualAmount = amount * 4;
        break;
      case 'annually':
        annualAmount = amount;
        break;
    }

    // Convert annual amount to selected frequency
    switch (selectedFreq) {
      case 'daily':
        return annualAmount / 365;
      case 'weekly':
        return annualAmount / 52;
      case 'fortnightly':
        return annualAmount / 26;
      case 'monthly':
        return annualAmount / 12;
      case 'quarterly':
        return annualAmount / 4;
      case 'annually':
        return annualAmount;
      default:
        return amount;
    }
  };

  const calculateTimeSinceLastDue = (lastScheduled: string | Date): number => {
    const lastDate = typeof lastScheduled === 'string' ? new Date(lastScheduled) : lastScheduled;
    const today = new Date();
    const daysDiff = differenceInDays(today, lastDate);

    let result: number;
    switch (selectedFrequency) {
      case 'daily':
        result = daysDiff;
        break;
      case 'weekly':
        result = Math.ceil(daysDiff / 7);
        break;
      case 'fortnightly':
        result = Math.ceil(daysDiff / 14);
        break;
      case 'monthly':
        result = Math.ceil(daysDiff / 30.44); // Average days in a month
        break;
      case 'quarterly':
        result = Math.ceil(daysDiff / 91.31); // Average days in a quarter
        break;
      case 'annually':
        result = Math.ceil(daysDiff / 365.25); // Account for leap years
        break;
      default:
        result = daysDiff;
    }
    
    // Ensure minimum value is 1 to prevent 0 weeks
    return Math.max(1, result);
  };

  const calculateTimeSinceLastDueWithFrequency = (lastScheduled: string | Date, frequency: string): number => {
    const lastDate = typeof lastScheduled === 'string' ? new Date(lastScheduled) : lastScheduled;
    const today = new Date();
    const daysDiff = differenceInDays(today, lastDate);

    let result: number;
    switch (frequency) {
      case 'daily':
        result = daysDiff;
        break;
      case 'weekly':
        result = Math.ceil(daysDiff / 7);
        break;
      case 'fortnightly':
        result = Math.ceil(daysDiff / 14);
        break;
      case 'monthly':
        result = Math.ceil(daysDiff / 30.44); // Average days in a month
        break;
      case 'quarterly':
        result = Math.ceil(daysDiff / 91.31); // Average days in a quarter
        break;
      case 'annually':
        result = Math.ceil(daysDiff / 365.25); // Account for leap years
        break;
      default:
        result = daysDiff;
    }
    
    // Ensure minimum value is 1 to prevent 0 weeks
    return Math.max(1, result);
  };

  const getAccountName = (accountId: number | null) => {
    if (accountId === null || accountId === undefined) {
      return 'No Account';
    }
    
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) {
      console.log(`Account not found for ID: ${accountId}. Available accounts:`, accounts.map(a => ({ id: a.id, name: a.name })));
      return 'Unknown';
    }
    return account.name;
  };

  const filteredExpenses = expenses.filter(expense => {
    if (selectedAccount === 'all') return true;
    return expense.accountId === parseInt(selectedAccount);
  });

  // Calculate total of Expected column
  const calculateTotalExpected = () => {
    return filteredExpenses.reduce((total, expense) => {
      const { lastScheduled } = calculateScheduledDates(expense.nextDue, expense.frequency);
      const rate = calculateRate(expense.amount, expense.frequency, selectedFrequency);
      const timeSinceLastDue = calculateTimeSinceLastDue(lastScheduled);
      const accruedAmount = parseFloat(calculateAccruedAmount(rate, timeSinceLastDue));
      return total + accruedAmount;
    }, 0);
  };

  // Calculate total expected for a specific account using a specific frequency
  const calculateTotalExpectedForAccount = (accountId: number | null, frequency: string) => {
    if (accountId === null) return 0;
    const accountExpenses = expenses.filter(expense => expense.accountId === accountId);
    return accountExpenses.reduce((total, expense) => {
      const { lastScheduled } = calculateScheduledDates(expense.nextDue, expense.frequency);
      const rate = calculateRate(expense.amount, expense.frequency, frequency);
      const timeSinceLastDue = calculateTimeSinceLastDueWithFrequency(lastScheduled, frequency);
      const accruedAmount = parseFloat(calculateAccruedAmount(rate, timeSinceLastDue));
      return total + accruedAmount;
    }, 0);
  };

  // Simulate the exact same logic as individual account update
  const simulateIndividualAccountUpdate = (accountId: number, frequency: string) => {
    // Create filtered expenses for this account (same as setting selectedAccount)
    const accountExpenses = expenses.filter(expense => expense.accountId === accountId);
    
    // Use the same calculation logic as calculateTotalExpected but with the specified frequency
    return accountExpenses.reduce((total, expense) => {
      const { lastScheduled } = calculateScheduledDates(expense.nextDue, expense.frequency);
      const rate = calculateRate(expense.amount, expense.frequency, frequency);
      const timeSinceLastDue = calculateTimeSinceLastDueWithFrequency(lastScheduled, frequency);
      const accruedAmount = parseFloat(calculateAccruedAmount(rate, timeSinceLastDue));
      return total + accruedAmount;
    }, 0);
  };

  const updateAccountRequiredBalance = async () => {
    if (selectedAccount === 'all') {
      setError('Please select a specific account');
      return;
    }

    const account = accounts.find(acc => acc.id.toString() === selectedAccount);
    if (!account) {
      setError('Account not found');
      return;
    }

    const totalExpected = calculateTotalExpected();
    
    try {
      const response = await apiCall(`/accounts/${selectedAccount}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: account.name,
          bank: account.bank,
          currentBalance: account.currentBalance,
          requiredBalance: totalExpected,
          isPrimary: account.isPrimary,
          diff: account.diff
        })
      });

      if (response.ok) {
        // Refresh accounts data to show updated values
        const accountsResponse = await apiCall('/accounts');
        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json();
          setAccounts(accountsData);
        }
        setError(null);
      } else {
        setError('Failed to update account');
      }
    } catch (err) {
      setError('Failed to update account');
      console.error('Error updating account:', err);
    }
  };

  const updateAllAccountsRequiredBalance = async () => {
    // Sync the modal frequency with the page frequency
    setUpdateAllFrequency(selectedFrequency);
    setShowUpdateAllModal(true);
  };

  // Sync modal frequency with page frequency
  useEffect(() => {
    setUpdateAllFrequency(selectedFrequency);
  }, [selectedFrequency]);

  const handleUpdateAllConfirm = async () => {
    setShowUpdateAllModal(false);
    
    // Update the page frequency to match the modal frequency
    setSelectedFrequency(updateAllFrequency);
    
    try {
      // Update each account one by one
      const updatePromises = accounts.map(async (account) => {
        // Simulate the exact same logic as individual account update
        const totalExpected = simulateIndividualAccountUpdate(account.id, updateAllFrequency);
        
        // Update the account
        const response = await apiCall(`/accounts/${account.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: account.name,
            bank: account.bank,
            currentBalance: account.currentBalance,
            requiredBalance: totalExpected,
            isPrimary: account.isPrimary,
            diff: account.diff
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to update account ${account.name}`);
        }

        return { account: account.name, success: true };
      });

      // Wait for all updates to complete
      const results = await Promise.all(updatePromises);
      
      // Refresh accounts data to show updated values
      const accountsResponse = await apiCall('/accounts');
      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        setAccounts(accountsData);
      }
      
      setError(null);
      console.log('All accounts updated successfully:', results);
    } catch (err) {
      setError('Failed to update some accounts');
      console.error('Error updating accounts:', err);
    }
  };

  // Add this helper function to match Expenses page logic
  const calculateFrequencyAmount = (amount: number, frequency: string, targetFrequency: string): number => {
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  // Sort filteredExpenses by Accrued Amount (descending)
  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    const { lastScheduled: lastA } = calculateScheduledDates(a.nextDue, a.frequency);
    const { lastScheduled: lastB } = calculateScheduledDates(b.nextDue, b.frequency);
    const rateA = calculateRate(a.amount, a.frequency, selectedFrequency);
    const rateB = calculateRate(b.amount, b.frequency, selectedFrequency);
    const timeA = calculateTimeSinceLastDue(lastA);
    const timeB = calculateTimeSinceLastDue(lastB);
    const accruedA = parseFloat(calculateAccruedAmount(rateA, timeA));
    const accruedB = parseFloat(calculateAccruedAmount(rateB, timeB));
    return accruedB - accruedA;
  });

  // Find the primary account
  const primaryAccount = accounts.find(acc => acc.isPrimary);
  // Get all non-primary accounts
  const nonPrimaryAccounts = accounts.filter(acc => !acc.isPrimary);

  // Calculate the sum of all non-primary accounts' required balances for the selected frequency
  const sumOfNonPrimaryAccounts = nonPrimaryAccounts.reduce((total, acc) => {
    // Use the same calculation as simulateIndividualAccountUpdate
    return total + simulateIndividualAccountUpdate(acc.id, selectedFrequency);
  }, 0);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Planning
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" variant="outlined" sx={{ minWidth: 200 }}>
            <InputLabel>Account</InputLabel>
            <Select
              value={selectedAccount}
              label="Account"
              onChange={(e) => setSelectedAccount(e.target.value)}
            >
              <MenuItem value="all">All Accounts</MenuItem>
              {accounts.map((account) => (
                <MenuItem key={account.id} value={account.id.toString()}>
                  {account.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" variant="outlined" sx={{ minWidth: 200 }}>
            <InputLabel>Frequency</InputLabel>
            <Select
              value={selectedFrequency}
              label="Frequency"
              onChange={(e) => setSelectedFrequency(e.target.value)}
            >
              <MenuItem value="daily">Daily</MenuItem>
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="fortnightly">Fortnightly</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="annually">Annually</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            onClick={updateAccountRequiredBalance}
            disabled={selectedAccount === 'all'}
          >
            Update Required Balance
          </Button>
          <Button
            variant="contained"
            onClick={updateAllAccountsRequiredBalance}
          >
            Update All Accounts
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Description</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Frequency</TableCell>
              <TableCell>Initial Due Date</TableCell>
              <TableCell>Last Scheduled</TableCell>
              <TableCell>Next Scheduled</TableCell>
              <TableCell>Account</TableCell>
              <TableCell>{getRateColumnTitle()}</TableCell>
              <TableCell>Since Last</TableCell>
              <TableCell sx={{ textAlign: 'right' }}>Accrued Amount</TableCell>
              <TableCell sx={{ display: 'none' }}>
                Expected
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedExpenses.map((expense) => {
              const { lastScheduled, nextScheduled, lastDue } = calculateScheduledDates(
                expense.nextDue,
                expense.frequency
              );
              const rate = calculateRate(expense.amount, expense.frequency, selectedFrequency);
              const timeSinceLastDue = calculateTimeSinceLastDue(lastScheduled);
              const accruedAmount = calculateAccruedAmount(rate, timeSinceLastDue);

              return (
                <TableRow key={expense.id}>
                  <TableCell>{expense.description}</TableCell>
                  <TableCell>${expense.amount.toFixed(2)}</TableCell>
                  <TableCell>{expense.frequency}</TableCell>
                  <TableCell>{format(new Date(expense.nextDue), "MMM d, yyyy")}</TableCell>
                  <TableCell>{format(new Date(lastScheduled), "MMM d, yyyy")}</TableCell>
                  <TableCell>{format(new Date(nextScheduled), "MMM d, yyyy")}</TableCell>
                  <TableCell>{getAccountName(expense.accountId)}</TableCell>
                  <TableCell>${rate.toFixed(2)}</TableCell>
                  <TableCell>{timeSinceLastDue} {selectedFrequency}</TableCell>
                  <TableCell align="right">${accruedAmount}</TableCell>
                  <TableCell sx={{ display: 'none' }}>
                    ${calculateTotalExpectedForAccount(expense.accountId, expense.frequency).toFixed(2)}
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow>
              <TableCell colSpan={9} sx={{ fontWeight: 'bold', textAlign: 'right' }}>
                Total
              </TableCell>
              <TableCell sx={{ display: 'none', fontWeight: 'bold', textAlign: 'right' }}>
                ${calculateTotalExpected().toFixed(2)}
              </TableCell>
              <TableCell style={{ fontWeight: 'bold', textAlign: 'right' }}>
                ${calculateTotalExpected().toFixed(2)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* Update All Accounts Confirmation Modal */}
      <Dialog open={showUpdateAllModal} onClose={() => setShowUpdateAllModal(false)}>
        <DialogTitle>Update All Required Balances</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            This will update all the required balances as{' '}
            <FormControl size="small" variant="outlined" sx={{ minWidth: 150, display: 'inline-flex', verticalAlign: 'middle' }}>
              <Select
                value={updateAllFrequency}
                onChange={(e) => setUpdateAllFrequency(e.target.value)}
                sx={{ height: 32 }}
              >
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="fortnightly">Fortnightly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="annually">Annually</MenuItem>
              </Select>
            </FormControl>{' '}
            values.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The calculation will be based on the selected frequency for all accounts.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUpdateAllModal(false)}>Cancel</Button>
          <Button onClick={handleUpdateAllConfirm} variant="contained">
            Update All
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add modal for auto update log */}
      <Dialog open={showAutoUpdateModal} onClose={() => setShowAutoUpdateModal(false)} maxWidth="md" fullWidth
        PaperProps={{
          sx: { height: '80vh', display: 'flex', flexDirection: 'column' }
        }}
      >
        <DialogTitle>Updating Required Balances</DialogTitle>
        <DialogContent sx={{ flex: 1, minHeight: 0, p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Progress Bar */}
          <Box sx={{ width: '100%', p: 2, pt: 3, pb: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
            <LinearProgress
              variant="determinate"
              value={updateLog.length === 0 ? 0 : (displayedLog.length / updateLog.length) * 100}
              sx={{ height: 8, borderRadius: 4, flex: 1 }}
            />
            <Typography variant="body2" sx={{ minWidth: 40, color: '#fff', fontFamily: 'monospace' }}>
              {updateLog.length === 0 ? '0%' : `${Math.round((displayedLog.length / updateLog.length) * 100)}%`}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', bgcolor: '#222', color: '#fff', fontFamily: 'monospace', p: 2 }} ref={logRef}>
            {displayedLog.map((line, idx) => {
              if (line.trim().startsWith('Total required for')) {
                return (
                  <div key={idx} style={{ fontWeight: 'bold', fontSize: '1.15rem', color: '#90caf9', margin: '8px 0' }}>{line}</div>
                );
              }
              return <div key={idx}>{line}</div>;
            })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAutoUpdateModal(false)} variant="contained">OK</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Planning; 