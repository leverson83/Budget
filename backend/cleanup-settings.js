const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'budget.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database for cleanup');
    cleanupSettings();
  }
});

function cleanupSettings() {
  console.log('Cleaning up settings table...');
  
  // First, let's see what we have
  db.all('SELECT * FROM settings ORDER BY user_id, key', (err, rows) => {
    if (err) {
      console.error('Error fetching settings:', err);
      return;
    }
    
    console.log(`Found ${rows.length} settings records`);
    
    // Group by user_id and key to find duplicates
    const grouped = {};
    rows.forEach(row => {
      const key = `${row.user_id}-${row.key}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(row);
    });
    
    // Find duplicates
    const duplicates = Object.values(grouped).filter(group => group.length > 1);
    
    if (duplicates.length === 0) {
      console.log('No duplicates found');
      db.close();
      return;
    }
    
    console.log(`Found ${duplicates.length} duplicate groups`);
    
    // Delete duplicates, keeping the first one
    let deletedCount = 0;
    duplicates.forEach(group => {
      // Keep the first one, delete the rest
      for (let i = 1; i < group.length; i++) {
        const row = group[i];
        db.run('DELETE FROM settings WHERE id = ?', [row.id], function(err) {
          if (err) {
            console.error(`Error deleting setting ${row.id}:`, err);
          } else {
            deletedCount++;
            console.log(`Deleted duplicate setting: ${row.key} for user ${row.user_id}`);
          }
        });
      }
    });
    
    setTimeout(() => {
      console.log(`Cleanup completed. Deleted ${deletedCount} duplicate settings.`);
      db.close();
    }, 2000);
  });
} 