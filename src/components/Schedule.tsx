import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import Tooltip from '@mui/material/Tooltip';
import Grid from '@mui/material/Grid';
import { eachDayOfInterval, format, isSameMonth, isToday, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, addYears, subDays } from 'date-fns';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { apiCall } from '../utils/api';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import ManualAdjustmentModal from './ManualAdjustmentModal';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface IncomeEntry {
  id: string;
  description: string;
  amount: number;
  frequency: string;
  nextDue: string;
  notes?: string;
  tags?: string[];
  accountId: number;
}

interface ExpenseEntry {
  id: string;
  description: string;
  amount: number;
  frequency: string;
  nextDue: string;
  notes?: string;
  tags?: string[];
  accountId: number;
}

interface Settings {
  frequencies: {
    [key: string]: {
      fuzziness: number;
    };
  };
}

interface AccountEntry {
  id: number;
  name: string;
  bank: string;
}

const API_URL = 'http://localhost:3001/api';

function getMonthGrid(startMonth: number, startYear: number) {
  const months = [];
  let month = startMonth;
  let year = startYear;
  for (let i = 0; i < 6; i++) {
    months.push({ month, year });
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }
  return months;
}

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(month: number, year: number) {
  return new Date(year, month, 1).getDay();
}

function getNextBusinessDay(date: Date): Date {
  const day = date.getDay();
  if (day === 0) { // Sunday
    date.setDate(date.getDate() + 1);
  } else if (day === 6) { // Saturday
    date.setDate(date.getDate() + 2);
  }
  return date;
}

function getNextDueDates(income: IncomeEntry, startDate: Date, endDate: Date, ignoreWeekends: boolean): Date[] {
  const dueDates: Date[] = [];
  const nextDue = new Date(income.nextDue);
  let currentDate = new Date(nextDue);

  while (currentDate <= endDate) {
    if (currentDate >= startDate) {
      const displayDate = ignoreWeekends ? getNextBusinessDay(new Date(currentDate)) : new Date(currentDate);
      if (displayDate <= endDate) {
        dueDates.push(displayDate);
      }
    }

    switch (income.frequency) {
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'fortnightly':
        currentDate.setDate(currentDate.getDate() + 14);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      case 'quarterly':
        currentDate.setMonth(currentDate.getMonth() + 3);
        break;
      case 'yearly':
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        break;
    }
  }

  return dueDates;
}

// Helper function to format currency with exactly2
const formatCurrency = (amount: number): string => {
  return `$${amount.toFixed(2)}`;
};

// Helper function to convert frequency terminology
const formatFrequency = (frequency: string): string => {
  switch (frequency) {
    case 'biweekly':
      return 'fortnightly';
    case 'biweek':
      return 'fortnight';
    default:
      return frequency;
  }
};

// Helper function to get frequency sort order
const getFrequencySortOrder = (frequency: string): number => {
  switch (frequency) {
    case 'weekly':
      return 1;
    case 'fortnightly':
    case 'biweekly':
      return 2;
    case 'monthly':
      return 3;
    case 'quarterly':
      return 4;
    case 'yearly':
    case 'annually':
      return 5;
    default:
      return 999; // Unknown frequencies at the end
  }
};

// Helper function to sort expenses by frequency
const sortExpensesByFrequency = (expenses: ExpenseEntry[]): ExpenseEntry[] => {
  return [...expenses].sort((a, b) => {
    const orderA = getFrequencySortOrder(a.frequency);
    const orderB = getFrequencySortOrder(b.frequency);
    return orderA - orderB;
  });
};

