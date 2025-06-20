const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'budget.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

// Add color column to tags table
db.run('ALTER TABLE tags ADD COLUMN color TEXT', (err) => {
  if (err) {
    if (err.message.includes('duplicate column name')) {
      console.log('Color column already exists in tags table');
    } else {
      console.error('Error adding color column:', err);
    }
  } else {
    console.log('Successfully added color column to tags table');
  }
  
  // Close database connection
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});

db.serialize(() => {
  // Add admin column if it doesn't exist
  db.get("PRAGMA table_info(users)", (err, row) => {
    if (err) throw err;
    db.all("PRAGMA table_info(users)", (err, columns) => {
      if (err) throw err;
      const hasAdmin = columns.some(col => col.name === 'admin');
      if (!hasAdmin) {
        db.run("ALTER TABLE users ADD COLUMN admin INTEGER DEFAULT 0", (err) => {
          if (err) throw err;
          console.log('Added admin column to users table.');
        });
      }
      // Set leverson83@gmail.com as admin
      db.run("UPDATE users SET admin = 1 WHERE email = ?", ['leverson83@gmail.com'], (err) => {
        if (err) throw err;
        console.log('Set leverson83@gmail.com as admin.');
      });
    });
  });
});

db.close(); 