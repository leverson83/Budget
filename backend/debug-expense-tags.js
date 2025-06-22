const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'budget.db'));

console.log('=== DEBUGGING EXPENSE-TAG RELATIONSHIPS ===\n');

// Check all imported versions across all users
db.all('SELECT id, name, user_id FROM budget_versions WHERE name LIKE "%Imported%" ORDER BY created_at DESC', (err, versions) => {
  if (err) {
    console.error('Error finding imported versions:', err);
    return;
  }
  
  if (versions.length === 0) {
    console.log('No imported versions found');
    return;
  }
  
  console.log(`Found ${versions.length} imported versions:`);
  versions.forEach(v => {
    console.log(`  User ${v.user_id}: Version ID ${v.id}, Name "${v.name}"`);
  });
  
  // Check the most recent one
  const latestVersion = versions[0];
  console.log(`\nChecking latest version: User ${latestVersion.user_id}, Version ID ${latestVersion.id}, Name "${latestVersion.name}"`);
  
  // Check expenses in this version
  db.get('SELECT COUNT(*) as count FROM expenses WHERE version_id = ?', [latestVersion.id], (err, result) => {
    if (err) {
      console.error('Error counting expenses:', err);
      return;
    }
    console.log(`Expenses in version: ${result.count}`);
    
    // Check tags in this version
    db.get('SELECT COUNT(*) as count FROM tags WHERE version_id = ?', [latestVersion.id], (err, tagResult) => {
      if (err) {
        console.error('Error counting tags:', err);
        return;
      }
      console.log(`Tags in version: ${tagResult.count}`);
      
      // Check expense-tag relationships
      db.get(`
        SELECT COUNT(*) as count 
        FROM expense_tags et 
        JOIN expenses e ON et.expense_id = e.id 
        WHERE e.version_id = ?
      `, [latestVersion.id], (err, etResult) => {
        if (err) {
          console.error('Error counting expense-tags:', err);
          return;
        }
        console.log(`Expense-tag relationships: ${etResult.count}`);
        
        // Show some sample data
        console.log('\n=== SAMPLE DATA ===');
        
        // Show first 3 expenses with their tags
        db.all(`
          SELECT e.id as expense_id, e.description, GROUP_CONCAT(t.name) as tags
          FROM expenses e
          LEFT JOIN expense_tags et ON e.id = et.expense_id
          LEFT JOIN tags t ON et.tag_id = t.id
          WHERE e.version_id = ?
          GROUP BY e.id
          LIMIT 3
        `, [latestVersion.id], (err, expenses) => {
          if (err) {
            console.error('Error fetching expenses with tags:', err);
            return;
          }
          
          console.log('\nFirst 3 expenses with tags:');
          expenses.forEach((expense, index) => {
            console.log(`  ${index + 1}. Expense ID: ${expense.expense_id}, Description: "${expense.description}", Tags: [${expense.tags || 'none'}]`);
          });
          
          // Show all tags
          db.all('SELECT id, name, color FROM tags WHERE version_id = ?', [latestVersion.id], (err, tags) => {
            if (err) {
              console.error('Error fetching tags:', err);
              return;
            }
            
            console.log('\nAll tags in version:');
            tags.forEach((tag, index) => {
              console.log(`  ${index + 1}. ID: ${tag.id}, Name: "${tag.name}", Color: ${tag.color}`);
            });
            
            // Show expense-tag relationships
            db.all(`
              SELECT et.expense_id, et.tag_id, e.description as expense_desc, t.name as tag_name
              FROM expense_tags et
              JOIN expenses e ON et.expense_id = e.id
              JOIN tags t ON et.tag_id = t.id
              WHERE e.version_id = ?
              LIMIT 5
            `, [latestVersion.id], (err, relationships) => {
              if (err) {
                console.error('Error fetching relationships:', err);
                return;
              }
              
              console.log('\nFirst 5 expense-tag relationships:');
              relationships.forEach((rel, index) => {
                console.log(`  ${index + 1}. Expense: "${rel.expense_desc}" (${rel.expense_id}) -> Tag: "${rel.tag_name}" (${rel.tag_id})`);
              });
              
              db.close();
            });
          });
        });
      });
    });
  });
}); 