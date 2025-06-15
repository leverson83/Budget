import { useState, useEffect } from 'react';
import { Box, Typography, Grid, Paper, CircularProgress, Alert } from '@mui/material';
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
import { API_URL, type Frequency } from '../config';

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
          nextDue: new Date(expense.nextDue)
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

  const calculateTotal = (items: (IncomeEntry | ExpenseEntry)[], frequency: Frequency) => {
    return items.reduce((total, item) => {
      const amount = Number(item.amount);
      switch (item.frequency) {
        case 'daily':
          return total + (amount * (frequency === 'monthly' ? 30 : frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : frequency === 'quarterly' ? 90 : frequency === 'annually' ? 365 : 30));
        case 'weekly':
          return total + (amount * (frequency === 'monthly' ? 4 : frequency === 'biweekly' ? 2 : frequency === 'quarterly' ? 13 : frequency === 'annually' ? 52 : 1));
        case 'biweekly':
          return total + (amount * (frequency === 'monthly' ? 2 : frequency === 'weekly' ? 0.5 : frequency === 'quarterly' ? 6.5 : frequency === 'annually' ? 26 : 1));
        case 'monthly':
          return total + (amount * (frequency === 'weekly' ? 0.25 : frequency === 'biweekly' ? 0.5 : frequency === 'quarterly' ? 3 : frequency === 'annually' ? 12 : 1));
        case 'quarterly':
          return total + (amount * (frequency === 'monthly' ? 0.33 : frequency === 'weekly' ? 0.08 : frequency === 'biweekly' ? 0.15 : frequency === 'annually' ? 4 : 1));
        case 'annually':
          return total + (amount * (frequency === 'monthly' ? 0.083 : frequency === 'weekly' ? 0.019 : frequency === 'biweekly' ? 0.038 : frequency === 'quarterly' ? 0.25 : 1));
        default:
          return total;
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

  const totalIncome = calculateTotal(incomes, displayFrequency);
  const totalExpenses = calculateTotal(expenses, displayFrequency);
  const netIncome = totalIncome - totalExpenses;

  // Income by Category Chart
  const incomeByCategory = {
    labels: incomes.map(income => income.description),
    datasets: [{
      label: `Income (${displayFrequency})`,
      data: incomes.map(income => calculateTotal([income], displayFrequency)),
      backgroundColor: 'rgba(75, 192, 192, 0.6)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1,
    }],
  };

  // Expenses by Category Chart
  const expensesByCategory = {
    labels: expenses.map(expense => expense.description),
    datasets: [{
      label: `Expenses (${displayFrequency})`,
      data: expenses.map(expense => calculateTotal([expense], displayFrequency)),
      backgroundColor: 'rgba(255, 99, 132, 0.6)',
      borderColor: 'rgba(255, 99, 132, 1)',
      borderWidth: 1,
    }],
  };

  // Income vs Expenses Chart
  const incomeVsExpenses = {
    labels: ['Income', 'Expenses', 'Net Income'],
    datasets: [{
      label: `Amount (${displayFrequency})`,
      data: [totalIncome, totalExpenses, netIncome],
      backgroundColor: [
        'rgba(75, 192, 192, 0.6)',
        'rgba(255, 99, 132, 0.6)',
        'rgba(54, 162, 235, 0.6)',
      ],
      borderColor: [
        'rgba(75, 192, 192, 1)',
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
      ],
      borderWidth: 1,
    }],
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      {/* Summary Cards Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid xs={12} md={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Total Income
            </Typography>
            <Typography variant="h4" color="success.main">
              ${totalIncome.toFixed(2)}
            </Typography>
          </Paper>
        </Grid>
        <Grid xs={12} md={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Total Expenses
            </Typography>
            <Typography variant="h4" color="error.main">
              ${totalExpenses.toFixed(2)}
            </Typography>
          </Paper>
        </Grid>
        <Grid xs={12} md={4}>
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
        <Grid xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Income by Category
            </Typography>
            <Bar data={incomeByCategory} options={{
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
        <Grid xs={12} md={6}>
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
        <Grid xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Income vs Expenses
            </Typography>
            <Box sx={{ height: 300 }}>
              <Bar data={incomeVsExpenses} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  tooltip: {
                    callbacks: {
                      label: (context) => formatCurrency(context.raw as number)
                    }
                  }
                }
              }} />
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard; 