import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const SELECT = `
  SELECT s.*, u.name AS created_by_name, p.quantity AS current_stock
  FROM shortages s
  LEFT JOIN users u ON u.id = s.created_by
  LEFT JOIN products p ON p.id = s.product_id
`;

// GET /api/shortages?status=&priority=&search=
router.get('/', (req, res) => {
  const { status, priority, search } = req.query;
  const where = [];
  const params = [];
  if (status) { where.push('s.status = ?'); params.push(status); }
  if (priority) { where.push('s.priority = ?'); params.push(priority); }
  if (search) { where.push('s.product_name LIKE ?'); params.push(`%${search}%`); }

  let sql = SELECT;
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ` ORDER BY
    CASE s.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
    s.created_at DESC`;
  res.json(db.prepare(sql).all(...params));
});

// POST /api/shortages
router.post('/', (req, res) => {
  let { product_id, product_name, quantity, note, priority = 'normal', status = 'pending' } = req.body || {};

  // If linked to a product, default the name from it.
  if (product_id && !product_name) {
    product_name = db.prepare('SELECT name FROM products WHERE id = ?').get(product_id)?.name;
  }
  if (!product_name) return res.status(400).json({ error: 'Product name is required' });

  const info = db.prepare(`
    INSERT INTO shortages (product_id, product_name, quantity, note, priority, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(product_id || null, product_name.trim(), Number(quantity) || 1, note ?? null, priority, status, req.user.id);

  res.status(201).json(db.prepare(SELECT + ' WHERE s.id = ?').get(info.lastInsertRowid));
});

// PUT /api/shortages/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM shortages WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Shortage not found' });

  const { product_id, product_name, quantity, note, priority, status } = req.body || {};
  db.prepare(`
    UPDATE shortages SET
      product_id = ?, product_name = ?, quantity = ?, note = ?, priority = ?, status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    product_id === undefined ? existing.product_id : product_id || null,
    product_name ?? existing.product_name,
    quantity === undefined ? existing.quantity : Number(quantity),
    note ?? existing.note,
    priority ?? existing.priority,
    status ?? existing.status,
    req.params.id
  );

  res.json(db.prepare(SELECT + ' WHERE s.id = ?').get(req.params.id));
});

// DELETE /api/shortages/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM shortages WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Shortage not found' });
  res.json({ success: true });
});

export default router;
