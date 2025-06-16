const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3001;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));
app.use(express.json());

// Database setup
const db = new sqlite3.Database(path.join(__dirname, 'budget.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    // Create tables
    db.serialize(() => {
      // Create income table
      db.run(`
        CREATE TABLE IF NOT EXISTS income (
          id TEXT PRIMARY KEY,
          description TEXT NOT NULL,
          amount REAL NOT NULL,
          frequency TEXT NOT NULL,
          nextDue TEXT NOT NULL,
          applyFuzziness BOOLEAN DEFAULT 0
        )
      `);

      // Create expenses table
      db.run(`
        CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY,
          description TEXT NOT NULL,
          amount REAL NOT NULL,
          frequency TEXT NOT NULL,
          nextDue TEXT NOT NULL,
          applyFuzziness BOOLEAN DEFAULT 0,
          notes TEXT,
          accountId INTEGER,
          FOREIGN KEY (accountId) REFERENCES accounts(id)
        )
      `);

      // Create settings table
      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT UNIQUE NOT NULL,
          value TEXT NOT NULL
        )
      `);

      // Create accounts table
      db.run(`
        CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          bank TEXT NOT NULL,
          currentBalance REAL NOT NULL,
          requiredBalance REAL NOT NULL,
          isPrimary INTEGER DEFAULT 0,
          diff REAL DEFAULT 0
        )
      `);

      // Create tags table
      db.run(`
        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL
        )
      `);

      // Create expense_tags junction table
      db.run(`
        CREATE TABLE IF NOT EXISTS expense_tags (
          expense_id TEXT,
          tag_id INTEGER,
          PRIMARY KEY (expense_id, tag_id),
          FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        )
      `);

      // Insert test data for tags
      db.run(`
        INSERT OR IGNORE INTO tags (name)
        VALUES 
          ('Groceries'),
          ('Utilities'),
          ('Entertainment'),
          ('Transportation')
      `);

      // Get the first account ID for the expense
      db.get('SELECT id FROM accounts LIMIT 1', [], (err, account) => {
        if (err) {
          console.error('Error getting account ID:', err);
          return;
        }

        if (account) {
          db.run(`
            INSERT OR IGNORE INTO expenses (id, description, amount, frequency, nextDue, accountId, notes)
            VALUES 
              ('1', 'Grocery Shopping', 200.00, 'weekly', '2024-03-20', ?, 'Weekly grocery shopping'),
              ('2', 'Electric Bill', 150.00, 'monthly', '2024-03-25', ?, 'Monthly electric bill payment')
          `, [account.id, account.id]);
        }
      });
    });
  }
});

// API Routes

// Get all income entries
app.get('/api/income', (req, res) => {
  db.all('SELECT * FROM income', [], (err, rows) => {
    if (err) {
      console.error('Error fetching incomes:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    // Convert applyFuzziness to boolean
    const processedRows = rows.map(row => ({
      ...row,
      applyFuzziness: Boolean(row.applyFuzziness)
    }));
    res.json(processedRows);
  });
});

// Add new income entry
app.post('/api/income', (req, res) => {
  const { id, description, amount, frequency, nextDue } = req.body;
  
  if (!id || !description || !amount || !frequency || !nextDue) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  db.run(
    'INSERT INTO income (id, description, amount, frequency, nextDue) VALUES (?, ?, ?, ?, ?)',
    [id, description, amount, frequency, nextDue],
    function(err) {
      if (err) {
        console.error('Error creating income:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID });
    }
  );
});

// Update income entry
app.put('/api/income/:id', (req, res) => {
  const { description, amount, frequency, nextDue } = req.body;
  const { id } = req.params;

  if (!description || !amount || !frequency || !nextDue) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  db.run(
    'UPDATE income SET description = ?, amount = ?, frequency = ?, nextDue = ? WHERE id = ?',
    [description, amount, frequency, nextDue, id],
    function(err) {
      if (err) {
        console.error('Error updating income:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ changes: this.changes });
    }
  );
});

// Delete income entry
app.delete('/api/income/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM income WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Error deleting income:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ changes: this.changes });
  });
});

// Expenses endpoints
app.get('/api/expenses', (req, res) => {
  db.all(`
    SELECT e.*, 
           GROUP_CONCAT(t.name) as tags,
           a.name as accountName
    FROM expenses e
    LEFT JOIN expense_tags et ON e.id = et.expense_id
    LEFT JOIN tags t ON et.tag_id = t.id
    LEFT JOIN accounts a ON e.accountId = a.id
    GROUP BY e.id
  `, [], (err, rows) => {
    if (err) {
      console.error('Error fetching expenses:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    // Convert applyFuzziness to boolean and parse tags
    const processedRows = rows.map(row => ({
      ...row,
      applyFuzziness: Boolean(row.applyFuzziness),
      tags: row.tags ? row.tags.split(',').filter(Boolean) : []
    }));
    res.json(processedRows);
  });
});

// Add new expense entry
app.post('/api/expenses', (req, res) => {
  const { id, description, amount, frequency, nextDue, applyFuzziness, notes, tags, accountId } = req.body;
  
  if (!id || !description || !amount || !frequency || !nextDue) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  console.log('Creating expense with data:', { id, description, amount, frequency, nextDue, applyFuzziness, notes, tags, accountId });

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Insert expense
    db.run(
      'INSERT INTO expenses (id, description, amount, frequency, nextDue, applyFuzziness, notes, accountId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, description, amount, frequency, nextDue, applyFuzziness ? 1 : 0, notes || null, accountId || null],
      function(err) {
        if (err) {
          console.error('Error creating expense:', err);
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
          return;
        }

        // If there are tags, insert them
        if (tags && tags.length > 0) {
          console.log('Inserting tags:', tags);
          let completedTags = 0;
          const totalTags = tags.length;
          let hasError = false;

          tags.forEach(tag => {
            // Insert or ignore the tag, then always fetch its ID
            db.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [tag], function(err) {
              if (err) {
                if (!hasError) {
                  hasError = true;
                  console.error('Error inserting tag:', err);
                  db.run('ROLLBACK');
                  res.status(500).json({ error: err.message });
                }
                return;
              }
              // Now fetch the tag ID
              db.get('SELECT id FROM tags WHERE name = ?', [tag], (err, row) => {
                if (err || !row) {
                  if (!hasError) {
                    hasError = true;
                    console.error('Error fetching tag id:', err);
                    db.run('ROLLBACK');
                    res.status(500).json({ error: err ? err.message : 'Tag not found' });
                  }
                  return;
                }
                // Insert into expense_tags
                db.run('INSERT INTO expense_tags (expense_id, tag_id) VALUES (?, ?)', [id, row.id], function(err) {
                  if (err) {
                    if (!hasError) {
                      hasError = true;
                      console.error('Error linking tag:', err);
                      db.run('ROLLBACK');
                      res.status(500).json({ error: err.message });
                    }
                    return;
                  }
                  completedTags++;
                  if (completedTags === totalTags && !hasError) {
                    db.run('COMMIT', (err) => {
                      if (err) {
                        console.error('Error committing transaction:', err);
                        res.status(500).json({ error: err.message });
                        return;
                      }
                      res.json({ id });
                    });
                  }
                });
              });
            });
          });
        } else {
          // Commit the transaction if no tags
          db.run('COMMIT', (err) => {
            if (err) {
              console.error('Error committing transaction:', err);
              res.status(500).json({ error: err.message });
              return;
            }
            res.json({ id });
          });
        }
      }
    );
  });
});

// Update expense entry
app.put('/api/expenses/:id', (req, res) => {
  const { description, amount, frequency, nextDue, applyFuzziness, notes, tags, accountId } = req.body;
  const { id } = req.params;

  if (!description || !amount || !frequency || !nextDue) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  console.log('Updating expense with data:', { id, description, amount, frequency, nextDue, applyFuzziness, notes, tags, accountId });

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Update expense
    db.run(
      'UPDATE expenses SET description = ?, amount = ?, frequency = ?, nextDue = ?, applyFuzziness = ?, notes = ?, accountId = ? WHERE id = ?',
      [description, amount, frequency, nextDue, applyFuzziness ? 1 : 0, notes || null, accountId || null, id],
      function(err) {
        if (err) {
          console.error('Error updating expense:', err);
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
          return;
        }

        // Delete existing tags for this expense
        db.run('DELETE FROM expense_tags WHERE expense_id = ?', [id], (err) => {
          if (err) {
            console.error('Error deleting existing tags:', err);
            db.run('ROLLBACK');
            res.status(500).json({ error: err.message });
            return;
          }

          // If there are new tags, insert them
          if (tags && tags.length > 0) {
            console.log('Inserting tags:', tags);
            
            // First, get all existing tag IDs
            const getTagId = (tagName, callback) => {
              db.get('SELECT id FROM tags WHERE name = ?', [tagName], (err, row) => {
                if (err) {
                  callback(err);
                  return;
                }
                if (row) {
                  callback(null, row.id);
                } else {
                  // If tag doesn't exist, create it
                  db.run('INSERT INTO tags (name) VALUES (?)', [tagName], function(err) {
                    if (err) {
                      callback(err);
                      return;
                    }
                    callback(null, this.lastID);
                  });
                }
              });
            };

            let completedTags = 0;
            const totalTags = tags.length;

            tags.forEach(tag => {
              getTagId(tag, (err, tagId) => {
                if (err) {
                  console.error('Error getting/creating tag:', err);
                  db.run('ROLLBACK');
                  res.status(500).json({ error: err.message });
                  return;
                }

                // Insert the tag relationship
                db.run('INSERT INTO expense_tags (expense_id, tag_id) VALUES (?, ?)', 
                  [id, tagId], 
                  (err) => {
                    if (err) {
                      console.error('Error inserting tag relationship:', err);
                      db.run('ROLLBACK');
                      res.status(500).json({ error: err.message });
                      return;
                    }
                    completedTags++;
                    if (completedTags === totalTags) {
                      db.run('COMMIT', (err) => {
                        if (err) {
                          console.error('Error committing transaction:', err);
                          res.status(500).json({ error: err.message });
                          return;
                        }
                        res.json({ changes: this.changes });
                      });
                    }
                  }
                );
              });
            });
          } else {
            // If no tags, just commit the transaction
            db.run('COMMIT', (err) => {
              if (err) {
                console.error('Error committing transaction:', err);
                res.status(500).json({ error: err.message });
                return;
              }
              res.json({ changes: this.changes });
            });
          }
        });
      }
    );
  });
});

// Delete expense entry
app.delete('/api/expenses/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM expenses WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Error deleting expense:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ changes: this.changes });
  });
});

// Settings endpoints
app.get('/api/settings', (req, res) => {
  db.all('SELECT * FROM settings', [], (err, rows) => {
    if (err) {
      console.error('Error fetching settings:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Default settings
    const defaultSettings = {
      fuzziness: {
        weekly: 1,
        fortnightly: 1,
        monthly: 1,
        quarterly: 1,
        yearly: 1
      },
      ignoreWeekends: false,
      frequency: 'monthly'
    };

    // Convert rows to object
    const settings = rows.reduce((acc, row) => {
      try {
        acc[row.key] = JSON.parse(row.value);
      } catch (e) {
        acc[row.key] = row.value;
      }
      return acc;
    }, {});

    // Merge with defaults
    const mergedSettings = {
      ...defaultSettings,
      ...settings
    };

    res.json(mergedSettings);
  });
});

// Get frequency setting
app.get('/api/settings/frequency', (req, res) => {
  db.get('SELECT value FROM settings WHERE key = ?', ['frequency'], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ frequency: row ? row.value : 'monthly' });
  });
});

// Update frequency setting
app.post('/api/settings/frequency', (req, res) => {
  const { frequency } = req.body;
  db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['frequency', frequency],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ frequency });
    }
  );
});

app.put('/api/settings', (req, res) => {
  const settings = req.body;
  
  // Convert settings object to array of key-value pairs
  const settingsArray = Object.entries(settings).map(([key, value]) => ({
    key,
    value: JSON.stringify(value)
  }));

  // Use a transaction to update all settings
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    
    settingsArray.forEach(({ key, value }) => {
      stmt.run(key, value);
    });

    stmt.finalize();

    db.run('COMMIT', (err) => {
      if (err) {
        console.error('Error updating settings:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(settings);
    });
  });
});

// Accounts API endpoints
app.get('/api/accounts', (req, res) => {
  db.all('SELECT * FROM accounts', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/accounts', (req, res) => {
  const { name, bank, currentBalance, requiredBalance, isPrimary, diff } = req.body;
  
  if (!name || !bank || currentBalance === undefined || requiredBalance === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  db.run(
    'INSERT INTO accounts (name, bank, currentBalance, requiredBalance, isPrimary, diff) VALUES (?, ?, ?, ?, ?, ?)',
    [name, bank, currentBalance, requiredBalance, isPrimary ? 1 : 0, diff || 0],
    function(err) {
      if (err) {
        console.error('Error adding account:', err);
        return res.status(500).json({ error: 'Error adding account' });
      }
      res.json({ id: this.lastID });
    }
  );
});

app.put('/api/accounts/:id', (req, res) => {
  const { name, bank, currentBalance, requiredBalance, isPrimary, diff } = req.body;
  const id = req.params.id;

  if (!name || !bank || currentBalance === undefined || requiredBalance === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  db.run(
    'UPDATE accounts SET name = ?, bank = ?, currentBalance = ?, requiredBalance = ?, isPrimary = ?, diff = ? WHERE id = ?',
    [name, bank, currentBalance, requiredBalance, isPrimary ? 1 : 0, diff || 0, id],
    function(err) {
      if (err) {
        console.error('Error updating account:', err);
        return res.status(500).json({ error: 'Error updating account' });
      }
      res.json({ message: 'Account updated successfully' });
    }
  );
});

app.delete('/api/accounts/:id', (req, res) => {
  db.run('DELETE FROM accounts WHERE id = ?', req.params.id, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Account deleted' });
  });
});

// Get all tags
app.get('/api/tags', (req, res) => {
  db.all('SELECT name FROM tags ORDER BY name', [], (err, rows) => {
    if (err) {
      console.error('Error fetching tags:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows.map(row => row.name));
  });
});

// Add new tag
app.post('/api/tags', (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    res.status(400).json({ error: 'Tag name is required' });
    return;
  }

  db.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [name], function(err) {
    if (err) {
      console.error('Error adding tag:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID });
  });
});

// Add error handling middleware before app.listen
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 