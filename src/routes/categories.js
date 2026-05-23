import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/categories  — includes a product count per category
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, COUNT(p.id) AS product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name COLLATE NOCASE
  `).all();
  res.json(rows);
});

// POST /api/categories
router.post('/', (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const exists = db.prepare('SELECT id FROM categories WHERE name = ?').get(name.trim());
  if (exists) return res.status(409).json({ error: 'Category already exists' });

  const info = db
    .prepare('INSERT INTO categories (name, description) VALUES (?, ?)')
    .run(name.trim(), description ?? null);
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(cat);
});

// PUT /api/categories/:id
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Category not found' });

  const { name, description } = req.body || {};
  db.prepare(`UPDATE categories SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(name ?? existing.name, description ?? existing.description, id);

  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  res.json(cat);
});

// DELETE /api/categories/:id  — products keep existing with category_id set NULL
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Category not found' });
  res.json({ success: true });
});

export default router;
