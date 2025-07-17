import { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress, 
  Alert, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  TextField,
  Paper,
  Card,
  CardContent
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  TimeScale
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { type Frequency, frequencies } from '../config';
import { apiCall } from '../utils/api';
import SettingsIcon from '@mui/icons-material/Settings';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';

// Format currency function
const formatCurrency = (amount: number, noCents: boolean = false): string => {
  const formatter = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: noCents ? 0 : 2,
    maximumFractionDigits: noCents ? 0 : 2,
  });
  return formatter.format(amount);
};

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  annotationPlugin
);

interface Account {
  id: number;
  name: string;
  isPrimary: boolean;
}

interface ForecastData {
  date: string;
  accounts: { [key: number]: number };
}

interface BalanceForecastResponse {
  forecast: ForecastData[];
  accounts: Account[];
}

interface DisbursementSettings {
  disbursementFrequency: Frequency;
  disbursementDay: number;
}

interface TimePeriodSettings {
  pastMonths: number;
  futureMonths: number;
}

const BalanceForecast = () => {
  const [forecastData, setForecastData] = useState<BalanceForecastResponse | null>(null);
  const [disbursementSettings, setDisbursementSettings] = useState<DisbursementSettings>({
    disbursementFrequency: 'monthly',
    disbursementDay: 1
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<number>>(new Set());
  const [nextCycleDate, setNextCycleDate] = useState<Date | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriodSettings>({
    pastMonths: 1,
    futureMonths: 3
  });
  const [chartKey, setChartKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [warningLine, setWarningLine] = useState<number | null>(null);
  const [settingsChanged, setSettingsChanged] = useState(false);

  // Fetch disbursement settings
  const fetchDisbursementSettings = async () => {
    try {
      const response = await apiCall('/settings/disbursement');
      if (response.ok) {
        const data = await response.json();
        setDisbursementSettings(data);
        // Set nextCycleDate based on frequency and day
        setNextCycleDate(getDateFromDisbursement(data.disbursementFrequency, data.disbursementDay));
      }
    } catch (err) {
      console.error('Error fetching disbursement settings:', err);
    }
  };

  // Helper: Convert backend value to Date
  const getDateFromDisbursement = (frequency: Frequency, day: number): Date => {
    const today = new Date();
    switch (frequency) {
      case 'daily':
        return today;
      case 'weekly':
      case 'biweekly': {
        // Find next occurrence of the selected day of week
        const targetDay = day % 7;
        const result = new Date(today);
        while (result.getDay() !== targetDay) {
          result.setDate(result.getDate() + 1);
        }
        return result;
      }
      case 'monthly': {
        // Use this or next month if day has passed
        const result = new Date(today.getFullYear(), today.getMonth(), day);
        if (result < today) result.setMonth(result.getMonth() + 1);
        return result;
      }
      case 'quarterly':
      case 'annually': {
        // Use this or next period if day has passed
        const result = new Date(today.getFullYear(), today.getMonth(), day);
        if (result < today) result.setFullYear(result.getFullYear() + 1);
        return result;
      }
      default:
        return today;
    }
  };

  // Helper: Convert picked date to backend value
  const getDisbursementDayFromDate = (frequency: Frequency, date: Date | null): number => {
    if (!date) return 1;
    switch (frequency) {
      case 'daily':
        return 1;
      case 'weekly':
      case 'biweekly':
        return date.getDay();
      case 'monthly':
      case 'quarterly':
      case 'annually':
        return date.getDate();
      default:
        return 1;
    }
  };

  // Update disbursement settings
  const updateDisbursementSettings = async (newSettings: DisbursementSettings, newDate?: Date | null) => {
    try {
      let disbursementDay = newSettings.disbursementDay;
      if (newDate) {
        disbursementDay = getDisbursementDayFromDate(newSettings.disbursementFrequency, newDate);
      }
      const response = await apiCall('/settings/disbursement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newSettings,
          disbursementDay
        })
      });
      
      if (response.ok) {
        setDisbursementSettings({ ...newSettings, disbursementDay });
        setNextCycleDate(newDate || nextCycleDate);
        // Refresh forecast data with new settings
        fetchForecastData();
      } else {
        setError('Failed to update disbursement settings');
      }
    } catch (err) {
      console.error('Error updating disbursement settings:', err);
      setError('Failed to update disbursement settings');
    }
  };

  // Fetch forecast data
  const fetchForecastData = async (customTimePeriod?: TimePeriodSettings) => {
    setLoading(true);
    setError(null);
    
    const periodToUse = customTimePeriod || timePeriod;
    
    console.log('Fetching forecast data with period:', periodToUse);
    
    try {
      const response = await apiCall(`/balance-forecast?pastMonths=${periodToUse.pastMonths}&futureMonths=${periodToUse.futureMonths}&t=${Date.now()}`);
      if (response.ok) {
        const data: BalanceForecastResponse = await response.json();
        console.log('Received forecast data:', {
          forecastLength: data.forecast.length,
          firstDate: data.forecast[0]?.date,
          lastDate: data.forecast[data.forecast.length - 1]?.date,
          accounts: data.accounts.length
        });
        setForecastData(data);
        
        // Auto-select all accounts initially
        const accountIds = new Set(data.accounts.map(acc => acc.id));
        setSelectedAccounts(accountIds);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch forecast data');
      }
    } catch (err) {
      console.error('Error fetching forecast data:', err);
      setError('Failed to fetch forecast data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisbursementSettings();
    fetchForecastData();
    // Load forecast settings (selected accounts, warning line)
    (async () => {
      try {
        const res = await apiCall('/forecast-settings');
        if (res.ok) {
          const data = await res.json();
          if (data.selectedAccounts && Array.isArray(data.selectedAccounts) && data.selectedAccounts.length > 0) {
            setSelectedAccounts(new Set(data.selectedAccounts));
          } else if (forecastData && forecastData.accounts) {
            // If no saved selection, default to all accounts
            setSelectedAccounts(new Set(forecastData.accounts.map(acc => acc.id)));
          }
          if (data.warningLine !== undefined && data.warningLine !== null) {
            setWarningLine(data.warningLine);
          }
        }
      } catch (err) {
        // ignore
      }
    })();
  }, []);

  // Update chart key when forecast data changes
  useEffect(() => {
    if (forecastData) {
      setChartKey(prev => prev + 1);
    }
  }, [forecastData]);

  const handleDisbursementFrequencyChange = (frequency: Frequency) => {
    const newSettings = { ...disbursementSettings, disbursementFrequency: frequency };
    // Reset date to today for new frequency
    const today = new Date();
    setNextCycleDate(today);
    updateDisbursementSettings(newSettings, today);
  };

  // New: handle date picker change
  const handleNextCycleDateChange = (date: Date | null) => {
    setNextCycleDate(date);
    updateDisbursementSettings(disbursementSettings, date);
  };

  const handleAccountToggle = (accountId: number) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(accountId)) {
      newSelected.delete(accountId);
    } else {
      newSelected.add(accountId);
    }
    setSelectedAccounts(newSelected);
    setSettingsChanged(true);
  };

  const handleTimePeriodChange = (field: keyof TimePeriodSettings, value: number) => {
    console.log('Time period change:', { field, value, currentTimePeriod: timePeriod });
    const newTimePeriod = { ...timePeriod, [field]: value };
    console.log('New time period:', newTimePeriod);
    setTimePeriod(newTimePeriod);
    setSettingsChanged(true);
    // Force chart re-render
    setChartKey(prev => prev + 1);
    // Refresh forecast data with new time period
    fetchForecastData(newTimePeriod);
  };

  const handleWarningLineChange = (value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    setWarningLine(numValue);
    setSettingsChanged(true);
  };

  const handleSaveSettings = async () => {
    // Save settings to backend
    try {
      await apiCall('/forecast-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedAccounts: Array.from(selectedAccounts),
          warningLine
        })
      });
    } catch (err) {
      // Optionally show error
    }
    setSettingsChanged(false);
    setSettingsOpen(false);
  };

  const handleCancelSettings = () => {
    // TODO: Revert changes if needed
    setSettingsChanged(false);
    setSettingsOpen(false);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  // Always render the chart and settings icon, even if forecastData is missing
  // Prepare chart data
  const chartData = {
    labels: forecastData?.forecast.map(item => new Date(item.date)) || [],
    datasets: [
      ...forecastData?.accounts
        .filter(account => selectedAccounts.has(account.id))
        .map((account, index) => {
          const colors = [
            '#1976d2', '#dc004e', '#388e3c', '#f57c00', '#7b1fa2', 
            '#d32f2f', '#388e3c', '#f57c00', '#7b1fa2', '#1976d2'
          ];
          
          return {
            label: account.name,
            data: forecastData?.forecast.map(item => item.accounts[account.id] || 0) || [],
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length] + '20',
            borderWidth: 2, // Show the lines
            fill: false,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: colors[index % colors.length],
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            datalabels: {
              display: false // Hide the data point labels
            }
          };
        })
      // Removed the Today star marker dataset
    ]
  };

  // Add annotation for today
  const today = new Date();
  const todayLabel = forecastData?.forecast.find(item => {
    const d = new Date(item.date);
    return d.toDateString() === today.toDateString();
  })?.date;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      datalabels: {
        display: false
      },
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20
        }
      },
      tooltip: {
        callbacks: {
          title: function(context: any) {
            const dataIndex = context[0].dataIndex;
            const date = forecastData?.forecast[dataIndex]?.date;
            if (date) {
              const validDate = new Date(date);
              if (!isNaN(validDate.getTime())) {
                return validDate.toLocaleDateString();
              }
            }
            return 'Invalid Date';
          },
          label: function(context: any) {
            const accountName = context.dataset.label;
            const balance = context.parsed.y;
            return `${accountName}: ${formatCurrency(balance)}`;
          }
        }
      },
      annotation: {
        annotations: {
          ...(todayLabel
            ? {
                todayLine: {
                  type: 'line' as const,
                  xMin: todayLabel,
                  xMax: todayLabel,
                  borderColor: '#FFD700',
                  borderWidth: 2,
                  borderDash: [6, 6],
                  label: {
                    display: false
                  }
                }
              }
            : {}),
          ...(warningLine !== null
            ? {
                warningLine: {
                  type: 'line' as const,
                  yMin: warningLine,
                  yMax: warningLine,
                  borderColor: '#ff4444',
                  borderWidth: 2,
                  borderDash: [4, 4],
                  label: {
                    display: true,
                    content: `Warning: ${formatCurrency(warningLine)}`,
                    position: 'start' as const,
                    backgroundColor: '#ff4444',
                    color: '#fff',
                    font: { weight: 'bold' as const }
                  }
                }
              }
            : {})
        }
      }
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          unit: 'month' as const,
          displayFormats: {
            month: 'MMM yyyy'
          }
        },
        title: {
          display: true,
          text: 'Date'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Balance'
        },
        ticks: {
          display: false // Hide the Y-axis values
        },
        grid: {
          display: true // Show the Y-axis grid lines
        }
      }
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
        Balance Forecast
      </Typography>
      
      {/* Forecast Settings Modal */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Forecast Settings</DialogTitle>
        <DialogContent>
         <Box sx={{ pt: 2 }}>
           {/* Disbursement Frequency */}
           <Typography variant="h6" sx={{ mb: 2 }}>
             Frequency
           </Typography>
           <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
             <FormControl fullWidth>
               <InputLabel>Frequency</InputLabel>
               <Select
                 value={disbursementSettings.disbursementFrequency}
                 label="Frequency"
                 onChange={(e) => handleDisbursementFrequencyChange(e.target.value as Frequency)}
               >
                 {frequencies.map((f) => (
                   <MenuItem key={f.value} value={f.value}>
                     {f.label}
                   </MenuItem>
                 ))}
               </Select>
             </FormControl>
             <LocalizationProvider dateAdapter={AdapterDateFns}>
               <DatePicker
                 label="Initial Date"
                 value={nextCycleDate}
                 onChange={(value) => {
                   let date: Date | null = null;
                   if (value instanceof Date) {
                     date = value;
                   } else if (value && typeof value === 'object' && typeof value.toDate === 'function') {
                     date = value.toDate();
                   }
                   handleNextCycleDateChange(date);
                 }}
                 format="EEE d MMMM yyyy"
                 slotProps={{ textField: { fullWidth: true } }}
                 views={['day']}
                 disablePast
               />
             </LocalizationProvider>
           </Box>
                        <Typography variant="caption" sx={{ mb: 3, display: 'block', color: 'text.secondary' }}>
               {(() => {
                 switch (disbursementSettings.disbursementFrequency) {
                   case 'daily':
                     return 'Each account receives its allocated expenses daily.';
                   case 'biweekly':
                     return 'Each account receives its allocated expenses every second week on the selected day.';
                   case 'monthly':
                     return 'Each account receives its allocated expenses on the selected day of the month.';
                   case 'quarterly':
                     return 'Each account receives its allocated expenses on the selected day of the first month of each quarter.';
                   case 'annually':
                     return 'Each account receives its allocated expenses on the selected day of the year.';
                   default:
                     return '';
                 }
               })()}
             </Typography>

           {/* Period to Show */}
           <Typography variant="h6" sx={{ mb: 2 }}>
             Period to Show
           </Typography>
           <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
             <FormControl fullWidth>
               <InputLabel>Past</InputLabel>
               <Select
                 value={timePeriod.pastMonths}
                 label="Past"
                 onChange={(e) => handleTimePeriodChange('pastMonths', e.target.value as number)}
               >
                 <MenuItem value={1}>1 Month</MenuItem>
                 <MenuItem value={2}>2 Months</MenuItem>
                 <MenuItem value={3}>3 Months</MenuItem>
               </Select>
             </FormControl>
             <FormControl fullWidth>
               <InputLabel>Future</InputLabel>
               <Select
                 value={timePeriod.futureMonths}
                 label="Future"
                 onChange={(e) => handleTimePeriodChange('futureMonths', e.target.value as number)}
               >
                 <MenuItem value={1}>1 Month</MenuItem>
                 <MenuItem value={2}>2 Months</MenuItem>
                 <MenuItem value={3}>3 Months</MenuItem>
                 <MenuItem value={6}>6 Months</MenuItem>
                 <MenuItem value={9}>9 Months</MenuItem>
                 <MenuItem value={12}>12 Months</MenuItem>
               </Select>
             </FormControl>
           </Box>


           {/* Warning Line */}
           <Typography variant="h6" sx={{ mb: 2 }}>
             Warning Line
           </Typography>
           <TextField
             label="Warning Amount"
             type="number"
             value={warningLine || ''}
             onChange={(e) => handleWarningLineChange(e.target.value)}
             fullWidth
             sx={{ mb: 2 }}
             inputProps={{ step: '0.01', min: 0 }}
             helperText="Enter an amount to show a warning line on the graph. Leave empty to hide."
           />

           {/* Account Selection */}
           <Typography variant="h6" sx={{ mb: 2 }}>
             Account Selection
           </Typography>
           <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1 }}>
             {forecastData?.accounts.map((account) => (
               <Card 
                 key={account.id}
                 sx={{ 
                   cursor: 'pointer',
                   border: selectedAccounts.has(account.id) ? '2px solid #1976d2' : '2px solid transparent',
                   '&:hover': {
                     border: '2px solid #1976d2',
                     opacity: 0.8
                   }
                 }}
                 onClick={() => handleAccountToggle(account.id)}
               >
                 <CardContent sx={{ p: 1, textAlign: 'center' }}>
                   <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                     {account.name}
                   </Typography>
                   <Typography variant="caption" color="text.secondary">
                     {account.isPrimary ? 'Primary' : 'Secondary'}
                   </Typography>
                 </CardContent>
               </Card>
             ))}
           </Box>
         </Box>
        </DialogContent>
        <DialogActions>
         <Button onClick={handleCancelSettings}>Cancel</Button>
         <Button onClick={handleSaveSettings} variant="contained" disabled={!settingsChanged}>
           Save Settings
         </Button>
        </DialogActions>
      </Dialog>

      {/* Chart */}
      <Paper sx={{ p: 3, position: 'relative' }}>
         {/* Settings Cog Icon */}
         <Box sx={{ position: 'absolute', top: 0, right: 0, zIndex: 1 }}>
           <IconButton aria-label="Forecast Settings" onClick={() => setSettingsOpen(true)}>
             <SettingsIcon />
           </IconButton>
         </Box>
        <Box sx={{ height: 500, position: 'relative' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 500 }}>
              <CircularProgress />
            </Box>
          ) : !forecastData ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 500 }}>
              <Typography variant="body2" color="text.secondary">No forecast data available</Typography>
            </Box>
          ) : (
            <Line 
              key={`chart-${chartKey}-${timePeriod.pastMonths}-${timePeriod.futureMonths}`}
              data={chartData} 
              options={chartOptions} 
            />
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default BalanceForecast; 