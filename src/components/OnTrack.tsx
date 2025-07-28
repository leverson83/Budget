import { Box, Typography } from '@mui/material';
import { Pie } from 'react-chartjs-2';
import { useState, useEffect, useCallback } from 'react';
import { useFrequency } from '../contexts/FrequencyContext';
import { useSettings } from '../contexts/SettingsContext';
import { apiCall } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { Bar, Pie as PieChart, Line } from 'react-chartjs-2';
import { Chart as ChartJS, BarElement, ArcElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { frequencies } from '../config';
import type { Frequency } from '../config';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import AccountRadialTree from './AccountRadialTree';

ChartJS.register(BarElement, ArcElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, ChartDataLabels);

const ResponsiveGridLayout = WidthProvider(Responsive);

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
  const { frequency, setFrequency } = useFrequency();
  const [incomes, setIncomes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { getChartType, setChartType } = useSettings();
  const [chartType, setChartTypeState] = useState<'bar' | 'pie'>(getChartType('incomeVsExpenses') as 'bar' | 'pie' || 'bar');
  const [tagChartType, setTagChartTypeState] = useState<'pie' | 'bar'>(getChartType('expensesByTag') as 'pie' | 'bar' || 'pie');

  // Grid layout state
  const [layout, setLayout] = useState([
    { i: 'income-vs-expenses', x: 0, y: 0, w: 6, h: 5, minW: 4, minH: 4, static: false },
    { i: 'expenses-by-tag', x: 6, y: 0, w: 6, h: 5, minW: 4, minH: 4, static: false },
    { i: 'account-radial-tree', x: 0, y: 5, w: 12, h: 6, minW: 6, minH: 5, static: false },
  ]);

  // Handle layout changes
  const onLayoutChange = useCallback((newLayout: any) => {
    setLayout(newLayout);
    localStorage.setItem('dashboard-layout', JSON.stringify(newLayout));
  }, []);

  // Custom resize functionality
  const handleResizeStart = useCallback((e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const currentLayout = layout.find(item => item.i === itemId);
    if (!currentLayout) return;
    
    const startWidth = currentLayout.w;
    const startHeight = currentLayout.h;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      // Convert pixel deltas to grid units (assuming 60px row height and similar column width)
      const gridUnitWidth = 60; // Approximate width of one grid unit
      const gridUnitHeight = 60; // Row height
      
      const newWidth = Math.max(4, Math.min(12, startWidth + Math.round(deltaX / gridUnitWidth)));
      const newHeight = Math.max(3, Math.min(15, startHeight + Math.round(deltaY / gridUnitHeight)));
      
      const newLayout = layout.map(item => 
        item.i === itemId 
          ? { ...item, w: newWidth, h: newHeight }
          : item
      );
      
      setLayout(newLayout);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      localStorage.setItem('dashboard-layout', JSON.stringify(layout));
      // Force chart resize after layout change
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [layout]);

  // Update chart sizes when layout changes
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
    return () => clearTimeout(timer);
  }, [layout]);

  // Load saved layout on mount
  useEffect(() => {
    const savedLayout = localStorage.getItem('dashboard-layout');
    if (savedLayout) {
      try {
        setLayout(JSON.parse(savedLayout));
      } catch (error) {
        console.warn('Failed to load saved layout:', error);
      }
    }
  }, []);

  // Sync with settings on mount/settings change
  useEffect(() => {
    const savedChartType = getChartType('incomeVsExpenses');
    if (savedChartType && savedChartType !== chartType) {
      setChartTypeState(savedChartType as 'bar' | 'pie');
    }
    const savedTagChartType = getChartType('expensesByTag');
    if (savedTagChartType && savedTagChartType !== tagChartType) {
      setTagChartTypeState(savedTagChartType as 'pie' | 'bar');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getChartType]);

  const handleChartTypeChange = useCallback((value: 'bar' | 'pie') => {
    setChartTypeState(value);
    setChartType('incomeVsExpenses', value);
  }, [setChartType]);

  const handleTagChartTypeChange = useCallback((value: 'pie' | 'bar') => {
    setTagChartTypeState(value);
    setChartType('expensesByTag', value);
  }, [setChartType]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [incomesRes, expensesRes, tagsRes, accountsRes] = await Promise.all([
          apiCall('/income'),
          apiCall('/expenses'),
          apiCall('/tags'),
          apiCall('/accounts'),
        ]);
        if (!incomesRes.ok) throw new Error('Failed to fetch incomes');
        if (!expensesRes.ok) throw new Error('Failed to fetch expenses');
        if (!tagsRes.ok) throw new Error('Failed to fetch tags');
        if (!accountsRes.ok) throw new Error('Failed to fetch accounts');
        const incomesData = await incomesRes.json();
        const expensesData = await expensesRes.json();
        const tagsData = await tagsRes.json();
        const accountsData = await accountsRes.json();
        setIncomes(incomesData.map((i: any) => ({ ...i, nextDue: new Date(i.nextDue) })));
        setExpenses(expensesData.map((e: any) => ({ ...e, nextDue: new Date(e.nextDue), tags: e.tags || [], accountId: e.accountId })));
        setTags(tagsData);
        setAccounts(accountsData);
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

  // Calculate total income for the selected frequency
  const totalIncome = calculateTotalForFrequency(incomes, frequency);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Frequency</InputLabel>
          <Select value={frequency} label="Frequency" onChange={e => setFrequency(e.target.value as Frequency)}>
            {frequencies.map((f) => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>
      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: layout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={60}
        onLayoutChange={onLayoutChange}
        isDraggable={true}
        isResizable={false}
        draggableHandle=".drag-handle"
        margin={[16, 80]}
        containerPadding={[0, 40]}
        useCSSTransforms={true}
        compactType="vertical"
        preventCollision={false}
        allowOverlap={false}
        verticalCompact={true}
      >
        {/* Income vs. Expenses Bar Chart Tile */}
        <Box key="income-vs-expenses" sx={{
          bgcolor: 'background.paper',
          borderRadius: 0,
          p: 2,
          boxShadow: 2,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          border: '1px solid #666666'
        }}>
          {/* Tab Container - positioned outside the tile */}
          <Box sx={{
            position: 'absolute',
            top: -32,
            right: -1,
            display: 'flex',
            gap: 0,
            zIndex: 1000,
          }}>
            {/* Drag Handle Tab */}
            <Box
              sx={{
                width: 32,
                height: 32,
                bgcolor: 'rgba(102, 102, 102, 0.1)',
                borderRadius: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'grab',
                border: '1px solid #666666',
                borderBottom: 'none',
                borderRight: 'none',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                '&:hover': {
                  bgcolor: 'rgba(173, 216, 230, 0.3)',
                },
                '&:active': {
                  cursor: 'grabbing',
                },
              }}
              className="drag-handle"
            >
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {[...Array(3)].map((_, i) => (
                  <Box
                    key={i}
                    sx={{
                      width: '100%',
                      height: '2px',
                      bgcolor: 'rgba(102, 102, 102, 0.6)',
                      borderRadius: '1px',
                    }}
                  />
                ))}
              </Box>
            </Box>
            {/* Resize Handle Tab */}
            <Box
              sx={{
                width: 32,
                height: 32,
                bgcolor: 'rgba(102, 102, 102, 0.05)',
                border: '1px solid #666666',
                borderRadius: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'se-resize',
                borderBottom: 'none',
                borderLeft: 'none',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: 'rgba(173, 216, 230, 0.2)',
                },
              }}
              className="custom-resize-handle"
              onMouseDown={(e) => handleResizeStart(e, 'income-vs-expenses')}
            >
              <Box
                sx={{
                  color: 'rgba(102, 102, 102, 0.4)',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                ↙
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              Income vs. Expenses
      </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Chart Type</InputLabel>
                <Select
                  value={chartType}
                  label="Chart Type"
                  onChange={(e) => handleChartTypeChange(e.target.value as 'bar' | 'pie')}
                >
                  <MenuItem value="bar">Bar</MenuItem>
                  <MenuItem value="pie">Pie</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
          {/* Chart Container */}
          <Box sx={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            minHeight: 0,
            overflow: 'hidden',
            width: '100%',
            height: '100%'
          }}>
            {chartType === 'bar' && (
              <Bar
                id="bar-income-vs-expenses"
                data={{
                  labels: ['Income', 'Expenses', 'Savings'],
                  datasets: [
                    {
                      label: 'Amount',
                      data: [
                        calculateTotalForFrequency(incomes, frequency),
                        calculateTotalForFrequency(expenses, frequency),
                        calculateTotalForFrequency(incomes, frequency) - calculateTotalForFrequency(expenses, frequency)
                      ],
                      backgroundColor: [
                        '#1976d2', // blue for Income
                        '#d32f2f', // red for Expenses
                        '#4CAF50'  // green for Savings
                      ],
                      borderColor: [
                        '#fff',
                        '#fff',
                        '#fff'
                      ],
                      borderWidth: 2
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          return `${context.label}: $${context.parsed.y?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        }
                      }
                    },
                    datalabels: { display: false },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function(value) {
                          return `$${value}`;
                        }
                      }
                    }
                  }
                }}
              />
            )}
            {chartType === 'pie' && (
              <PieChart
                id="pie-income-vs-expenses"
                data={{
                  labels: ['Income', 'Expenses', 'Savings'],
                  datasets: [
                    {
                      label: 'Amount',
                      data: [
                        calculateTotalForFrequency(incomes, frequency),
                        calculateTotalForFrequency(expenses, frequency),
                        calculateTotalForFrequency(incomes, frequency) - calculateTotalForFrequency(expenses, frequency)
                      ],
                      backgroundColor: [
                        '#1976d2', // blue for Income
                        '#d32f2f', // red for Expenses
                        '#4CAF50'  // green for Savings
                      ],
                      borderColor: ['#fff', '#fff', '#fff'],
                      borderWidth: 2
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          return `${context.label}: $${context.parsed?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        }
                      }
                    },
                    // @ts-ignore: datalabels is a Chart.js plugin and may not be typed in options
                    datalabels: {
                      display: true,
                      formatter: (value: number, context: any) => {
                        const label = context.chart.data.labels[context.dataIndex];
                        return label;
                      },
                      color: '#fff',
                      font: {
                        weight: 'bold',
                        size: 13,
                      },
                      anchor: 'center',
                      align: 'end',
                      offset: 20,
                      clamp: true,
                      clip: false,
                    },
                  },
                }}
              />
            )}
          </Box>
        </Box>
        {/* Expenses by Tag Pie Chart Tile */}
        <Box key="expenses-by-tag" sx={{
          bgcolor: 'background.paper',
          borderRadius: 0,
          p: 2,
          boxShadow: 2,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          border: '1px solid #666666'
        }}>
          {/* Tab Container - positioned outside the tile */}
          <Box sx={{
            position: 'absolute',
            top: -32,
            right: -1,
            display: 'flex',
            gap: 0,
            zIndex: 1000,
          }}>
            {/* Drag Handle Tab */}
            <Box
              sx={{
                width: 32,
                height: 32,
                bgcolor: 'rgba(102, 102, 102, 0.1)',
                borderRadius: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'grab',
                border: '1px solid #666666',
                borderBottom: 'none',
                borderRight: 'none',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                '&:hover': {
                  bgcolor: 'rgba(173, 216, 230, 0.3)',
                },
                '&:active': {
                  cursor: 'grabbing',
                },
              }}
              className="drag-handle"
            >
      <Box 
        sx={{ 
                  width: 12,
                  height: 12,
          display: 'flex', 
                  flexDirection: 'column',
                  gap: '2px',
          justifyContent: 'center', 
          alignItems: 'center', 
                }}
              >
                {[...Array(3)].map((_, i) => (
                  <Box
                    key={i}
                    sx={{
                      width: '100%',
                      height: '2px',
                      bgcolor: 'rgba(102, 102, 102, 0.6)',
                      borderRadius: '1px',
                    }}
                  />
                ))}
              </Box>
            </Box>
            {/* Resize Handle Tab */}
            <Box
              sx={{
                width: 32,
                height: 32,
                bgcolor: 'rgba(102, 102, 102, 0.05)',
                border: '1px solid #666666',
                borderRadius: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'se-resize',
                borderBottom: 'none',
                borderLeft: 'none',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: 'rgba(173, 216, 230, 0.2)',
                },
              }}
              className="custom-resize-handle"
              onMouseDown={(e) => handleResizeStart(e, 'expenses-by-tag')}
            >
              <Box
                sx={{
                  color: 'rgba(102, 102, 102, 0.4)',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                ↙
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              Expenses by Tag
            </Typography>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Chart Type</InputLabel>
              <Select
                value={tagChartType}
                label="Chart Type"
                onChange={(e) => handleTagChartTypeChange(e.target.value as 'pie' | 'bar')}
              >
                <MenuItem value="pie">Pie</MenuItem>
                <MenuItem value="bar">Bar</MenuItem>
              </Select>
            </FormControl>
          </Box>
          {/* Chart Container */}
          <Box sx={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            minHeight: 0,
            overflow: 'hidden',
            width: '100%',
            height: '100%'
          }}>
            {tagChartType === 'bar' && (
              <Bar
                id="bar-expenses-by-tag"
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
                    label: 'Amount',
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
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          const label = context.label || '';
                          const value = context.parsed.y;
                          const dataset = context.dataset.data;
                          const validData = Array.isArray(dataset) ? dataset.filter((v: any) => typeof v === 'number' && !isNaN(v)) : [];
                          const total = (validData as number[]).reduce((sum, val) => sum + val, 0);
                          const percentage = total > 0 && typeof value === 'number' ? ((value / total) * 100).toFixed(1) : '0.0';
                          return `${label}: $${value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${percentage}%)`;
                        }
                      }
                    },
                    datalabels: { display: false },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function(value) {
                          return `$${value}`;
                        }
                      }
                    }
                  }
                }}
              />
            )}
            {tagChartType === 'pie' && (
              <PieChart
                id="pie-expenses-by-tag"
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
                      display: false,
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          const label = context.label || '';
                          const value = context.parsed;
                          const total = context.dataset.data.reduce((sum: number, val: number) => sum + val, 0);
                          const percentage = ((value / total) * 100).toFixed(1);
                          return `${label}: $${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${percentage}%)`;
                        }
                      }
                    },
                    // @ts-ignore: datalabels is a Chart.js plugin and may not be typed in options
                    datalabels: {
                      formatter: (value: number, context: any) => {
                        const label = context.chart.data.labels[context.dataIndex];
                        const dataset = context.chart.data.datasets[context.datasetIndex];
                        const total = dataset.data.reduce((sum: number, val: number) => sum + val, 0);
                        const percentage = (value / total) * 100;
                        if (percentage < 7) return '';
                        return `${label} (${Math.round(percentage)}%)`;
                      },
                      color: '#fff',
                      font: {
                        weight: 'bold',
                        size: 11,
                      },
                      anchor: 'center',
                      align: 'end',
                      offset: 20,
                      clamp: true,
                      clip: false,
                    },
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
            )}
          </Box>
        </Box>
        {/* Account Flow Radial Tree Diagram Tile */}
        <Box key="account-radial-tree" sx={{
          bgcolor: 'background.paper',
          borderRadius: 0,
          p: 2,
          boxShadow: 2,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          border: '1px solid #666666'
        }}>
          {/* Tab Container - positioned outside the tile */}
          <Box sx={{
            position: 'absolute',
            top: -32,
            right: -1,
            display: 'flex',
            gap: 0,
            zIndex: 1000,
          }}>
            {/* Drag Handle Tab */}
            <Box
              sx={{
                width: 32,
                height: 32,
                bgcolor: 'rgba(102, 102, 102, 0.1)',
                borderRadius: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'grab',
                border: '1px solid #666666',
                borderBottom: 'none',
                borderRight: 'none',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                '&:hover': {
                  bgcolor: 'rgba(173, 216, 230, 0.3)',
                },
                '&:active': {
                  cursor: 'grabbing',
                },
              }}
              className="drag-handle"
            >
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {[...Array(3)].map((_, i) => (
                  <Box
                    key={i}
                    sx={{
                      width: '100%',
                      height: '2px',
                      bgcolor: 'rgba(102, 102, 102, 0.6)',
                      borderRadius: '1px',
                    }}
                  />
                ))}
              </Box>
            </Box>
            {/* Resize Handle Tab */}
            <Box
              sx={{
                width: 32,
                height: 32,
                bgcolor: 'rgba(102, 102, 102, 0.05)',
                border: '1px solid #666666',
                borderRadius: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'se-resize',
                borderBottom: 'none',
                borderLeft: 'none',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: 'rgba(173, 216, 230, 0.2)',
                },
              }}
              className="custom-resize-handle"
              onMouseDown={(e) => handleResizeStart(e, 'account-radial-tree')}
            >
              <Box
                sx={{
                  color: 'rgba(102, 102, 102, 0.4)',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                ↙
              </Box>
            </Box>
          </Box>
          {/* Header */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
              Funds Distribution
            </Typography>
          </Box>
          <AccountRadialTree
            accounts={accounts}
            perAccountExpenses={(() => {
              const totals: Record<number, number> = {};
              for (const acc of accounts) {
                const accExpenses = expenses.filter(e => e.accountId === acc.id);
                totals[acc.id] = accExpenses.length > 0 ? calculateTotalForFrequency(accExpenses, frequency) : 0;
              }
              return totals;
            })()}
            frequencyLabel={(() => {
              const f = frequencies.find(f => f.value === frequency);
              return f ? f.label : frequency;
            })()}
            totalIncome={totalIncome}
            style={{
              width: '100%',
              height: '100%',
              minHeight: 0,
              overflow: 'hidden'
            }}
          />
      </Box>
      </ResponsiveGridLayout>
    </Box>
  );
};

function getPeriods(frequency: string, count: number) {
  const now = new Date();
  const periods = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    if (frequency === 'monthly') d.setMonth(d.getMonth() - i);
    else if (frequency === 'weekly') d.setDate(d.getDate() - i * 7);
    else if (frequency === 'fortnightly') d.setDate(d.getDate() - i * 14);
    else if (frequency === 'quarterly') d.setMonth(d.getMonth() - i * 3);
    else if (frequency === 'annually') d.setFullYear(d.getFullYear() - i);
    else if (frequency === 'daily') d.setDate(d.getDate() - i);
    periods.push(new Date(d));
  }
  return periods;
}

function formatPeriodLabel(date: Date, frequency: string) {
  if (frequency === 'monthly') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  if (frequency === 'weekly' || frequency === 'fortnightly' || frequency === 'daily') return date.toLocaleDateString();
  if (frequency === 'quarterly') return `${date.getFullYear()} Q${Math.floor(date.getMonth() / 3) + 1}`;
  if (frequency === 'annually') return `${date.getFullYear()}`;
  return date.toLocaleDateString();
}

export default OnTrack; 