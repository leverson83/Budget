const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'budget.db');
const db = new sqlite3.Database(dbPath);

console.log('Setting admin user...');

db.run(
  'UPDATE users SET admin = 1 WHERE email = ?',
  ['leverson83@gmail.com'],
  function(err) {
    if (err) {
      console.error('Error updating user:', err);
    } else {
      console.log(`Updated ${this.changes} user(s)`);
      
      // Check the result
      db.get('SELECT * FROM users WHERE email = ?', ['leverson83@gmail.com'], (err, row) => {
        if (err) {
          console.error('Error checking user:', err);
        } else {
          console.log('User details:', row);
        }
        db.close();
      });
    }
  }
); 