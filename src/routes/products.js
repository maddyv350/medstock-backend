import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const SELECT_WITH_CATEGORY = `
  SELECT p.*, c.name AS category_name
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
`;

// GET /api/products?search=&category=&status=&sort=&order=
// status: 'low' (qty <= reorder_level) | 'out' (qty = 0) | 'expiring' (within 60 days)
router.get('/', (req, res) => {
  const { search, category, status, sort = 'name', order = 'asc' } = req.query;
  const where = [];
  const params = [];

  if (search) {
    where.push('(p.name LIKE ? OR p.manufacturer LIKE ? OR p.batch_number LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (category) {
    where.push('p.category_id = ?');
    params.push(category);
  }
  if (status === 'low') where.push('p.quantity <= p.reorder_level AND p.quantity > 0');
  if (status === 'out') where.push('p.quantity = 0');
  if (status === 'expiring') where.push("p.expiry_date IS NOT NULL AND date(p.expiry_date) <= date('now', '+60 days')");

  const sortCols = { name: 'p.name', quantity: 'p.quantity', expiry: 'p.expiry_date', price: 'p.price', created: 'p.created_at' };
  const sortCol = sortCols[sort] || 'p.name';
  const dir = order === 'desc' ? 'DESC' : 'ASC';

  let sql = SELECT_WITH_CATEGORY;
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ` ORDER BY ${sortCol} ${dir}`;

  res.json(db.prepare(sql).all(...params));
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const product = db.prepare(SELECT_WITH_CATEGORY + ' WHERE p.id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

function parseProductBody(body = {}) {
  return {
    name: body.name?.trim(),
    category_id: body.category_id || null,
    manufacturer: body.manufacturer ?? null,
    batch_number: body.batch_number ?? null,
    description: body.description ?? null,
    unit: body.unit || 'unit',
    quantity: Number.isFinite(+body.quantity) ? +body.quantity : 0,
    reorder_level: Number.isFinite(+body.reorder_level) ? +body.reorder_level : 10,
    price: Number.isFinite(+body.price) ? +body.price : 0,
    mrp: Number.isFinite(+body.mrp) ? +body.mrp : 0,
    expiry_date: body.expiry_date || null,
  };
}

// POST /api/products
router.post('/', (req, res) => {
  const p = parseProductBody(req.body);
  if (!p.name) return res.status(400).json({ error: 'Name is required' });

  const info = db.prepare(`
    INSERT INTO products
      (name, category_id, manufacturer, batch_number, description, unit, quantity, reorder_level, price, mrp, expiry_date)
    VALUES (@name, @category_id, @manufacturer, @batch_number, @description, @unit, @quantity, @reorder_level, @price, @mrp, @expiry_date)
  `).run(p);

  const product = db.prepare(SELECT_WITH_CATEGORY + ' WHERE p.id = ?').get(info.lastInsertRowid);
  res.status(201).json(product);
});

// PUT /api/products/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const p = parseProductBody(req.body);
  if (!p.name) return res.status(400).json({ error: 'Name is required' });

  db.prepare(`
    UPDATE products SET
      name = @name, category_id = @category_id, manufacturer = @manufacturer,
      batch_number = @batch_number, description = @description, unit = @unit,
      quantity = @quantity, reorder_level = @reorder_level, price = @price,
      mrp = @mrp, expiry_date = @expiry_date, updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...p, id: req.params.id });

  const product = db.prepare(SELECT_WITH_CATEGORY + ' WHERE p.id = ?').get(req.params.id);
  res.json(product);
});

// PATCH /api/products/:id/stock  — quick stock adjustment (+/-)
router.patch('/:id/stock', (req, res) => {
  const { delta } = req.body || {};
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const newQty = Math.max(0, product.quantity + Number(delta || 0));
  db.prepare(`UPDATE products SET quantity = ?, updated_at = datetime('now') WHERE id = ?`).run(newQty, req.params.id);
  res.json(db.prepare(SELECT_WITH_CATEGORY + ' WHERE p.id = ?').get(req.params.id));
});

// DELETE /api/products/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Product not found' });
  res.json({ success: true });
});

export default router;
