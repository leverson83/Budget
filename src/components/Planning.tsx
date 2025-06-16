import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import { format, subDays, addDays, subMonths, addMonths, subWeeks, addWeeks, differenceInDays } from 'date-fns';
import { API_URL, frequencies, type Frequency } from '../config';
import axios from 'axios';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';

interface Expense {
  id: string;
  description: string;
  amount: number;
  frequency: Frequency;
  nextDue: string;
}

interface Account {
  id: number;
  name: string;
  balance: number;
}

const Planning = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFrequency, setSelectedFrequency] = useState<string>('daily');

  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        const response = await axios.get(`${API_URL}/expenses`);
        setExpenses(response.data);
        setError(null);
      } catch (err) {
        setError('Failed to fetch expenses');
        console.error('Error fetching expenses:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
  }, []);

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

  const calculateRate = (amount: number, frequency: string): number => {
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
    switch (selectedFrequency) {
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

    switch (selectedFrequency) {
      case 'daily':
        return daysDiff;
      case 'weekly':
        return Math.ceil(daysDiff / 7);
      case 'fortnightly':
        return Math.ceil(daysDiff / 14);
      case 'monthly':
        return Math.ceil(daysDiff / 30.44); // Average days in a month
      case 'quarterly':
        return Math.ceil(daysDiff / 91.31); // Average days in a quarter
      case 'annually':
        return Math.ceil(daysDiff / 365.25); // Account for leap years
      default:
        return daysDiff;
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
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Planning
        </Typography>
        <FormControl sx={{ minWidth: 200 }}>
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
              <TableCell>{getRateColumnTitle()}</TableCell>
              <TableCell>Since Last Due</TableCell>
              <TableCell>Accrued Amount</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {expenses.map((expense) => {
              const { lastScheduled, nextScheduled, lastDue } = calculateScheduledDates(
                expense.nextDue,
                expense.frequency
              );
              const rate = calculateRate(expense.amount, expense.frequency);
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
                  <TableCell>${rate.toFixed(2)}</TableCell>
                  <TableCell>{timeSinceLastDue}</TableCell>
                  <TableCell>{timeSinceLastDue} {selectedFrequency}</TableCell>
                  <TableCell>${accruedAmount}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default Planning; 