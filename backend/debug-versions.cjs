const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('Debugging version functionality...');

const db = new sqlite3.Database(path.join(__dirname, 'budget.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database');
    
    // Check users
    console.log('\n=== USERS ===');
    db.all('SELECT id, name, email, admin, default_version_id FROM users', [], (err, users) => {
      if (err) {
        console.error('Error fetching users:', err);
      } else {
        users.forEach(user => {
          console.log(`User: ${user.name} (${user.email}) - Admin: ${user.admin ? 'Yes' : 'No'} - Default Version: ${user.default_version_id || 'None'}`);
        });
      }
      
      // Check versions for leverson83@gmail.com
      console.log('\n=== VERSIONS FOR leverson83@gmail.com ===');
      db.get('SELECT id FROM users WHERE email = ?', ['leverson83@gmail.com'], (err, user) => {
        if (err || !user) {
          console.error('User leverson83@gmail.com not found');
          db.close();
          process.exit(1);
        }
        
        db.all('SELECT * FROM budget_versions WHERE user_id = ? ORDER BY created_at DESC', [user.id], (err, versions) => {
          if (err) {
            console.error('Error fetching versions:', err);
          } else {
            console.log(`Found ${versions.length} versions for user ${user.id}:`);
            versions.forEach(version => {
              console.log(`  Version ${version.id}: "${version.name}" - Active: ${version.is_active ? 'Yes' : 'No'} - Created: ${version.created_at}`);
            });
          }
          
          // Check if user has default version set
          console.log('\n=== DEFAULT VERSION CHECK ===');
          db.get('SELECT default_version_id FROM users WHERE id = ?', [user.id], (err, userRow) => {
            if (err) {
              console.error('Error checking default version:', err);
            } else {
              console.log(`User ${user.id} default_version_id: ${userRow.default_version_id || 'None'}`);
              
              if (!userRow.default_version_id && versions.length > 0) {
                console.log('Setting first version as default...');
                db.run('UPDATE users SET default_version_id = ? WHERE id = ?', [versions[0].id, user.id], function(err) {
                  if (err) {
                    console.error('Error setting default version:', err);
                  } else {
                    console.log(`Set version ${versions[0].id} as default for user ${user.id}`);
                  }
                  db.close();
                  process.exit(0);
                });
              } else {
                db.close();
                process.exit(0);
              }
            }
          });
        });
      });
    });
  }
}); 