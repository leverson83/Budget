const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'budget.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
    return;
  }
  
  console.log('Connected to database for migration...');
  
  // Start migration
  migrateToUserSpecificData();
});

function migrateToUserSpecificData() {
  console.log('Starting migration to user-specific data...');
  
  db.serialize(() => {
    // First, ensure the leverson83@gmail.com user exists and get their ID
    db.get('SELECT id FROM users WHERE email = ?', ['leverson83@gmail.com'], (err, user) => {
      if (err) {
        console.error('Error finding user:', err);
        return;
      }
      
      if (!user) {
        console.error('User leverson83@gmail.com not found!');
        return;
      }
      
      const userId = user.id;
      console.log(`Found user ID: ${userId} for leverson83@gmail.com`);
      
      // Check if tables already have user_id column
      db.get("PRAGMA table_info(income)", (err, row) => {
        if (err) {
          console.error('Error checking income table structure:', err);
          return;
        }
        
        // Check if user_id column exists
        db.all("PRAGMA table_info(income)", (err, columns) => {
          if (err) {
            console.error('Error getting income table columns:', err);
            return;
          }
          
          const hasUserIdColumn = columns.some(col => col.name === 'user_id');
          
          if (hasUserIdColumn) {
            console.log('Tables already have user_id columns. Migration may have been run already.');
            return;
          }
          
          console.log('Adding user_id columns to existing tables...');
          
          // Add user_id columns to existing tables
          db.run('ALTER TABLE income ADD COLUMN user_id INTEGER', (err) => {
            if (err) {
              console.error('Error adding user_id to income table:', err);
            } else {
              console.log('Added user_id column to income table');
              // Update existing income records
              db.run('UPDATE income SET user_id = ?', [userId], (err) => {
                if (err) {
                  console.error('Error updating income records:', err);
                } else {
                  console.log('Updated existing income records with user_id');
                }
              });
            }
          });
          
          db.run('ALTER TABLE expenses ADD COLUMN user_id INTEGER', (err) => {
            if (err) {
              console.error('Error adding user_id to expenses table:', err);
            } else {
              console.log('Added user_id column to expenses table');
              // Update existing expense records
              db.run('UPDATE expenses SET user_id = ?', [userId], (err) => {
                if (err) {
                  console.error('Error updating expense records:', err);
                } else {
                  console.log('Updated existing expense records with user_id');
                }
              });
            }
          });
          
          db.run('ALTER TABLE settings ADD COLUMN user_id INTEGER', (err) => {
            if (err) {
              console.error('Error adding user_id to settings table:', err);
            } else {
              console.log('Added user_id column to settings table');
              // Update existing settings records
              db.run('UPDATE settings SET user_id = ?', [userId], (err) => {
                if (err) {
                  console.error('Error updating settings records:', err);
                } else {
                  console.log('Updated existing settings records with user_id');
                }
              });
            }
          });
          
          db.run('ALTER TABLE accounts ADD COLUMN user_id INTEGER', (err) => {
            if (err) {
              console.error('Error adding user_id to accounts table:', err);
            } else {
              console.log('Added user_id column to accounts table');
              // Update existing account records
              db.run('UPDATE accounts SET user_id = ?', [userId], (err) => {
                if (err) {
                  console.error('Error updating account records:', err);
                } else {
                  console.log('Updated existing account records with user_id');
                }
              });
            }
          });
          
          db.run('ALTER TABLE tags ADD COLUMN user_id INTEGER', (err) => {
            if (err) {
              console.error('Error adding user_id to tags table:', err);
            } else {
              console.log('Added user_id column to tags table');
              // Update existing tag records
              db.run('UPDATE tags SET user_id = ?', [userId], (err) => {
                if (err) {
                  console.error('Error updating tag records:', err);
                } else {
                  console.log('Updated existing tag records with user_id');
                }
              });
            }
          });
          
          console.log('Migration completed successfully!');
          console.log('All existing data has been associated with user leverson83@gmail.com');
        });
      });
    });
  });
}

// Close database after migration
setTimeout(() => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed.');
    }
  });
}, 2000); 