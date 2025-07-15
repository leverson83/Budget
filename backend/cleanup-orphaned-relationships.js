const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'budget.db'));

console.log('Cleaning up orphaned expense-tag relationships...\n');

// First, let's see what we're dealing with
db.all(`
  SELECT et.expense_id, et.tag_id, t.name as tag_name 
  FROM expense_tags et 
  LEFT JOIN tags t ON et.tag_id = t.id 
  WHERE t.id IS NULL
  ORDER BY et.tag_id
`, [], (err, orphanedRelationships) => {
  if (err) {
    console.error('Error fetching orphaned relationships:', err);
    return;
  }
  
  if (orphanedRelationships.length === 0) {
    console.log('✅ No orphaned relationships found. Database is clean!');
    db.close();
    return;
  }
  
  console.log(`Found ${orphanedRelationships.length} orphaned relationships:`);
  orphanedRelationships.forEach(rel => {
    console.log(`  Expense: ${rel.expense_id}, Tag: ${rel.tag_id} (UNKNOWN)`);
  });
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Get unique orphaned tag IDs
  const orphanedTagIds = [...new Set(orphanedRelationships.map(r => r.tag_id))];
  console.log(`Unique orphaned tag IDs: ${orphanedTagIds.join(', ')}`);
  
  console.log('\nCleaning up orphaned relationships...');
  
  // Delete orphaned relationships
  const placeholders = orphanedTagIds.map(() => '?').join(',');
  const deleteQuery = `DELETE FROM expense_tags WHERE tag_id IN (${placeholders})`;
  
  db.run(deleteQuery, orphanedTagIds, function(err) {
    if (err) {
      console.error('Error deleting orphaned relationships:', err);
      return;
    }
    
    console.log(`✅ Deleted ${this.changes} orphaned expense-tag relationships`);
    
    // Verify cleanup
    db.all(`
      SELECT COUNT(*) as count
      FROM expense_tags et 
      LEFT JOIN tags t ON et.tag_id = t.id 
      WHERE t.id IS NULL
    `, [], (err, result) => {
      if (err) {
        console.error('Error verifying cleanup:', err);
        return;
      }
      
      const remainingOrphaned = result[0].count;
      if (remainingOrphaned === 0) {
        console.log('✅ All orphaned relationships have been cleaned up!');
      } else {
        console.log(`⚠️  ${remainingOrphaned} orphaned relationships still remain.`);
      }
      
      // Show final statistics
      db.all('SELECT COUNT(*) as count FROM expense_tags', [], (err, result) => {
        if (err) {
          console.error('Error getting final count:', err);
          return;
        }
        
        console.log(`\nFinal statistics:`);
        console.log(`  Total expense-tag relationships: ${result[0].count}`);
        
        db.close();
      });
    });
  });
}); 