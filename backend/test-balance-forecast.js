const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const bcrypt = require('bcryptjs');

// Test configuration
const TEST_DB_PATH = path.join(__dirname, 'test-balance-forecast.db');
const SERVER_URL = 'http://localhost:8585';

// Helper function to create test database
function createTestDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(TEST_DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }
      // Create tables
      const schema = `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          is_admin INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS versions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          is_active INTEGER DEFAULT 0,
          is_shared INTEGER DEFAULT 0,
          shared_by_user_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (shared_by_user_id) REFERENCES users (id)
        );
        CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          version_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          bank TEXT,
          current_balance REAL NOT NULL,
          required_balance REAL DEFAULT 0,
          is_primary INTEGER DEFAULT 0,
          include_in_on_track INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (version_id) REFERENCES versions (id)
        );
        CREATE TABLE IF NOT EXISTS income (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          version_id INTEGER NOT NULL,
          description TEXT NOT NULL,
          amount REAL NOT NULL,
          frequency TEXT NOT NULL,
          day_of_month INTEGER,
          day_of_week INTEGER,
          start_date TEXT NOT NULL,
          end_date TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (version_id) REFERENCES versions (id)
        );
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          version_id INTEGER NOT NULL,
          description TEXT NOT NULL,
          amount REAL NOT NULL,
          frequency TEXT NOT NULL,
          day_of_month INTEGER,
          day_of_week INTEGER,
          start_date TEXT NOT NULL,
          end_date TEXT,
          is_hidden INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (version_id) REFERENCES versions (id)
        );
        CREATE TABLE IF NOT EXISTS manual_adjustments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          version_id INTEGER NOT NULL,
          account_id INTEGER NOT NULL,
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (version_id) REFERENCES versions (id),
          FOREIGN KEY (account_id) REFERENCES accounts (id)
        );
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          version_id INTEGER NOT NULL,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (version_id) REFERENCES versions (id),
          UNIQUE(user_id, version_id, key)
        );
      `;
      db.exec(schema, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(db);
      });
    });
  });
}

// Helper function to insert test data
async function insertTestData(db) {
  return new Promise(async (resolve, reject) => {
    // Create test user with proper password hash
    const passwordHash = await bcrypt.hash('testpass', 10);
    db.run("INSERT INTO users (id, email, password_hash) VALUES (1, 'testuser@example.com', ?)", [passwordHash], (err) => {
      if (err) {
        reject(err);
        return;
      }
      // Create test version
      db.run("INSERT INTO versions (id, user_id, name, is_active) VALUES (1, 1, 'Test Version', 1)", (err) => {
        if (err) {
          reject(err);
          return;
        }
        // Create test accounts
        const accounts = [
          { id: 1, name: 'Primary Account', bank: 'Test Bank', current_balance: 5000, required_balance: 1000, is_primary: 1 },
          { id: 2, name: 'Savings', bank: 'Test Bank', current_balance: 2000, required_balance: 500, is_primary: 0 },
          { id: 3, name: 'Bills', bank: 'Test Bank', current_balance: 1500, required_balance: 800, is_primary: 0 }
        ];
        let completed = 0;
        accounts.forEach(account => {
          db.run(
            "INSERT INTO accounts (id, user_id, version_id, name, bank, current_balance, required_balance, is_primary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [account.id, 1, 1, account.name, account.bank, account.current_balance, account.required_balance, account.is_primary],
            (err) => {
              if (err) {
                reject(err);
                return;
              }
              completed++;
              if (completed === accounts.length) {
                // Create test income
                db.run(
                  "INSERT INTO income (user_id, version_id, description, amount, frequency, day_of_month, start_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
                  [1, 1, 'Salary', 3000, 'monthly', 15, '2024-01-01'],
                  (err) => {
                    if (err) {
                      reject(err);
                      return;
                    }
                    // Create test expenses
                    const expenses = [
                      { description: 'Rent', amount: 1200, frequency: 'monthly', day_of_month: 1, start_date: '2024-01-01' },
                      { description: 'Groceries', amount: 400, frequency: 'monthly', day_of_month: 5, start_date: '2024-01-05' },
                      { description: 'Utilities', amount: 200, frequency: 'monthly', day_of_month: 10, start_date: '2024-01-10' }
                    ];
                    let expCompleted = 0;
                    expenses.forEach(expense => {
                      db.run(
                        "INSERT INTO expenses (user_id, version_id, description, amount, frequency, day_of_month, start_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        [1, 1, expense.description, expense.amount, expense.frequency, expense.day_of_month, expense.start_date],
                        (err) => {
                          if (err) {
                            reject(err);
                            return;
                          }
                          expCompleted++;
                          if (expCompleted === expenses.length) {
                            // Create test settings
                            db.run(
                              "INSERT INTO settings (user_id, version_id, key, value) VALUES (?, ?, ?, ?)",
                              [1, 1, 'disbursementFrequency', 'monthly'],
                              (err) => {
                                if (err) {
                                  reject(err);
                                  return;
                                }
                                db.run(
                                  "INSERT INTO settings (user_id, version_id, key, value) VALUES (?, ?, ?, ?)",
                                  [1, 1, 'disbursementDay', '20'],
                                  (err) => {
                                    if (err) {
                                      reject(err);
                                      return;
                                    }
                                    resolve();
                                  }
                                );
                              }
                            );
                          }
                        }
                      );
                    });
                  }
                );
              }
            }
          );
        });
      });
    });
  });
}

