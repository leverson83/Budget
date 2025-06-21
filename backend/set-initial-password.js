const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, 'budget.db');

async function setInitialPassword() {
  const db = new sqlite3.Database(dbPath);
  
  try {
    console.log('Setting initial password for leverson83@gmail.com...');
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Update the user's password
    db.run(
      'UPDATE users SET password_hash = ? WHERE email = ?',
      [hashedPassword, 'leverson83@gmail.com'],
      function(err) {
        if (err) {
          console.error('Error updating password:', err);
        } else {
          if (this.changes > 0) {
            console.log('✅ Password updated successfully for leverson83@gmail.com');
            console.log('📧 Email: leverson83@gmail.com');
            console.log('🔑 Password: admin123');
          } else {
            console.log('⚠️  User leverson83@gmail.com not found in database');
          }
        }
        db.close();
      }
    );
    
  } catch (error) {
    console.error('Error:', error);
    db.close();
  }
}

setInitialPassword(); 