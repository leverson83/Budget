const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'budget.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database for sharing migration');
    migrate();
  }
});

function migrate() {
  console.log('Starting version sharing migration...');
  
  db.serialize(() => {
    // Add default_version_id column to users table if it doesn't exist
    db.run(`
      ALTER TABLE users ADD COLUMN default_version_id INTEGER 
      REFERENCES budget_versions(id) ON DELETE SET NULL
    `, (err) => {
      if (err && err.code !== 'SQLITE_ERROR') {
        console.error('Error adding default_version_id column:', err);
      } else if (err && err.code === 'SQLITE_ERROR') {
        console.log('default_version_id column already exists or error occurred:', err.message);
      } else {
        console.log('Added default_version_id column to users table');
      }
    });

    // Create shared_versions table
    db.run(`
      CREATE TABLE IF NOT EXISTS shared_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version_id INTEGER NOT NULL,
        owner_user_id INTEGER NOT NULL,
        shared_with_user_id INTEGER NOT NULL,
        shared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (shared_with_user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(version_id, shared_with_user_id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating shared_versions table:', err);
      } else {
        console.log('Created shared_versions table');
      }
    });

    // Set default version for existing users (set their first version as default)
    db.run(`
      UPDATE users 
      SET default_version_id = (
        SELECT id FROM budget_versions 
        WHERE user_id = users.id 
        ORDER BY created_at ASC 
        LIMIT 1
      )
      WHERE default_version_id IS NULL
    `, (err) => {
      if (err) {
        console.error('Error setting default versions:', err);
      } else {
        console.log('Set default versions for existing users');
      }
      
      // Close database and exit
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Sharing migration completed successfully');
        }
        process.exit(0);
      });
    });
  });
} 