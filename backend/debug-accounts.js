const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use the same database as the main server
const dbPath = path.join(__dirname, 'budget.db');
const db = new sqlite3.Database(dbPath);

console.log('Listing all accounts and their expenses...');

// Get all accounts
db.all('SELECT * FROM accounts ORDER BY name', (err, accounts) => {
  if (err) {
    console.error('Error getting accounts:', err);
    return;
  }
  
  console.log('\nAll accounts:');
  accounts.forEach(acc => {
    console.log(`- ${acc.name} (ID: ${acc.id}, Balance: ${acc.currentBalance}, Primary: ${acc.isPrimary})`);
  });
  
  // Get all expenses
  db.all('SELECT * FROM expenses ORDER BY description', (err, expenses) => {
    if (err) {
      console.error('Error getting expenses:', err);
      return;
    }
    
    console.log('\nAll expenses:');
    expenses.forEach(exp => {
      console.log(`- ${exp.description} (ID: ${exp.id}, Account: ${exp.accountId}, Amount: ${exp.amount}, Frequency: ${exp.frequency}, Manual: ${exp.manualWithdrawalsOnly})`);
    });
    
    // Get disbursement settings
    db.all('SELECT * FROM settings WHERE key LIKE "disbursement%"', (err, settings) => {
      if (err) {
        console.error('Error getting settings:', err);
        return;
      }
      
      console.log('\nDisbursement settings:');
      settings.forEach(setting => {
        console.log(`- ${setting.key}: ${setting.value}`);
      });
      
      db.close();
    });
  });
}); 