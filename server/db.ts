import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'ordering.db');

    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    runMigrations();
    initTables();
    seedDefaults();
  }
  return db;
}

function runMigrations() {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)`);
  const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null };
  const current = row.v ?? 0;

  if (current < 2) {
    db.pragma('foreign_keys = OFF');

    // Drop users table (no longer needed — no auth)
    db.exec(`DROP TABLE IF EXISTS users`);

    // Check whether old tables exist (fresh DB won't have them)
    const hasProducts = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='products'"
    ).get();
    const hasOrders = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='orders'"
    ).get();

    // Clean up any leftovers from a failed prior migration
    db.exec(`DROP TABLE IF EXISTS products_new`);
    db.exec(`DROP TABLE IF EXISTS orders_new`);

    if (hasProducts) {
      // Migrate products: remove variants column
      db.exec(`
        CREATE TABLE products_new (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL,
          category TEXT NOT NULL, description TEXT DEFAULT '', image TEXT DEFAULT '',
          stock INTEGER DEFAULT 999, allow_brewing INTEGER DEFAULT 0,
          allow_freezing INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO products_new (id, name, price, category, description, image, stock, allow_brewing, allow_freezing, created_at)
          SELECT id, name, price, category, description, image, stock, allow_brewing, allow_freezing, created_at FROM products;
        DROP TABLE products;
        ALTER TABLE products_new RENAME TO products;
      `);
    }

    if (hasOrders) {
      // Migrate orders: remove user_id FK, add nickname/dorm columns
      db.exec(`
        CREATE TABLE orders_new (
          id TEXT PRIMARY KEY, nickname TEXT NOT NULL, dorm TEXT NOT NULL,
          is_delivery INTEGER DEFAULT 0, items TEXT NOT NULL,
          total_price REAL NOT NULL, status TEXT DEFAULT 'pending',
          created_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO orders_new (id, nickname, dorm, is_delivery, items, total_price, status, created_at)
          SELECT o.id, COALESCE(o.nickname, ''), COALESCE(o.dorm, ''),
            o.is_delivery, o.items, o.total_price, o.status, o.created_at FROM orders o;
        DROP TABLE orders;
        ALTER TABLE orders_new RENAME TO orders;
      `);
    }

    db.pragma('foreign_keys = ON');
    db.prepare('INSERT INTO schema_version (version) VALUES (2)').run();
    console.log('[DB] Migrated to schema v2.');
  }

  if (current < 3) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        nickname TEXT UNIQUE NOT NULL,
        dorm TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
    db.prepare('INSERT INTO schema_version (version) VALUES (3)').run();
    console.log('[DB] Migrated to schema v3 (users table).');
  }
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT NOT NULL,
      description TEXT DEFAULT '',
      image TEXT DEFAULT '',
      stock INTEGER DEFAULT 999,
      allow_brewing INTEGER DEFAULT 0,
      allow_freezing INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      dorm TEXT NOT NULL,
      is_delivery INTEGER DEFAULT 0,
      items TEXT NOT NULL,
      total_price REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

const DEFAULT_PRODUCTS = [
  {
    id: 'p1',
    name: '招牌红烧肉套餐',
    price: 38,
    category: '1',
    description: '精选五花肉，慢火炖煮，口感软糯。',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop',
    stock: 999,
    allow_brewing: 0,
    allow_freezing: 0,
  },
  {
    id: 'p2',
    name: '秘制香辣鸡腿堡',
    price: 22,
    category: '2',
    description: '外酥里嫩，辣味过瘾。',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop',
    stock: 999,
    allow_brewing: 0,
    allow_freezing: 0,
  },
  {
    id: 'p3',
    name: '康师傅红烧牛肉面（帮泡）',
    price: 6,
    category: '1',
    description: '经典红烧牛肉面，帮你泡好送到手。',
    image: 'https://images.unsplash.com/photo-1612929904986-8e4ba5b8f9d1?w=400&h=300&fit=crop',
    stock: 999,
    allow_brewing: 1,
    allow_freezing: 0,
  },
  {
    id: 'p4',
    name: '可口可乐（冰镇）',
    price: 4,
    category: '4',
    description: '冰镇可口可乐，透心凉。',
    image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&h=300&fit=crop',
    stock: 999,
    allow_brewing: 0,
    allow_freezing: 1,
  },
  {
    id: 'p5',
    name: '草莓芝士蛋糕',
    price: 25,
    category: '5',
    description: '绵密芝士搭配新鲜草莓酱。',
    image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400&h=300&fit=crop',
    stock: 999,
    allow_brewing: 0,
    allow_freezing: 1,
  },
];

function seedDefaults() {
  const row = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  if (row.count === 0) {
    const stmt = db.prepare(
      'INSERT INTO products (id, name, price, category, description, image, stock, allow_brewing, allow_freezing) VALUES (@id, @name, @price, @category, @description, @image, @stock, @allow_brewing, @allow_freezing)'
    );
    const insertAll = db.transaction(() => {
      for (const p of DEFAULT_PRODUCTS) {
        stmt.run(p);
      }
    });
    insertAll();
    console.log('[DB] Seeded default products.');
  }
}
