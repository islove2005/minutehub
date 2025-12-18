const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create SQLite database
const dbPath = path.join(__dirname, '../minutehub.db');
const db = new sqlite3.Database(dbPath);

// Create tables
const createTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('super_admin', 'admin', 'secretary')),
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Forms table
      db.run(`CREATE TABLE IF NOT EXISTS forms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        created_by INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`);

      // Form fields table
      db.run(`CREATE TABLE IF NOT EXISTS form_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_id INTEGER NOT NULL,
        field_name TEXT NOT NULL,
        field_type TEXT NOT NULL CHECK(field_type IN ('text', 'textarea', 'rich_text', 'name', 'email', 'phone', 'datetime', 'signature', 'dropdown', 'section')),
        field_label TEXT NOT NULL,
        field_options TEXT,
        is_required BOOLEAN DEFAULT 0,
        field_order INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
      )`);

      // Form entries table
      db.run(`CREATE TABLE IF NOT EXISTS form_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_id INTEGER NOT NULL,
        submitted_by INTEGER NOT NULL,
        minute_title TEXT,
        entry_data TEXT NOT NULL,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (form_id) REFERENCES forms(id),
        FOREIGN KEY (submitted_by) REFERENCES users(id)
      )`);

      // Insert default admin user (password: 'password')
      db.run(`INSERT OR IGNORE INTO users (email, password, first_name, last_name, role) 
              VALUES ('admin@icgc.org', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Super', 'Admin', 'super_admin')`, 
              (err) => {
        if (err) {
          console.log('Admin user already exists or error:', err.message);
        } else {
          console.log('✅ Default admin user created');
        }
        resolve();
      });
    });
  });
};

// Mock pool interface for compatibility
const pool = {
  execute: (query, params = []) => {
    return new Promise((resolve, reject) => {
      // Convert MySQL syntax to SQLite
      let sqliteQuery = query
        .replace(/AUTO_INCREMENT/g, 'AUTOINCREMENT')
        .replace(/BOOLEAN/g, 'INTEGER')
        .replace(/JSON/g, 'TEXT')
        .replace(/TIMESTAMP/g, 'DATETIME')
        .replace(/CURRENT_TIMESTAMP/g, 'CURRENT_TIMESTAMP');

      if (query.toLowerCase().includes('select')) {
        db.all(sqliteQuery, params, (err, rows) => {
          if (err) reject(err);
          else resolve([rows]);
        });
      } else {
        db.run(sqliteQuery, params, function(err) {
          if (err) reject(err);
          else resolve([{ insertId: this.lastID, affectedRows: this.changes }]);
        });
      }
    });
  },
  getConnection: () => {
    return Promise.resolve({
      execute: pool.execute,
      beginTransaction: () => Promise.resolve(),
      commit: () => Promise.resolve(),
      rollback: () => Promise.resolve(),
      release: () => {}
    });
  }
};

const testConnection = async () => {
  try {
    await createTables();
    console.log('✅ SQLite database connected and initialized');
  } catch (error) {
    console.error('❌ SQLite database error:', error.message);
  }
};

module.exports = { pool, testConnection };