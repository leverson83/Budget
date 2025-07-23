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
import { useFrequency } from '../contexts/FrequencyContext';
import InfoIcon from '@mui/icons-material/Info';

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
  const { frequency } = useFrequency();
  const [forecastData, setForecastData] = useState<BalanceForecastResponse | null>(null);
  const [disbursementSettings, setDisbursementSettings] = useState<DisbursementSettings>({
    disbursementFrequency: 'monthly',
    disbursementDay: 1
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<number>>(new Set());
  const [modalSelectedAccounts, setModalSelectedAccounts] = useState<Set<number>>(new Set());
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [nextCycleDate, setNextCycleDate] = useState<Date | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriodSettings>({
    pastMonths: 1,
    futureMonths: 3
  });
  const [modalTimePeriod, setModalTimePeriod] = useState<TimePeriodSettings>({
    pastMonths: 1,
    futureMonths: 3
  });
  const [chartKey, setChartKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [warningLine, setWarningLine] = useState<number | null>(null);
  const [modalWarningLine, setModalWarningLine] = useState<number | null>(null);
  const [settingsChanged, setSettingsChanged] = useState(false);
  const [debugModalOpen, setDebugModalOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugError, setDebugError] = useState<string | null>(null);

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
  const fetchForecastData = async (customTimePeriod?: TimePeriodSettings, preloadedAccounts?: Set<number>) => {
    setLoading(true);
    setError(null);
    
    const periodToUse = customTimePeriod || timePeriod;
    
    console.log('Fetching forecast data with period:', periodToUse, 'and frequency:', disbursementSettings.disbursementFrequency, 'and day:', disbursementSettings.disbursementDay);
    
    try {
      const response = await apiCall(`/balance-forecast?pastMonths=${periodToUse.pastMonths}&futureMonths=${periodToUse.futureMonths}&frequency=${disbursementSettings.disbursementFrequency}&disbursementDay=${disbursementSettings.disbursementDay}&t=${Date.now()}`);
      if (response.ok) {
        const data: BalanceForecastResponse = await response.json();
        console.log('Received forecast data:', {
          forecastLength: data.forecast.length,
          firstDate: data.forecast[0]?.date,
          lastDate: data.forecast[data.forecast.length - 1]?.date,
          accounts: data.accounts.length
        });
        setForecastData(data);
        
        // Use preloaded accounts if available, otherwise use existing logic
        if (preloadedAccounts && preloadedAccounts.size > 0) {
          console.log('✅ Using preloaded account selection:', Array.from(preloadedAccounts));
          setSelectedAccounts(preloadedAccounts);
        } else if (!settingsLoaded && selectedAccounts.size === 0) {
          console.log('🔧 No saved settings loaded yet, defaulting to all accounts');
          const accountIds = new Set(data.accounts.map(acc => acc.id));
          setSelectedAccounts(accountIds);
        } else if (settingsLoaded) {
          console.log('✅ Settings already loaded, keeping account selection:', Array.from(selectedAccounts));
        } else {
          console.log('✅ Keeping existing account selection:', Array.from(selectedAccounts));
        }
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

  const fetchDebugInfo = async () => {
    setDebugLoading(true);
    setDebugError(null);
    try {
      // Convert selected accounts to comma-separated string
      const accountIds = Array.from(selectedAccounts).join(',');
      const response = await apiCall(`/balance-forecast-debug?frequency=${frequency}&accounts=${accountIds}&t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        setDebugInfo(data.debug || 'No debug info available.');
      } else {
        setDebugError('Failed to fetch debug info.');
      }
    } catch (err) {
      setDebugError('Failed to fetch debug info.');
    } finally {
      setDebugLoading(false);
    }
  };

  const handleOpenDebugModal = () => {
    setDebugModalOpen(true);
    fetchDebugInfo();
  };
  const handleCloseDebugModal = () => {
    setDebugModalOpen(false);
  };

  // Load saved settings on mount
  useEffect(() => {
    console.log('🔄 Component mounted, loading settings...');
    fetchDisbursementSettings();
    // Load settings first, then fetch forecast data
    loadSavedSettings().then((loadedAccounts) => {
      fetchForecastData(undefined, loadedAccounts);
    });
  }, []);

  const loadSavedSettings = async (): Promise<Set<number> | undefined> => {
    try {
      console.log('🌐 Loading settings from:', `${window.location.origin}/api/forecast-settings`);
      const res = await apiCall('/forecast-settings');
      if (res.ok) {
        const data = await res.json();
        console.log('📥 Loaded from backend:', data);
        
        if (data.selectedAccounts && Array.isArray(data.selectedAccounts) && data.selectedAccounts.length > 0) {
          const accounts = new Set(data.selectedAccounts as number[]);
          console.log('✅ Using saved account selection:', Array.from(accounts));
          setSelectedAccounts(accounts);
          setModalSelectedAccounts(new Set(accounts));
          
          const warning = data.warningLine !== undefined && data.warningLine !== null ? data.warningLine : null;
          setWarningLine(warning);
          setModalWarningLine(warning);
          
          // Mark settings as loaded to prevent overriding
          setSettingsLoaded(true);
          
          return accounts;
        } else {
          console.log('🔧 No saved account selection found, will use default');
          
          const warning = data.warningLine !== undefined && data.warningLine !== null ? data.warningLine : null;
          setWarningLine(warning);
          setModalWarningLine(warning);
          
          // Mark settings as loaded to prevent overriding
          setSettingsLoaded(true);
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
    
    return undefined;
  };

  // Update chart key when forecast data changes
  useEffect(() => {
    if (forecastData) {
      setChartKey(prev => prev + 1);
      // Only load settings if we have no accounts selected (initial load)
      if (selectedAccounts.size === 0 && forecastData.accounts.length > 0) {
        loadSavedSettings();
      }
    }
  }, [forecastData]);

  useEffect(() => {
    // Only refetch if the modal is closed (to avoid double fetches)
    if (!settingsOpen) {
      fetchForecastData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disbursementSettings.disbursementFrequency, disbursementSettings.disbursementDay]);

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

  // Handle account toggle from graph legend (immediate save)
  const handleGraphAccountToggle = async (accountId: number) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(accountId)) {
      newSelected.delete(accountId);
    } else {
      newSelected.add(accountId);
    }
    setSelectedAccounts(newSelected);
    
    // Immediately save to backend
    try {
      await apiCall('/forecast-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedAccounts: Array.from(newSelected),
          warningLine
        })
      });
    } catch (err) {
      console.error('Failed to save account visibility:', err);
    }
  };

  // Handle account toggle from modal (temporary change)
  const handleModalAccountToggle = (accountId: number) => {
    const newSelected = new Set(modalSelectedAccounts);
    if (newSelected.has(accountId)) {
      newSelected.delete(accountId);
    } else {
      newSelected.add(accountId);
    }
    setModalSelectedAccounts(newSelected);
    setSettingsChanged(true);
  };

  const handleModalTimePeriodChange = (field: keyof TimePeriodSettings, value: number) => {
    const newTimePeriod = { ...modalTimePeriod, [field]: value };
    setModalTimePeriod(newTimePeriod);
    setSettingsChanged(true);
  };

  const handleModalWarningLineChange = (value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    setModalWarningLine(numValue);
    setSettingsChanged(true);
  };

  const handleSaveSettings = async () => {
    console.log('💾 Saving account settings:', Array.from(modalSelectedAccounts));
    console.log('🌐 Saving settings to:', `${window.location.origin}/api/forecast-settings`);

    // Save settings to backend first
    try {
      const response = await apiCall('/forecast-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedAccounts: Array.from(modalSelectedAccounts),
          warningLine: modalWarningLine
        })
      });
      
      if (response.ok) {
        console.log('✅ Settings saved successfully to backend');
      } else {
        console.error('❌ Failed to save settings to backend:', response.status);
      }
    } catch (err) {
      console.error('❌ Error saving settings:', err);
    }

    // Apply modal changes to main state
    setSelectedAccounts(new Set(modalSelectedAccounts));
    setTimePeriod({ ...modalTimePeriod });
    setWarningLine(modalWarningLine);

    // Only refetch data if time period changed
    const timePeriodChanged = modalTimePeriod.pastMonths !== timePeriod.pastMonths || 
                             modalTimePeriod.futureMonths !== timePeriod.futureMonths;
    
    if (timePeriodChanged) {
      fetchForecastData(modalTimePeriod);
    }
    
    // Force chart re-render after state updates
    setChartKey(prev => prev + 1);
    
    setSettingsChanged(false);
    setSettingsOpen(false);

    console.log('🎯 New selectedAccounts applied to chart:', Array.from(modalSelectedAccounts));
  };

  const handleCancelSettings = () => {
    // Revert modal state to current saved state
    setModalSelectedAccounts(new Set(selectedAccounts));
    setModalTimePeriod(timePeriod);
    setModalWarningLine(warningLine);
    setSettingsChanged(false);
    setSettingsOpen(false);
  };

  const handleOpenSettings = () => {
    // Initialize modal state with current values
    setModalSelectedAccounts(new Set(selectedAccounts));
    setModalTimePeriod(timePeriod);
    setModalWarningLine(warningLine);
    setSettingsOpen(true);
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
  const filteredAccounts = (forecastData?.accounts || []).filter(account => selectedAccounts.has(account.id));

  const chartData = {
    labels: forecastData?.forecast.map(item => new Date(item.date)) || [],
    datasets: [
      ...filteredAccounts.map((account, index) => {
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
        },
        onClick: (event: any, legendItem: any, legend: any) => {
          // Find the account by name
          const account = forecastData?.accounts.find(acc => acc.name === legendItem.text);
          if (account) {
            handleGraphAccountToggle(account.id);
          }
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
                 value={modalTimePeriod.pastMonths}
                 label="Past"
                 onChange={(e) => handleModalTimePeriodChange('pastMonths', e.target.value as number)}
               >
                 <MenuItem value={1}>1 Month</MenuItem>
                 <MenuItem value={2}>2 Months</MenuItem>
                 <MenuItem value={3}>3 Months</MenuItem>
               </Select>
             </FormControl>
             <FormControl fullWidth>
               <InputLabel>Future</InputLabel>
               <Select
                 value={modalTimePeriod.futureMonths}
                 label="Future"
                 onChange={(e) => handleModalTimePeriodChange('futureMonths', e.target.value as number)}
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
             value={modalWarningLine || ''}
             onChange={(e) => handleModalWarningLineChange(e.target.value)}
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
                   border: modalSelectedAccounts.has(account.id) ? '2px solid #1976d2' : '2px solid transparent',
                   '&:hover': {
                     border: '2px solid #1976d2',
                     opacity: 0.8
                   }
                 }}
                 onClick={() => handleModalAccountToggle(account.id)}
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

      {/* Debug Modal */}
      <Dialog open={debugModalOpen} onClose={handleCloseDebugModal} maxWidth="md" fullWidth>
        <DialogTitle>Balance Forecast Debug Info</DialogTitle>
        <DialogContent>
          {debugLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
              <CircularProgress />
            </Box>
          ) : debugError ? (
            <Alert severity="error">{debugError}</Alert>
          ) : (
            <Box sx={{ maxHeight: 500, overflow: 'auto', bgcolor: '#222', color: '#fff', p: 2, borderRadius: 2, fontFamily: 'monospace', fontSize: 13 }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{debugInfo}</pre>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDebugModal}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Chart */}
      <Paper sx={{ p: 3, position: 'relative' }}>
         {/* Settings and Debug Icons */}
         <Box sx={{ position: 'absolute', top: 0, right: 0, zIndex: 1, display: 'flex' }}>
           <IconButton aria-label="Show Debug Info" onClick={handleOpenDebugModal}>
             <InfoIcon />
           </IconButton>
           <IconButton aria-label="Forecast Settings" onClick={handleOpenSettings}>
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