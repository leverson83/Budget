import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  LinearProgress,
  Box,
  Typography,
} from '@mui/material';
import { apiCall } from '../utils/api';
import { type Frequency } from '../config';

interface Expense {
  id: string;
  description: string;
  amount: number;
  frequency: Frequency;
  nextDue: string;
  accountId: number | null;
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

interface AutoUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AutoUpdateModal: React.FC<AutoUpdateModalProps> = ({ isOpen, onClose }) => {
  const [updateLog, setUpdateLog] = useState<string[]>([]);
  const [displayedLog, setDisplayedLog] = useState<string[]>([]);
  const [showProgressBar, setShowProgressBar] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('AutoUpdateModal: isOpen changed to:', isOpen);
    
    if (!isOpen) {
      setUpdateLog([]);
      setDisplayedLog([]);
      setShowProgressBar(false);
      return;
    }

    console.log('AutoUpdateModal: Starting auto update...');
    const performAutoUpdate = async () => {
      try {
        // Fetch frequency setting
        const freqRes = await apiCall('/settings/frequency');
        let freq = 'daily';
        if (freqRes.ok) {
          const data = await freqRes.json();
          freq = data.frequency || 'daily';
        }

        // Fetch expenses and accounts
        const [expensesResponse, accountsResponse] = await Promise.all([
          apiCall('/expenses?includeHidden=true'),
          apiCall('/accounts')
        ]);

        if (!expensesResponse.ok || !accountsResponse.ok) {
          throw new Error('Failed to fetch data');
        }

        const expenses: Expense[] = await expensesResponse.json();
        const accounts: Account[] = await accountsResponse.json();

        setShowProgressBar(true);
        setUpdateLog([`Starting required balance update for all accounts (frequency: ${freq})...`]);

        for (const account of accounts) {
          setUpdateLog((log: string[]) => [...log, `\nUpdating account: ${account.name} (${account.bank})`]);
          let accountTotal = 0;
          const accountExpenses = expenses.filter(e => e.accountId === account.id);
          
          if (accountExpenses.length === 0) {
            setUpdateLog((log: string[]) => [...log, '  No expenses for this account.']);
          }

          for (const expense of accountExpenses) {
            const { lastScheduled } = calculateScheduledDates(expense.nextDue, expense.frequency);
            const rate = calculateRate(expense.amount, expense.frequency, freq);
            const periods = calculateTimeSinceLastDueWithFrequency(lastScheduled, freq);
            const accrued = parseFloat(calculateAccruedAmount(rate, periods));
            accountTotal += accrued;

            // Use freq for labels
            const freqLabel = getFrequencyLabel(freq as Frequency).toLowerCase();
            let perLabel = freqLabel;
            if (freq === 'daily') perLabel = 'day';
            else if (freq === 'weekly') perLabel = 'week';
            else if (freq === 'monthly') perLabel = 'month';
            else if (freq === 'quarterly') perLabel = 'quarter';
            else if (freq === 'annually') perLabel = 'year';

            let periodLabel = freqLabel;
            if (freq === 'daily') periodLabel = 'days';
            else if (freq === 'weekly') periodLabel = 'weeks';
            else if (freq === 'monthly') periodLabel = 'months';
            else if (freq === 'quarterly') periodLabel = 'quarters';
            else if (freq === 'annually') periodLabel = 'years';
            else if (!freqLabel.endsWith('s')) periodLabel = freqLabel + 's';

            // Fix rate for fortnightly->weekly log
            let logRate = rate;
            let logAccrued = accrued;
            if (expense.frequency === 'fortnightly' && freq === 'weekly') {
              logRate = expense.amount * 26 / 52;
              if (periods === 2) {
                logAccrued = expense.amount;
              } else {
                logAccrued = logRate * periods;
              }
            }

            setUpdateLog((log: string[]) => [
              ...log,
              `  - ${expense.description}: $${expense.amount.toFixed(2)} (${expense.frequency === 'fortnightly' ? 'fortnightly' : expense.frequency}), Rate: $${logRate.toFixed(2)} per ${perLabel} x ${periods} ${periodLabel} = $${logAccrued.toFixed(2)}`
            ]);
          }

          try {
            const response = await apiCall(`/accounts/${account.id}`, {
              method: 'PUT',
              body: JSON.stringify({
                name: account.name,
                bank: account.bank,
                currentBalance: account.currentBalance,
                requiredBalance: accountTotal,
                isPrimary: account.isPrimary,
                diff: account.diff
              })
            });
            if (response.ok) {
              setUpdateLog((log: string[]) => [...log, `✔️ Updated ${account.name}: $${accountTotal.toFixed(2)}`, '--------------------']);
            } else {
              setUpdateLog((log: string[]) => [...log, `❌ Failed to update ${account.name}`]);
            }
          } catch (err) {
            setUpdateLog((log: string[]) => [...log, `❌ Error updating ${account.name}`]);
          }
        }

        setUpdateLog((log: string[]) => [...log, '\nAll updates complete.']);
      } catch (err) {
        setUpdateLog((log: string[]) => [...log, '❌ Error during auto update.']);
      }
    };

