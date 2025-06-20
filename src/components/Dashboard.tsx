import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Alert, Select, MenuItem, FormControl, InputLabel, Chip } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { API_URL, type Frequency, frequencies } from '../config';
import { useFrequency } from '../contexts/FrequencyContext';

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
  accountId?: number;
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

const calculateTotalForFrequency = (items: (IncomeEntry | ExpenseEntry)[], targetFrequency: Frequency) => {
  return items.reduce((total, item) => {
    const amount = Number(item.amount);
    const itemFrequency = item.frequency;
    let annualAmount = amount;
    switch (itemFrequency) {
      case 'daily': annualAmount = amount * 365; break;
      case 'weekly': annualAmount = amount * 52; break;
      case 'biweekly': annualAmount = amount * 26; break;
      case 'monthly': annualAmount = amount * 12; break;
      case 'quarterly': annualAmount = amount * 4; break;
      case 'annually': annualAmount = amount; break;
    }
    switch (targetFrequency) {
      case 'daily': return total + (annualAmount / 365);
      case 'weekly': return total + (annualAmount / 52);
      case 'biweekly': return total + (annualAmount / 26);
      case 'monthly': return total + (annualAmount / 12);
      case 'quarterly': return total + (annualAmount / 4);
      case 'annually': return total + annualAmount;
      default: return total + annualAmount;
    }
  }, 0);
};

