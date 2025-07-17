const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use the same database as the main server
const dbPath = path.join(__dirname, 'budget.db');
const db = new sqlite3.Database(dbPath);

console.log('Debugging family account with $20/week and manual withdrawals only...');

// Get the family account and its expense
db.get(`
  SELECT a.*, e.* 
  FROM accounts a 
  LEFT JOIN expenses e ON a.id = e.accountId 
  WHERE a.name = 'family' AND e.description IS NOT NULL
`, (err, row) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  
  if (!row) {
    console.log('No family account found or no expense associated');
    return;
  }
  
  console.log('Family account found:', {
    accountId: row.id,
    name: row.name,
    currentBalance: row.currentBalance,
    isPrimary: row.isPrimary
  });
  
  console.log('Associated expense:', {
    expenseId: row.expenseId,
    description: row.description,
    amount: row.amount,
    frequency: row.frequency,
    manualWithdrawalsOnly: row.manualWithdrawalsOnly,
    nextDue: row.nextDue
  });
  
  // Get disbursement settings
  db.get('SELECT value FROM settings WHERE key = ?', ['disbursementFrequency'], (err, freqRow) => {
    if (err) {
      console.error('Error getting disbursement frequency:', err);
      return;
    }
    
    db.get('SELECT value FROM settings WHERE key = ?', ['disbursementDay'], (err, dayRow) => {
      if (err) {
        console.error('Error getting disbursement day:', err);
        return;
      }
      
      console.log('Disbursement settings:', {
        frequency: freqRow?.value || 'not set',
        day: dayRow?.value || 'not set'
      });
      
      // Test the isDue function for the next few weeks
      const today = new Date();
      console.log('\nTesting isDue for next 4 weeks:');
      
      for (let i = 0; i < 28; i++) {
        const testDate = new Date(today);
        testDate.setDate(today.getDate() + i);
        
        const isDueToday = isDue(row, testDate);
        const isDisbursementDay = isDisbursementDay(testDate, freqRow?.value || 'monthly', parseInt(dayRow?.value || '1'));
        
        if (isDueToday || isDisbursementDay) {
          console.log(`${testDate.toISOString().split('T')[0]}:`, {
            isDue: isDueToday,
            isDisbursementDay: isDisbursementDay
          });
        }
      }
      
      db.close();
    });
  });
});

// Copy the isDue function from server.js
function isDue(item, date) {
  const freq = item.frequency;
  const nextDue = new Date(item.nextDue);
  
  if (date < nextDue) return false;
  
  let result = false;
  switch (freq) {
    case 'daily': 
      result = true;
      break;
    case 'weekly': 
      result = date.getDay() === nextDue.getDay();
      break;
    case 'fortnightly': {
      const diff = Math.floor((date - nextDue) / (1000 * 60 * 60 * 24));
      result = diff % 14 === 0;
      break;
    }
    case 'monthly': 
      result = date.getDate() === nextDue.getDate();
      break;
    case 'quarterly': 
      result = date.getDate() === nextDue.getDate() && [0, 3, 6, 9].includes(date.getMonth());
      break;
    case 'yearly': 
      result = date.getDate() === nextDue.getDate() && date.getMonth() === nextDue.getMonth();
      break;
    default: 
      result = false;
  }
  return result;
}

// Copy the isDisbursementDay function from server.js
function isDisbursementDay(date, frequency, day) {
  switch (frequency) {
    case 'daily': return true;
    case 'weekly': return date.getDay() === (day % 7);
    case 'fortnightly': {
      const start = new Date(date.getFullYear(), 0, 1);
      const diff = Math.floor((date - start) / (1000 * 60 * 60 * 24));
      return diff % 14 === 0 && date.getDay() === (day % 7);
    }
    case 'monthly': return date.getDate() === day;
    case 'quarterly': {
      const month = date.getMonth();
      const quarterStartMonth = Math.floor(month / 3) * 3;
      const quarterDate = new Date(date.getFullYear(), quarterStartMonth, day);
      return date.toDateString() === quarterDate.toDateString();
    }
    case 'yearly': return date.getMonth() === 0 && date.getDate() === day;
    default: return false;
  }
} 