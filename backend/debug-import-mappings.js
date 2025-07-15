const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Simulate the tag mapping logic from the import process
console.log('Simulating tag mapping logic...\n');

// Sample data structure (what would be in the export)
const importData = {
  tags: [
    { id: 1, name: "Cars", color: "#FF0000" },
    { id: 2, name: "Home", color: "#00FF00" },
    { id: 5, name: "Investing", color: "#0000FF" },
    { id: 8, name: "Subscription", color: "#FFFF00" },
    { id: 10, name: "Family", color: "#FF00FF" },
    { id: 11, name: "Holidays", color: "#00FFFF" }
  ],
  expenseTags: [
    { expense_id: "expense1", tag_id: 1 },
    { expense_id: "expense2", tag_id: 2 },
    { expense_id: "expense3", tag_id: 5 },
    { expense_id: "expense4", tag_id: 8 },
    { expense_id: "expense5", tag_id: 10 },
    { expense_id: "expense6", tag_id: 11 }
  ]
};

console.log('Original tag data:');
importData.tags.forEach(tag => {
  console.log(`  ID: ${tag.id}, Name: "${tag.name}"`);
});

console.log('\nOriginal expense-tag relationships:');
importData.expenseTags.forEach(et => {
  console.log(`  Expense: ${et.expense_id}, Tag: ${et.tag_id}`);
});

console.log('\n' + '='.repeat(50) + '\n');

// Simulate the tag insertion and mapping process
const tagIdMapping = new Map();
const userId = 1;
const versionId = 35; // The version ID from the logs

console.log('Simulating tag insertion and mapping...');

// Simulate what happens during import
importData.tags.forEach(tag => {
  // This simulates the INSERT OR REPLACE and then SELECT to get the new ID
  // In the real database, these would get new IDs like 198, 199, 200, etc.
  const newTagId = 198 + tag.id; // Simulate new ID assignment
  console.log(`Tag "${tag.name}" (old ID: ${tag.id}) -> new ID: ${newTagId}`);
  tagIdMapping.set(tag.id, newTagId);
});

console.log('\nTag mappings created:');
tagIdMapping.forEach((newId, oldId) => {
  console.log(`  ${oldId} -> ${newId}`);
});

console.log('\n' + '='.repeat(50) + '\n');

// Now simulate the expense-tag relationship processing
console.log('Simulating expense-tag relationship processing...');

importData.expenseTags.forEach(et => {
  const newTagId = tagIdMapping.get(et.tag_id);
  if (newTagId) {
    console.log(`✓ Relationship: expense_id=${et.expense_id}, tag_id=${et.tag_id} -> new_tag_id=${newTagId}`);
  } else {
    console.log(`✗ Skipping: expense_id=${et.expense_id}, tag_id=${et.tag_id} (mapped to ${newTagId})`);
  }
});

console.log('\n' + '='.repeat(50) + '\n');

// Now let's check what's actually in the database
const db = new sqlite3.Database(path.join(__dirname, 'budget.db'));

console.log('Checking actual database state...\n');

// Check tags in the specific version
db.all('SELECT id, name FROM tags WHERE user_id = ? AND version_id = ? ORDER BY id', [userId, versionId], (err, tags) => {
  if (err) {
    console.error('Error fetching tags:', err);
    return;
  }
  
  console.log(`Tags in version ${versionId}:`);
  tags.forEach(tag => {
    console.log(`  ID: ${tag.id}, Name: "${tag.name}"`);
  });
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check expense-tag relationships for this version
  db.all(`
    SELECT et.expense_id, et.tag_id, t.name as tag_name 
    FROM expense_tags et 
    JOIN expenses e ON et.expense_id = e.id 
    LEFT JOIN tags t ON et.tag_id = t.id 
    WHERE e.user_id = ? AND e.version_id = ?
    ORDER BY et.expense_id
  `, [userId, versionId], (err, relationships) => {
    if (err) {
      console.error('Error fetching relationships:', err);
      return;
    }
    
    console.log(`Expense-tag relationships in version ${versionId}:`);
    relationships.forEach(rel => {
      const tagName = rel.tag_name || 'UNKNOWN TAG';
      console.log(`  Expense: ${rel.expense_id}, Tag: ${rel.tag_id} (${tagName})`);
    });
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Check for orphaned relationships (tag_id doesn't exist)
    const tagIds = tags.map(t => t.id);
    const orphanedRelationships = relationships.filter(rel => !tagIds.includes(rel.tag_id));
    
    if (orphanedRelationships.length > 0) {
      console.log('Orphaned relationships (tag_id does not exist):');
      orphanedRelationships.forEach(rel => {
        console.log(`  Expense: ${rel.expense_id}, Tag: ${rel.tag_id} (${rel.tag_name || 'UNKNOWN'})`);
      });
    } else {
      console.log('All relationships have valid tag IDs.');
    }
    
    db.close();
  });
}); 