import { useState, useEffect } from 'react';
import { Box, Typography, Paper, CircularProgress, Alert, Select, MenuItem, FormControl, InputLabel, Grid } from '@mui/material';
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

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const Dashboard = () => {
  const [incomes, setIncomes] = useState<IncomeEntry[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayFrequency, setDisplayFrequency] = useState<Frequency>('monthly');

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

        // Fetch display frequency
        const frequencyResponse = await fetch(`${API_URL}/settings/frequency`);
        if (frequencyResponse.ok) {
          const { frequency } = await frequencyResponse.json();
          if (frequency) setDisplayFrequency(frequency);
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

  const calculateFrequencyAmount = (amount: number, frequency: Frequency, targetFrequency: Frequency): number => {
    // First convert to annual amount
    let annualAmount: number;
    switch (frequency) {
      case "daily":
        annualAmount = amount * 365;
        break;
      case "weekly":
        annualAmount = amount * 52;
        break;
      case "biweekly":
        annualAmount = amount * 26;
        break;
      case "monthly":
        annualAmount = amount * 12;
        break;
      case "quarterly":
        annualAmount = amount * 4;
        break;
      case "annually":
        annualAmount = amount;
        break;
      default:
        annualAmount = amount;
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
        return amount;
    }
  };

  const calculateTotal = (items: (IncomeEntry | ExpenseEntry)[], frequency: Frequency) => {
    return items.reduce((total, item) => {
      return total + calculateFrequencyAmount(Number(item.amount), item.frequency, frequency);
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

  const totalIncome = calculateTotal(incomes, displayFrequency);
  const totalExpenses = calculateTotal(expenses, displayFrequency);
  const netIncome = totalIncome - totalExpenses;

  // Expenses by Category Chart
  const expensesByCategory = {
    labels: Array.from(new Set(expenses.flatMap(expense => expense.tags))),
    datasets: [{
      label: `Expenses (${displayFrequency})`,
      data: Array.from(new Set(expenses.flatMap(expense => expense.tags))).map(tag => {
        const tagExpenses = expenses.filter(expense => expense.tags.includes(tag));
        return calculateTotal(tagExpenses, displayFrequency);
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

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Dashboard
        </Typography>
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Frequency</InputLabel>
          <Select
            value={displayFrequency}
            label="Frequency"
            onChange={(e) => setDisplayFrequency(e.target.value as Frequency)}
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
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Total Income
            </Typography>
            <Typography variant="h4" color="success.main">
              ${totalIncome.toFixed(2)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Total Expenses
            </Typography>
            <Typography variant="h4" color="error.main">
              ${totalExpenses.toFixed(2)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Net Income
            </Typography>
            <Typography variant="h4" color={netIncome >= 0 ? "success.main" : "error.main"}>
              ${netIncome.toFixed(2)}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Charts Grid */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Expenses by Category
            </Typography>
            <Bar data={expensesByCategory} options={{
              responsive: true,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (context) => formatCurrency(context.raw as number)
                  }
                }
              }
            }} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard; 