import { Router } from 'express';
import db from '../db/index.js';

// Read-only endpoints consumed by the customer-facing Flutter app.
// No authentication: these expose only catalogue & availability info.
const router = Router();

// GET /api/public/categories
router.get('/categories', (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.name, c.description, COUNT(p.id) AS product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name COLLATE NOCASE
  `).all();
  res.json(rows);
});

// GET /api/public/products?search=&category=
// Exposes availability (in stock / low / out) without internal cost price.
router.get('/products', (req, res) => {
  const { search, category } = req.query;
  const where = [];
  const params = [];
  if (search) {
    where.push('(p.name LIKE ? OR p.manufacturer LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) { where.push('p.category_id = ?'); params.push(category); }

  let sql = `
    SELECT p.id, p.name, p.manufacturer, p.unit, p.mrp, p.quantity,
           p.reorder_level, p.expiry_date, p.description, c.name AS category_name,
           CASE
             WHEN p.quantity = 0 THEN 'out'
             WHEN p.quantity <= p.reorder_level THEN 'low'
             ELSE 'in'
           END AS availability
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
  `;
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY p.name COLLATE NOCASE';
  res.json(db.prepare(sql).all(...params));
});

// GET /api/public/products/:id
router.get('/products/:id', (req, res) => {
  const p = db.prepare(`
    SELECT p.id, p.name, p.manufacturer, p.unit, p.mrp, p.quantity,
           p.reorder_level, p.expiry_date, p.description, c.name AS category_name,
           CASE
             WHEN p.quantity = 0 THEN 'out'
             WHEN p.quantity <= p.reorder_level THEN 'low'
             ELSE 'in'
           END AS availability
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(p);
});

// GET /api/public/shortages  — items the store currently lacks (pending/ordered)
router.get('/shortages', (req, res) => {
  const rows = db.prepare(`
    SELECT id, product_name, quantity, priority, status, note, created_at
    FROM shortages
    WHERE status != 'resolved'
    ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, created_at DESC
  `).all();
  res.json(rows);
});

export default router;
