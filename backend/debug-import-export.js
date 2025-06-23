const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Connect to the database
const dbPath = path.join(__dirname, 'budget.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 DEBUGGING IMPORT/EXPORT TAG ISSUES');
console.log('=====================================\n');

// First, let's check what we have in the database
function checkCurrentData() {
  console.log('📊 CURRENT DATABASE STATE:');
  
  // Check users
  db.all('SELECT id, email FROM users', (err, users) => {
    if (err) {
      console.error('Error fetching users:', err);
      return;
    }
    
    console.log(`👥 Users: ${users.length}`);
    users.forEach(user => {
      console.log(`  - User ${user.id}: ${user.email}`);
    });
    
    // For each user, check their data
    users.forEach(user => {
      checkUserData(user.id, user.email);
    });
  });
}

function checkUserData(userId, userEmail) {
  console.log(`\n🔍 Checking data for user ${userId} (${userEmail}):`);
  
  // Check versions
  db.all('SELECT id, name, is_active FROM budget_versions WHERE user_id = ?', [userId], (err, versions) => {
    if (err) {
      console.error('Error fetching versions:', err);
      return;
    }
    
    console.log(`  📁 Versions: ${versions.length}`);
    versions.forEach(version => {
      console.log(`    - Version ${version.id}: "${version.name}" (active: ${version.is_active})`);
      
      // Check data in this version
      checkVersionData(userId, version.id, version.name);
    });
  });
}

function checkVersionData(userId, versionId, versionName) {
  console.log(`\n    📂 Data in version "${versionName}" (${versionId}):`);
  
  // Check expenses
  db.all('SELECT id, description, amount FROM expenses WHERE user_id = ? AND version_id = ?', [userId, versionId], (err, expenses) => {
    if (err) {
      console.error('Error fetching expenses:', err);
      return;
    }
    
    console.log(`      💰 Expenses: ${expenses.length}`);
    
    // Check tags
    db.all('SELECT id, name, color FROM tags WHERE user_id = ? AND version_id = ?', [userId, versionId], (err, tags) => {
      if (err) {
        console.error('Error fetching tags:', err);
        return;
      }
      
      console.log(`      🏷️ Tags: ${tags.length}`);
      tags.forEach(tag => {
        console.log(`        - Tag ${tag.id}: "${tag.name}" (color: ${tag.color})`);
      });
      
      // Check expense-tag relationships
      db.all(`
        SELECT et.expense_id, et.tag_id, e.description as expense_desc, t.name as tag_name
        FROM expense_tags et
        JOIN expenses e ON et.expense_id = e.id
        JOIN tags t ON et.tag_id = t.id
        WHERE e.user_id = ? AND e.version_id = ?
      `, [userId, versionId], (err, relationships) => {
        if (err) {
          console.error('Error fetching relationships:', err);
          return;
        }
        
        console.log(`      🔗 Expense-tag relationships: ${relationships.length}`);
        relationships.forEach(rel => {
          console.log(`        - "${rel.expense_desc}" -> "${rel.tag_name}"`);
        });
        
        // If this is the active version, run the export test
        if (versionName === 'Default' || versionName.includes('Imported')) {
          // Check if this is the active version
          db.get('SELECT is_active FROM budget_versions WHERE id = ?', [versionId], (err, result) => {
            if (!err && result && result.is_active === 1) {
              console.log(`\n🎯 This is the ACTIVE version - testing export/import...`);
              testExportImport(userId, versionId);
            }
          });
        }
      });
    });
  });
}

function testExportImport(userId, versionId) {
  console.log('\n🧪 TESTING EXPORT/IMPORT PROCESS:');
  console.log('==================================');
  
  // Simulate export
  console.log('\n📤 STEP 1: Simulating export...');
  
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
              
              console.log(`✅ Export data prepared:`);
              console.log(`  - Accounts: ${exportData.accounts.length}`);
              console.log(`  - Income: ${exportData.income.length}`);
              console.log(`  - Expenses: ${exportData.expenses.length}`);
              console.log(`  - Tags: ${exportData.tags.length}`);
              console.log(`  - Settings: ${exportData.settings.length}`);
              console.log(`  - Expense-tag relationships: ${exportData.expenseTags.length}`);
              
              // Show some sample data
              console.log('\n📋 Sample export data:');
              console.log('  Tags:', exportData.tags.map(t => ({ id: t.id, name: t.name })));
              console.log('  Expenses:', exportData.expenses.map(e => ({ id: e.id, description: e.description })));
              console.log('  Relationships:', exportData.expenseTags.map(et => ({ 
                expense_id: et.expense_id, 
                tag_id: et.tag_id, 
                tag_name: et.tag_name 
              })));
              
              // Now simulate import to a new user
              simulateImport(exportData);
            });
          });
        });
      });
    });
  });
}

