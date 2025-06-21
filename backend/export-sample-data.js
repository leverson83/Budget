const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'budget.db');

async function exportSampleData() {
  const db = new sqlite3.Database(dbPath);
  
  try {
    console.log('Exporting sample data for leverson83@gmail.com...');
    
    // Get user and their default version
    db.get('SELECT id, default_version_id FROM users WHERE email = ?', ['leverson83@gmail.com'], (err, user) => {
      if (err || !user) {
        console.error('User leverson83@gmail.com not found!');
        db.close();
        return;
      }
      
      console.log(`Found user ID: ${user.id}, Default Version ID: ${user.default_version_id}`);
      
      const sampleData = {
        userId: user.id,
        versionId: user.default_version_id,
        accounts: [],
        income: [],
        expenses: [],
        tags: [],
        settings: [],
        expenseTags: []
      };
      
      // Export accounts
      db.all('SELECT * FROM accounts WHERE user_id = ? AND version_id = ?', [user.id, user.default_version_id], (err, accounts) => {
        if (!err) {
          sampleData.accounts = accounts;
          console.log(`Exported ${accounts.length} accounts`);
        }
        
        // Export income
        db.all('SELECT * FROM income WHERE user_id = ? AND version_id = ?', [user.id, user.default_version_id], (err, income) => {
          if (!err) {
            sampleData.income = income;
            console.log(`Exported ${income.length} income items`);
          }
          
          // Export expenses
          db.all('SELECT * FROM expenses WHERE user_id = ? AND version_id = ?', [user.id, user.default_version_id], (err, expenses) => {
            if (!err) {
              sampleData.expenses = expenses;
              console.log(`Exported ${expenses.length} expenses`);
            }
            
            // Export tags
            db.all('SELECT * FROM tags WHERE user_id = ? AND version_id = ?', [user.id, user.default_version_id], (err, tags) => {
              if (!err) {
                sampleData.tags = tags;
                console.log(`Exported ${tags.length} tags`);
              }
              
              // Export settings
              db.all('SELECT * FROM settings WHERE user_id = ? AND version_id = ?', [user.id, user.default_version_id], (err, settings) => {
                if (!err) {
                  sampleData.settings = settings;
                  console.log(`Exported ${settings.length} settings`);
                }
                
                // Export expense_tags relationships
                db.all(`
                  SELECT et.expense_id, et.tag_id, t.name as tag_name 
                  FROM expense_tags et
                  JOIN tags t ON et.tag_id = t.id
                  JOIN expenses e ON et.expense_id = e.id
                  WHERE e.user_id = ? AND e.version_id = ?
                `, [user.id, user.default_version_id], (err, expenseTags) => {
                  if (!err) {
                    sampleData.expenseTags = expenseTags;
                    console.log(`Exported ${expenseTags.length} expense-tag relationships`);
                  }
                  
                  // Write to file
                  const outputPath = path.join(__dirname, 'sample-data.json');
                  fs.writeFileSync(outputPath, JSON.stringify(sampleData, null, 2));
                  console.log(`✅ Sample data exported to ${outputPath}`);
                  
                  // Also create a SQL insert script
                  createSQLScript(sampleData);
                  
                  db.close();
                });
              });
            });
          });
        });
      });
    });
    
  } catch (error) {
    console.error('Error:', error);
    db.close();
  }
}

function createSQLScript(sampleData) {
  let sql = `-- Sample data for leverson83@gmail.com\n\n`;
  
  // Insert accounts
  if (sampleData.accounts.length > 0) {
    sql += `-- Accounts\n`;
    sampleData.accounts.forEach(account => {
      sql += `INSERT INTO accounts (user_id, version_id, name, bank, currentBalance, requiredBalance, isPrimary, diff) VALUES (?, ?, ?, ?, ?, ?, ?, ?);\n`;
    });
    sql += `\n`;
  }
  
  // Insert income
  if (sampleData.income.length > 0) {
    sql += `-- Income\n`;
    sampleData.income.forEach(income => {
      sql += `INSERT INTO income (id, user_id, version_id, description, amount, frequency, nextDue, applyFuzziness) VALUES (?, ?, ?, ?, ?, ?, ?, ?);\n`;
    });
    sql += `\n`;
  }
  
  // Insert expenses
  if (sampleData.expenses.length > 0) {
    sql += `-- Expenses\n`;
    sampleData.expenses.forEach(expense => {
      sql += `INSERT INTO expenses (id, user_id, version_id, description, amount, frequency, nextDue, applyFuzziness, notes, accountId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);\n`;
    });
    sql += `\n`;
  }
  
  // Insert tags
  if (sampleData.tags.length > 0) {
    sql += `-- Tags\n`;
    sampleData.tags.forEach(tag => {
      sql += `INSERT INTO tags (user_id, version_id, name, color) VALUES (?, ?, ?, ?);\n`;
    });
    sql += `\n`;
  }
  
  // Insert settings
  if (sampleData.settings.length > 0) {
    sql += `-- Settings\n`;
    sampleData.settings.forEach(setting => {
      sql += `INSERT INTO settings (user_id, version_id, key, value) VALUES (?, ?, ?, ?);\n`;
    });
    sql += `\n`;
  }
  
  // Insert expense_tags relationships
  if (sampleData.expenseTags.length > 0) {
    sql += `-- Expense-Tag Relationships\n`;
    sampleData.expenseTags.forEach(et => {
      sql += `INSERT INTO expense_tags (expense_id, tag_id) VALUES (?, ?);\n`;
    });
    sql += `\n`;
  }
  
  const sqlPath = path.join(__dirname, 'sample-data.sql');
  fs.writeFileSync(sqlPath, sql);
  console.log(`✅ SQL script created at ${sqlPath}`);
}

exportSampleData(); 