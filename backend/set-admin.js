const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'budget.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database');
    
    // Set leverson83@gmail.com as admin
    db.run(
      'UPDATE users SET admin = 1 WHERE email = ?',
      ['leverson83@gmail.com'],
      function(err) {
        if (err) {
          console.error('Error updating admin status:', err);
          process.exit(1);
        }
        
        console.log(`Updated ${this.changes} user(s) to admin status`);
        
        // Verify the change
        db.get('SELECT id, name, email, admin FROM users WHERE email = ?', ['leverson83@gmail.com'], (err, user) => {
          if (err) {
            console.error('Error verifying user:', err);
          } else if (user) {
            console.log(`User: ${user.name} (${user.email}) - Admin: ${user.admin ? 'Yes' : 'No'}`);
          } else {
            console.log('User not found');
          }
          
          db.close();
          process.exit(0);
        });
      }
    );
  }
}); 