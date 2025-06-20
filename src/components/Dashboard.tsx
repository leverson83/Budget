import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Alert, Select, MenuItem, FormControl, InputLabel, Chip, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Checkbox } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { API_URL, type Frequency, frequencies } from '../config';
import { useFrequency } from '../contexts/FrequencyContext';

ChartJS.register(ArcElement, Tooltip, Legend);

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
  accountExpensesTotal,
  isAuditing,
  isChecked,
  onAccountCheck,
  expenses,
  frequency,
  incomes
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
  incomes?: IncomeEntry[]
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
            <Typography variant="body1" sx={{ textAlign: 'center', color: isChecked ? 'black' : 'inherit' }}>
              Balance: <strong>{formatCurrency(account.currentBalance, true)}</strong>
            </Typography>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [checkedAccounts, setCheckedAccounts] = useState<Set<number>>(new Set());
  const [showAuditStartDialog, setShowAuditStartDialog] = useState(false);
  const [showAuditCompleteDialog, setShowAuditCompleteDialog] = useState(false);

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

  const handleCloseAuditCompleteDialog = () => {
    setShowAuditCompleteDialog(false);
    setIsAuditing(false);
    setCheckedAccounts(new Set());
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
          <Button variant="outlined" sx={{ height: 40 }} onClick={handleStartAudit}>Audit Transfers</Button>
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
                  backgroundColor: [
                    '#FF6384', // Pink
                    '#36A2EB', // Blue
                    '#FFCE56', // Yellow
                    '#4BC0C0', // Teal
                    '#9966FF', // Purple
                    '#FF9F40', // Orange
                    '#FF6384', // Pink
                    '#C9CBCF', // Grey
                    '#4BC0C0', // Teal
                    '#FF6384', // Pink
                    '#8AC249', // Green
                    '#FF6B6B', // Red
                    '#4ECDC4', // Turquoise
                    '#45B7D1', // Sky Blue
                    '#96CEB4', // Mint
                    '#FFEAA7', // Light Yellow
                    '#DDA0DD', // Plum
                    '#98D8C8', // Sea Green
                    '#F7DC6F', // Golden Yellow
                    '#BB8FCE', // Lavender
                    '#85C1E9', // Light Blue
                    '#F8C471', // Light Orange
                    '#82E0AA', // Light Green
                    '#F1948A', // Light Red
                    '#85C1E9', // Light Blue
                    '#F7DC6F', // Golden Yellow
                    '#D7BDE2', // Light Purple
                    '#A9DFBF', // Light Mint
                    '#FAD7A0', // Light Peach
                    '#AED6F1', // Very Light Blue
                    '#F9E79F'  // Very Light Yellow
                  ],
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
                  }
                }
              }}
            />
          </Box>
        </Box>
      )}

      <Dialog open={showAuditStartDialog} onClose={() => setShowAuditStartDialog(false)}>
        <DialogTitle>Start Audit</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Ready to audit transfers?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAuditStartDialog(false)}>Cancel</Button>
          <Button onClick={handleConfirmStartAudit} autoFocus>
            OK
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={showAuditCompleteDialog} onClose={handleCloseAuditCompleteDialog}>
        <DialogTitle>Audit Complete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Complete
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAuditCompleteDialog} autoFocus>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard; 