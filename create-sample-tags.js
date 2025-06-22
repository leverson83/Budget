const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'backend', 'budget.db'));

// Sample tags to create for user 1
const sampleTags = [
  { name: 'Living Expenses', color: '#d32f2f' },
  { name: 'Home', color: '#e64a19' },
  { name: 'Transport', color: '#1976d2' },
  { name: 'Food', color: '#388e3c' },
  { name: 'Entertainment', color: '#7b1fa2' },
  { name: 'Utilities', color: '#f57c00' },
  { name: 'Insurance', color: '#5d4037' },
  { name: 'Savings', color: '#0097a7' },
  { name: 'Investing', color: '#2e7d32' },
  { name: 'Healthcare', color: '#c2185b' }
];

console.log('Creating sample tags for user 1...');

// Get user 1's active version
db.get('SELECT id FROM budget_versions WHERE user_id = 1 AND is_active = 1', [], (err, version) => {
  if (err) {
    console.error('Error getting active version:', err);
    process.exit(1);
  }

  if (!version) {
    console.error('No active version found for user 1');
    process.exit(1);
  }

  console.log(`Using version ID: ${version.id}`);

  let created = 0;
  sampleTags.forEach(tag => {
    db.run(
      'INSERT OR IGNORE INTO tags (name, color, user_id, version_id) VALUES (?, ?, ?, ?)',
      [tag.name, tag.color, 1, version.id],
      function(err) {
        if (err) {
          console.error(`Error creating tag "${tag.name}":`, err);
        } else {
          if (this.changes > 0) {
            console.log(`✅ Created tag: ${tag.name}`);
          } else {
            console.log(`⚠️  Tag already exists: ${tag.name}`);
          }
        }
        
        created++;
        if (created === sampleTags.length) {
          console.log('\n✅ Finished creating sample tags');
          
          // Verify the tags were created
          db.all('SELECT name, color FROM tags WHERE user_id = 1 AND version_id = ?', [version.id], (err, rows) => {
            if (err) {
              console.error('Error verifying tags:', err);
            } else {
              console.log(`\nTags for user 1 (${rows.length} total):`);
              rows.forEach(row => {
                console.log(`- ${row.name} ${row.color ? `(${row.color})` : ''}`);
              });
            }
            db.close();
          });
        }
      }
    );
  });
}); 