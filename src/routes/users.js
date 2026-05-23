import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// All user-management endpoints require an authenticated admin.
router.use(requireAuth, requireAdmin);

// GET /api/users
router.get('/', (req, res) => {
  const users = db
    .prepare('SELECT id, name, email, role, active, created_at, updated_at FROM users ORDER BY created_at DESC')
    .all();
  res.json(users);
});

// POST /api/users
router.post('/', (req, res) => {
  const { name, email, password, role = 'staff' } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (!['admin', 'staff'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or staff' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (exists) return res.status(409).json({ error: 'Email already in use' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
    .run(name.trim(), email.toLowerCase().trim(), hash, role);

  const user = db
    .prepare('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?')
    .get(info.lastInsertRowid);
  res.status(201).json(user);
});

// PUT /api/users/:id
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'User not found' });

  const { name, email, role, active, password } = req.body || {};

  if (email && email.toLowerCase().trim() !== existing.email) {
    const dupe = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (dupe) return res.status(409).json({ error: 'Email already in use' });
  }

  const hash = password ? bcrypt.hashSync(password, 10) : existing.password;

  db.prepare(`
    UPDATE users
    SET name = ?, email = ?, role = ?, active = ?, password = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ?? existing.name,
    (email ?? existing.email).toLowerCase().trim(),
    role ?? existing.role,
    active === undefined ? existing.active : active ? 1 : 0,
    hash,
    id
  );

  const user = db
    .prepare('SELECT id, name, email, role, active, created_at, updated_at FROM users WHERE id = ?')
    .get(id);
  res.json(user);
});

// DELETE /api/users/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  if (Number(id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true });
});

export default router;
