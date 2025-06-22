const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'budget.db'));

console.log('Fixing active version...\n');

// First, deactivate all versions
db.run('UPDATE budget_versions SET is_active = 0 WHERE user_id = 1', (err) => {
  if (err) {
    console.error('Error deactivating versions:', err);
    return;
  }
  
  console.log('Deactivated all versions');
  
  // Then activate the Default version (which has the sample data)
  db.run('UPDATE budget_versions SET is_active = 1 WHERE user_id = 1 AND name = "Default"', function(err) {
    if (err) {
      console.error('Error activating Default version:', err);
      return;
    }
    
    console.log(`Activated Default version. Rows affected: ${this.changes}`);
    
    // Verify the change
    db.get('SELECT id, name, is_active FROM budget_versions WHERE user_id = 1 AND is_active = 1', (err, row) => {
      if (err) {
        console.error('Error checking active version:', err);
        return;
      }
      
      if (row) {
        console.log(`✅ Active version is now: ID ${row.id}, Name "${row.name}"`);
      } else {
        console.log('❌ No active version found');
      }
      
      db.close();
    });
  });
}); 