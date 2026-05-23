import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DATA_DIR lets a host (e.g. a Render persistent disk mounted at /var/data)
// point the SQLite file at durable storage. Falls back to a local ./data dir.
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'medical.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Create all tables if they do not exist yet.
 * Designed to be safe to run on every boot.
 */
export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      email       TEXT NOT NULL UNIQUE,
      password    TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'staff', -- 'admin' | 'staff'
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      manufacturer  TEXT,
      batch_number  TEXT,
      description   TEXT,
      unit          TEXT DEFAULT 'unit',      -- e.g. strip, bottle, box
      quantity      INTEGER NOT NULL DEFAULT 0,
      reorder_level INTEGER NOT NULL DEFAULT 10,
      price         REAL NOT NULL DEFAULT 0,  -- cost / selling price
      mrp           REAL NOT NULL DEFAULT 0,
      expiry_date   TEXT,                     -- ISO date string
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shortages (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
      product_name TEXT NOT NULL,             -- denormalized so free-text shortages work too
      quantity     INTEGER NOT NULL DEFAULT 1,
      note         TEXT,
      priority     TEXT NOT NULL DEFAULT 'normal', -- 'low' | 'normal' | 'high'
      status       TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'ordered' | 'resolved'
      created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_shortages_status ON shortages(status);
  `);
}

export default db;
