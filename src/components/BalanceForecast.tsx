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
    pastMonths: 0,
    futureMonths: 3
  });
  const [modalTimePeriod, setModalTimePeriod] = useState<TimePeriodSettings>({
    pastMonths: 0,
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
  const [manualAdjustments, setManualAdjustments] = useState<any[]>([]);
  // Add state for custom marker date
  const [modalMarkerDate, setModalMarkerDate] = useState<Date | null>(null);
  const [markerDate, setMarkerDate] = useState<Date | null>(null);
  // Add modal state for disbursement settings
  const [modalDisbursementSettings, setModalDisbursementSettings] = useState<DisbursementSettings>(disbursementSettings);
  const [modalNextCycleDate, setModalNextCycleDate] = useState<Date | null>(null);

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
    
    // Always use pastMonths=0, only futureMonths is user-selected
    const periodToUse = {
      pastMonths: 0,
      futureMonths: (customTimePeriod ? customTimePeriod.futureMonths : timePeriod.futureMonths)
    };
    
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

  // Fetch manual adjustments
  const fetchManualAdjustments = async () => {
    try {
      const response = await apiCall('/manual-adjustments');
      if (response.ok) {
        setManualAdjustments(await response.json());
      }
    } catch (err) {
      // ignore
    }
  };

  // Load saved settings on mount
  useEffect(() => {
    loadSavedSettings();
  }, []);

  useEffect(() => {
    fetchManualAdjustments();
  }, []);

  // Add effect to fetch forecast data after settingsLoaded and disbursementSettings are set
  useEffect(() => {
    if (
      settingsLoaded &&
      disbursementSettings.disbursementFrequency &&
      disbursementSettings.disbursementDay !== undefined &&
      timePeriod.pastMonths &&
      timePeriod.futureMonths
    ) {
      fetchForecastData(timePeriod);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded, disbursementSettings.disbursementFrequency, disbursementSettings.disbursementDay, timePeriod.pastMonths, timePeriod.futureMonths]);

  const loadSavedSettings = async (): Promise<Set<number> | undefined> => {
    try {
      console.log('🌐 Loading settings from:', `${window.location.origin}/api/forecast-settings`);
      const res = await apiCall('/forecast-settings');
      if (res.ok) {
        const data = await res.json();
        console.log('📥 Loaded from backend:', data);
        let loadedPeriod: { pastMonths: number, futureMonths: number } | undefined = undefined;
        
        if (data.selectedAccounts && Array.isArray(data.selectedAccounts) && data.selectedAccounts.length > 0) {
          const accounts = new Set(data.selectedAccounts as number[]);
          console.log('✅ Using saved account selection:', Array.from(accounts));
          setSelectedAccounts(accounts);
          setModalSelectedAccounts(new Set(accounts));
          
          const warning = data.warningLine !== undefined && data.warningLine !== null ? data.warningLine : null;
          setWarningLine(warning);
          setModalWarningLine(warning);

          // Load period settings
          if (data.pastMonths !== undefined && data.futureMonths !== undefined) {
            setTimePeriod({ pastMonths: data.pastMonths, futureMonths: data.futureMonths });
            setModalTimePeriod({ pastMonths: data.pastMonths, futureMonths: data.futureMonths });
            loadedPeriod = { pastMonths: data.pastMonths, futureMonths: data.futureMonths };
          }
          if (data.frequency !== undefined && data.disbursementDay !== undefined) {
            setDisbursementSettings({
              disbursementFrequency: data.frequency,
              disbursementDay: data.disbursementDay
            });
          }

          // Mark settings as loaded to prevent overriding
          setSettingsLoaded(true);
          // Fetch forecast data with loaded period
          if (loadedPeriod) {
            fetchForecastData(loadedPeriod, accounts);
          }
          return accounts;
        } else {
          console.log('🔧 No saved account selection found, will use default');
          const warning = data.warningLine !== undefined && data.warningLine !== null ? data.warningLine : null;
          setWarningLine(warning);
          setModalWarningLine(warning);
          // Load period settings
          if (data.pastMonths !== undefined && data.futureMonths !== undefined) {
            setTimePeriod({ pastMonths: data.pastMonths, futureMonths: data.futureMonths });
            setModalTimePeriod({ pastMonths: data.pastMonths, futureMonths: data.futureMonths });
            loadedPeriod = { pastMonths: data.pastMonths, futureMonths: data.futureMonths };
          }
          if (data.frequency !== undefined && data.disbursementDay !== undefined) {
            setDisbursementSettings({
              disbursementFrequency: data.frequency,
              disbursementDay: data.disbursementDay
            });
          }
          setSettingsLoaded(true);
          if (loadedPeriod) {
            fetchForecastData(loadedPeriod);
          }
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

  // Modal field handlers for frequency and date
  const handleModalDisbursementFrequencyChange = (frequency: Frequency) => {
    setModalDisbursementSettings({ ...modalDisbursementSettings, disbursementFrequency: frequency });
    setSettingsChanged(true);
  };
  const handleModalNextCycleDateChange = (date: Date | null) => {
    setModalNextCycleDate(date);
    setSettingsChanged(true);
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

    // Compute disbursementDay from modalNextCycleDate and modalDisbursementSettings
    let disbursementDay = modalDisbursementSettings.disbursementDay;
    if (modalNextCycleDate) {
      disbursementDay = getDisbursementDayFromDate(modalDisbursementSettings.disbursementFrequency, modalNextCycleDate);
    }
    // Save settings to backend
    try {
      const response = await apiCall('/forecast-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedAccounts: Array.from(modalSelectedAccounts),
          warningLine: modalWarningLine,
          pastMonths: modalTimePeriod.pastMonths,
          futureMonths: modalTimePeriod.futureMonths,
          frequency: modalDisbursementSettings.disbursementFrequency,
          disbursementDay
        })
      });
      
      if (response.ok) {
        setDisbursementSettings({ ...modalDisbursementSettings, disbursementDay });
        setNextCycleDate(modalNextCycleDate);
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
    setMarkerDate(modalMarkerDate);

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
    setModalMarkerDate(markerDate);
    setModalDisbursementSettings(disbursementSettings);
    setModalNextCycleDate(nextCycleDate);
    setSettingsChanged(false);
    setSettingsOpen(false);
  };

  const handleOpenSettings = () => {
    // Initialize modal state with current values
    setModalSelectedAccounts(new Set(selectedAccounts));
    setModalTimePeriod(timePeriod);
    setModalWarningLine(warningLine);
    // Set the modal's date picker to the current disbursement date
    setModalNextCycleDate(getDateFromDisbursement(disbursementSettings.disbursementFrequency, disbursementSettings.disbursementDay));
    setModalDisbursementSettings(disbursementSettings);
    setSettingsOpen(true);
  };

  // Helper to format date as YYYY-MM-DD (local, no time)
  function toYMD(date: Date) {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Helper to format date as YYYY-MM-DD in UTC
  function toUTCYMD(date: Date) {
    const y = date.getUTCFullYear();
    const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = date.getUTCDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Helper to format date as YYYY-MM-DDT00:00:00Z (UTC midnight)
  function toUTCISOStringYMD(date: Date) {
    return date ? new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString().slice(0, 10) + 'T00:00:00Z' : '';
  }

  // Helper to format date as DD/MM/YYYY
  function toDDMMYYYY(date: Date) {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  }

  // Debug logging for marker and forecast dates
  if (forecastData && forecastData.forecast && forecastData.forecast.length > 0) {
    const firstDate = forecastData.forecast[0].date;
    const lastDate = forecastData.forecast[forecastData.forecast.length - 1].date;
    console.log('Forecast first date:', firstDate, 'as Date:', new Date(firstDate));
    console.log('Forecast last date:', lastDate, 'as Date:', new Date(lastDate));
  }
  if (markerDate) {
    console.log('Marker date (raw):', markerDate);
    console.log('Marker date (local YMD):', toYMD(markerDate));
    console.log('Marker date (UTC YMD):', toUTCYMD(markerDate));
  }

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
  const filteredForecast = (forecastData?.forecast || []).filter(item => new Date(item.date) >= new Date(new Date().toDateString()));

  // Build chart datasets
  const chartData = {
    labels: filteredForecast.map(item => {
      // Use actual Date objects for Chart.js to avoid timezone issues
      return new Date(item.date);
    }) || [],
    datasets: [
      ...filteredAccounts.map((account, index) => {
        const colors = [
          '#1976d2', '#dc004e', '#388e3c', '#f57c00', '#7b1fa2', 
          '#d32f2f', '#388e3c', '#f57c00', '#7b1fa2', '#1976d2'
        ];
        const color = colors[index % colors.length];
        const accountData = filteredForecast.map(item => item.accounts[account.id] || 0);
        
        return {
          label: account.name,
          data: accountData,
          borderColor: color,
          backgroundColor: color + '10',
          borderWidth: 3,
          fill: false,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: color,
          order: 1,
          datalabels: {
            display: false
          },
          isTrendLine: false
        };
      }),
      ...filteredAccounts.map((account, index) => {
        // Manual adjustment markers for this account
        const accountManuals = manualAdjustments.filter(
          (adj) => adj.account_id === account.id
        );
        // Map to {x: date, y: balance} for each adjustment
        const points = accountManuals.map((adj) => {
          // Find the forecasted balance for this account on this date
          const forecastPoint = filteredForecast.find(f => {
            // Compare as Date objects
            const forecastDate = new Date(f.date);
            const adjDate = new Date(adj.date);
            return forecastDate.toDateString() === adjDate.toDateString();
          });
          return forecastPoint
            ? {
                x: new Date(adj.date),
                y: forecastPoint.accounts[account.id],
                type: adj.type,
                amount: adj.amount,
                description: adj.description
              }
            : null;
        }).filter(Boolean);
        if (points.length === 0) return [];
        return [{
          type: 'scatter' as const,
          label: `${account.name} Manual Adjustments`,
          data: points,
          showLine: false,
          pointStyle: (ctx: any) => {
            const t = ctx.raw?.type;
            if (t === 'withdrawal') return 'triangle';
            if (t === 'deposit') return 'triangle';
            return 'circle';
          },
          pointRotation: (ctx: any) => ctx.raw?.type === 'withdrawal' ? 180 : 0,
          pointBackgroundColor: (ctx: any) => ctx.raw?.type === 'withdrawal' ? '#d32f2f' : '#388e3c',
          pointBorderColor: (ctx: any) => ctx.raw?.type === 'withdrawal' ? '#d32f2f' : '#388e3c',
          pointRadius: 8,
          pointHoverRadius: 10,
          order: 100,
          datalabels: { display: false },
          isManualMarker: true,
          legend: { display: false }
        }];
      }).flat()
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
          padding: 20,
          // Hide trend lines and manual markers from legend
          filter: (legendItem: any, data: any) => {
            const dataset = data.datasets[legendItem.datasetIndex];
            return !dataset.isTrendLine && !dataset.isManualMarker;
          }
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
        // Hide trend lines from tooltip
        filter: (tooltipItem: any) => {
          const dataset = tooltipItem.dataset;
          return !dataset.isTrendLine;
        },
        callbacks: {
          title: function(context: any) {
            const dataIndex = context[0].dataIndex;
            const date = forecastData?.forecast[dataIndex]?.date;
            if (date) {
              // Show as DD/MM/YYYY
              const validDate = new Date(date);
              if (!isNaN(validDate.getTime())) {
                return toDDMMYYYY(validDate);
              }
            }
            return 'Invalid Date';
          },
          label: function(context: any) {
            if (context.dataset.isManualMarker && context.raw) {
              const adj = context.raw;
              const dir = adj.type === 'withdrawal' ? 'Manual Withdrawal' : 'Manual Deposit';
              return `${dir}: ${formatCurrency(adj.amount)}${adj.description ? ' - ' + adj.description : ''}`;
            }
            // fallback to default
            const accountName = context.dataset.label;
            const balance = context.parsed.y;
            return `${accountName}: ${formatCurrency(balance)}`;
          }
        }
      },
      annotation: {
        annotations: {
          ...(markerDate
            ? {
                customMarker: {
                  type: 'line' as const,
                  xMin: new Date(markerDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
                  xMax: new Date(markerDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
                  borderColor: '#00bcd4',
                  borderWidth: 2,
                  borderDash: [4, 4],
                  label: { display: false }
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
                  borderDash: [4, 4]
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
            day: 'dd/MM/yyyy',
            month: 'MM/yyyy',
            year: 'yyyy'
          },
          tooltipFormat: 'dd/MM/yyyy'
        },
        title: {
          display: true,
          text: 'Date'
        },
        adapters: {
          date: {
            locale: undefined // Use default locale, but we override with displayFormats above
          }
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
                 value={modalDisbursementSettings.disbursementFrequency}
                 label="Frequency"
                 onChange={(e) => handleModalDisbursementFrequencyChange(e.target.value as Frequency)}
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
                 value={modalNextCycleDate}
                 onChange={(value) => {
                   let date: Date | null = null;
                   if (value instanceof Date) {
                     date = value;
                   } else if (value && typeof value === 'object' && typeof value.toDate === 'function') {
                     date = value.toDate();
                   }
                   handleModalNextCycleDateChange(date);
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
                 switch (modalDisbursementSettings.disbursementFrequency) {
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

           {/* Period to Show (Future only) */}
           <Typography variant="h6" sx={{ mb: 2 }}>
             Period to Show
           </Typography>
           <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
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


           {/* Warning Line and Custom Marker Date */}
           <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
             <Box sx={{ flex: 1 }}>
               <Typography variant="h6" sx={{ mb: 2 }}>
                 Warning Line
               </Typography>
               <TextField
                 label="Warning Amount"
                 type="number"
                 value={modalWarningLine || ''}
                 onChange={(e) => handleModalWarningLineChange(e.target.value)}
                 fullWidth
                 inputProps={{ step: '0.01', min: 0 }}
                 helperText="Show a warning line on the graph"
               />
             </Box>
             <Box sx={{ flex: 1 }}>
               <Typography variant="h6" sx={{ mb: 2 }}>
                 Custom Marker Date
               </Typography>
               <LocalizationProvider dateAdapter={AdapterDateFns}>
                 <DatePicker
                   label="Custom Marker Date"
                   value={modalMarkerDate}
                                  onChange={(value) => {
                 let date: Date | null = null;
                 if (value instanceof Date) {
                   date = value;
                 } else if (value && typeof value === 'object' && typeof value.toDate === 'function') {
                   date = value.toDate();
                 }
                 setModalMarkerDate(date);
                 setSettingsChanged(true);
               }}
                   format="EEE d MMMM yyyy"
                   slotProps={{ 
                     textField: { 
                       fullWidth: true,
                       helperText: "Add a date marker to the graph"
                     } 
                   }}
                   views={['day']}
                   disablePast
                 />
               </LocalizationProvider>
             </Box>
           </Box>

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
          {/* Show frequency and date info */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Forecast Frequency: {disbursementSettings.disbursementFrequency ? (disbursementSettings.disbursementFrequency.charAt(0).toUpperCase() + disbursementSettings.disbursementFrequency.slice(1)) : 'N/A'}
              {' | '}Disbursement Date: {(() => {
                if (!disbursementSettings.disbursementFrequency || disbursementSettings.disbursementDay == null) return 'N/A';
                const date = getDateFromDisbursement(disbursementSettings.disbursementFrequency, disbursementSettings.disbursementDay);
                return date ? date.toLocaleDateString() : 'N/A';
              })()}
            </Typography>
          </Box>
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
              data={chartData as any} 
              options={chartOptions} 
            />
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default BalanceForecast; 