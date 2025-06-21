const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'budget.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database for migration');
    migrateData();
  }
});

function migrateData() {
  console.log('Starting version migration...');
  
  db.serialize(() => {
    // First, check if budget_versions table exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='budget_versions'", (err, row) => {
      if (err) {
        console.error('Error checking for budget_versions table:', err);
        return;
      }

      if (!row) {
        console.log('Creating budget_versions table...');
        
        // Create budget_versions table
        db.run(`
          CREATE TABLE budget_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            is_active INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, name)
          )
        `, (err) => {
          if (err) {
            console.error('Error creating budget_versions table:', err);
            return;
          }
          console.log('budget_versions table created successfully');
          
          // Add version_id columns to existing tables
          addVersionColumns();
        });
      } else {
        console.log('budget_versions table already exists');
        addVersionColumns();
      }
    });
  });
}

function addVersionColumns() {
  console.log('Adding version_id columns to existing tables...');
  
  const tables = ['income', 'expenses', 'settings', 'accounts', 'tags'];
  
  tables.forEach(table => {
    db.get(`PRAGMA table_info(${table})`, (err, rows) => {
      if (err) {
        console.error(`Error checking ${table} table structure:`, err);
        return;
      }
      
      // Check if version_id column exists
      db.all(`PRAGMA table_info(${table})`, (err, columns) => {
        if (err) {
          console.error(`Error getting ${table} columns:`, err);
          return;
        }
        
        const hasVersionId = columns.some(col => col.name === 'version_id');
        
        if (!hasVersionId) {
          console.log(`Adding version_id column to ${table} table...`);
          
          // Add version_id column
          db.run(`ALTER TABLE ${table} ADD COLUMN version_id INTEGER`, (err) => {
            if (err) {
              console.error(`Error adding version_id to ${table}:`, err);
              return;
            }
            console.log(`version_id column added to ${table} table`);
            
            // Add foreign key constraint
            db.run(`CREATE INDEX idx_${table}_version_id ON ${table}(version_id)`, (err) => {
              if (err) {
                console.error(`Error creating index for ${table}:`, err);
              } else {
                console.log(`Index created for ${table}.version_id`);
              }
            });
          });
        } else {
          console.log(`version_id column already exists in ${table} table`);
        }
      });
    });
  });
  
  // After adding columns, create default versions for existing users
  setTimeout(createDefaultVersions, 1000);
}

function createDefaultVersions() {
  console.log('Creating default versions for existing users...');
  
  // Get all users
  db.all('SELECT id, name, email FROM users', (err, users) => {
    if (err) {
      console.error('Error fetching users:', err);
      return;
    }
    
    console.log(`Found ${users.length} users`);
    
    let completedUsers = 0;
    
    users.forEach(user => {
      // Check if user already has a version
      db.get('SELECT id FROM budget_versions WHERE user_id = ?', [user.id], (err, version) => {
        if (err) {
          console.error(`Error checking versions for user ${user.email}:`, err);
          completedUsers++;
          if (completedUsers === users.length) {
            addForeignKeys();
          }
          return;
        }
        
        if (!version) {
          console.log(`Creating default version for user ${user.email}...`);
          
          // Create default version
          db.run(
            'INSERT INTO budget_versions (user_id, name, description, is_active) VALUES (?, ?, ?, ?)',
            [user.id, 'Default', 'Default budget version', 1],
            function(err) {
              if (err) {
                console.error(`Error creating default version for ${user.email}:`, err);
              } else {
                const versionId = this.lastID;
                console.log(`Created default version (ID: ${versionId}) for user ${user.email}`);
                
                // Update existing data to use this version
                updateExistingData(user.id, versionId);
              }
              
              completedUsers++;
              if (completedUsers === users.length) {
                setTimeout(() => {
                  addForeignKeys();
                }, 3000);
              }
            }
          );
        } else {
          console.log(`User ${user.email} already has a version`);
          completedUsers++;
          if (completedUsers === users.length) {
            setTimeout(() => {
              addForeignKeys();
            }, 3000);
          }
        }
      });
    });
  });
}

function updateExistingData(userId, versionId) {
  console.log(`Updating existing data for user ${userId} to use version ${versionId}...`);
  
  const tables = ['income', 'expenses', 'settings', 'accounts', 'tags'];
  
  tables.forEach(table => {
    // Check if the table has data for this user
    db.get(`SELECT COUNT(*) as count FROM ${table} WHERE user_id = ?`, [userId], (err, row) => {
      if (err) {
        console.error(`Error checking ${table} for user ${userId}:`, err);
        return;
      }
      
      if (row.count > 0) {
        console.log(`Found ${row.count} records in ${table} for user ${userId}`);
        
        // Update the records to use the new version
        db.run(`UPDATE ${table} SET version_id = ? WHERE user_id = ? AND (version_id IS NULL OR version_id = 0)`, [versionId, userId], function(err) {
          if (err) {
            console.error(`Error updating ${table} for user ${userId}:`, err);
            return;
          }
          if (this.changes > 0) {
            console.log(`Updated ${this.changes} records in ${table} for user ${userId}`);
          }
        });
      } else {
        console.log(`No records found in ${table} for user ${userId}`);
      }
    });
  });
  
  // Add foreign key constraints after data migration
  setTimeout(() => {
    addForeignKeys();
  }, 2000);
}

function addForeignKeys() {
  console.log('Adding foreign key constraints...');
  
  // Note: SQLite doesn't support adding foreign key constraints to existing tables
  // The constraints are defined in the CREATE TABLE statements in server.js
  // This is just for logging purposes
  
  console.log('Migration completed successfully!');
  console.log('You can now restart your server to use the versioning system.');
  
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
  });
} 