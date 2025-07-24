import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Select, InputLabel, FormControl, Box
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { Dayjs } from 'dayjs';

interface Account {
  id: number;
  name: string;
  bank: string;
}

interface ManualAdjustmentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { account_id: number; type: 'withdrawal' | 'deposit'; amount: number; date: string; description: string }) => void;
  accounts: Account[];
  allowedType?: 'deposit' | 'withdrawal';
}

const ManualAdjustmentModal: React.FC<ManualAdjustmentModalProps> = ({ open, onClose, onSave, accounts, allowedType }) => {
  const [accountId, setAccountId] = useState<number | ''>('');
  const [type, setType] = useState<'withdrawal' | 'deposit'>(allowedType || 'withdrawal');
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState<Dayjs | null>(dayjs());
  const [description, setDescription] = useState('');

  const handleSave = () => {
    if (!accountId || !amount || !date) {
      console.error('Missing required fields:', { accountId, amount, date });
      return;
    }
    
    if (amount <= 0) {
      console.error('Amount must be greater than 0');
      return;
    }
    
    const formattedDate = date.format('YYYY-MM-DD');
    console.log('Saving manual adjustment:', {
      account_id: Number(accountId),
      type,
      amount: Number(amount),
      date: formattedDate
    });
    
    onSave({
      account_id: Number(accountId),
      type,
      amount: Number(amount),
      date: formattedDate,
      description: description.trim(),
    });
    setAccountId('');
    setType(allowedType || 'withdrawal');
    setAmount('');
    setDate(dayjs());
    setDescription('');
  };

  const handleClose = () => {
    setAccountId('');
    setType(allowedType || 'withdrawal');
    setAmount('');
    setDate(dayjs());
    setDescription('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Manual Adjustment</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <FormControl fullWidth required>
            <InputLabel id="account-label">Account</InputLabel>
            <Select
              labelId="account-label"
              value={accountId}
              label="Account"
              onChange={e => setAccountId(Number(e.target.value))}
            >
              {accounts.map(acc => (
                <MenuItem key={acc.id} value={acc.id}>{acc.name} ({acc.bank})</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth required>
            <InputLabel id="type-label">Type</InputLabel>
            <Select
              labelId="type-label"
              value={type}
              label="Type"
              onChange={e => setType(e.target.value as 'withdrawal' | 'deposit')}
              disabled={!!allowedType}
            >
              {(!allowedType || allowedType === 'withdrawal') && (
                <MenuItem value="withdrawal">Withdrawal</MenuItem>
              )}
              {(!allowedType || allowedType === 'deposit') && (
                <MenuItem value="deposit">Deposit</MenuItem>
              )}
            </Select>
          </FormControl>
          <TextField
            label="Amount"
            type="number"
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            fullWidth
            required
            inputProps={{ step: '0.01', min: 0 }}
          />
          <TextField
            label="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={1}
            maxRows={3}
          />
          <DatePicker
            label="Date"
            value={date}
            onChange={(value) => setDate(value as Dayjs | null)}
            format="YYYY-MM-DD"
            sx={{ width: '100%' }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" color="primary" disabled={!accountId || !amount || !date}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ManualAdjustmentModal; 