function simulateImport(exportData) {
  console.log('\n📥 STEP 2: Simulating import...');
  
  // Create a test user for import
  const testUserId = 999; // Use a test user ID
  const testUserEmail = 'test-import@example.com';
  
  // First, clean up any existing test data
  db.run('DELETE FROM expense_tags WHERE expense_id IN (SELECT id FROM expenses WHERE user_id = ?)', [testUserId]);
  db.run('DELETE FROM expenses WHERE user_id = ?', [testUserId]);
  db.run('DELETE FROM tags WHERE user_id = ?', [testUserId]);
  db.run('DELETE FROM accounts WHERE user_id = ?', [testUserId]);
  db.run('DELETE FROM income WHERE user_id = ?', [testUserId]);
  db.run('DELETE FROM settings WHERE user_id = ?', [testUserId]);
  db.run('DELETE FROM budget_versions WHERE user_id = ?', [testUserId]);
  
  // Create test user if doesn't exist
  db.run('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)', 
    [testUserId, testUserEmail, 'test-hash']);
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    try {
      // Create new version
      const versionName = 'Test Import Version';
      db.run(
        'INSERT INTO budget_versions (user_id, name, description, is_active) VALUES (?, ?, ?, 0)',
        [testUserId, versionName, 'Test import version'],
        function(err) {
          if (err) {
            console.error('Error creating test version:', err);
            db.run('ROLLBACK');
            return;
          }
          
          const versionId = this.lastID;
          console.log(`✅ Created test version (ID: ${versionId})`);
          
          // Store mappings
          const accountIdMapping = new Map();
          const expenseIdMapping = new Map();
          const incomeIdMapping = new Map();
          const tagIdMapping = new Map();
          
          // Import accounts
          if (exportData.accounts && exportData.accounts.length > 0) {
            exportData.accounts.forEach(account => {
              db.run(
                'INSERT INTO accounts (user_id, version_id, name, bank, currentBalance, requiredBalance, isPrimary, diff) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [testUserId, versionId, account.name, account.bank, account.currentBalance, account.requiredBalance, account.isPrimary, account.diff],
                function(err) {
                  if (!err) {
                    accountIdMapping.set(account.id, this.lastID);
                  }
                }
              );
            });
          }
          
          // Import tags first (so we have the mappings)
          if (exportData.tags && exportData.tags.length > 0) {
            let tagsProcessed = 0;
            exportData.tags.forEach(tag => {
              db.run(
                'INSERT OR REPLACE INTO tags (user_id, version_id, name, color) VALUES (?, ?, ?, ?)',
                [testUserId, versionId, tag.name, tag.color],
                function(err) {
                  if (!err) {
                    // Get the actual tag ID
                    db.get('SELECT id FROM tags WHERE user_id = ? AND version_id = ? AND name = ?', 
                      [testUserId, versionId, tag.name], (err, result) => {
                      if (!err && result) {
                        tagIdMapping.set(tag.id, result.id);
                        console.log(`✅ Tag "${tag.name}": ${tag.id} -> ${result.id}`);
                      }
                      
                      tagsProcessed++;
                      if (tagsProcessed === exportData.tags.length) {
                        console.log(`✅ Imported ${exportData.tags.length} tags`);
                        console.log(`Tag mappings:`, Array.from(tagIdMapping.entries()));
                        
                        // Now import expenses
                        importExpenses();
                      }
                    });
                  } else {
                    tagsProcessed++;
                    if (tagsProcessed === exportData.tags.length) {
                      importExpenses();
                    }
                  }
                }
              );
            });
          } else {
            importExpenses();
          }
          
          function importExpenses() {
            if (exportData.expenses && exportData.expenses.length > 0) {
              let expensesProcessed = 0;
              exportData.expenses.forEach(expense => {
                const newExpenseId = uuidv4();
                let newAccountId = null;
                if (expense.accountId && accountIdMapping.has(expense.accountId)) {
                  newAccountId = accountIdMapping.get(expense.accountId);
                }
                
                db.run(
                  'INSERT INTO expenses (id, user_id, version_id, description, amount, frequency, nextDue, applyFuzziness, notes, accountId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                  [newExpenseId, testUserId, versionId, expense.description, expense.amount, expense.frequency, expense.nextDue, expense.applyFuzziness, expense.notes, newAccountId],
                  function(err) {
                    if (!err) {
                      expenseIdMapping.set(expense.id, newExpenseId);
                      console.log(`✅ Expense "${expense.description}": ${expense.id} -> ${newExpenseId}`);
                    }
                    
                    expensesProcessed++;
                    if (expensesProcessed === exportData.expenses.length) {
                      console.log(`✅ Imported ${exportData.expenses.length} expenses`);
                      console.log(`Expense mappings:`, Array.from(expenseIdMapping.entries()));
                      
                      // Now import expense-tag relationships
                      importExpenseTags();
                    }
                  }
                );
              });
            } else {
              importExpenseTags();
            }
          }
          
          function importExpenseTags() {
            if (exportData.expenseTags && exportData.expenseTags.length > 0) {
              console.log('\n🔗 Importing expense-tag relationships...');
              console.log('Available mappings:');
              console.log('  Expense mappings:', expenseIdMapping.size);
              console.log('  Tag mappings:', tagIdMapping.size);
              
              let relationshipsProcessed = 0;
              exportData.expenseTags.forEach(et => {
                const newExpenseId = expenseIdMapping.get(et.expense_id);
                const newTagId = tagIdMapping.get(et.tag_id);
                
                console.log(`  Relationship: expense_id=${et.expense_id}->${newExpenseId}, tag_id=${et.tag_id}->${newTagId}, tag_name="${et.tag_name}"`);
                
                if (newExpenseId && newTagId) {
                  db.run('INSERT INTO expense_tags (expense_id, tag_id) VALUES (?, ?)', [newExpenseId, newTagId], function(err) {
                    if (err) {
                      console.error(`❌ Error inserting relationship:`, err);
                    } else {
                      console.log(`✅ Inserted relationship: ${newExpenseId} -> ${newTagId}`);
                    }
                    
                    relationshipsProcessed++;
                    if (relationshipsProcessed === exportData.expenseTags.length) {
                      console.log(`✅ Imported ${exportData.expenseTags.length} expense-tag relationships`);
                      verifyImport();
                    }
                  });
                } else {
                  console.warn(`⚠️ Skipping relationship: expense_id=${et.expense_id} (mapped to ${newExpenseId}), tag_id=${et.tag_id} (mapped to ${newTagId})`);
                  relationshipsProcessed++;
                  if (relationshipsProcessed === exportData.expenseTags.length) {
                    verifyImport();
                  }
                }
              });
            } else {
              verifyImport();
            }
          }
          
          function verifyImport() {
            console.log('\n🔍 STEP 3: Verifying import...');
            
            // Check what was actually imported
            db.all(`
              SELECT e.id, e.description, GROUP_CONCAT(t.name) as tags
              FROM expenses e
              LEFT JOIN expense_tags et ON e.id = et.expense_id
              LEFT JOIN tags t ON et.tag_id = t.id
              WHERE e.user_id = ? AND e.version_id = ?
              GROUP BY e.id
            `, [testUserId, versionId], (err, expenses) => {
              if (err) {
                console.error('Error verifying import:', err);
                db.run('ROLLBACK');
                return;
              }
              
              console.log(`\n📋 Imported expenses with tags:`);
              expenses.forEach(expense => {
                console.log(`  - "${expense.description}": [${expense.tags || 'none'}]`);
              });
              
              // Check all tags
              db.all('SELECT id, name FROM tags WHERE user_id = ? AND version_id = ?', [testUserId, versionId], (err, tags) => {
                console.log(`\n🏷️ Imported tags:`);
                tags.forEach(tag => {
                  console.log(`  - Tag ${tag.id}: "${tag.name}"`);
                });
                
                // Check relationships
                db.all(`
                  SELECT et.expense_id, et.tag_id, e.description as expense_desc, t.name as tag_name
                  FROM expense_tags et
                  JOIN expenses e ON et.expense_id = e.id
                  JOIN tags t ON et.tag_id = t.id
                  WHERE e.user_id = ? AND e.version_id = ?
                `, [testUserId, versionId], (err, relationships) => {
                  console.log(`\n🔗 Imported relationships:`);
                  relationships.forEach(rel => {
                    console.log(`  - "${rel.expense_desc}" -> "${rel.tag_name}"`);
                  });
                  
                  console.log('\n✅ Import verification complete!');
                  db.run('COMMIT');
                  
                  // Clean up test data
                  setTimeout(() => {
                    console.log('\n🧹 Cleaning up test data...');
                    db.run('DELETE FROM expense_tags WHERE expense_id IN (SELECT id FROM expenses WHERE user_id = ?)', [testUserId]);
                    db.run('DELETE FROM expenses WHERE user_id = ?', [testUserId]);
                    db.run('DELETE FROM tags WHERE user_id = ?', [testUserId]);
                    db.run('DELETE FROM accounts WHERE user_id = ?', [testUserId]);
                    db.run('DELETE FROM income WHERE user_id = ?', [testUserId]);
                    db.run('DELETE FROM settings WHERE user_id = ?', [testUserId]);
                    db.run('DELETE FROM budget_versions WHERE user_id = ?', [testUserId]);
                    db.run('DELETE FROM users WHERE id = ?', [testUserId]);
                    console.log('✅ Cleanup complete!');
                    db.close();
                  }, 1000);
                });
              });
            });
          }
        }
      );
    } catch (error) {
      console.error('Import error:', error);
      db.run('ROLLBACK');
      db.close();
    }
  });
}

// Start the debug process
checkCurrentData(); 