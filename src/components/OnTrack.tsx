import { Box, Typography } from '@mui/material';
import { Pie } from 'react-chartjs-2';
import { useState, useEffect } from 'react';
import { useFrequency } from '../contexts/FrequencyContext';
import { apiCall } from '../utils/api';
import { useNavigate } from 'react-router-dom';

const getTagColor = (tagName: string, tags: any[]) => {
  const tag = tags.find((t: any) => t.name === tagName);
  if (tag && tag.color) return tag.color;
  const predefinedColors = [
    '#1976d2', '#dc004e', '#388e3c', '#f57c00', '#7b1fa2',
    '#d32f2f', '#388e3c', '#f57c00', '#7b1fa2', '#1976d2'
  ];
  const index = tagName.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
  return predefinedColors[index % predefinedColors.length];
};

const formatCurrency = (amount: number, noCents: boolean = false): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: noCents ? 0 : 2,
    maximumFractionDigits: noCents ? 0 : 2,
  }).format(amount).replace('A$', '$');
};

const calculateTotalForFrequency = (items: any[], targetFrequency: string) => {
  return items.reduce((total, item) => {
    const amount = Number(item.amount);
    const itemFrequency = item.frequency;
    let annualAmount = amount;
    switch (itemFrequency) {
      case 'daily': annualAmount = amount * 365; break;
      case 'weekly': annualAmount = amount * 52; break;
      case 'fortnightly': annualAmount = amount * 26; break;
      case 'monthly': annualAmount = amount * 12; break;
      case 'quarterly': annualAmount = amount * 4; break;
      case 'annually': annualAmount = amount; break;
    }
    switch (targetFrequency) {
      case 'daily': return total + (annualAmount / 365);
      case 'weekly': return total + (annualAmount / 52);
      case 'fortnightly': return total + (annualAmount / 26);
      case 'monthly': return total + (annualAmount / 12);
      case 'quarterly': return total + (annualAmount / 4);
      case 'annually': return total + annualAmount;
      default: return total + annualAmount;
    }
  }, 0);
};

const OnTrack = () => {
  const { frequency } = useFrequency();
  const [incomes, setIncomes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [incomesRes, expensesRes, tagsRes] = await Promise.all([
          apiCall('/income'),
          apiCall('/expenses'),
          apiCall('/tags'),
        ]);
        if (!incomesRes.ok) throw new Error('Failed to fetch incomes');
        if (!expensesRes.ok) throw new Error('Failed to fetch expenses');
        if (!tagsRes.ok) throw new Error('Failed to fetch tags');
        const incomesData = await incomesRes.json();
        const expensesData = await expensesRes.json();
        const tagsData = await tagsRes.json();
        setIncomes(incomesData.map((i: any) => ({ ...i, nextDue: new Date(i.nextDue) })));
        setExpenses(expensesData.map((e: any) => ({ ...e, nextDue: new Date(e.nextDue), tags: e.tags || [], accountId: e.accountId })));
        setTags(tagsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <Typography>Loading...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        OnTrack
      </Typography>
      {/* Expenses by Tag Pie Chart */}
      <Box sx={{ mt: 6, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>
          Expenses by Tag
        </Typography>
        <Box sx={{ width: '100%', maxWidth: 600, height: 400, cursor: 'pointer' }}>
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
                    data.push(calculateTotalForFrequency(expenses, frequency));
                  } else {
                    data = uniqueTags.map(tag => {
                      const tagExpenses = expenses.filter(expense => expense.tags && expense.tags.includes(tag));
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
                backgroundColor: (() => {
                  const allTags = expenses.flatMap(expense => expense.tags || []);
                  const uniqueTags = [...new Set(allTags)];
                  let colors = [];
                  if (uniqueTags.length === 0) {
                    colors.push('#C9CBCF');
                  } else {
                    colors = uniqueTags.map(tag => getTagColor(tag, tags));
                  }
                  // Add green color for savings
                  const totalIncome = calculateTotalForFrequency(incomes, frequency);
                  const totalExpenses = calculateTotalForFrequency(expenses, frequency);
                  const savings = totalIncome - totalExpenses;
                  if (savings > 0) {
                    colors.push('#4CAF50');
                  }
                  return colors;
                })(),
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
                      const isClickable = label !== 'Savings' && label !== 'No Tags';
                      return `${label}: ${formatCurrency(value)} (${percentage}%)${isClickable ? ' - Click to filter' : ''}`;
                    }
                  }
                },
                datalabels: {
                  display: function(context: any) {
                    const value = context.dataset.data[context.dataIndex];
                    const total = context.dataset.data.reduce((sum: number, val: number) => sum + val, 0);
                    const percentage = (value / total) * 100;
                    return percentage > 5;
                  },
                  color: '#fff',
                  font: {
                    weight: 'bold',
                    size: 10
                  },
                  formatter: function(_value: number, context: any) {
                    const label = context.chart.data.labels[context.dataIndex];
                    return label;
                  },
                  textAlign: 'center',
                  textStrokeColor: 'rgba(0,0,0,0.5)',
                  textStrokeWidth: 2
                }
              },
              onClick: (_event: any, elements: any[]) => {
                if (elements.length > 0) {
                  const index = elements[0].index;
                  const allTags = expenses.flatMap((expense: any) => expense.tags || []);
                  const uniqueTags = [...new Set(allTags)];
                  const labels = uniqueTags.length > 0 ? uniqueTags : ['No Tags'];
                  // Add Savings to the labels
                  const totalIncome = calculateTotalForFrequency(incomes, frequency);
                  const totalExpenses = calculateTotalForFrequency(expenses, frequency);
                  const savings = totalIncome - totalExpenses;
                  if (savings > 0) {
                    labels.push('Savings');
                  }
                  const clickedLabel = labels[index];
                  if (clickedLabel === 'Savings' || clickedLabel === 'No Tags') return;
                  navigate(`/expenses?tags=${encodeURIComponent(clickedLabel)}`);
                }
              },
            }}
          />
        </Box>
        <Typography variant="caption" sx={{ mt: 1, color: 'text.secondary', textAlign: 'center' }}>
          Click on a tag segment to view filtered expenses
        </Typography>
      </Box>
    </Box>
  );
};

export default OnTrack; 