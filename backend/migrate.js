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