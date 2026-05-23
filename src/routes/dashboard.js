import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/dashboard/stats
router.get('/stats', (req, res) => {
  const totalProducts = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  const totalCategories = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
  const lowStock = db.prepare('SELECT COUNT(*) AS n FROM products WHERE quantity <= reorder_level AND quantity > 0').get().n;
  const outOfStock = db.prepare('SELECT COUNT(*) AS n FROM products WHERE quantity = 0').get().n;
  const expiringSoon = db.prepare("SELECT COUNT(*) AS n FROM products WHERE expiry_date IS NOT NULL AND date(expiry_date) <= date('now', '+60 days')").get().n;
  const pendingShortages = db.prepare("SELECT COUNT(*) AS n FROM shortages WHERE status = 'pending'").get().n;
  const inventoryValue = db.prepare('SELECT COALESCE(SUM(quantity * price), 0) AS v FROM products').get().v;
  const totalUsers = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;

  const lowStockItems = db.prepare(`
    SELECT p.id, p.name, p.quantity, p.reorder_level, p.unit, c.name AS category_name
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.quantity <= p.reorder_level
    ORDER BY p.quantity ASC LIMIT 8
  `).all();

  const expiringItems = db.prepare(`
    SELECT p.id, p.name, p.expiry_date, p.quantity, c.name AS category_name
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.expiry_date IS NOT NULL AND date(p.expiry_date) <= date('now', '+60 days')
    ORDER BY p.expiry_date ASC LIMIT 8
  `).all();

  const byCategory = db.prepare(`
    SELECT c.name, COUNT(p.id) AS count, COALESCE(SUM(p.quantity), 0) AS units
    FROM categories c LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id ORDER BY count DESC
  `).all();

  res.json({
    totals: {
      products: totalProducts,
      categories: totalCategories,
      lowStock,
      outOfStock,
      expiringSoon,
      pendingShortages,
      inventoryValue,
      users: totalUsers,
    },
    lowStockItems,
    expiringItems,
    byCategory,
  });
});

export default router;