    performAutoUpdate();
  }, [isOpen]);

  // Animate log lines in modal
  useEffect(() => {
    if (!isOpen || updateLog.length === 0) {
      setDisplayedLog([]);
      return;
    }

    let cancelled = false;
    setDisplayedLog([updateLog[0]]);
    const totalDuration = 1500; // 1.5 seconds
    const interval = updateLog.length > 1 ? totalDuration / updateLog.length : totalDuration;
    let idx = 1;

    function showNext() {
      if (cancelled) return;
      setDisplayedLog((prev) => updateLog.slice(0, idx + 1));
      idx++;
      if (idx < updateLog.length) {
        setTimeout(showNext, interval);
      }
    }

    if (updateLog.length > 1) setTimeout(showNext, interval);
    return () => { cancelled = true; };
  }, [isOpen, updateLog]);

  // Update scroll position
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight - logRef.current.clientHeight + 40;
    }
  }, [displayedLog]);

  const getFrequencyLabel = (frequency: Frequency) => {
    const labels: Record<Frequency, string> = {
      daily: 'Daily',
      weekly: 'Weekly',
      fortnightly: 'Fortnightly',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      annually: 'Annually'
    };
    return labels[frequency] || frequency;
  };

  const calculateAccruedAmount = (rate: number, timeSinceLastDue: number): string => {
    const result = rate * timeSinceLastDue;
    return result.toFixed(2);
  };

  const calculateScheduledDates = (nextDueDate: string, frequency: string) => {
    const today = new Date();
    const nextDue = new Date(nextDueDate);
    let lastScheduled: Date;

    const dayOfWeek = nextDue.getDay();
    const month = nextDue.getMonth();
    const day = nextDue.getDate();

    switch (frequency) {
      case 'daily':
        lastScheduled = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        break;
      case 'weekly': {
        const daysSinceLast = (today.getDay() - dayOfWeek + 7) % 7;
        lastScheduled = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (daysSinceLast || 7));
        break;
      }
      case 'fortnightly': {
        const daysSinceLast = (today.getDay() - dayOfWeek + 14) % 14;
        lastScheduled = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (daysSinceLast || 14));
        break;
      }
      case 'monthly': {
        lastScheduled = new Date(today.getFullYear(), today.getMonth(), day);
        if (lastScheduled > today) {
          lastScheduled = new Date(today.getFullYear(), today.getMonth() - 1, day);
        }
        break;
      }
      case 'quarterly': {
        const currentQuarter = Math.floor(today.getMonth() / 3);
        const targetMonth = currentQuarter * 3 + (month % 3);
        lastScheduled = new Date(today.getFullYear(), targetMonth, day);
        if (lastScheduled > today) {
          lastScheduled = new Date(today.getFullYear(), targetMonth - 3, day);
        }
        break;
      }
      case 'annually': {
        lastScheduled = new Date(today.getFullYear(), month, day);
        if (lastScheduled > today) {
          lastScheduled = new Date(today.getFullYear() - 1, month, day);
        }
        break;
      }
      default:
        lastScheduled = today;
    }

    return { lastScheduled };
  };

  const calculateRate = (amount: number, frequency: string, selectedFreq: string): number => {
    let annualAmount = amount;
    switch (frequency) {
      case 'daily':
        annualAmount = amount * 365;
        break;
      case 'weekly':
        annualAmount = amount * 52;
        break;
      case 'fortnightly':
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

    switch (selectedFreq) {
      case 'daily':
        return annualAmount / 365;
      case 'weekly':
        return annualAmount / 52;
      case 'fortnightly':
        return annualAmount / 26;
      case 'monthly':
        return annualAmount / 12;
      case 'quarterly':
        return annualAmount / 4;
      case 'annually':
        return annualAmount;
      default:
        return annualAmount / 365;
    }
  };

  const calculateTimeSinceLastDueWithFrequency = (lastScheduled: string | Date, frequency: string): number => {
    const today = new Date();
    const lastDue = typeof lastScheduled === 'string' ? new Date(lastScheduled) : lastScheduled;
    
    switch (frequency) {
      case 'daily':
        return Math.max(0, Math.floor((today.getTime() - lastDue.getTime()) / (1000 * 60 * 60 * 24)));
      case 'weekly':
        return Math.max(0, Math.floor((today.getTime() - lastDue.getTime()) / (1000 * 60 * 60 * 24 * 7)));
      case 'fortnightly':
        return Math.max(0, Math.floor((today.getTime() - lastDue.getTime()) / (1000 * 60 * 60 * 24 * 14)));
      case 'monthly':
        return Math.max(0, (today.getFullYear() - lastDue.getFullYear()) * 12 + (today.getMonth() - lastDue.getMonth()));
      case 'quarterly':
        return Math.max(0, Math.floor(((today.getFullYear() - lastDue.getFullYear()) * 12 + (today.getMonth() - lastDue.getMonth())) / 3));
      case 'annually':
        return Math.max(0, today.getFullYear() - lastDue.getFullYear());
      default:
        return Math.max(0, Math.floor((today.getTime() - lastDue.getTime()) / (1000 * 60 * 60 * 24)));
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          height: '80vh',
          maxHeight: '80vh',
        }
      }}
    >
      <DialogTitle>Updating Required Balances</DialogTitle>
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
        {showProgressBar && (
          <Box sx={{ p: 2, pb: 1 }}>
            <LinearProgress 
              variant="determinate" 
              value={Math.min((displayedLog.length / updateLog.length) * 100, 100)}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        )}
        <Box
          ref={logRef}
          sx={{
            flex: 1,
            p: 2,
            pt: showProgressBar ? 1 : 2,
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            lineHeight: 1.4,
            whiteSpace: 'pre-wrap',
            bgcolor: 'grey.900',
            color: 'grey.100',
            borderRadius: 1,
            mx: 2,
            mb: 2,
            border: '1px solid',
            borderColor: 'grey.700',
          }}
        >
          {displayedLog.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained">
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AutoUpdateModal; 