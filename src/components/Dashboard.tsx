import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, CircularProgress, Alert, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { Grid } from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { API_URL, type Frequency, frequencies } from '../config';
import { useFrequency } from '../contexts/FrequencyContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface IncomeEntry {
  id: string;
  description: string;
  amount: number;
  frequency: Frequency;
  nextDue: Date;
}

interface ExpenseEntry {
  id: string;
  description: string;
  amount: number;
  frequency: Frequency;
  nextDue: Date;
  tags: string[];
}

const formatCurrency = (amount: number, noCents: boolean = false): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: noCents ? 0 : 2,
    maximumFractionDigits: noCents ? 0 : 2,
  }).format(amount).replace('A$', '$');
};

const Dashboard = () => {
  const { frequency, setFrequency } = useFrequency();
  const [incomes, setIncomes] = useState<IncomeEntry[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch incomes
        const incomesResponse = await fetch(`${API_URL}/income`);
        if (!incomesResponse.ok) throw new Error('Failed to fetch incomes');
        const incomesData = await incomesResponse.json();
        setIncomes(incomesData.map((income: any) => ({
          ...income,
          nextDue: new Date(income.nextDue)
        })));

        // Fetch expenses
        const expensesResponse = await fetch(`${API_URL}/expenses`);
        if (!expensesResponse.ok) throw new Error('Failed to fetch expenses');
        const expensesData = await expensesResponse.json();
        setExpenses(expensesData.map((expense: any) => ({
          ...expense,
          nextDue: new Date(expense.nextDue),
          tags: expense.tags || []
        })));
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const calculateTotal = (items: (IncomeEntry | ExpenseEntry)[], targetFrequency: Frequency) => {
    return items.reduce((total, item) => {
      const amount = Number(item.amount);
      const itemFrequency = item.frequency;

      // Convert to annual amount first
      let annualAmount = amount;
      switch (itemFrequency) {
        case 'daily':
          annualAmount = amount * 365;
          break;
        case 'weekly':
          annualAmount = amount * 52;
          break;
        case 'biweekly':
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

      // Then convert to target frequency
      switch (targetFrequency) {
        case 'daily':
          return total + (annualAmount / 365);
        case 'weekly':
          return total + (annualAmount / 52);
        case 'biweekly':
          return total + (annualAmount / 26);
        case 'monthly':
          return total + (annualAmount / 12);
        case 'quarterly':
          return total + (annualAmount / 4);
        case 'annually':
          return total + annualAmount;
        default:
          return total + annualAmount;
      }
    }, 0);
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

  const totalIncome = calculateTotal(incomes, frequency);
  const totalExpenses = calculateTotal(expenses, frequency);
  const netIncome = totalIncome - totalExpenses;

  // Expenses by Category Chart
  const expensesByCategory = {
    labels: Array.from(new Set(expenses.flatMap(expense => expense.tags))),
    datasets: [{
      label: `Expenses (${frequency})`,
      data: Array.from(new Set(expenses.flatMap(expense => expense.tags))).map(tag => {
        const tagExpenses = expenses.filter(expense => expense.tags.includes(tag));
        return calculateTotal(tagExpenses, frequency);
      }),
      backgroundColor: Array.from(new Set(expenses.flatMap(expense => expense.tags))).map(tag => {
        const colors = [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(153, 102, 255, 0.6)',
          'rgba(255, 159, 64, 0.6)',
          'rgba(199, 199, 199, 0.6)',
          'rgba(83, 102, 255, 0.6)',
          'rgba(40, 159, 64, 0.6)',
          'rgba(210, 199, 199, 0.6)',
        ];
        const index = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[index % colors.length];
      }),
      borderColor: Array.from(new Set(expenses.flatMap(expense => expense.tags))).map(tag => {
        const colors = [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(199, 199, 199, 1)',
          'rgba(83, 102, 255, 1)',
          'rgba(40, 159, 64, 1)',
          'rgba(210, 199, 199, 1)',
        ];
        const index = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[index % colors.length];
      }),
      borderWidth: 1,
    }],
  };

  const handleFrequencyChange = (event: SelectChangeEvent) => {
    setFrequency(event.target.value as Frequency);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 4,
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Dashboard
        </Typography>
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Display Frequency</InputLabel>
          <Select
            value={frequency}
            label="Display Frequency"
            onChange={handleFrequencyChange}
            size="small"
          >
            {frequencies.map((freq) => (
              <MenuItem key={freq.value} value={freq.value}>
                {freq.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Summary Cards Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Paper 
            elevation={2}
            sx={{ 
              p: 3, 
              textAlign: 'center',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              bgcolor: 'success.light',
              color: 'success.contrastText'
            }}
          >
            <Typography variant="h6" gutterBottom>
              Total Income
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              {formatCurrency(totalIncome, true)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper 
            elevation={2}
            sx={{ 
              p: 3, 
              textAlign: 'center',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              bgcolor: 'error.light',
              color: 'error.contrastText'
            }}
          >
            <Typography variant="h6" gutterBottom>
              Total Expenses
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              {formatCurrency(totalExpenses, true)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper 
            elevation={2}
            sx={{ 
              p: 3, 
              textAlign: 'center',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              bgcolor: netIncome >= 0 ? 'success.light' : 'error.light',
              color: netIncome >= 0 ? 'success.contrastText' : 'error.contrastText'
            }}
          >
            <Typography variant="h6" gutterBottom>
              Net Income
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              {netIncome >= 0 ? '+' : ''}{formatCurrency(netIncome, true)}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Charts Grid */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper 
            elevation={2}
            sx={{ 
              p: 3,
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              Expenses by Category
            </Typography>
            <Box sx={{ flex: 1, minHeight: 300 }}>
              <Bar 
                data={expensesByCategory} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (context) => formatCurrency(context.raw as number)
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: (value) => formatCurrency(value as number)
                      }
                    }
                  }
                }} 
              />
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard; 