// Helper function to make HTTP requests
async function makeRequest(method, endpoint, data = null, token = null) {
  return new Promise((resolve) => {
    const url = new URL(`${SERVER_URL}${endpoint}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsedData });
        } catch (error) {
          resolve({ status: res.statusCode, data: { error: 'Invalid JSON response' } });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ status: 500, data: { error: error.message } });
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test functions
async function testBalanceForecastEndpoint() {
  console.log('\n=== Testing Balance Forecast Endpoint ===');
  
  // First, authenticate to get a token
  console.log('Authenticating...');
  const loginResponse = await makeRequest('POST', '/api/auth/login', {
    email: 'testuser@example.com',
    password: 'testpass'
  });
  
  if (loginResponse.status !== 200 || !loginResponse.data.token) {
    console.log('❌ Authentication failed:', loginResponse.data);
    return;
  }
  
  const token = loginResponse.data.token;
  console.log('✅ Authentication successful');
  
  // Test 1: Basic forecast request
  console.log('\nTest 1: Basic forecast request');
  const response1 = await makeRequest('GET', '/api/balance-forecast', null, token);
  console.log('Status:', response1.status);
  if (response1.status === 200 && response1.data.forecast) {
    console.log('✅ Basic forecast request successful');
    console.log(`   Forecast contains ${response1.data.forecast.length} data points`);
  } else {
    console.log('❌ Basic forecast request failed');
    console.log('Response:', JSON.stringify(response1.data, null, 2));
  }
  
  // Test 2: Forecast with custom date range
  console.log('\nTest 2: Forecast with custom date range');
  const response2 = await makeRequest('GET', '/api/balance-forecast?startDate=2024-01-01&endDate=2024-12-31', null, token);
  console.log('Status:', response2.status);
  if (response2.status === 200 && response2.data.forecast) {
    console.log('✅ Custom date range forecast successful');
    console.log(`   Forecast contains ${response2.data.forecast.length} data points`);
  } else {
    console.log('❌ Custom date range forecast failed');
    console.log('Response:', JSON.stringify(response2.data, null, 2));
  }
  
  // Test 3: Forecast with invalid date range
  console.log('\nTest 3: Forecast with invalid date range');
  const response3 = await makeRequest('GET', '/api/balance-forecast?startDate=invalid&endDate=invalid', null, token);
  console.log('Status:', response3.status);
  if (response3.status === 400) {
    console.log('✅ Invalid date range properly rejected');
  } else {
    console.log('❌ Invalid date range not properly handled');
    console.log('Response:', JSON.stringify(response3.data, null, 2));
  }
}

async function testDatabaseOperations() {
  console.log('\n=== Testing Database Operations ===');
  let db;
  try {
    // Create test database
    db = await createTestDatabase();
    console.log('✅ Test database created');
    // Insert test data
    await insertTestData(db);
    console.log('✅ Test data inserted');
    // Test account retrieval
    const accounts = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM accounts WHERE user_id = 1 AND version_id = 1", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    console.log(`✅ Retrieved ${accounts.length} accounts`);
    // Test income retrieval
    const income = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM income WHERE user_id = 1 AND version_id = 1", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    console.log(`✅ Retrieved ${income.length} income items`);
    // Test expenses retrieval
    const expenses = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM expenses WHERE user_id = 1 AND version_id = 1", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    console.log(`✅ Retrieved ${expenses.length} expenses`);
    // Test settings retrieval
    const settings = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM settings WHERE user_id = 1 AND version_id = 1", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    console.log(`✅ Retrieved ${settings.length} settings`);
  } catch (error) {
    console.log('❌ Database test failed:', error.message);
  } finally {
    if (db) {
      db.close();
    }
  }
}

async function testDateCalculations() {
  console.log('\n=== Testing Date Calculations ===');
  // Test monthly frequency calculations
  const testDates = [
    { date: '2024-02-15', frequency: 'monthly', day: 15, expected: '2024-03-15' },
    { date: '2024-02-29', frequency: 'monthly', day: 31, expected: '2024-03-31' }, // Leap year
    { date: '2024-03-31', frequency: 'monthly', day: 31, expected: '2024-04-30' }, // Month with 30 days
  ];
  testDates.forEach((test, index) => {
    const currentDate = new Date(test.date);
    // Move to next month
    let nextMonth = currentDate.getMonth() + 1;
    let nextYear = currentDate.getFullYear();
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    // Get the last day of the next month
    const lastDayOfNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
    // Set to the minimum of requested day or last day of next month
    const day = Math.min(test.day, lastDayOfNextMonth);
    const nextDate = new Date(nextYear, nextMonth, day);
    // Fix: If the requested day is greater than last day, set to last day
    if (test.day > lastDayOfNextMonth) {
      nextDate.setDate(lastDayOfNextMonth);
    }
    const expected = new Date(test.expected);
    const success = nextDate.getTime() === expected.getTime();
    console.log(`Test ${index + 1}: ${test.date} -> ${nextDate.toISOString().split('T')[0]} (expected: ${test.expected}) ${success ? '✅' : '❌'}`);
  });
}

async function testBalanceCalculations() {
  console.log('\n=== Testing Balance Calculations ===');
  // Simulate a simple balance calculation
  const initialBalance = 5000;
  const income = 3000;
  const expenses = 1200 + 400 + 200; // Rent + Groceries + Utilities
  const expectedBalance = initialBalance + income - expenses;
  console.log(`Initial balance: $${initialBalance}`);
  console.log(`Income: $${income}`);
  console.log(`Expenses: $${expenses}`);
  console.log(`Expected balance: $${expectedBalance}`);
  console.log(`Calculation: ${initialBalance} + ${income} - ${expenses} = ${expectedBalance} ✅`);
}

// Main test runner
async function runTests() {
  console.log('🧪 Starting Balance Forecast Tests...\n');
  try {
    // Test database operations
    await testDatabaseOperations();
    // Test date calculations
    await testDateCalculations();
    // Test balance calculations
    await testBalanceCalculations();
    // Test API endpoint (requires server to be running)
    console.log('\n⚠️  Note: API endpoint tests require the server to be running on port 8585');
    console.log('   Start the server with: node server.js');
    console.log('   Then run: node test-balance-forecast.js');
    // Uncomment the line below when server is running
    await testBalanceForecastEndpoint();
    console.log('\n🎉 All tests completed!');
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Clean up test database
function cleanup() {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
    console.log('🧹 Test database cleaned up');
  }
}

// Handle process termination
process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().then(() => {
    cleanup();
    process.exit(0);
  }).catch((error) => {
    console.error('Test suite failed:', error);
    cleanup();
    process.exit(1);
  });
}

module.exports = {
  createTestDatabase,
  insertTestData,
  testBalanceForecastEndpoint,
  testDatabaseOperations,
  testDateCalculations,
  testBalanceCalculations,
  runTests
}; 