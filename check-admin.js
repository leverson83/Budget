const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('Checking admin status for leverson83@gmail.com...');

const db = new sqlite3.Database(path.join(__dirname, 'backend/budget.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database');
    
    // Check current admin status
    db.get('SELECT id, name, email, admin FROM users WHERE email = ?', ['leverson83@gmail.com'], (err, user) => {
      if (err) {
        console.error('Error checking user:', err);
        process.exit(1);
      }
      
      if (user) {
        console.log(`Current status: ${user.name} (${user.email}) - Admin: ${user.admin ? 'Yes' : 'No'}`);
        
        if (user.admin !== 1) {
          console.log('Setting admin status to 1...');
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
              db.get('SELECT id, name, email, admin FROM users WHERE email = ?', ['leverson83@gmail.com'], (err, updatedUser) => {
                if (err) {
                  console.error('Error verifying user:', err);
                } else if (updatedUser) {
                  console.log(`Updated status: ${updatedUser.name} (${updatedUser.email}) - Admin: ${updatedUser.admin ? 'Yes' : 'No'}`);
                } else {
                  console.log('User not found after update');
                }
                
                db.close();
                process.exit(0);
              });
            }
          );
        } else {
          console.log('User is already admin. No changes needed.');
          db.close();
          process.exit(0);
        }
      } else {
        console.log('User leverson83@gmail.com not found in database');
        db.close();
        process.exit(1);
      }
    });
  }
}); 