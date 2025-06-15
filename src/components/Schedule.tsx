import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import Tooltip from '@mui/material/Tooltip';
import Grid from '@mui/material/Grid';
import { eachDayOfInterval, format, isSameMonth, isToday, startOfMonth, endOfMonth, addDays } from 'date-fns';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface IncomeEntry {
  id: string;
  description: string;
  amount: number;
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';
  nextDue: string;
  applyFuzziness: boolean;
}

interface ExpenseEntry {
  id: string;
  description: string;
  amount: number;
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';
  nextDue: string;
  applyFuzziness: boolean;
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
      try {
        const [incomesRes, expensesRes, settingsRes] = await Promise.all([
          fetch(`${API_URL}/income`),
          fetch(`${API_URL}/expenses`),
          fetch(`${API_URL}/settings`)
        ]);

        if (!incomesRes.ok || !expensesRes.ok || !settingsRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const [incomesData, expensesData, settingsData] = await Promise.all([
          incomesRes.json(),
          expensesRes.json(),
          settingsRes.json()
        ]);

        setIncomes(incomesData.map((income: any) => ({
          ...income,
          nextDue: new Date(income.nextDue)
        })));
        setExpenses(expensesData.map((expense: any) => ({
          ...expense,
          nextDue: new Date(expense.nextDue)
        })));
        setSettings(settingsData);
        setError(null);
      } catch (err) {
        setError('Failed to load data');
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handlePrev = () => {
    let newMonth = startMonth - 6;
    let newYear = startYear;
    while (newMonth < 0) {
      newMonth += 12;
      newYear--;
    }
    setStartMonth(newMonth);
    setStartYear(newYear);
  };

  const handleNext = () => {
    let newMonth = startMonth + 6;
    let newYear = startYear;
    while (newMonth > 11) {
      newMonth -= 12;
      newYear++;
    }
    setStartMonth(newMonth);
    setStartYear(newYear);
  };

  const getDueDatesForMonth = (date: Date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const days = eachDayOfInterval({ start, end });
    const dueDates = new Map<string, { incomes: IncomeEntry[], expenses: ExpenseEntry[] }>();

    // Helper function to add dates for a frequency
    const addDatesForFrequency = (
      startDate: Date,
      frequency: string,
      item: IncomeEntry | ExpenseEntry,
      isIncome: boolean
    ) => {
      const currentDate = new Date(startDate);
      const endOfYear = new Date(date.getFullYear(), 11, 31); // Look ahead until end of year

      while (currentDate <= endOfYear) {
        if (isSameMonth(currentDate, date)) {
          const dateStr = currentDate.toISOString().split('T')[0];
          const existing = dueDates.get(dateStr) || { incomes: [], expenses: [] };
          
          if (isIncome) {
            dueDates.set(dateStr, { ...existing, incomes: [...existing.incomes, item as IncomeEntry] });
          } else {
            dueDates.set(dateStr, { ...existing, expenses: [...existing.expenses, item as ExpenseEntry] });
          }
        }

        // Add next occurrence based on frequency
        switch (frequency) {
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
    };

    // Process incomes
    incomes.forEach(income => {
      const startDate = new Date(income.nextDue);
      addDatesForFrequency(startDate, income.frequency, income, true);
    });

    // Process expenses
    expenses.forEach(expense => {
      const startDate = new Date(expense.nextDue);
      addDatesForFrequency(startDate, expense.frequency, expense, false);
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
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 3 }}>
        {months.map(({ month, year }) => {
          const dueDates = getDueDatesForMonth(new Date(year, month, 1));
          return (
            <Box key={`${year}-${month}`}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  {monthNames[month]} {year}
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
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