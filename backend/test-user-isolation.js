const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'budget.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
    return;
  }
  
  console.log('Connected to database for testing user isolation...');
  testUserIsolation();
});

function testUserIsolation() {
  console.log('\n=== Testing User-Specific Data Isolation ===\n');
  
  // Test 1: Check that leverson83@gmail.com has data
  console.log('1. Checking data for leverson83@gmail.com...');
  db.get('SELECT id FROM users WHERE email = ?', ['leverson83@gmail.com'], (err, user) => {
    if (err || !user) {
      console.error('User leverson83@gmail.com not found!');
      return;
    }
    
    const userId = user.id;
    console.log(`   User ID: ${userId}`);
    
    // Check income data
    db.all('SELECT COUNT(*) as count FROM income WHERE user_id = ?', [userId], (err, rows) => {
      if (err) {
        console.error('Error checking income:', err);
      } else {
        console.log(`   Income records: ${rows[0].count}`);
      }
    });
    
    // Check expenses data
    db.all('SELECT COUNT(*) as count FROM expenses WHERE user_id = ?', [userId], (err, rows) => {
      if (err) {
        console.error('Error checking expenses:', err);
      } else {
        console.log(`   Expense records: ${rows[0].count}`);
      }
    });
    
    // Check accounts data
    db.all('SELECT COUNT(*) as count FROM accounts WHERE user_id = ?', [userId], (err, rows) => {
      if (err) {
        console.error('Error checking accounts:', err);
      } else {
        console.log(`   Account records: ${rows[0].count}`);
      }
    });
    
    // Check tags data
    db.all('SELECT COUNT(*) as count FROM tags WHERE user_id = ?', [userId], (err, rows) => {
      if (err) {
        console.error('Error checking tags:', err);
      } else {
        console.log(`   Tag records: ${rows[0].count}`);
      }
    });
    
    // Check settings data
    db.all('SELECT COUNT(*) as count FROM settings WHERE user_id = ?', [userId], (err, rows) => {
      if (err) {
        console.error('Error checking settings:', err);
      } else {
        console.log(`   Settings records: ${rows[0].count}`);
      }
    });
  });
  
  // Test 2: Check that marina has no data initially
  console.log('\n2. Checking data for marinahu1990@hotmail.com...');
  db.get('SELECT id FROM users WHERE email = ?', ['marinahu1990@hotmail.com'], (err, user) => {
    if (err || !user) {
      console.error('User marinahu1990@hotmail.com not found!');
      return;
    }
    
    const userId = user.id;
    console.log(`   User ID: ${userId}`);
    
    // Check income data
    db.all('SELECT COUNT(*) as count FROM income WHERE user_id = ?', [userId], (err, rows) => {
      if (err) {
        console.error('Error checking income:', err);
      } else {
        console.log(`   Income records: ${rows[0].count}`);
      }
    });
    
    // Check expenses data
    db.all('SELECT COUNT(*) as count FROM expenses WHERE user_id = ?', [userId], (err, rows) => {
      if (err) {
        console.error('Error checking expenses:', err);
      } else {
        console.log(`   Expense records: ${rows[0].count}`);
      }
    });
    
    // Check accounts data
    db.all('SELECT COUNT(*) as count FROM accounts WHERE user_id = ?', [userId], (err, rows) => {
      if (err) {
        console.error('Error checking accounts:', err);
      } else {
        console.log(`   Account records: ${rows[0].count}`);
      }
    });
    
    // Check tags data
    db.all('SELECT COUNT(*) as count FROM tags WHERE user_id = ?', [userId], (err, rows) => {
      if (err) {
        console.error('Error checking tags:', err);
      } else {
        console.log(`   Tag records: ${rows[0].count}`);
      }
    });
    
    // Check settings data
    db.all('SELECT COUNT(*) as count FROM settings WHERE user_id = ?', [userId], (err, rows) => {
      if (err) {
        console.error('Error checking settings:', err);
      } else {
        console.log(`   Settings records: ${rows[0].count}`);
      }
    });
  });
  
  // Test 3: Check total data counts
  console.log('\n3. Checking total data counts...');
  db.all('SELECT COUNT(*) as count FROM income', (err, rows) => {
    if (err) {
      console.error('Error checking total income:', err);
    } else {
      console.log(`   Total income records: ${rows[0].count}`);
    }
  });
  
  db.all('SELECT COUNT(*) as count FROM expenses', (err, rows) => {
    if (err) {
      console.error('Error checking total expenses:', err);
    } else {
      console.log(`   Total expense records: ${rows[0].count}`);
    }
  });
  
  db.all('SELECT COUNT(*) as count FROM accounts', (err, rows) => {
    if (err) {
      console.error('Error checking total accounts:', err);
    } else {
      console.log(`   Total account records: ${rows[0].count}`);
    }
  });
  
  db.all('SELECT COUNT(*) as count FROM tags', (err, rows) => {
    if (err) {
      console.error('Error checking total tags:', err);
    } else {
      console.log(`   Total tag records: ${rows[0].count}`);
    }
  });
  
  db.all('SELECT COUNT(*) as count FROM settings', (err, rows) => {
    if (err) {
      console.error('Error checking total settings:', err);
    } else {
      console.log(`   Total settings records: ${rows[0].count}`);
    }
  });
  
  console.log('\n=== Test completed ===\n');
}

// Close database after testing
setTimeout(() => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed.');
    }
  });
}, 3000); 