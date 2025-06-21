// Load environment variables
require('dotenv').config();

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3001;

// JWT secret key from environment variable, with fallback
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  const crypto = require('crypto');
  const generatedSecret = crypto.randomBytes(64).toString('hex');
  console.warn('⚠️  No JWT_SECRET found in environment variables. Generated a new one for this session.');
  console.warn('⚠️  For production, set JWT_SECRET in your .env file.');
  return generatedSecret;
})();

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Serve static files from the React app build
app.use(express.static(path.join(__dirname, '../public')));

// Database setup
const db = new sqlite3.Database(path.join(__dirname, 'budget.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    // Create tables
    db.serialize(() => {
      // Create users table first (if it doesn't exist)
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT,
          is_initialized INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          admin INTEGER DEFAULT 0,
          default_version_id INTEGER,
          FOREIGN KEY (default_version_id) REFERENCES budget_versions(id) ON DELETE SET NULL
        )
      `, (err) => {
        if (err) {
          console.error('Error creating users table:', err);
        } else {
          // Insert initial users if they don't exist
          db.run(`
            INSERT OR IGNORE INTO users (name, email) 
            VALUES ('Luke', 'leverson83@gmail.com')
          `);
          db.run(`
            INSERT OR IGNORE INTO users (name, email) 
            VALUES ('Marina', 'marinahu1990@hotmail.com')
          `);
        }
      });

      // Create budget_versions table
      db.run(`
        CREATE TABLE IF NOT EXISTS budget_versions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          is_active INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, name)
        )
      `);

      // Create income table with user_id and version_id
      db.run(`
        CREATE TABLE IF NOT EXISTS income (
          id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          version_id INTEGER NOT NULL,
          description TEXT NOT NULL,
          amount REAL NOT NULL,
          frequency TEXT NOT NULL,
          nextDue TEXT NOT NULL,
          applyFuzziness BOOLEAN DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE
        )
      `);

      // Create expenses table with user_id and version_id
      db.run(`
        CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          version_id INTEGER NOT NULL,
          description TEXT NOT NULL,
          amount REAL NOT NULL,
          frequency TEXT NOT NULL,
          nextDue TEXT NOT NULL,
          applyFuzziness INTEGER DEFAULT 0,
          notes TEXT,
          accountId INTEGER,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
          FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE SET NULL
        )
      `);

      // Create settings table with user_id and version_id
      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          version_id INTEGER NOT NULL,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
          UNIQUE(user_id, version_id, key)
        )
      `);

      // Create accounts table with user_id and version_id
      db.run(`
        CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          version_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          bank TEXT NOT NULL,
          currentBalance REAL NOT NULL,
          requiredBalance REAL NOT NULL,
          isPrimary INTEGER DEFAULT 0,
          diff REAL DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE
        )
      `);

      // Create tags table with user_id and version_id
      db.run(`
        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          version_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          color TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
          UNIQUE(user_id, version_id, name)
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

      // Create shared_versions table
      db.run(`
        CREATE TABLE IF NOT EXISTS shared_versions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version_id INTEGER NOT NULL,
          owner_user_id INTEGER NOT NULL,
          shared_with_user_id INTEGER NOT NULL,
          shared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
          FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (shared_with_user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(version_id, shared_with_user_id)
        )
      `);
    });
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Middleware to check admin
function requireAdmin(req, res, next) {
  const userId = req.user.userId;
  db.get('SELECT admin FROM users WHERE id = ?', [userId], (err, row) => {
    if (err || !row) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (row.admin !== 1) {
      return res.status(403).json({ error: 'Admin only' });
    }
    next();
  });
}

// API Routes

// Authentication endpoints
app.post('/api/auth/login', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      console.error('Error finding user:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has set a password
    if (!user.password_hash) {
      return res.json({ 
        needsPassword: true, 
        user: { id: user.id, name: user.name, email: user.email, admin: !!user.admin }
      });
    }

    // User has password, require it for login
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Check if user has a default version and activate it
    db.get('SELECT default_version_id FROM users WHERE id = ?', [user.id], (err, userRow) => {
      if (err) {
        console.error('Error checking default version:', err);
        // Still return the response even if there's an error checking default version
        res.json({ 
          token, 
          user: { id: user.id, name: user.name, email: user.email, admin: !!user.admin },
          needsPassword: false
        });
        return;
      }

      if (userRow && userRow.default_version_id) {
        // Activate the default version
        db.run(
          'UPDATE budget_versions SET is_active = 0 WHERE user_id = ?',
          [user.id],
          (err) => {
            if (err) {
              console.error('Error deactivating other versions:', err);
            } else {
              db.run(
                'UPDATE budget_versions SET is_active = 1 WHERE id = ? AND user_id = ?',
                [userRow.default_version_id, user.id],
                (err) => {
                  if (err) {
                    console.error('Error activating default version:', err);
                  }
                }
              );
            }
          }
        );
      }

      res.json({ 
        token, 
        user: { id: user.id, name: user.name, email: user.email, admin: !!user.admin },
        needsPassword: false
      });
    });
  });
});

app.post('/api/auth/set-password', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      console.error('Error hashing password:', err);
      return res.status(500).json({ error: 'Error setting password' });
    }

    db.run(
      'UPDATE users SET password_hash = ?, is_initialized = 1 WHERE email = ?',
      [hash, email],
      function(err) {
        if (err) {
          console.error('Error updating user password:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Get user details for JWT token
        db.get('SELECT id, name FROM users WHERE email = ?', [email], (err, user) => {
          if (err) {
            console.error('Error getting user details:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          // Generate JWT token with userId
          const token = jwt.sign(
            { userId: user.id, email, name: user.name },
            JWT_SECRET,
            { expiresIn: '24h' }
          );

          res.json({ 
            message: 'Password set successfully',
            token
          });
        });
      }
    );
  });
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  // Check if user already exists
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, existingUser) => {
    if (err) {
      console.error('Error checking existing user:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password and create user
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        console.error('Error hashing password:', err);
        return res.status(500).json({ error: 'Error creating account' });
      }

      db.run(
        'INSERT INTO users (name, email, password_hash, is_initialized) VALUES (?, ?, ?, 1)',
        [name, email, hash],
        function(err) {
          if (err) {
            console.error('Error creating user:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          const userId = this.lastID;

          // Create a default version for the new user
          db.run(
            'INSERT INTO budget_versions (user_id, name, description, is_active) VALUES (?, ?, ?, 1)',
            [userId, 'Default', 'Default budget version', 1],
            function(err) {
              if (err) {
                console.error('Error creating default version:', err);
                return res.status(500).json({ error: 'Database error' });
              }

              const versionId = this.lastID;

              // Insert default settings for new user
              const defaultSettings = [
                ['showPlanningPage', false],
                ['showSchedulePage', false],
                ['showAccountsPage', false],
                ['fuzziness', JSON.stringify({
                  weekly: 1,
                  fortnightly: 1,
                  monthly: 1,
                  quarterly: 1,
                  yearly: 1
                })],
                ['ignoreWeekends', false],
                ['frequency', 'monthly']
              ];
              const stmt = db.prepare('INSERT OR REPLACE INTO settings (user_id, version_id, key, value) VALUES (?, ?, ?, ?)');
              defaultSettings.forEach(([key, value]) => {
                stmt.run(userId, versionId, key, value);
              });
              stmt.finalize();

              // Generate JWT token
              const token = jwt.sign(
                { userId, email, name },
                JWT_SECRET,
                { expiresIn: '24h' }
              );

              res.json({ 
                message: 'Account created successfully',
                token,
                user: { id: userId, name, email }
              });
            }
          );
        }
      );
    });
  });
});

// Delete user by email (admin function)
app.delete('/api/auth/users/:email', authenticateToken, (req, res) => {
  const { email } = req.params;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  db.run('DELETE FROM users WHERE email = ?', [email], function(err) {
    if (err) {
      console.error('Error deleting user:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: 'User deleted successfully',
      changes: this.changes
    });
  });
});

app.get('/api/auth/check', authenticateToken, (req, res) => {
  res.json({ 
    authenticated: true, 
    user: { 
      id: req.user.userId, 
      email: req.user.email, 
      name: req.user.name 
    } 
  });
});

// Version management endpoints
app.get('/api/versions', authenticateToken, (req, res) => {
  db.all('SELECT * FROM budget_versions WHERE user_id = ? ORDER BY created_at DESC', [req.user.userId], (err, rows) => {
    if (err) {
      console.error('Error fetching versions:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get('/api/versions/active', authenticateToken, (req, res) => {
  db.get('SELECT * FROM budget_versions WHERE user_id = ? AND is_active = 1', [req.user.userId], (err, row) => {
    if (err) {
      console.error('Error fetching active version:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(row);
  });
});

app.post('/api/versions', authenticateToken, (req, res) => {
  const { name, description, copyFromVersionId } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Version name is required' });
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Create new version
    db.run(
      'INSERT INTO budget_versions (user_id, name, description, is_active) VALUES (?, ?, ?, 1)',
      [req.user.userId, name, description || null],
      function(err) {
        if (err) {
          console.error('Error creating version:', err);
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }

        const newVersionId = this.lastID;

        // Deactivate all other versions for this user
        db.run(
          'UPDATE budget_versions SET is_active = 0 WHERE user_id = ? AND id != ?',
          [req.user.userId, newVersionId],
          (err) => {
            if (err) {
              console.error('Error deactivating other versions:', err);
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }

            // If copying from another version, copy all data
            if (copyFromVersionId) {
              // Copy income
              db.run(
                'INSERT INTO income (id, user_id, version_id, description, amount, frequency, nextDue, applyFuzziness) ' +
                'SELECT id, user_id, ?, description, amount, frequency, nextDue, applyFuzziness ' +
                'FROM income WHERE user_id = ? AND version_id = ?',
                [newVersionId, req.user.userId, copyFromVersionId]
              );

              // Copy expenses
              db.run(
                'INSERT INTO expenses (id, user_id, version_id, description, amount, frequency, nextDue, applyFuzziness, notes, accountId) ' +
                'SELECT id, user_id, ?, description, amount, frequency, nextDue, applyFuzziness, notes, accountId ' +
                'FROM expenses WHERE user_id = ? AND version_id = ?',
                [newVersionId, req.user.userId, copyFromVersionId]
              );

              // Copy accounts
              db.run(
                'INSERT INTO accounts (user_id, version_id, name, bank, currentBalance, requiredBalance, isPrimary, diff) ' +
                'SELECT user_id, ?, name, bank, currentBalance, requiredBalance, isPrimary, diff ' +
                'FROM accounts WHERE user_id = ? AND version_id = ?',
                [newVersionId, req.user.userId, copyFromVersionId]
              );

              // Copy tags
              db.run(
                'INSERT INTO tags (user_id, version_id, name, color) ' +
                'SELECT user_id, ?, name, color ' +
                'FROM tags WHERE user_id = ? AND version_id = ?',
                [newVersionId, req.user.userId, copyFromVersionId]
              );

              // Copy settings
              db.run(
                'INSERT INTO settings (user_id, version_id, key, value) ' +
                'SELECT user_id, ?, key, value ' +
                'FROM settings WHERE user_id = ? AND version_id = ?',
                [newVersionId, req.user.userId, copyFromVersionId]
              );

              // Copy expense_tags relationships (need to handle new tag IDs)
              db.run(`
                INSERT INTO expense_tags (expense_id, tag_id)
                SELECT e.id, new_tags.id
                FROM expenses e
                JOIN expense_tags et ON e.id = et.expense_id
                JOIN tags old_tags ON et.tag_id = old_tags.id
                JOIN tags new_tags ON new_tags.name = old_tags.name AND new_tags.version_id = ? AND new_tags.user_id = ?
                WHERE e.user_id = ? AND e.version_id = ? AND old_tags.version_id = ?
              `, [newVersionId, req.user.userId, req.user.userId, newVersionId, copyFromVersionId]);
            } else {
              // Create default settings for new blank version
              const defaultSettings = [
                ['showPlanningPage', false],
                ['showSchedulePage', false],
                ['showAccountsPage', false],
                ['fuzziness', JSON.stringify({
                  weekly: 1,
                  fortnightly: 1,
                  monthly: 1,
                  quarterly: 1,
                  yearly: 1
                })],
                ['ignoreWeekends', false],
                ['frequency', 'monthly']
              ];
              
              const stmt = db.prepare('INSERT INTO settings (user_id, version_id, key, value) VALUES (?, ?, ?, ?)');
              defaultSettings.forEach(([key, value]) => {
                stmt.run(req.user.userId, newVersionId, key, value);
              });
              stmt.finalize();
            }

            db.run('COMMIT', (err) => {
              if (err) {
                console.error('Error committing transaction:', err);
                return res.status(500).json({ error: err.message });
              }
              res.json({ 
                id: newVersionId, 
                name, 
                description, 
                is_active: 1,
                message: copyFromVersionId ? 'Version copied successfully' : 'Version created successfully'
              });
            });
          }
        );
      }
    );
  });
});

app.put('/api/versions/:id/activate', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Deactivate all versions for this user
    db.run(
      'UPDATE budget_versions SET is_active = 0 WHERE user_id = ?',
      [req.user.userId],
      (err) => {
        if (err) {
          console.error('Error deactivating versions:', err);
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }

        // Activate the specified version
        db.run(
          'UPDATE budget_versions SET is_active = 1 WHERE id = ? AND user_id = ?',
          [id, req.user.userId],
          function(err) {
            if (err) {
              console.error('Error activating version:', err);
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }

            if (this.changes === 0) {
              db.run('ROLLBACK');
              return res.status(404).json({ error: 'Version not found' });
            }

            db.run('COMMIT', (err) => {
              if (err) {
                console.error('Error committing transaction:', err);
                return res.status(500).json({ error: err.message });
              }
              res.json({ message: 'Version activated successfully' });
            });
          }
        );
      }
    );
  });
});

app.put('/api/versions/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Version name is required' });
  }

  db.run(
    'UPDATE budget_versions SET name = ?, description = ? WHERE id = ? AND user_id = ?',
    [name, description || null, id, req.user.userId],
    function(err) {
      if (err) {
        console.error('Error updating version:', err);
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Version not found' });
      }

      res.json({ message: 'Version updated successfully' });
    }
  );
});

app.delete('/api/versions/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  // Check if this is the only version
  db.get('SELECT COUNT(*) as count FROM budget_versions WHERE user_id = ?', [req.user.userId], (err, row) => {
    if (err) {
      console.error('Error checking version count:', err);
      return res.status(500).json({ error: err.message });
    }

    if (row.count <= 1) {
      return res.status(400).json({ error: 'Cannot delete the only version. Create a new version first.' });
    }

    // Check if this is the active version
    db.get('SELECT is_active FROM budget_versions WHERE id = ? AND user_id = ?', [id, req.user.userId], (err, row) => {
      if (err) {
        console.error('Error checking version status:', err);
        return res.status(500).json({ error: err.message });
      }

      if (!row) {
        return res.status(404).json({ error: 'Version not found' });
      }

      if (row.is_active) {
        return res.status(400).json({ error: 'Cannot delete the active version. Switch to another version first.' });
      }

      // Delete the version (cascade will handle related data)
      db.run('DELETE FROM budget_versions WHERE id = ? AND user_id = ?', [id, req.user.userId], function(err) {
        if (err) {
          console.error('Error deleting version:', err);
          return res.status(500).json({ error: err.message });
        }

        res.json({ message: 'Version deleted successfully' });
      });
    });
  });
});

// Share version with another user
app.post('/api/versions/:id/share', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Check if the version exists and belongs to the user
  db.get('SELECT * FROM budget_versions WHERE id = ? AND user_id = ?', [id, req.user.userId], (err, version) => {
    if (err) {
      console.error('Error checking version:', err);
      return res.status(500).json({ error: err.message });
    }

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Find the user to share with
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, targetUser) => {
      if (err) {
        console.error('Error finding target user:', err);
        return res.status(500).json({ error: err.message });
      }

      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (targetUser.id === req.user.userId) {
        return res.status(400).json({ error: 'Cannot share with yourself' });
      }

      // Share the version
      db.run(
        'INSERT OR IGNORE INTO shared_versions (version_id, owner_user_id, shared_with_user_id) VALUES (?, ?, ?)',
        [id, req.user.userId, targetUser.id],
        function(err) {
          if (err) {
            console.error('Error sharing version:', err);
            return res.status(500).json({ error: err.message });
          }

          if (this.changes === 0) {
            return res.status(409).json({ error: 'Version already shared with this user' });
          }

          res.json({ message: 'Version shared successfully' });
        }
      );
    });
  });
});

// Get shared versions (versions shared with the current user)
app.get('/api/versions/shared', authenticateToken, (req, res) => {
  db.all(`
    SELECT bv.*, u.name as owner_name, u.email as owner_email, sv.shared_at
    FROM shared_versions sv
    JOIN budget_versions bv ON sv.version_id = bv.id
    JOIN users u ON sv.owner_user_id = u.id
    WHERE sv.shared_with_user_id = ?
    ORDER BY sv.shared_at DESC
  `, [req.user.userId], (err, rows) => {
    if (err) {
      console.error('Error fetching shared versions:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get versions shared by the current user
app.get('/api/versions/shared-by-me', authenticateToken, (req, res) => {
  db.all(`
    SELECT bv.*, u.name as shared_with_name, u.email as shared_with_email, sv.shared_at
    FROM shared_versions sv
    JOIN budget_versions bv ON sv.version_id = bv.id
    JOIN users u ON sv.shared_with_user_id = u.id
    WHERE sv.owner_user_id = ?
    ORDER BY sv.shared_at DESC
  `, [req.user.userId], (err, rows) => {
    if (err) {
      console.error('Error fetching shared versions:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Unshare version
app.delete('/api/versions/:id/share/:email', authenticateToken, (req, res) => {
  const { id, email } = req.params;

  db.run(`
    DELETE FROM shared_versions 
    WHERE version_id = ? AND owner_user_id = ? AND shared_with_user_id = (
      SELECT id FROM users WHERE email = ?
    )
  `, [id, req.user.userId, email], function(err) {
    if (err) {
      console.error('Error unsharing version:', err);
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Shared version not found' });
    }

    res.json({ message: 'Version unshared successfully' });
  });
});

// Set default version
app.put('/api/versions/:id/set-default', authenticateToken, (req, res) => {
  const { id } = req.params;

  // Check if the version exists and belongs to the user
  db.get('SELECT * FROM budget_versions WHERE id = ? AND user_id = ?', [id, req.user.userId], (err, version) => {
    if (err) {
      console.error('Error checking version:', err);
      return res.status(500).json({ error: err.message });
    }

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Set as default version
    db.run('UPDATE users SET default_version_id = ? WHERE id = ?', [id, req.user.userId], function(err) {
      if (err) {
        console.error('Error setting default version:', err);
        return res.status(500).json({ error: err.message });
      }

      res.json({ message: 'Default version set successfully' });
    });
  });
});

// Get default version
app.get('/api/versions/default', authenticateToken, (req, res) => {
  db.get(`
    SELECT bv.* FROM budget_versions bv
    JOIN users u ON bv.id = u.default_version_id
    WHERE u.id = ?
  `, [req.user.userId], (err, row) => {
    if (err) {
      console.error('Error fetching default version:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(row);
  });
});

// Get all users for sharing (excluding current user)
app.get('/api/users', authenticateToken, (req, res) => {
  db.all('SELECT id, name, email FROM users WHERE id != ? ORDER BY name', [req.user.userId], (err, rows) => {
    if (err) {
      console.error('Error fetching users:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get all income entries
app.get('/api/income', authenticateToken, (req, res) => {
  db.all(`
    SELECT i.* FROM income i
    JOIN budget_versions bv ON i.version_id = bv.id
    WHERE i.user_id = ? AND bv.is_active = 1
  `, [req.user.userId], (err, rows) => {
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
app.post('/api/income', authenticateToken, (req, res) => {
  const { id, description, amount, frequency, nextDue } = req.body;
  
  if (!id || !description || !amount || !frequency || !nextDue) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  // Get the active version ID
  db.get('SELECT id FROM budget_versions WHERE user_id = ? AND is_active = 1', [req.user.userId], (err, version) => {
    if (err) {
      console.error('Error getting active version:', err);
      return res.status(500).json({ error: err.message });
    }

    if (!version) {
      return res.status(400).json({ error: 'No active version found. Please create a version first.' });
    }

    db.run(
      'INSERT INTO income (id, user_id, version_id, description, amount, frequency, nextDue) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.userId, version.id, description, amount, frequency, nextDue],
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
});

// Update income entry
app.put('/api/income/:id', authenticateToken, (req, res) => {
  const { description, amount, frequency, nextDue } = req.body;
  const { id } = req.params;

  if (!description || !amount || !frequency || !nextDue) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  db.run(`
    UPDATE income SET description = ?, amount = ?, frequency = ?, nextDue = ? 
    WHERE id = ? AND user_id = ? AND version_id IN (
      SELECT id FROM budget_versions WHERE user_id = ? AND is_active = 1
    )
  `, [description, amount, frequency, nextDue, id, req.user.userId, req.user.userId],
  function(err) {
    if (err) {
      console.error('Error updating income:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ changes: this.changes });
  });
});

// Delete income entry
app.delete('/api/income/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run(`
    DELETE FROM income 
    WHERE id = ? AND user_id = ? AND version_id IN (
      SELECT id FROM budget_versions WHERE user_id = ? AND is_active = 1
    )
  `, [id, req.user.userId, req.user.userId], function(err) {
    if (err) {
      console.error('Error deleting income:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ changes: this.changes });
  });
});

// Expenses endpoints
app.get('/api/expenses', authenticateToken, (req, res) => {
  db.all(`
    SELECT e.*, 
           GROUP_CONCAT(t.name) as tags,
           a.name as accountName
    FROM expenses e
    LEFT JOIN expense_tags et ON e.id = et.expense_id
    LEFT JOIN tags t ON et.tag_id = t.id
    LEFT JOIN accounts a ON e.accountId = a.id
    JOIN budget_versions bv ON e.version_id = bv.id
    WHERE e.user_id = ? AND bv.is_active = 1
    GROUP BY e.id
  `, [req.user.userId], (err, rows) => {
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
app.post('/api/expenses', authenticateToken, (req, res) => {
  const { id, description, amount, frequency, nextDue, applyFuzziness, notes, tags, accountId } = req.body;
  
  if (!id || !description || !amount || !frequency || !nextDue) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  console.log('Creating expense with data:', { id, description, amount, frequency, nextDue, applyFuzziness, notes, tags, accountId });

  // Get the active version ID
  db.get('SELECT id FROM budget_versions WHERE user_id = ? AND is_active = 1', [req.user.userId], (err, version) => {
    if (err) {
      console.error('Error getting active version:', err);
      return res.status(500).json({ error: err.message });
    }

    if (!version) {
      return res.status(400).json({ error: 'No active version found. Please create a version first.' });
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      // Insert expense
      db.run(
        'INSERT INTO expenses (id, user_id, version_id, description, amount, frequency, nextDue, applyFuzziness, notes, accountId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, req.user.userId, version.id, description, amount, frequency, nextDue, applyFuzziness ? 1 : 0, notes || null, accountId || null],
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
              // Generate a consistent color for the tag
              const colors = [
                '#1976d2', '#9c27b0', '#2e7d32', '#f57c00', '#c2185b', '#00838f', '#7b1fa2', '#d32f2f', '#5d4037', '#455a64',
                '#388e3c', '#fbc02d', '#0288d1', '#e64a19', '#6d4c41', '#512da8', '#0097a7', '#afb42b', '#f06292', '#8d6e63',
                '#00bcd4', '#ffb300', '#43a047', '#e53935', '#8e24aa'
              ];
              const index = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
              const color = colors[index % colors.length];
              
              db.run('INSERT OR IGNORE INTO tags (name, color, user_id, version_id) VALUES (?, ?, ?, ?)', [tag, color, req.user.userId, version.id], function(err) {
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
                db.get('SELECT id FROM tags WHERE name = ? AND user_id = ? AND version_id = ?', [tag, req.user.userId, version.id], (err, row) => {
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
});

// Update expense entry
app.put('/api/expenses/:id', authenticateToken, (req, res) => {
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
      'UPDATE expenses SET description = ?, amount = ?, frequency = ?, nextDue = ?, applyFuzziness = ?, notes = ?, accountId = ? WHERE id = ? AND user_id = ?',
      [description, amount, frequency, nextDue, applyFuzziness ? 1 : 0, notes || null, accountId || null, id, req.user.userId],
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
              db.get('SELECT id FROM tags WHERE name = ? AND user_id = ?', [tagName, req.user.userId], (err, row) => {
                if (err) {
                  callback(err);
                  return;
                }
                if (row) {
                  callback(null, row.id);
                } else {
                  // Generate a consistent color for the tag
                  const colors = [
                    '#1976d2', '#9c27b0', '#2e7d32', '#f57c00', '#c2185b', '#00838f', '#7b1fa2', '#d32f2f', '#5d4037', '#455a64',
                    '#388e3c', '#fbc02d', '#0288d1', '#e64a19', '#6d4c41', '#512da8', '#0097a7', '#afb42b', '#f06292', '#8d6e63',
                    '#00bcd4', '#ffb300', '#43a047', '#e53935', '#8e24aa'
                  ];
                  const index = tagName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                  const color = colors[index % colors.length];
                  
                  db.run('INSERT INTO tags (name, color, user_id) VALUES (?, ?, ?)', [tagName, color, req.user.userId], function(err) {
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
app.delete('/api/expenses/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM expenses WHERE id = ? AND user_id = ?', [id, req.user.userId], function(err) {
    if (err) {
      console.error('Error deleting expense:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ changes: this.changes });
  });
});

// Settings endpoints
app.get('/api/settings', authenticateToken, (req, res) => {
  db.all(`
    SELECT s.* FROM settings s
    JOIN budget_versions bv ON s.version_id = bv.id
    WHERE s.user_id = ? AND bv.is_active = 1
  `, [req.user.userId], (err, rows) => {
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
      frequency: 'monthly',
      showPlanningPage: true,
      showSchedulePage: true,
      showAccountsPage: true
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
app.get('/api/settings/frequency', authenticateToken, (req, res) => {
  db.get(`
    SELECT s.value FROM settings s
    JOIN budget_versions bv ON s.version_id = bv.id
    WHERE s.key = ? AND s.user_id = ? AND bv.is_active = 1
  `, ['frequency', req.user.userId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ frequency: row ? row.value : 'monthly' });
  });
});

// Update frequency setting
app.post('/api/settings/frequency', authenticateToken, (req, res) => {
  const { frequency } = req.body;
  
  // Get the active version ID
  db.get('SELECT id FROM budget_versions WHERE user_id = ? AND is_active = 1', [req.user.userId], (err, version) => {
    if (err) {
      console.error('Error getting active version:', err);
      return res.status(500).json({ error: err.message });
    }

    if (!version) {
      return res.status(400).json({ error: 'No active version found. Please create a version first.' });
    }

    db.run(
      'INSERT OR REPLACE INTO settings (user_id, version_id, key, value) VALUES (?, ?, ?, ?)',
      [req.user.userId, version.id, 'frequency', frequency],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ frequency });
      }
    );
  });
});

app.put('/api/settings', authenticateToken, (req, res) => {
  const settings = req.body;
  
  // Get the active version ID
  db.get('SELECT id FROM budget_versions WHERE user_id = ? AND is_active = 1', [req.user.userId], (err, version) => {
    if (err) {
      console.error('Error getting active version:', err);
      return res.status(500).json({ error: err.message });
    }

    if (!version) {
      return res.status(400).json({ error: 'No active version found. Please create a version first.' });
    }

    // Convert settings object to array of key-value pairs
    const settingsArray = Object.entries(settings).map(([key, value]) => ({
      key,
      value: JSON.stringify(value)
    }));

    // Use a transaction to update all settings
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const stmt = db.prepare('INSERT OR REPLACE INTO settings (user_id, version_id, key, value) VALUES (?, ?, ?, ?)');
      
      settingsArray.forEach(({ key, value }) => {
        stmt.run(req.user.userId, version.id, key, value);
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
});

// Accounts API endpoints
app.get('/api/accounts', authenticateToken, (req, res) => {
  db.all(`
    SELECT a.* FROM accounts a
    JOIN budget_versions bv ON a.version_id = bv.id
    WHERE a.user_id = ? AND bv.is_active = 1
  `, [req.user.userId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/accounts', authenticateToken, (req, res) => {
  const { name, bank, currentBalance, requiredBalance, isPrimary, diff } = req.body;
  
  if (!name || !bank || currentBalance === undefined || requiredBalance === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Get the active version ID
  db.get('SELECT id FROM budget_versions WHERE user_id = ? AND is_active = 1', [req.user.userId], (err, version) => {
    if (err) {
      console.error('Error getting active version:', err);
      return res.status(500).json({ error: err.message });
    }

    if (!version) {
      return res.status(400).json({ error: 'No active version found. Please create a version first.' });
    }

    db.run(
      'INSERT INTO accounts (user_id, version_id, name, bank, currentBalance, requiredBalance, isPrimary, diff) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.userId, version.id, name, bank, currentBalance, requiredBalance, isPrimary ? 1 : 0, diff || 0],
      function(err) {
        if (err) {
          console.error('Error adding account:', err);
          return res.status(500).json({ error: 'Error adding account' });
        }
        res.json({ id: this.lastID });
      }
    );
  });
});

app.put('/api/accounts/:id', authenticateToken, (req, res) => {
  const { name, bank, currentBalance, requiredBalance, isPrimary, diff } = req.body;
  const id = req.params.id;

  if (!name || !bank || currentBalance === undefined || requiredBalance === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  db.run(`
    UPDATE accounts SET name = ?, bank = ?, currentBalance = ?, requiredBalance = ?, isPrimary = ?, diff = ? 
    WHERE id = ? AND user_id = ? AND version_id IN (
      SELECT id FROM budget_versions WHERE user_id = ? AND is_active = 1
    )
  `, [name, bank, currentBalance, requiredBalance, isPrimary ? 1 : 0, diff || 0, id, req.user.userId, req.user.userId],
  function(err) {
    if (err) {
      console.error('Error updating account:', err);
      return res.status(500).json({ error: 'Error updating account' });
    }
    res.json({ message: 'Account updated successfully' });
  });
});

app.delete('/api/accounts/:id', authenticateToken, (req, res) => {
  db.run(`
    DELETE FROM accounts 
    WHERE id = ? AND user_id = ? AND version_id IN (
      SELECT id FROM budget_versions WHERE user_id = ? AND is_active = 1
    )
  `, [req.params.id, req.user.userId, req.user.userId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Account deleted' });
  });
});

// Get all tags
app.get('/api/tags', authenticateToken, (req, res) => {
  db.all(`
    SELECT t.name, t.color FROM tags t
    JOIN budget_versions bv ON t.version_id = bv.id
    WHERE t.user_id = ? AND bv.is_active = 1
    ORDER BY t.name
  `, [req.user.userId], (err, rows) => {
    if (err) {
      console.error('Error fetching tags:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows.map(row => ({ name: row.name, color: row.color })));
  });
});

// Add new tag
app.post('/api/tags', authenticateToken, (req, res) => {
  const { name, color } = req.body;
  
  if (!name) {
    res.status(400).json({ error: 'Tag name is required' });
    return;
  }

  // Get the active version ID
  db.get('SELECT id FROM budget_versions WHERE user_id = ? AND is_active = 1', [req.user.userId], (err, version) => {
    if (err) {
      console.error('Error getting active version:', err);
      return res.status(500).json({ error: err.message });
    }

    if (!version) {
      return res.status(400).json({ error: 'No active version found. Please create a version first.' });
    }

    db.run('INSERT OR IGNORE INTO tags (name, color, user_id, version_id) VALUES (?, ?, ?, ?)', [name, color || null, req.user.userId, version.id], function(err) {
      if (err) {
        console.error('Error adding tag:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID });
    });
  });
});

// Update tag
app.put('/api/tags/:name', authenticateToken, (req, res) => {
  const { name: newName, color } = req.body;
  const { name: oldName } = req.params;
  
  if (!newName) {
    res.status(400).json({ error: 'Tag name is required' });
    return;
  }

  db.run(`
    UPDATE tags SET name = ?, color = ? 
    WHERE name = ? AND user_id = ? AND version_id IN (
      SELECT id FROM budget_versions WHERE user_id = ? AND is_active = 1
    )
  `, [newName, color || null, oldName, req.user.userId, req.user.userId],
  function(err) {
    if (err) {
      console.error('Error updating tag:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }
    res.json({ message: 'Tag updated successfully' });
  });
});

// Delete tag
app.delete('/api/tags/:name', authenticateToken, (req, res) => {
  const { name } = req.params;

  db.run(`
    DELETE FROM tags 
    WHERE name = ? AND user_id = ? AND version_id IN (
      SELECT id FROM budget_versions WHERE user_id = ? AND is_active = 1
    )
  `, [name, req.user.userId, req.user.userId], function(err) {
    if (err) {
      console.error('Error deleting tag:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }
    res.json({ message: 'Tag deleted successfully' });
  });
});

// Get all users (admin only)
app.get('/api/auth/users', authenticateToken, requireAdmin, (req, res) => {
  db.all('SELECT id, name, email, admin FROM users', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Update user admin status (admin only)
app.put('/api/auth/users/:id/admin', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { admin } = req.body;
  if (typeof admin !== 'boolean' && admin !== 0 && admin !== 1) {
    return res.status(400).json({ error: 'Invalid admin value' });
  }
  db.run('UPDATE users SET admin = ? WHERE id = ?', [admin ? 1 : 0, id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User admin status updated', changes: this.changes });
  });
});

// Debug endpoint to check user admin status
app.get('/api/debug/users', (req, res) => {
  db.all('SELECT id, name, email, admin FROM users', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Health check endpoint for Docker
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Catch-all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  
  res.sendFile(path.join(__dirname, '../public/index.html'));
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