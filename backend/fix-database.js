const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'budget.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database');
    
    db.serialize(() => {
      console.log('Starting database fixes...');
      
      // Add default_version_id column to users table if it doesn't exist
      db.run(`
        ALTER TABLE users ADD COLUMN default_version_id INTEGER
      `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding default_version_id column:', err);
        } else {
          console.log('✓ default_version_id column added/verified');
        }
      });

      // Fix settings table unique constraint
      db.run(`
        CREATE TABLE IF NOT EXISTS settings_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          version_id INTEGER NOT NULL,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
          UNIQUE(user_id, version_id, key)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating new settings table:', err);
        } else {
          console.log('✓ New settings table created');
          
          // Copy data from old settings table
          db.run(`
            INSERT OR IGNORE INTO settings_new (user_id, version_id, key, value)
            SELECT user_id, version_id, key, value FROM settings
          `, (err) => {
            if (err) {
              console.error('Error copying settings data:', err);
            } else {
              console.log('✓ Settings data copied');
              
              // Drop old table and rename new one
              db.run('DROP TABLE settings', (err) => {
                if (err) {
                  console.error('Error dropping old settings table:', err);
                } else {
                  console.log('✓ Old settings table dropped');
                  
                  db.run('ALTER TABLE settings_new RENAME TO settings', (err) => {
                    if (err) {
                      console.error('Error renaming settings table:', err);
                    } else {
                      console.log('✓ Settings table renamed successfully');
                    }
                  });
                }
              });
            }
          });
        }
      });

      // Fix budget_versions table unique constraint
      db.run(`
        CREATE TABLE IF NOT EXISTS budget_versions_new (
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
          console.error('Error creating new budget_versions table:', err);
        } else {
          console.log('✓ New budget_versions table created');
          
          // Copy data from old budget_versions table
          db.run(`
            INSERT OR IGNORE INTO budget_versions_new (id, user_id, name, description, is_active, created_at)
            SELECT id, user_id, name, description, is_active, created_at FROM budget_versions
          `, (err) => {
            if (err) {
              console.error('Error copying budget_versions data:', err);
            } else {
              console.log('✓ Budget versions data copied');
              
              // Drop old table and rename new one
              db.run('DROP TABLE budget_versions', (err) => {
                if (err) {
                  console.error('Error dropping old budget_versions table:', err);
                } else {
                  console.log('✓ Old budget_versions table dropped');
                  
                  db.run('ALTER TABLE budget_versions_new RENAME TO budget_versions', (err) => {
                    if (err) {
                      console.error('Error renaming budget_versions table:', err);
                    } else {
                      console.log('✓ Budget versions table renamed successfully');
                      
                      // Set default versions for existing users
                      db.all('SELECT id FROM users', [], (err, users) => {
                        if (err) {
                          console.error('Error fetching users:', err);
                        } else {
                          users.forEach(user => {
                            db.get('SELECT id FROM budget_versions WHERE user_id = ? ORDER BY created_at ASC LIMIT 1', [user.id], (err, version) => {
                              if (err) {
                                console.error('Error getting default version for user:', user.id, err);
                              } else if (version) {
                                db.run('UPDATE users SET default_version_id = ? WHERE id = ?', [version.id, user.id], (err) => {
                                  if (err) {
                                    console.error('Error setting default version for user:', user.id, err);
                                  } else {
                                    console.log(`✓ Set default version ${version.id} for user ${user.id}`);
                                  }
                                });
                              }
                            });
                          });
                        }
                      });
                    }
                  });
                }
              });
            }
          });
        }
      });

      // Wait a bit for all operations to complete
      setTimeout(() => {
        console.log('Database fixes completed!');
        db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          } else {
            console.log('Database connection closed');
          }
          process.exit(0);
        });
      }, 2000);
    });
  }
}); 