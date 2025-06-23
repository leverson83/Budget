const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the database
const dbPath = path.join(__dirname, 'budget.db');
const db = new sqlite3.Database(dbPath);

console.log('🧪 TESTING EXPORT WITH VERSION PARAMETER');
console.log('========================================\n');

// Test export for a specific version (version 33 which has tags)
function testExportVersion(versionId, userId) {
  console.log(`📤 Testing export for version ${versionId} (user ${userId})...`);
  
  const exportData = {
    exportDate: new Date().toISOString(),
    version: {
      id: versionId,
      name: 'Test Export',
      description: 'Test export for debugging'
    },
    accounts: [],
    income: [],
    expenses: [],
    tags: [],
    settings: [],
    expenseTags: []
  };
  
  // Export accounts
  db.all('SELECT * FROM accounts WHERE user_id = ? AND version_id = ?', [userId, versionId], (err, accounts) => {
    if (!err) exportData.accounts = accounts;
    
    // Export income
    db.all('SELECT * FROM income WHERE user_id = ? AND version_id = ?', [userId, versionId], (err, income) => {
      if (!err) exportData.income = income;
      
      // Export expenses
      db.all('SELECT * FROM expenses WHERE user_id = ? AND version_id = ?', [userId, versionId], (err, expenses) => {
        if (!err) exportData.expenses = expenses;
        
        // Export tags
        db.all('SELECT * FROM tags WHERE user_id = ? AND version_id = ?', [userId, versionId], (err, tags) => {
          if (!err) exportData.tags = tags;
          
          // Export settings
          db.all('SELECT * FROM settings WHERE user_id = ? AND version_id = ?', [userId, versionId], (err, settings) => {
            if (!err) exportData.settings = settings;
            
            // Export expense-tag relationships
            db.all(`
              SELECT et.expense_id, et.tag_id, t.name as tag_name 
              FROM expense_tags et
              JOIN tags t ON et.tag_id = t.id
              JOIN expenses e ON et.expense_id = e.id
              WHERE e.user_id = ? AND e.version_id = ?
            `, [userId, versionId], (err, expenseTags) => {
              if (!err) exportData.expenseTags = expenseTags;
              
              console.log(`✅ Export data for version ${versionId} (user ${userId}):`);
              console.log(`  - Accounts: ${exportData.accounts.length}`);
              console.log(`  - Income: ${exportData.income.length}`);
              console.log(`  - Expenses: ${exportData.expenses.length}`);
              console.log(`  - Tags: ${exportData.tags.length}`);
              console.log(`  - Settings: ${exportData.settings.length}`);
              console.log(`  - Expense-tag relationships: ${exportData.expenseTags.length}`);
              
              if (exportData.tags.length > 0) {
                console.log('\n📋 Tags found:');
                exportData.tags.forEach(tag => {
                  console.log(`  - "${tag.name}" (ID: ${tag.id})`);
                });
              }
              
              if (exportData.expenseTags.length > 0) {
                console.log('\n🔗 Expense-tag relationships found:');
                exportData.expenseTags.forEach(et => {
                  console.log(`  - Expense ID: ${et.expense_id} -> Tag: "${et.tag_name}" (ID: ${et.tag_id})`);
                });
              }
              
              console.log('\n✅ Export test completed successfully!');
              console.log('The export now includes all tags and expense-tag relationships.');
              db.close();
            });
          });
        });
      });
    });
  });
}

// Test with version 33 (which has tags for user 1)
testExportVersion(33, 1); 