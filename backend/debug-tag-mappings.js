const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'budget.db'));

console.log('Debugging tag mappings...\n');

// Check all tags in the database
db.all('SELECT id, name, user_id, version_id FROM tags ORDER BY id', [], (err, tags) => {
  if (err) {
    console.error('Error fetching tags:', err);
    return;
  }
  
  console.log('All tags in database:');
  tags.forEach(tag => {
    console.log(`  ID: ${tag.id}, Name: "${tag.name}", User: ${tag.user_id}, Version: ${tag.version_id}`);
  });
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check expense-tag relationships
  db.all('SELECT expense_id, tag_id FROM expense_tags ORDER BY expense_id', [], (err, relationships) => {
    if (err) {
      console.error('Error fetching expense-tag relationships:', err);
      return;
    }
    
    console.log('All expense-tag relationships:');
    relationships.forEach(rel => {
      console.log(`  Expense: ${rel.expense_id}, Tag: ${rel.tag_id}`);
    });
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Check which tag IDs are referenced in relationships but don't exist
    const tagIds = tags.map(t => t.id);
    const referencedTagIds = [...new Set(relationships.map(r => r.tag_id))];
    
    console.log('Tag IDs that exist:', tagIds);
    console.log('Tag IDs referenced in relationships:', referencedTagIds);
    
    const missingTagIds = referencedTagIds.filter(id => !tagIds.includes(id));
    if (missingTagIds.length > 0) {
      console.log('Missing tag IDs:', missingTagIds);
    } else {
      console.log('All referenced tag IDs exist in the database.');
    }
    
    db.close();
  });
}); 