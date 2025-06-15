export const API_URL = 'http://localhost:3001/api';

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';

export const frequencies = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' }
]; 