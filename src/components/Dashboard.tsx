import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Alert, Select, MenuItem, FormControl, InputLabel, Chip, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Checkbox, TextField } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { API_URL, type Frequency, frequencies } from '../config';
import { useFrequency } from '../contexts/FrequencyContext';
import { apiCall } from '../utils/api';

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

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

interface Tag {
  name: string;
  color?: string;
}

// Predefined colors for fallback
const predefinedColors = [
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

const getTagColor = (tagName: string, tags: Tag[]) => {
  // First try to find the tag in our fetched tags
  const tag = tags.find(t => t.name === tagName);
  if (tag && tag.color) {
    return tag.color;
  }
  
  // Fallback to predefined colors based on tag name
  const index = tagName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return predefinedColors[index % predefinedColors.length];
};

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
  accountExpensesTotal,
  isAuditing,
  isChecked,
  onAccountCheck,
  expenses,
  frequency,
  incomes,
  editableBalance,
  onBalanceChange,
  onBalanceUpdate
}: { 
  account: Account | { name: string, currentBalance: number }, 
  isIncomeSource?: boolean, 
  isExpenseSource?: boolean,
  netIncome?: number,
  accountExpensesTotal?: number,
  isAuditing?: boolean,
  isChecked?: boolean,
  onAccountCheck?: (accountId: number, checked: boolean) => void,
  expenses?: ExpenseEntry[],
  frequency?: Frequency,
  incomes?: IncomeEntry[],
  editableBalance?: number,
  onBalanceChange?: (accountId: number, newBalance: number) => void,
  onBalanceUpdate?: (accountId: number) => void
}) => {
  const isPrimary = 'isPrimary' in account && !!account.isPrimary;
  
  const diff = isPrimary && typeof netIncome === 'number' 
    ? netIncome 
    : ('requiredBalance' in account ? ((account.currentBalance || 0) - (account.requiredBalance || 0)) : 0);
  
  const diffColor = diff >= 0 ? 'success.main' : 'error.main';
  const diffText = `${diff >= 0 ? '+' : '-'}${formatCurrency(Math.abs(diff), true)}`;

  let borderColor = 'grey.500';
  let labelColor = 'grey.500';

  if (isChecked) {
    borderColor = 'grey.400';
    labelColor = 'grey.400';
  } else if (isIncomeSource) {
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
      bgcolor: isChecked ? 'grey.100' : 'transparent',
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
      
      {/* Percentage display for non-primary accounts */}
      {!isPrimary && !isIncomeSource && !isExpenseSource && typeof accountExpensesTotal === 'number' && (
        <Typography 
          variant="caption" 
          sx={{ 
            position: 'absolute', 
            top: '8px', 
            left: '8px', 
            bgcolor: isChecked ? 'grey.100' : 'background.default', 
            color: 'text.primary', 
            px: 1, 
            py: 0.5, 
            borderRadius: 1, 
            fontSize: '0.75rem',
            fontWeight: 'bold'
          }}
        >
          {(() => {
            if (!expenses || !frequency || !incomes) return '0.0%';
            const totalIncome = calculateTotalForFrequency(incomes, frequency);
            const percentage = totalIncome > 0 ? ((accountExpensesTotal / totalIncome) * 100).toFixed(1) : '0.0';
            return `${percentage}%`;
          })()}
        </Typography>
      )}
      
      {/* Percentage display for primary account */}
      {isPrimary && typeof netIncome === 'number' && (
        <Typography 
          variant="caption" 
          sx={{ 
            position: 'absolute', 
            top: '8px', 
            left: '8px', 
            bgcolor: isChecked ? 'grey.100' : 'background.default', 
            color: 'text.primary', 
            px: 1, 
            py: 0.5, 
            borderRadius: 1, 
            fontSize: '0.75rem',
            fontWeight: 'bold'
          }}
        >
          {(() => {
            if (!incomes || !frequency) return '0.0%';
            const totalIncome = calculateTotalForFrequency(incomes, frequency);
            const percentage = totalIncome > 0 ? ((netIncome / totalIncome) * 100).toFixed(1) : '0.0';
            return `${percentage}%`;
          })()}
        </Typography>
      )}
      
      {isAuditing && !isPrimary && !isIncomeSource && !isExpenseSource && 'id' in account && onAccountCheck && (
        <Checkbox
            checked={!!isChecked}
            onChange={(e) => onAccountCheck(account.id, e.target.checked)}
            sx={{ position: 'absolute', top: 0, right: 0 }}
        />
      )}
      
      {isPrimary && (
        <Box>
          <Typography variant="body1" sx={{ 
            color: isChecked ? 'black' : diffColor, 
            fontWeight: 'bold', 
            textAlign: 'center', 
            ...(isPrimary && !isChecked && {
              animation: diff >= 0 ? 'pulseGreen 1.5s ease-in-out infinite' : 'pulseRed 1.5s ease-in-out infinite',
              '@keyframes pulseGreen': { '0%': { opacity: 0.8, textShadow: '0 0 2px #4caf50' }, '50%': { opacity: 1, textShadow: '0 0 4px #4caf50' }, '100%': { opacity: 0.8, textShadow: '0 0 2px #4caf50' } },
              '@keyframes pulseRed': { '0%': { opacity: 0.8, textShadow: '0 0 2px #f44336' }, '50%': { opacity: 1, textShadow: '0 0 4px #f44336' }, '100%': { opacity: 0.8, textShadow: '0 0 2px #f44336' } }
            })
          }}>
            {diffText}
          </Typography>
        </Box>
      )}

      {!isPrimary && typeof accountExpensesTotal === 'number' && (
        <Box>
          <Typography variant="body1" sx={{ 
            color: isChecked ? 'black' : 'error.main', 
            fontWeight: 'bold', 
            textAlign: 'center',
            ...(!isChecked && {
              animation: 'pulseRedExpense 1.5s ease-in-out infinite',
              '@keyframes pulseRedExpense': {
                '0%': { opacity: 0.8, textShadow: '0 0 2px #f44336' },
                '50%': { opacity: 1, textShadow: '0 0 4px #f44336' },
                '100%': { opacity: 0.8, textShadow: '0 0 2px #f44336' }
              }
            })
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
            color: isChecked ? 'black' : (isIncomeSource ? 'success.main' : 'error.main'),
            ...(!isChecked && {
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
            })
          }}>
            {isIncomeSource ? '+' : '-'}{formatCurrency(account.currentBalance, true)}
          </Typography>
        ) : (
          <>
            {isAuditing && !isPrimary && 'id' in account && onBalanceChange ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ textAlign: 'center', color: isChecked ? 'black' : 'inherit' }}>
                  Balance:
                </Typography>
                <TextField
                  type="number"
                  value={editableBalance !== undefined ? editableBalance : account.currentBalance}
                  onChange={(e) => {
                    const newBalance = parseFloat(e.target.value) || 0;
                    onBalanceChange(account.id, newBalance);
                  }}
                  onBlur={() => onBalanceUpdate && onBalanceUpdate(account.id)}
                  size="small"
                  sx={{ 
                    width: '120px',
                    '& .MuiInputBase-input': { 
                      textAlign: 'center',
                      fontWeight: 'bold',
                      fontSize: '1rem'
                    },
                    '& .MuiOutlinedInput-root': {
                      ...(editableBalance !== undefined && editableBalance !== account.currentBalance && {
                        borderColor: 'warning.main',
                        '&:hover': {
                          borderColor: 'warning.main'
                        },
                        '&.Mui-focused': {
                          borderColor: 'warning.main'
                        }
                      })
                    }
                  }}
                  inputProps={{ 
                    step: 0.01,
                    min: 0
                  }}
                  helperText={editableBalance !== undefined && editableBalance !== account.currentBalance ? "Click outside to save" : ""}
                  FormHelperTextProps={{
                    sx: { 
                      fontSize: '0.7rem', 
                      textAlign: 'center',
                      margin: 0,
                      color: 'warning.main'
                    }
                  }}
                />
              </Box>
            ) : (
              <Typography variant="body1" sx={{ textAlign: 'center', color: isChecked ? 'black' : 'inherit' }}>
                Balance: <strong>{formatCurrency(account.currentBalance, true)}</strong>
              </Typography>
            )}
            {'requiredBalance' in account && !isPrimary && (
              <Typography variant="body2" sx={{ color: isChecked ? 'black' : diffColor, fontWeight: 'bold', textAlign: 'center' }}>
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
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [checkedAccounts, setCheckedAccounts] = useState<Set<number>>(new Set());
  const [editableBalances, setEditableBalances] = useState<{ [key: number]: number }>({});
  const [showAuditStartDialog, setShowAuditStartDialog] = useState(false);
  const [showAuditCompleteDialog, setShowAuditCompleteDialog] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [incomesRes, expensesRes, accountsRes, tagsRes] = await Promise.all([
          apiCall('/income'),
          apiCall('/expenses'),
          apiCall('/accounts'),
          apiCall('/tags'),
        ]);

        if (!incomesRes.ok) throw new Error('Failed to fetch incomes');
        if (!expensesRes.ok) throw new Error('Failed to fetch expenses');
        if (!accountsRes.ok) throw new Error('Failed to fetch accounts');
        if (!tagsRes.ok) throw new Error('Failed to fetch tags');

        const incomesData = await incomesRes.json();
        const expensesData = await expensesRes.json();
        const accountsData = await accountsRes.json();
        const tagsData = await tagsRes.json();

        setIncomes(incomesData.map((i: any) => ({ ...i, nextDue: new Date(i.nextDue) })));
        setExpenses(expensesData.map((e: any) => ({ ...e, nextDue: new Date(e.nextDue), tags: e.tags || [], accountId: e.accountId })));
        setAccounts(accountsData);
        setTags(tagsData);

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
    if (a.isPrimary && b.isPrimary) return 0;
    
    // For non-primary accounts, sort by percentage of income (highest to lowest)
    const aExpenses = expenses.filter(e => e.accountId === a.id);
    const bExpenses = expenses.filter(e => e.accountId === b.id);
    const aTotal = calculateTotalForFrequency(aExpenses, frequency);
    const bTotal = calculateTotalForFrequency(bExpenses, frequency);
    const totalIncome = calculateTotalForFrequency(incomes, frequency);
    
    const aPercentage = totalIncome > 0 ? (aTotal / totalIncome) : 0;
    const bPercentage = totalIncome > 0 ? (bTotal / totalIncome) : 0;
    
    return bPercentage - aPercentage; // Highest to lowest
  });

  const primaryAccount = sortedAccounts.find(a => a.isPrimary);
  const otherAccounts = sortedAccounts.filter(a => !a.isPrimary);

  useEffect(() => {
    if (isAuditing && otherAccounts.length > 0 && checkedAccounts.size === otherAccounts.length) {
      setShowAuditCompleteDialog(true);
    }
  }, [checkedAccounts, otherAccounts, isAuditing]);

  const handleStartAudit = () => {
    setShowAuditStartDialog(true);
  };

  const handleConfirmStartAudit = () => {
    setShowAuditStartDialog(false);
    setIsAuditing(true);
    setCheckedAccounts(new Set());
    // Initialize editable balances with current account balances
    const initialBalances: { [key: number]: number } = {};
    accounts.forEach(account => {
      if (!account.isPrimary) {
        initialBalances[account.id] = account.currentBalance;
      }
    });
    setEditableBalances(initialBalances);
  };

  const handleAccountCheck = (accountId: number, isChecked: boolean) => {
    setCheckedAccounts(prev => {
      const newSet = new Set(prev);
      if (isChecked) {
        newSet.add(accountId);
      } else {
        newSet.delete(accountId);
      }
      return newSet;
    });
  };

  const handleBalanceChange = (accountId: number, newBalance: number) => {
    setEditableBalances(prev => ({
      ...prev,
      [accountId]: newBalance
    }));
  };

  const handleBalanceUpdate = async (accountId: number) => {
    const newBalance = editableBalances[accountId];
    if (newBalance === undefined) return;

    try {
      const response = await apiCall(`/accounts/${accountId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentBalance: newBalance,
          // Keep other fields unchanged
          name: accounts.find(a => a.id === accountId)?.name || '',
          bank: accounts.find(a => a.id === accountId)?.bank || '',
          requiredBalance: accounts.find(a => a.id === accountId)?.requiredBalance || 0,
          isPrimary: accounts.find(a => a.id === accountId)?.isPrimary || false,
          diff: newBalance - (accounts.find(a => a.id === accountId)?.requiredBalance || 0)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update account balance');
      }

      // Update the local accounts state
      setAccounts(prev => prev.map(account => 
        account.id === accountId 
          ? { ...account, currentBalance: newBalance, diff: newBalance - account.requiredBalance }
          : account
      ));

    } catch (error) {
      console.error('Error updating account balance:', error);
      // Revert the editable balance to the original value
      setEditableBalances(prev => ({
        ...prev,
        [accountId]: accounts.find(a => a.id === accountId)?.currentBalance || 0
      }));
    }
  };

  const handleCloseAuditCompleteDialog = () => {
    setShowAuditCompleteDialog(false);
    setIsAuditing(false);
    setCheckedAccounts(new Set());
    setEditableBalances({});
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
  if (error) return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Frequency</InputLabel>
            <Select value={frequency} label="Frequency" onChange={(e) => setFrequency(e.target.value as Frequency)}>
              {frequencies.map((f) => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="outlined" sx={{ height: 40 }} onClick={handleStartAudit}>Account Check</Button>
        </Box>
      </Box>

      <Box sx={{ my: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '60px' }}>
        <Box sx={{ position: 'relative' }}>
          <AccountTile account={incomeAccount} isIncomeSource={true} expenses={expenses} frequency={frequency} incomes={incomes} />
        </Box>

        {primaryAccount && (
          <Box sx={{ position: 'relative', '&::before': { content: '""', position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', width: '2px', height: '60px', bgcolor: 'success.main', animation: 'flowDown 1.5s ease-in-out infinite', '@keyframes flowDown': { '0%': { background: 'linear-gradient(to bottom, #4caf50 0%, transparent 0%)', boxShadow: '0 0 5px #4caf50' }, '20%': { background: 'linear-gradient(to bottom, #4caf50 0%, #4caf50 20%, transparent 20%)', boxShadow: '0 0 8px #4caf50' }, '40%': { background: 'linear-gradient(to bottom, #4caf50 0%, #4caf50 40%, transparent 40%)', boxShadow: '0 0 10px #4caf50, 0 0 15px #4caf50' }, '60%': { background: 'linear-gradient(to bottom, #4caf50 0%, #4caf50 60%, transparent 60%)', boxShadow: '0 0 12px #4caf50, 0 0 20px #4caf50' }, '80%': { background: 'linear-gradient(to bottom, #4caf50 0%, #4caf50 80%, transparent 80%)', boxShadow: '0 0 8px #4caf50' }, '100%': { background: 'linear-gradient(to bottom, #4caf50 0%, #4caf50 100%)', boxShadow: '0 0 5px #4caf50' } } } }}>
            <AccountTile account={primaryAccount} netIncome={netIncome} expenses={expenses} frequency={frequency} incomes={incomes} />
          </Box>
        )}

        {primaryAccount && (
          <Box sx={{ position: 'relative', '&::before': { content: '""', position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', width: '2px', height: '60px', bgcolor: 'error.main', animation: 'flowDownRed 1.5s ease-in-out infinite', '@keyframes flowDownRed': { '0%': { background: 'linear-gradient(to bottom, #f44336 0%, transparent 0%)', boxShadow: '0 0 5px #f44336' }, '20%': { background: 'linear-gradient(to bottom, #f44336 0%, #f44336 20%, transparent 20%)', boxShadow: '0 0 8px #f44336' }, '40%': { background: 'linear-gradient(to bottom, #f44336 0%, #f44336 40%, transparent 40%)', boxShadow: '0 0 10px #f44336, 0 0 15px #f44336' }, '60%': { background: 'linear-gradient(to bottom, #f44336 0%, #f44336 60%, transparent 60%)', boxShadow: '0 0 12px #f44336, 0 0 20px #f44336' }, '80%': { background: 'linear-gradient(to bottom, #f44336 0%, #f44336 80%, transparent 80%)', boxShadow: '0 0 8px #f44336' }, '100%': { background: 'linear-gradient(to bottom, #f44336 0%, #f44336 100%)', boxShadow: '0 0 5px #f44336' } } } }}>
            <AccountTile account={expenseAccount} isExpenseSource={true} expenses={expenses} frequency={frequency} incomes={incomes} />
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
                <AccountTile 
                  key={account.id} 
                  account={account} 
                  accountExpensesTotal={totalAccountExpenses}
                  isAuditing={isAuditing}
                  isChecked={checkedAccounts.has(account.id)}
                  onAccountCheck={handleAccountCheck}
                  expenses={expenses}
                  frequency={frequency}
                  incomes={incomes}
                  editableBalance={editableBalances[account.id]}
                  onBalanceChange={handleBalanceChange}
                  onBalanceUpdate={handleBalanceUpdate}
                />
              );
            })}
          </Box>
        )}
      </Box>

      {/* Expenses by Tag Pie Chart */}
      {expenses.length > 0 && (
        <Box sx={{ mt: 6, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>
            Expenses by Tag
            </Typography>
          <Box sx={{ width: '100%', maxWidth: 600, height: 400 }}>
            <Pie 
              data={{
                labels: (() => {
                  const allTags = expenses.flatMap(expense => expense.tags || []);
                  const uniqueTags = [...new Set(allTags)];
                  const labels = uniqueTags.length > 0 ? uniqueTags : ['No Tags'];
                  // Add Savings to the labels
                  const totalIncome = calculateTotalForFrequency(incomes, frequency);
                  const totalExpenses = calculateTotalForFrequency(expenses, frequency);
                  const savings = totalIncome - totalExpenses;
                  if (savings > 0) {
                    labels.push('Savings');
                  }
                  return labels;
                })(),
                datasets: [{
                  data: (() => {
                    const allTags = expenses.flatMap(expense => expense.tags || []);
                    const uniqueTags = [...new Set(allTags)];
                    
                    let data = [];
                    if (uniqueTags.length === 0) {
                      // If no tags, show total expenses as "No Tags"
                      data.push(calculateTotalForFrequency(expenses, frequency));
                    } else {
                      data = uniqueTags.map(tag => {
                        const tagExpenses = expenses.filter(expense => 
                          expense.tags && expense.tags.includes(tag)
                        );
                        return calculateTotalForFrequency(tagExpenses, frequency);
                      });
                    }
                    
                    // Add savings to the data
                    const totalIncome = calculateTotalForFrequency(incomes, frequency);
                    const totalExpenses = calculateTotalForFrequency(expenses, frequency);
                    const savings = totalIncome - totalExpenses;
                    if (savings > 0) {
                      data.push(savings);
                    }
                    
                    return data;
                  })(),
                  backgroundColor: (() => {
                    const allTags = expenses.flatMap(expense => expense.tags || []);
                    const uniqueTags = [...new Set(allTags)];
                    
                    let colors = [];
                    if (uniqueTags.length === 0) {
                      // If no tags, use a neutral color for "No Tags"
                      colors.push('#C9CBCF');
                    } else {
                      // Use custom colors for each tag
                      colors = uniqueTags.map(tag => getTagColor(tag, tags));
                    }
                    
                    // Add green color for savings
                    const totalIncome = calculateTotalForFrequency(incomes, frequency);
                    const totalExpenses = calculateTotalForFrequency(expenses, frequency);
                    const savings = totalIncome - totalExpenses;
                    if (savings > 0) {
                      colors.push('#4CAF50'); // Green for savings
                    }
                    
                    return colors;
                  })(),
                  borderWidth: 2,
                  borderColor: '#fff'
                }]
              }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          const label = context.label || '';
                          const value = context.parsed;
                          const total = context.dataset.data.reduce((sum: number, val: number) => sum + val, 0);
                          const percentage = ((value / total) * 100).toFixed(1);
                          return `${label}: ${formatCurrency(value)} (${percentage}%)`;
                        }
                      }
                    },
                    datalabels: {
                      display: function(context: any) {
                        const value = context.dataset.data[context.dataIndex];
                        const total = context.dataset.data.reduce((sum: number, val: number) => sum + val, 0);
                        const percentage = (value / total) * 100;
                        return percentage > 5;
                      },
                      color: '#fff',
                      font: {
                        weight: 'bold',
                        size: 10
                      },
                      formatter: function(value: number, context: any) {
                        const label = context.chart.data.labels[context.dataIndex];
                        return label;
                      },
                      textAlign: 'center',
                      textStrokeColor: 'rgba(0,0,0,0.5)',
                      textStrokeWidth: 2
                    }
                  }
                }} 
              />
            </Box>
        </Box>
      )}

      <Dialog 
        open={showAuditStartDialog} 
        onClose={() => setShowAuditStartDialog(false)}
      >
        <DialogTitle>Start Check</DialogTitle>
        <DialogContent>
          <Box component="ol" sx={{ pl: 2, m: 0 }}>
            <Box component="li" sx={{ mb: 1 }}>
              Check each account has the correct transfer amount setup through internet banking
            </Box>
            <Box component="li" sx={{ mb: 1 }}>
              Enter the current account balance
            </Box>
            <Box component="li" sx={{ mb: 0 }}>
              Tick the checkbox to confirm account information up to date
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAuditStartDialog(false)}>Cancel</Button>
          <Button onClick={handleConfirmStartAudit} color="error" variant="contained">
            Start Check
          </Button>
        </DialogActions>
      </Dialog>
      
      <Dialog 
        open={showAuditCompleteDialog} 
        onClose={() => setShowAuditCompleteDialog(false)}
      >
        <DialogTitle>Finished</DialogTitle>
        <DialogContent>
          <DialogContentText>
            All accounts up to date
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAuditCompleteDialog} color="error" variant="contained">
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard; 