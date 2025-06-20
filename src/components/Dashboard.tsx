import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, CircularProgress, Alert, Select, MenuItem, FormControl, InputLabel, Chip } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
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

interface Account {
  id: number;
  name: string;
  bank: string;
  currentBalance: number;
  requiredBalance: number;
  isPrimary: number;
  diff: number;
}

const formatCurrency = (amount: number, noCents: boolean = false): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: noCents ? 0 : 2,
    maximumFractionDigits: noCents ? 0 : 2,
  }).format(amount).replace('A$', '$');
};

const AccountTile = ({ account, isIncomeSource, isExpenseSource, netIncome }: { 
  account: Account | { name: string, currentBalance: number }, 
  isIncomeSource?: boolean, 
  isExpenseSource?: boolean,
  netIncome?: number
}) => {
  const isPrimary = 'isPrimary' in account && !!account.isPrimary;
  
  const diff = isPrimary && typeof netIncome === 'number' 
    ? netIncome 
    : ('requiredBalance' in account ? ((account.currentBalance || 0) - (account.requiredBalance || 0)) : 0);
  
  const diffColor = diff >= 0 ? 'success.main' : 'error.main';
  const diffText = `${diff >= 0 ? '+' : '-'}${formatCurrency(Math.abs(diff), true)}`;

  let borderColor = 'grey.500';
  let labelColor = 'grey.500';

  if (isIncomeSource) {
    borderColor = 'success.main';
    labelColor = 'success.main';
  } else if (isExpenseSource) {
    borderColor = 'error.main';
    labelColor = 'error.main';
  } else if (isPrimary) {
    borderColor = 'primary.main';
    labelColor = 'primary.main';
  }

  return (
    <Box
      sx={{
        p: 2,
        width: 240,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        position: 'relative',
        border: '2px solid',
        borderColor: borderColor,
        borderRadius: 1,
      }}
    >
      <Typography 
        variant="caption" 
        sx={{ 
          position: 'absolute',
          top: '-8px',
          left: '12px',
          bgcolor: 'background.default',
          px: 1,
          fontWeight: 'bold',
          color: labelColor,
        }}
      >
        {account.name}
      </Typography>
      
      {isPrimary && (
        <Chip
          label="Primary"
          color="primary"
          size="small"
          sx={{ position: 'absolute', top: 8, right: 8, fontWeight: 'bold' }}
        />
      )}
      
      <Box mt={1}>
        {(isIncomeSource || isExpenseSource) ? (
            <Typography variant="h5" sx={{ textAlign: 'center', fontWeight: 'bold' }}>
                {formatCurrency(account.currentBalance, true)}
            </Typography>
        ) : (
            <>
                <Typography variant="body1">
                    Balance: <strong>{formatCurrency(account.currentBalance, true)}</strong>
                </Typography>
                {'requiredBalance' in account && !isPrimary && (
                    <Typography variant="body2" color="text.secondary">
                        Required: {formatCurrency(account.requiredBalance, true)}
                    </Typography>
                )}
            </>
        )}
      </Box>
      {'requiredBalance' in account && (
        <Box>
          <Typography variant="body1" sx={{ color: diffColor, fontWeight: 'bold' }}>
            {`${isPrimary ? 'Change' : 'Difference'}: ${diffText}`}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

const Dashboard = () => {
  const { frequency, setFrequency } = useFrequency();
  const [incomes, setIncomes] = useState<IncomeEntry[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
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

        // Fetch accounts
        const accountsResponse = await fetch(`${API_URL}/accounts`);
        if (!accountsResponse.ok) throw new Error('Failed to fetch accounts');
        const accountsData = await accountsResponse.json();
        setAccounts(accountsData);

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
  
  const incomeAccount = { name: "Income", currentBalance: totalIncome };
  const expenseAccount = { name: "Expenses", currentBalance: totalExpenses };

  // Sort accounts: primary first, then by name
  const sortedAccounts = [...accounts].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    if (a.name && b.name) {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  const primaryAccount = sortedAccounts.find(a => a.isPrimary);
  const otherAccounts = sortedAccounts.filter(a => !a.isPrimary);

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

      {/* Account Tree */}
      <Box sx={{ my: 5 }}>
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '60px',
        }}>
           {/* Income Tile */}
            <Box sx={{ position: 'relative' }}>
                <AccountTile account={incomeAccount} isIncomeSource={true} />
            </Box>

            {/* Primary Account with connector from Income */}
            {primaryAccount && (
              <Box sx={{
                  position: 'relative',
                  '&::before': {
                      content: '""',
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '2px',
                      height: '60px',
                      bgcolor: 'white',
                  },
              }}>
                  <AccountTile account={primaryAccount} netIncome={netIncome} />
              </Box>
            )}

            {/* Expense Tile with connector from Primary */}
            {primaryAccount && (
              <Box sx={{
                  position: 'relative',
                  '&::before': {
                      content: '""',
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '2px',
                      height: '60px',
                      bgcolor: 'white',
                  },
              }}>
                  <AccountTile account={expenseAccount} isExpenseSource={true} />
              </Box>
            )}

            {/* Other Accounts with horizontal connectors */}
            {primaryAccount && otherAccounts.length > 0 && (
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 4,
                    position: 'relative',
                    // Vertical line from expense tile
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '2px',
                        height: '60px',
                        bgcolor: 'white',
                    },
                    // Continuous horizontal line across all accounts
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '1000px', // Fixed wide width to ensure coverage
                        height: '2px',
                        bgcolor: 'white',
                    },
                }}>
                    {otherAccounts.map((account, index) => (
                        <Box key={`account-${account.id}-${index}`} sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            position: 'relative',
                            pt: '60px', // Space for connectors
                            // Vertical line part for each account
                            '&::before': {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: '2px',
                                height: '60px',
                                bgcolor: 'white',
                            }
                        }}>
                           <AccountTile account={account} />
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
      </Box>

      {/* Charts Grid */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        <Box sx={{ flex: '1 1 500px', minWidth: 300 }}>
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
        </Box>
        <Box sx={{ flex: '1 1 500px', minWidth: 300 }}>
            {/* You can add another chart here if you want */}
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard; 