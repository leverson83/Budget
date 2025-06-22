const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('budget.db');

console.log('Checking accounts for user 1...');

db.all('SELECT * FROM accounts WHERE user_id = 1', (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Accounts found:', rows.length);
    console.table(rows);
  }
  
  db.all('SELECT * FROM budget_versions WHERE user_id = 1', (err, versions) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('\nVersions found:', versions.length);
      console.table(versions);
    }
    db.close();
  });
}); 