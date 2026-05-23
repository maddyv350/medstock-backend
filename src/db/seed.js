import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import db, { initSchema } from './index.js';

/**
 * Seed the database with an admin account, a staff account, some categories,
 * a catalogue of common medicines and a few shortage records.
 *
 * Safe to re-run: it only inserts rows that don't already exist.
 */
export function seed() {
  initSchema();

  // --- Users ---------------------------------------------------------------
  const adminPass = bcrypt.hashSync('admin123', 10);
  const staffPass = bcrypt.hashSync('staff123', 10);

  const insertUser = db.prepare(
    `INSERT OR IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`
  );
  insertUser.run('Store Admin', 'admin@medical.com', adminPass, 'admin');
  insertUser.run('Counter Staff', 'staff@medical.com', staffPass, 'staff');

  // --- Categories ----------------------------------------------------------
  const categories = [
    ['Tablets', 'Oral tablets and pills'],
    ['Syrups', 'Liquid oral medicines'],
    ['Injections', 'Injectable medicines and vials'],
    ['Capsules', 'Hard and soft gel capsules'],
    ['Ointments', 'Topical creams, gels and ointments'],
    ['Drops', 'Eye, ear and nasal drops'],
    ['Surgical', 'Surgical and first-aid supplies'],
    ['Supplements', 'Vitamins and nutritional supplements'],
  ];
  const insertCat = db.prepare(
    `INSERT OR IGNORE INTO categories (name, description) VALUES (?, ?)`
  );
  categories.forEach((c) => insertCat.run(...c));

  const catId = (name) =>
    db.prepare('SELECT id FROM categories WHERE name = ?').get(name)?.id;

  // --- Products ------------------------------------------------------------
  // [name, category, manufacturer, batch, unit, qty, reorder, price, mrp, expiry]
  const products = [
    ['Paracetamol 500mg', 'Tablets', 'Cipla', 'PCM500-A12', 'strip', 240, 50, 18, 25, '2027-03-01'],
    ['Amoxicillin 250mg', 'Capsules', 'Sun Pharma', 'AMX250-B07', 'strip', 8, 30, 42, 60, '2026-11-15'],
    ['Cetirizine 10mg', 'Tablets', 'Dr Reddy', 'CTZ10-C03', 'strip', 130, 40, 12, 20, '2027-06-20'],
    ['Cough Syrup (Benadryl)', 'Syrups', 'Johnson & Johnson', 'BND-S21', 'bottle', 35, 20, 85, 120, '2026-09-10'],
    ['Insulin Glargine', 'Injections', 'Novo Nordisk', 'INS-G44', 'vial', 5, 15, 320, 450, '2026-08-01'],
    ['Omeprazole 20mg', 'Capsules', 'Cipla', 'OMP20-D18', 'strip', 90, 30, 28, 45, '2027-01-25'],
    ['ORS Powder', 'Supplements', 'FDC Ltd', 'ORS-E09', 'sachet', 300, 60, 8, 12, '2027-12-01'],
    ['Betadine Ointment', 'Ointments', 'Win-Medicare', 'BET-F02', 'tube', 22, 15, 65, 95, '2026-10-30'],
    ['Moxifloxacin Eye Drops', 'Drops', 'Cipla', 'MOX-G15', 'bottle', 3, 10, 110, 160, '2026-07-18'],
    ['Surgical Gloves (M)', 'Surgical', 'VWR', 'GLV-M77', 'box', 18, 10, 220, 300, '2028-01-01'],
    ['Vitamin C 1000mg', 'Supplements', 'HealthKart', 'VTC-H31', 'bottle', 60, 20, 180, 250, '2027-04-12'],
    ['Azithromycin 500mg', 'Tablets', 'Alkem', 'AZT500-J05', 'strip', 14, 25, 65, 95, '2026-12-05'],
    ['Diclofenac Gel', 'Ointments', 'Novartis', 'DIC-K22', 'tube', 40, 15, 75, 110, '2027-02-28'],
    ['Metformin 500mg', 'Tablets', 'USV', 'MET500-L08', 'strip', 110, 40, 22, 35, '2027-08-19'],
    ['Saline Nasal Drops', 'Drops', 'Cipla', 'SAL-M14', 'bottle', 6, 12, 30, 45, '2026-06-30'],
  ];

  const insertProd = db.prepare(`
    INSERT INTO products
      (name, category_id, manufacturer, batch_number, unit, quantity, reorder_level, price, mrp, expiry_date)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = ? AND batch_number = ?)
  `);
  products.forEach((p) => {
    const [name, cat, mfr, batch, unit, qty, reorder, price, mrp, expiry] = p;
    insertProd.run(name, catId(cat), mfr, batch, unit, qty, reorder, price, mrp, expiry, name, batch);
  });

  // --- Shortages -----------------------------------------------------------
  const adminId = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@medical.com')?.id;
  const prodId = (name) => db.prepare('SELECT id FROM products WHERE name = ?').get(name)?.id;

  const shortages = [
    [prodId('Amoxicillin 250mg'), 'Amoxicillin 250mg', 50, 'Running low, fast moving', 'high', 'pending'],
    [prodId('Insulin Glargine'), 'Insulin Glargine', 20, 'Cold-chain item, order ASAP', 'high', 'ordered'],
    [prodId('Moxifloxacin Eye Drops'), 'Moxifloxacin Eye Drops', 15, 'Below reorder level', 'normal', 'pending'],
    [null, 'Pedialyte Electrolyte', 12, 'Requested by customer, not in catalogue', 'low', 'pending'],
  ];
  const insertShort = db.prepare(`
    INSERT INTO shortages (product_id, product_name, quantity, note, priority, status, created_by)
    SELECT ?, ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM shortages WHERE product_name = ? AND status != 'resolved')
  `);
  shortages.forEach((s) => insertShort.run(...s, adminId, s[1]));

  console.log('✅ Seed complete.');
  console.log('   Admin login: admin@medical.com / admin123');
  console.log('   Staff login: staff@medical.com / staff123');
}

/**
 * Seed only if the database has no users yet. Called on server boot so a fresh
 * deploy (or an ephemeral filesystem) always has a working admin login, while
 * an existing database with real data is left untouched.
 */
export function seedIfEmpty() {
  initSchema();
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (n === 0) {
    console.log('No users found — seeding initial data…');
    seed();
  }
}

// Run the full seed when executed directly: `node src/db/seed.js`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed();
}