const Schedule = () => {
  const today = new Date();
  const [startMonth, setStartMonth] = useState(today.getMonth());
  const [startYear, setStartYear] = useState(today.getFullYear());
  const [incomes, setIncomes] = useState<IncomeEntry[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ignoreWeekends, setIgnoreWeekends] = useState(false);
  const [hiddenExpenses, setHiddenExpenses] = useState<{[key: string]: boolean}>({});
  const [showFilter, setShowFilter] = useState(false);
  const [accounts, setAccounts] = useState<AccountEntry[]>([]);
  const [manualAdjustments, setManualAdjustments] = useState<any[]>([]);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('info');

  const months = getMonthGrid(startMonth, startYear);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [incomeRes, expensesRes, settingsRes, hiddenExpensesRes, accountsRes, manualAdjRes] = await Promise.all([
          apiCall('/income'),
          apiCall('/expenses?includeHidden=true'),
          apiCall('/settings'),
          apiCall('/hidden-expenses'),
          apiCall('/accounts'),
          apiCall('/manual-adjustments'),
        ]);

        if (!incomeRes.ok) throw new Error('Failed to fetch income');
        if (!expensesRes.ok) throw new Error('Failed to fetch expenses');
        if (!settingsRes.ok) throw new Error('Failed to fetch settings');
        if (!hiddenExpensesRes.ok) throw new Error('Failed to fetch hidden expenses');
        if (!accountsRes.ok) throw new Error('Failed to fetch accounts');
        if (!manualAdjRes.ok) throw new Error('Failed to fetch manual adjustments');

        const incomeData = await incomeRes.json();
        const expensesData = await expensesRes.json();
        const settingsData = await settingsRes.json();
        const hiddenExpensesData = await hiddenExpensesRes.json();
        const accountsData = await accountsRes.json();
        const manualAdjData = await manualAdjRes.json();

        setIncomes(incomeData.map((i: any) => ({ ...i, nextDue: new Date(i.nextDue) })));
        setExpenses(expensesData.map((e: any) => ({ ...e, nextDue: new Date(e.nextDue) })));
        setSettings(settingsData);
        setAccounts(accountsData);
        console.log('Fetched manual adjustments:', manualAdjData);
        setManualAdjustments(manualAdjData);
        
        // Convert hidden expenses array to object
        const hiddenMap: {[key: string]: boolean} = {};
        hiddenExpensesData.forEach((item: any) => {
          hiddenMap[item.expense_id] = item.is_hidden === 1;
        });
        setHiddenExpenses(hiddenMap);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handlePrev = () => {
    try {
      const newDate = new Date(startYear, startMonth - 6, 1);
      if (isNaN(newDate.getTime())) {
        console.error('Invalid date calculated');
        return;
      }
      setStartMonth(newDate.getMonth());
      setStartYear(newDate.getFullYear());
    } catch (error) {
      console.error('Error in handlePrev:', error);
    }
  };

  const handleNext = () => {
    try {
      const newDate = new Date(startYear, startMonth + 6, 1);
      if (isNaN(newDate.getTime())) {
        console.error('Invalid date calculated');
        return;
      }
      setStartMonth(newDate.getMonth());
      setStartYear(newDate.getFullYear());
    } catch (error) {
      console.error('Error in handleNext:', error);
    }
  };

  const addDatesForFrequency = (startDate: Date, frequency: string): Date[] => {
    const dates: Date[] = [];
    const today = new Date();
    const nextDue = new Date(startDate);
    
    // Get the day of the week (0-6, where 0 is Sunday)
    const dayOfWeek = nextDue.getDay();
    // Get the month and day for date-based calculations
    const month = nextDue.getMonth();
    const day = nextDue.getDate();

    // Calculate the last scheduled date (most recent past occurrence)
    let lastScheduled: Date;
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
      case 'fortnightly':
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
    let nextScheduled: Date;
    switch (frequency) {
      case 'daily':
        nextScheduled = addDays(lastScheduled, 1);
        break;
      case 'weekly':
        nextScheduled = addDays(lastScheduled, 7);
        break;
      case 'fortnightly':
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

    // Generate dates starting from the next scheduled date
    let currentDate = new Date(nextScheduled);
    const endDate = addYears(today, 1);

    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      
      // Calculate the next occurrence
      switch (frequency) {
        case 'daily':
          currentDate = addDays(currentDate, 1);
          break;
        case 'weekly':
          currentDate = addDays(currentDate, 7);
          break;
        case 'fortnightly':
        case 'biweekly':
          currentDate = addDays(currentDate, 14);
          break;
        case 'monthly':
          currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate());
          break;
        case 'quarterly':
          currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 3, currentDate.getDate());
          break;
        case 'annually':
          currentDate = new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), currentDate.getDate());
          break;
        default:
          currentDate = addDays(currentDate, 1);
      }
    }

    return dates;
  };

  const getDueDatesForMonth = (date: Date) => {
    const dueDates = new Map<string, { incomes: IncomeEntry[]; expenses: ExpenseEntry[] }>();

    // Process incomes
    incomes.forEach((income) => {
      try {
        const startDate = new Date(income.nextDue);
        if (!isNaN(startDate.getTime())) {
          addDatesForFrequency(startDate, income.frequency).forEach((date) => {
            if (isSameMonth(date, date)) {
              const dateStr = date.toISOString().split('T')[0];
              const existing = dueDates.get(dateStr) || { incomes: [], expenses: [] };
              dueDates.set(dateStr, { ...existing, incomes: [...existing.incomes, income] });
            }
          });
        }
      } catch (error) {
        console.error('Error processing income:', error);
      }
    });

    // Process expenses (filter out hidden)
    expenses.filter(e => !hiddenExpenses[e.id]).forEach((expense) => {
      try {
        const startDate = new Date(expense.nextDue);
        if (!isNaN(startDate.getTime())) {
          addDatesForFrequency(startDate, expense.frequency).forEach((date) => {
            if (isSameMonth(date, date)) {
              const dateStr = date.toISOString().split('T')[0];
              const existing = dueDates.get(dateStr) || { incomes: [], expenses: [] };
              dueDates.set(dateStr, { ...existing, expenses: [...existing.expenses, expense] });
            }
          });
        }
      } catch (error) {
        console.error('Error processing expense:', error);
      }
    });

    return dueDates;
  };

  // Create a map of accountId to account name for quick lookup
  const accountMap = Object.fromEntries(accounts.map(acc => [acc.id, acc.name]));

  const renderDay = (day: Date) => {
    // Use consistent date formatting to avoid timezone issues
    const dayStr = format(day, 'yyyy-MM-dd');
    const dueDates = getDueDatesForMonth(day);
    const dayData = dueDates.get(dayStr);

    // Calculate max amounts for relative scaling with better dynamic range
    const visibleExpenses = expenses.filter(e => !hiddenExpenses[e.id]);
    const maxIncomeAmount = Math.max(...incomes.map(i => i.amount), 1);
    const maxExpenseAmount = Math.max(...visibleExpenses.map(e => e.amount), 1);
    
    // Use a more dynamic scaling that reduces the impact of very large amounts
    const getBarHeight = (amount: number, maxAmount: number) => {
      // Use square root scaling to make smaller amounts more visible
      const scaledAmount = Math.sqrt(amount / maxAmount);
      return Math.max(3, scaledAmount * 18); // Min 3px, max ~18px
    };

    // Get manual adjustments for this day
    const dayManualAdjustments = manualAdjustments.filter(adj => {
      const matches = adj.date === dayStr;
      if (day.getMonth() === 6 && day.getDate() === 1) {
        console.log(`Comparing adj.date ${adj.date}" with dayStr "${dayStr}": ${matches}`);
      }
      return matches;
    });
    
    // Debug logging for July 1st
    if (day.getMonth() === 6 && day.getDate() === 1) {
      console.log('July 1st debugging:');
      console.log('dayStr:', dayStr);
      console.log('manualAdjustments:', manualAdjustments);
      console.log('dayManualAdjustments:', dayManualAdjustments);
    }

    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          bgcolor: isToday(day) 
            ? 'warning.light' 
            : dayData?.incomes.length || dayData?.expenses.length || dayManualAdjustments.length
              ? 'rgba(144, 202, 249, 0.1)' 
              : 'transparent',
          transition: 'box-shadow 0.2s, border 0.2s',
          '&:hover': {
            outline: '2px solid #90caf9',
            zIndex: 2,
          },
        }}
      >
        <Typography
          variant="body2"
          sx={{
            p: 1,
            color: isToday(day) ? '#000000' : 'text.primary',
            fontWeight: isToday(day) ? 'bold' : 'normal',
          }}
        >
          {format(day, 'd')}
        </Typography>
        {(dayData?.incomes.length || dayData?.expenses.length) && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 4,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              gap: 0.5,
              alignItems: 'flex-end',
              height: 24,
            }}
          >
            {dayData?.incomes.map((income) => (
              <Box
                key={income.id}
                sx={{
                  width: 4,
                  height: getBarHeight(income.amount, maxIncomeAmount),
                  bgcolor: 'success.main',
                  borderRadius: '2px 2px 0 0',
                  minHeight: 3,
                }}
              />
            ))}
            {dayData?.expenses.map((expense) => (
              <Box
                key={expense.id}
                sx={{
                  width: 4,
                  height: getBarHeight(expense.amount, maxExpenseAmount),
                  bgcolor: 'error.main',
                  borderRadius: '2px 2px 0 0',
                  minHeight: 3,
                }}
              />
            ))}
          </Box>
        )}
        {dayManualAdjustments.map(adj => (
          <Box 
            key={adj.id} 
            sx={{ 
              width: 6,
              height: 6,
              bgcolor: 'orange', 
              borderRadius: '50%', 
              position: 'absolute', 
              top: 2, 
              right: 2, 
            }} 
          />
        ))}
        {( (dayData?.incomes && dayData.incomes.length > 0) || (dayData?.expenses && dayData.expenses.length > 0) || dayManualAdjustments.length > 0 ) && (
          <Tooltip
            title={
              <Box>
                {dayData?.incomes && dayData.incomes.length > 0 && (
                  <>
                    <Typography variant="subtitle2" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                      Income:
                    </Typography>
                    {dayData.incomes.map((income) => (
                      <Typography key={income.id} variant="body2" sx={{ ml: 1 }}>
                        {income.description} - {formatCurrency(income.amount)} ({formatFrequency(income.frequency)})
                      </Typography>
                    ))}
                  </>
                )}
                {dayData?.expenses && dayData.expenses.length > 0 && (
                  <>
                    <Typography variant="subtitle2" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                      Expenses:
                    </Typography>
                    {dayData.expenses.map((expense) => (
                      <Typography key={expense.id} variant="body2" sx={{ ml: 1 }}>
                        {expense.description} - {formatCurrency(expense.amount)} ({formatFrequency(expense.frequency)})
                      </Typography>
                    ))}
                  </>
                )}
                {dayManualAdjustments.length > 0 && (
                  <>
                    <Typography variant="subtitle2" sx={{ color: 'warning.main', fontWeight: 'bold' }}>
                      Manual:
                    </Typography>
                    {dayManualAdjustments.map((adj) => (
                      <Typography key={adj.id} variant="body2" sx={{ ml: 1 }}>
                        {accountMap[adj.account_id] || 'Unknown'}: {adj.description && adj.description.trim() ? adj.description : 'No description'} ({formatCurrency(adj.amount)})
                      </Typography>
                    ))}
                  </>
                )}
              </Box>
            }
          >
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </Tooltip>
        )}
      </Box>
    );
  };

  const toggleExpenseVisibility = async (expenseId: string, isHidden: boolean) => {
    try {
      const response = await apiCall('/hidden-expenses', {
        method: 'POST',
        body: JSON.stringify({ expenseId, isHidden })
      });

      if (response.ok) {
        setHiddenExpenses(prev => ({
          ...prev,
          [expenseId]: isHidden
        }));
      } else {
        console.error('Failed to update expense visibility');
      }
    } catch (error) {
      console.error('Error updating expense visibility:', error);
    }
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

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={handlePrev} size="large">
          <ArrowBackIosNewIcon />
        </IconButton>
        <Typography variant="h5">
          {monthNames[startMonth]} {startYear} - {monthNames[(startMonth + 5) % 12]} {(startMonth + 5) > 11 ? startYear + 1 : startYear}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button variant="contained" color="warning" onClick={() => setManualModalOpen(true)}>
            Manual Adjustment
          </Button>
          <IconButton onClick={handleNext} size="large">
            <ArrowForwardIosIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Expense Filter */}
      <Accordion sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Expense Filter</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Uncheck expenses to hide them from the Planning page. Hidden expenses will not appear in required balance calculations.
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: '300px', overflowY: 'auto' }}>
            {sortExpensesByFrequency(expenses).map((expense) => (
              <FormControlLabel
                key={expense.id}
                control={
                  <Checkbox
                    checked={!hiddenExpenses[expense.id]}
                    onChange={(e) => toggleExpenseVisibility(expense.id, !e.target.checked)}
                    size="small"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Typography variant="body2">{expense.description}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', ml: 2 }}>
                      {formatCurrency(expense.amount)} ({formatFrequency(expense.frequency)})
                    </Typography>
                  </Box>
                }
                sx={{ 
                  width: '100%', 
                  margin: 0,
                  '& .MuiFormControlLabel-label': { width: '100%' }
                }}
              />
            ))}
          </Box>
          {expenses.length === 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
              No expenses found
            </Typography>
          )}
        </AccordionDetails>
      </Accordion>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 3 }}>
        {months.map(({ month, year }) => {
          const dueDates = getDueDatesForMonth(new Date(year, month, 1));
          return (
            <Box key={`${year}-${month}`}>
              <Paper sx={{ p: 2, height: '400px' }}>
                <Typography variant="h6" gutterBottom>
                  {monthNames[month]} {year}
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <Typography
                      key={day}
                      variant="caption"
                      sx={{
                        textAlign: 'center',
                        fontWeight: 'bold',
                        color: 'text.secondary',
                        mb: 1
                      }}
                    >
                      {day}
                    </Typography>
                  ))}
                  {Array(new Date(year, month, 1).getDay()).fill(null).map((_, index) => (
                    <Box key={`empty-${index}`} />
                  ))}
                  {Array(getDaysInMonth(month, year)).fill(null).map((_, day) => {
                    const date = new Date(year, month, day + 1);
                    return (
                      <Box key={day}>
                        {renderDay(date)}
                      </Box>
                    );
                  })}
                </Box>
              </Paper>
            </Box>
          );
        })}
      </Box>
      <ManualAdjustmentModal
        open={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        onSave={async (data) => {
          try {
            console.log('Saving manual adjustment data:', data);
            const res = await apiCall('/manual-adjustments', { method: 'POST', body: JSON.stringify(data) });
            if (res.ok) {
              const newAdj = await res.json();
              console.log('Server response:', newAdj);
              const newManualAdjustment = { ...data, id: newAdj.id };
              console.log('New manual adjustment to add:', newManualAdjustment);
              setManualAdjustments(prev => {
                const updated = [...prev, newManualAdjustment];
                console.log('Updated manual adjustments:', updated);
                return updated;
              });
              setManualModalOpen(false);
              setSnackbarMessage('Manual adjustment saved successfully');
              setSnackbarSeverity('success');
              setSnackbarOpen(true);
            } else {
              console.error('Failed to save manual adjustment:', res.status, res.statusText);
              const errorData = await res.json().catch(() => ({}));
              console.error('Error details:', errorData);
              setSnackbarMessage('Failed to save manual adjustment');
              setSnackbarSeverity('error');
              setSnackbarOpen(true);
            }
          } catch (error) {
            console.error('Error saving manual adjustment:', error);
            setSnackbarMessage('Error saving manual adjustment');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
          }
        }}
        accounts={accounts}
      />
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Schedule; 