const AccountTile = ({ 
  account, 
  isIncomeSource, 
  isExpenseSource, 
  netIncome,
  accountExpensesTotal
}: { 
  account: Account | { name: string, currentBalance: number }, 
  isIncomeSource?: boolean, 
  isExpenseSource?: boolean,
  netIncome?: number,
  accountExpensesTotal?: number
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
    <Box sx={{ 
      p: 2, 
      width: 240, 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 1, 
      position: 'relative', 
      border: '2px solid', 
      borderColor: borderColor, 
      borderRadius: 1,
      ...(isPrimary && {
        animation: `pulseBorder 2s ease-in-out infinite`,
        '@keyframes pulseBorder': {
          '0%': { boxShadow: '0 0 4px #1976d2' },
          '50%': { boxShadow: '0 0 10px #1976d2, 0 0 15px #1976d2' },
          '100%': { boxShadow: '0 0 4px #1976d2' }
        }
      })
    }}>
      <Typography variant="caption" sx={{ position: 'absolute', top: '-8px', left: '12px', bgcolor: 'background.default', px: 1, fontWeight: 'bold', color: labelColor }}>
        {account.name}
      </Typography>
      
      {isPrimary && (
        <Box>
          <Typography variant="body1" sx={{ color: diffColor, fontWeight: 'bold', textAlign: 'center', ...(isPrimary && {
            animation: diff >= 0 ? 'pulseGreen 1.5s ease-in-out infinite' : 'pulseRed 1.5s ease-in-out infinite',
            '@keyframes pulseGreen': { '0%': { opacity: 0.8, textShadow: '0 0 2px #4caf50' }, '50%': { opacity: 1, textShadow: '0 0 4px #4caf50' }, '100%': { opacity: 0.8, textShadow: '0 0 2px #4caf50' } },
            '@keyframes pulseRed': { '0%': { opacity: 0.8, textShadow: '0 0 2px #f44336' }, '50%': { opacity: 1, textShadow: '0 0 4px #f44336' }, '100%': { opacity: 0.8, textShadow: '0 0 2px #f44336' } }
          })}}>
            {diffText}
          </Typography>
        </Box>
      )}

      {!isPrimary && typeof accountExpensesTotal === 'number' && (
        <Box>
          <Typography variant="body1" sx={{ 
            color: 'error.main', 
            fontWeight: 'bold', 
            textAlign: 'center',
            animation: 'pulseRedExpense 1.5s ease-in-out infinite',
            '@keyframes pulseRedExpense': {
              '0%': { opacity: 0.8, textShadow: '0 0 2px #f44336' },
              '50%': { opacity: 1, textShadow: '0 0 4px #f44336' },
              '100%': { opacity: 0.8, textShadow: '0 0 2px #f44336' }
            }
          }}>
            {formatCurrency(accountExpensesTotal, true)}
          </Typography>
        </Box>
      )}

      <Box mt={1}>
        {(isIncomeSource || isExpenseSource) ? (
          <Typography variant="h5" sx={{ 
            textAlign: 'center', 
            fontWeight: 'bold',
            color: isIncomeSource ? 'success.main' : 'error.main',
            animation: isIncomeSource 
              ? 'pulseIncome 1.5s ease-in-out infinite' 
              : 'pulseExpense 1.5s ease-in-out infinite',
            '@keyframes pulseIncome': {
              '0%': { opacity: 0.8, textShadow: '0 0 2px #4caf50' },
              '50%': { opacity: 1, textShadow: '0 0 4px #4caf50' },
              '100%': { opacity: 0.8, textShadow: '0 0 2px #4caf50' }
            },
            '@keyframes pulseExpense': {
              '0%': { opacity: 0.8, textShadow: '0 0 2px #f44336' },
              '50%': { opacity: 1, textShadow: '0 0 4px #f44336' },
              '100%': { opacity: 0.8, textShadow: '0 0 2px #f44336' }
            }
          }}>
            {isIncomeSource ? '+' : '-'}{formatCurrency(account.currentBalance, true)}
          </Typography>
        ) : (
          <>
            <Typography variant="body1" sx={{ textAlign: 'center' }}>
              Balance: <strong>{formatCurrency(account.currentBalance, true)}</strong>
            </Typography>
            {'requiredBalance' in account && !isPrimary && (
              <Typography variant="body2" sx={{ color: diffColor, fontWeight: 'bold', textAlign: 'center' }}>
                Difference: {diffText}
              </Typography>
            )}
          </>
        )}
      </Box>
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
        const [incomesRes, expensesRes, accountsRes] = await Promise.all([
          fetch(`${API_URL}/income`),
          fetch(`${API_URL}/expenses`),
          fetch(`${API_URL}/accounts`),
        ]);

        if (!incomesRes.ok) throw new Error('Failed to fetch incomes');
        if (!expensesRes.ok) throw new Error('Failed to fetch expenses');
        if (!accountsRes.ok) throw new Error('Failed to fetch accounts');

        const incomesData = await incomesRes.json();
        const expensesData = await expensesRes.json();
        const accountsData = await accountsRes.json();

        setIncomes(incomesData.map((i: any) => ({ ...i, nextDue: new Date(i.nextDue) })));
        setExpenses(expensesData.map((e: any) => ({ ...e, nextDue: new Date(e.nextDue), tags: e.tags || [], accountId: e.accountId })));
        setAccounts(accountsData);

      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalIncome = calculateTotalForFrequency(incomes, frequency);
  const totalExpenses = calculateTotalForFrequency(expenses, frequency);
  const netIncome = totalIncome - totalExpenses;

  const incomeAccount = { name: "Income", currentBalance: totalIncome };
  const expenseAccount = { name: "Expenses", currentBalance: totalExpenses };

  const sortedAccounts = [...accounts].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return a.name.localeCompare(b.name);
  });

  const primaryAccount = sortedAccounts.find(a => a.isPrimary);
  const otherAccounts = sortedAccounts.filter(a => !a.isPrimary);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
  if (error) return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Dashboard</Typography>
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Display Frequency</InputLabel>
          <Select value={frequency} label="Display Frequency" onChange={(e) => setFrequency(e.target.value as Frequency)} size="small">
            {frequencies.map((f) => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ my: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '60px' }}>
        <Box sx={{ position: 'relative' }}>
          <AccountTile account={incomeAccount} isIncomeSource={true} />
        </Box>

        {primaryAccount && (
          <Box sx={{ position: 'relative', '&::before': { content: '""', position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', width: '2px', height: '60px', bgcolor: 'success.main', animation: 'flowDown 1.5s ease-in-out infinite', '@keyframes flowDown': { '0%': { background: 'linear-gradient(to bottom, #4caf50 0%, transparent 0%)', boxShadow: '0 0 5px #4caf50' }, '20%': { background: 'linear-gradient(to bottom, #4caf50 0%, #4caf50 20%, transparent 20%)', boxShadow: '0 0 8px #4caf50' }, '40%': { background: 'linear-gradient(to bottom, #4caf50 0%, #4caf50 40%, transparent 40%)', boxShadow: '0 0 10px #4caf50, 0 0 15px #4caf50' }, '60%': { background: 'linear-gradient(to bottom, #4caf50 0%, #4caf50 60%, transparent 60%)', boxShadow: '0 0 12px #4caf50, 0 0 20px #4caf50' }, '80%': { background: 'linear-gradient(to bottom, #4caf50 0%, #4caf50 80%, transparent 80%)', boxShadow: '0 0 8px #4caf50' }, '100%': { background: 'linear-gradient(to bottom, #4caf50 0%, #4caf50 100%)', boxShadow: '0 0 5px #4caf50' } } } }}>
            <AccountTile account={primaryAccount} netIncome={netIncome} />
          </Box>
        )}

        {primaryAccount && (
          <Box sx={{ position: 'relative', '&::before': { content: '""', position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', width: '2px', height: '60px', bgcolor: 'error.main', animation: 'flowDownRed 1.5s ease-in-out infinite', '@keyframes flowDownRed': { '0%': { background: 'linear-gradient(to bottom, #f44336 0%, transparent 0%)', boxShadow: '0 0 5px #f44336' }, '20%': { background: 'linear-gradient(to bottom, #f44336 0%, #f44336 20%, transparent 20%)', boxShadow: '0 0 8px #f44336' }, '40%': { background: 'linear-gradient(to bottom, #f44336 0%, #f44336 40%, transparent 40%)', boxShadow: '0 0 10px #f44336, 0 0 15px #f44336' }, '60%': { background: 'linear-gradient(to bottom, #f44336 0%, #f44336 60%, transparent 60%)', boxShadow: '0 0 12px #f44336, 0 0 20px #f44336' }, '80%': { background: 'linear-gradient(to bottom, #f44336 0%, #f44336 80%, transparent 80%)', boxShadow: '0 0 8px #f44336' }, '100%': { background: 'linear-gradient(to bottom, #f44336 0%, #f44336 100%)', boxShadow: '0 0 5px #f44336' } } } }}>
            <AccountTile account={expenseAccount} isExpenseSource={true} />
          </Box>
        )}

        {primaryAccount && otherAccounts.length > 0 && (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 4, 
            position: 'relative', 
            flexWrap: 'wrap',
            '&::before': {
              content: '""',
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '2px',
              height: '60px',
              bgcolor: 'error.main',
              animation: 'flowDownRed 1.5s ease-in-out infinite',
              '@keyframes flowDownRed': {
                '0%': { background: 'linear-gradient(to bottom, #f44336 0%, transparent 0%)', boxShadow: '0 0 5px #f44336' },
                '20%': { background: 'linear-gradient(to bottom, #f44336 0%, #f44336 20%, transparent 20%)', boxShadow: '0 0 8px #f44336' },
                '40%': { background: 'linear-gradient(to bottom, #f44336 0%, #f44336 40%, transparent 40%)', boxShadow: '0 0 10px #f44336, 0 0 15px #f44336' },
                '60%': { background: 'linear-gradient(to bottom, #f44336 0%, #f44336 60%, transparent 60%)', boxShadow: '0 0 12px #f44336, 0 0 20px #f44336' },
                '80%': { background: 'linear-gradient(to bottom, #f44336 0%, #f44336 80%, transparent 80%)', boxShadow: '0 0 8px #f44336' },
                '100%': { background: 'linear-gradient(to bottom, #f44336 0%, #f44336 100%)', boxShadow: '0 0 5px #f44336' }
              }
            }
          }}>
            {otherAccounts.map((account) => {
              const accountExpenses = expenses.filter(e => e.accountId === account.id);
              const totalAccountExpenses = calculateTotalForFrequency(accountExpenses, frequency);
              return (
                <AccountTile key={account.id} account={account} accountExpensesTotal={totalAccountExpenses} />
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default Dashboard; 