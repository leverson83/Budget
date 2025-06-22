const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'budget.db'));

console.log('=== COMPREHENSIVE IMPORT/EXPORT DEBUG ===\n');

// Check all versions for user 1
db.all('SELECT id, name, is_active, created_at FROM budget_versions WHERE user_id = 1 ORDER BY created_at DESC', (err, versions) => {
  if (err) {
    console.error('Error fetching versions:', err);
    return;
  }
  
  console.log('📋 ALL VERSIONS FOR USER 1:');
  versions.forEach(v => {
    console.log(`  ID: ${v.id}, Name: "${v.name}", Active: ${v.is_active}, Created: ${v.created_at}`);
  });
  
  console.log('\n📊 EXPENSE COUNTS PER VERSION:');
  
  let completedChecks = 0;
  versions.forEach(version => {
    db.get('SELECT COUNT(*) as count FROM expenses WHERE user_id = 1 AND version_id = ?', [version.id], (err, result) => {
      if (err) {
        console.error(`Error checking version ${version.id}:`, err);
        return;
      }
      console.log(`  Version ${version.id} ("${version.name}"): ${result.count} expenses`);
      
      completedChecks++;
      if (completedChecks === versions.length) {
        checkActiveVersion();
      }
    });
  });
});

function checkActiveVersion() {
  console.log('\n🔍 CHECKING ACTIVE VERSION DETAILS:');
  
  db.get('SELECT id, name FROM budget_versions WHERE user_id = 1 AND is_active = 1', (err, activeVersion) => {
    if (err) {
      console.error('Error getting active version:', err);
      return;
    }
    
    if (!activeVersion) {
      console.log('❌ No active version found!');
      return;
    }
    
    console.log(`✅ Active version: ID ${activeVersion.id}, Name "${activeVersion.name}"`);
    
    // Check expenses in active version
    db.all('SELECT id, description, amount, frequency FROM expenses WHERE user_id = 1 AND version_id = ? ORDER BY description LIMIT 10', [activeVersion.id], (err, expenses) => {
      if (err) {
        console.error('Error fetching expenses:', err);
        return;
      }
      
      console.log(`\n📝 FIRST 10 EXPENSES IN ACTIVE VERSION (${activeVersion.id}):`);
      if (expenses.length === 0) {
        console.log('  No expenses found!');
      } else {
        expenses.forEach((expense, index) => {
          console.log(`  ${index + 1}. ID: ${expense.id}, Description: "${expense.description}", Amount: $${expense.amount}, Frequency: ${expense.frequency}`);
        });
      }
      
      // Check total count
      db.get('SELECT COUNT(*) as total FROM expenses WHERE user_id = 1 AND version_id = ?', [activeVersion.id], (err, result) => {
        if (err) {
          console.error('Error getting total count:', err);
          return;
        }
        console.log(`\n📊 TOTAL EXPENSES IN ACTIVE VERSION: ${result.total}`);
        
        // Check if there are any expenses at all for this user
        db.get('SELECT COUNT(*) as total FROM expenses WHERE user_id = 1', (err, totalResult) => {
          if (err) {
            console.error('Error getting total user expenses:', err);
            return;
          }
          console.log(`📊 TOTAL EXPENSES FOR USER 1 (ALL VERSIONS): ${totalResult.total}`);
          
          // Check the most recent import
          checkRecentImport();
        });
      });
    });
  });
}

function checkRecentImport() {
  console.log('\n🔄 CHECKING MOST RECENT IMPORT:');
  
  // Find the most recent "Imported Version"
  db.get('SELECT id, name, created_at FROM budget_versions WHERE user_id = 1 AND name LIKE "%Imported%" ORDER BY created_at DESC LIMIT 1', (err, recentImport) => {
    if (err) {
      console.error('Error finding recent import:', err);
      return;
    }
    
    if (!recentImport) {
      console.log('❌ No imported versions found');
      return;
    }
    
    console.log(`📦 Most recent import: ID ${recentImport.id}, Name "${recentImport.name}", Created: ${recentImport.created_at}`);
    
    // Check expenses in this import
    db.get('SELECT COUNT(*) as count FROM expenses WHERE user_id = 1 AND version_id = ?', [recentImport.id], (err, result) => {
      if (err) {
        console.error('Error checking import expenses:', err);
        return;
      }
      
      console.log(`📊 Expenses in recent import: ${result.count}`);
      
      if (result.count > 0) {
        // Show first few expenses from import
        db.all('SELECT id, description, amount, frequency FROM expenses WHERE user_id = 1 AND version_id = ? ORDER BY description LIMIT 5', [recentImport.id], (err, expenses) => {
          if (err) {
            console.error('Error fetching import expenses:', err);
            return;
          }
          
          console.log('\n📝 FIRST 5 EXPENSES IN RECENT IMPORT:');
          expenses.forEach((expense, index) => {
            console.log(`  ${index + 1}. ID: ${expense.id}, Description: "${expense.description}", Amount: $${expense.amount}, Frequency: ${expense.frequency}`);
          });
        });
      }
      
      // Check if this import is active
      db.get('SELECT is_active FROM budget_versions WHERE id = ?', [recentImport.id], (err, row) => {
        if (err) {
          console.error('Error checking import active status:', err);
          return;
        }
        
        console.log(`🔍 Recent import active status: ${row.is_active ? 'YES' : 'NO'}`);
        
        // Check expense-tag relationships
        checkExpenseTags(recentImport.id);
      });
    });
  });
}

function checkExpenseTags(versionId) {
  console.log('\n🏷️ CHECKING EXPENSE-TAG RELATIONSHIPS:');
  
  db.get('SELECT COUNT(*) as count FROM expense_tags et JOIN expenses e ON et.expense_id = e.id WHERE e.user_id = 1 AND e.version_id = ?', [versionId], (err, result) => {
    if (err) {
      console.error('Error checking expense-tags:', err);
      return;
    }
    
    console.log(`📊 Expense-tag relationships in version ${versionId}: ${result.count}`);
    
    // Check tags
    db.get('SELECT COUNT(*) as count FROM tags WHERE user_id = 1 AND version_id = ?', [versionId], (err, tagResult) => {
      if (err) {
        console.error('Error checking tags:', err);
        return;
      }
      
      console.log(`🏷️ Tags in version ${versionId}: ${tagResult.count}`);
      
      // Check accounts
      db.get('SELECT COUNT(*) as count FROM accounts WHERE user_id = 1 AND version_id = ?', [versionId], (err, accountResult) => {
        if (err) {
          console.error('Error checking accounts:', err);
          return;
        }
        
        console.log(`🏦 Accounts in version ${versionId}: ${accountResult.count}`);
        
        // Check income
        db.get('SELECT COUNT(*) as count FROM income WHERE user_id = 1 AND version_id = ?', [versionId], (err, incomeResult) => {
          if (err) {
            console.error('Error checking income:', err);
            return;
          }
          
          console.log(`💰 Income in version ${versionId}: ${incomeResult.count}`);
          
          console.log('\n=== DEBUG COMPLETE ===');
          db.close();
        });
      });
    });
  });
} 