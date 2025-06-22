const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'budget.db'));

console.log('Checking versions for user 1...\n');

db.all('SELECT id, name, is_active, created_at FROM budget_versions WHERE user_id = 1 ORDER BY created_at DESC', (err, rows) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  
  console.log('Versions:');
  rows.forEach(row => {
    console.log(`ID: ${row.id}, Name: "${row.name}", Active: ${row.is_active}, Created: ${row.created_at}`);
  });
  
  console.log('\nChecking expenses count per version:');
  rows.forEach(row => {
    db.get('SELECT COUNT(*) as count FROM expenses WHERE user_id = 1 AND version_id = ?', [row.id], (err, result) => {
      if (err) {
        console.error('Error:', err);
        return;
      }
      console.log(`Version ${row.id} ("${row.name}"): ${result.count} expenses`);
    });
  });
  
  setTimeout(() => {
    db.close();
  }, 1000);
}); 