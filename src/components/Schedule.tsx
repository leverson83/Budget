import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import Tooltip from '@mui/material/Tooltip';
import Grid from '@mui/material/Grid';
import { eachDayOfInterval, format, isSameMonth, isToday, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { apiCall } from '../utils/api';

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

  const months = getMonthGrid(startMonth, startYear);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [incomeRes, expensesRes, settingsRes] = await Promise.all([
          apiCall('/income'),
          apiCall('/expenses'),
          apiCall('/settings')
        ]);

        if (!incomeRes.ok) throw new Error('Failed to fetch income');
        if (!expensesRes.ok) throw new Error('Failed to fetch expenses');
        if (!settingsRes.ok) throw new Error('Failed to fetch settings');

        const incomeData = await incomeRes.json();
        const expensesData = await expensesRes.json();
        const settingsData = await settingsRes.json();

        setIncomes(incomeData.map((i: any) => ({ ...i, nextDue: new Date(i.nextDue) })));
        setExpenses(expensesData.map((e: any) => ({ ...e, nextDue: new Date(e.nextDue) })));
        setSettings(settingsData);
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
    let currentDate = new Date(startDate);
    const endDate = addYears(currentDate, 1);

    switch (frequency) {
      case 'daily':
        while (currentDate <= endDate) {
          dates.push(new Date(currentDate));
          currentDate = addDays(currentDate, 1);
        }
        break;
      case 'weekly':
        while (currentDate <= endDate) {
          dates.push(new Date(currentDate));
          currentDate = addWeeks(currentDate, 1);
        }
        break;
      case 'fortnightly':
        while (currentDate <= endDate) {
          dates.push(new Date(currentDate));
          currentDate = addWeeks(currentDate, 2);
        }
        break;
      case 'monthly':
        while (currentDate <= endDate) {
          dates.push(new Date(currentDate));
          currentDate = addMonths(currentDate, 1);
        }
        break;
      case 'quarterly':
        while (currentDate <= endDate) {
          dates.push(new Date(currentDate));
          currentDate = addMonths(currentDate, 3);
        }
        break;
      case 'annually':
        while (currentDate <= endDate) {
          dates.push(new Date(currentDate));
          currentDate = addYears(currentDate, 1);
        }
        break;
      default:
        console.warn(`Invalid frequency: ${frequency}`);
        break;
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

    // Process expenses
    expenses.forEach((expense) => {
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

  const renderDay = (day: Date) => {
    const dayStr = day.toISOString().split('T')[0];
    const dueDates = getDueDatesForMonth(day);
    const dayData = dueDates.get(dayStr);

    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          bgcolor: isToday(day) 
            ? 'warning.light' 
            : dayData?.incomes.length || dayData?.expenses.length 
              ? 'rgba(144, 202, 249, 0.1)' 
              : 'transparent',
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
            }}
          >
            {dayData?.incomes.map((income) => (
              <Box
                key={income.id}
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: 'success.main',
                }}
              />
            ))}
            {dayData?.expenses.map((expense) => (
              <Box
                key={expense.id}
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: 'error.main',
                }}
              />
            ))}
          </Box>
        )}
        <Tooltip
          title={
            <Box>
              {dayData?.incomes.map((income) => (
                <Typography key={income.id} variant="body2">
                  Income: {income.description} - ${income.amount}
                </Typography>
              ))}
              {dayData?.expenses.map((expense) => (
                <Typography key={expense.id} variant="body2">
                  Expense: {expense.description} - ${expense.amount}
                </Typography>
              ))}
            </Box>
          }
        >
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        </Tooltip>
      </Box>
    );
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
        <IconButton onClick={handleNext} size="large">
          <ArrowForwardIosIcon />
        </IconButton>
      </Box>
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
    </Box>
  );
};

export default Schedule; 