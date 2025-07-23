const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('budget.db');

function addColumnIfNotExists(table, column, type, next) {
  db.all(`PRAGMA table_info(${table})`, (err, columns) => {
    if (err) throw err;
    const exists = columns.some(col => col.name === column);
    if (!exists) {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`, err => {
        if (err) throw err;
        console.log(`Added column ${column} to ${table}`);
        next();
      });
    } else {
      console.log(`Column ${column} already exists in ${table}`);
      next();
    }
  });
}

function runMigrations() {
  addColumnIfNotExists('forecast_settings', 'past_months', 'INTEGER', () => {
    addColumnIfNotExists('forecast_settings', 'future_months', 'INTEGER', () => {
      addColumnIfNotExists('forecast_settings', 'frequency', 'TEXT', () => {
        addColumnIfNotExists('forecast_settings', 'disbursement_day', 'INTEGER', () => {
          db.close();
        });
      });
    });
  });
}

runMigrations(); 