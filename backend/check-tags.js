const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'budget.db');
const db = new sqlite3.Database(dbPath);

console.log('🏷️ CHECKING ALL TAGS IN DATABASE');
console.log('================================\n');

db.all('SELECT id, name, user_id, version_id FROM tags ORDER BY user_id, version_id', (err, rows) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  
  console.log('All tags in database:');
  if (rows.length === 0) {
    console.log('  No tags found!');
  } else {
    rows.forEach(tag => {
      console.log(`  - Tag ${tag.id}: "${tag.name}" (User: ${tag.user_id}, Version: ${tag.version_id})`);
    });
  }
  
  console.log(`\nTotal tags: ${rows.length}`);
  db.close();
}); 