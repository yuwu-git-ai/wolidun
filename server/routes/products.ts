import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db';
import { requireAdmin } from '../middleware/auth';

const router = Router();

router.post('/admin/verify', (req: Request, res: Response) => {
  const adminKey = req.headers['x-admin-key'] as string;
  const expectedKey = process.env.ADMIN_KEY || 'admin123';

  if (!adminKey || adminKey !== expectedKey) {
    res.status(403).json({ error: '管理员密钥错误' });
    return;
  }
  res.json({ success: true });
});

function serializeProduct(p: any) {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    category: p.category,
    description: p.description || '',
    image: p.image || '',
    stock: p.stock,
    allowBrewing: p.allow_brewing === 1 || p.allow_brewing === true,
    allowFreezing: p.allow_freezing === 1 || p.allow_freezing === true,
  };
}

router.get('/products', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM products ORDER BY price ASC').all();
  res.json(rows.map(serializeProduct));
});

router.post('/products', requireAdmin, (req: Request, res: Response) => {
  const { name, price, category, description, image, stock, allowBrewing, allowFreezing } = req.body;

  if (!name || price == null || !category) {
    res.status(400).json({ error: '请填写商品名称、价格和分类' });
    return;
  }

  const db = getDb();
  const id = uuid();

  db.prepare(`
    INSERT INTO products (id, name, price, category, description, image, stock, allow_brewing, allow_freezing)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, name, price, category,
    description || '', image || '', stock ?? 999,
    allowBrewing ? 1 : 0, allowFreezing ? 1 : 0
  );

  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  res.json(serializeProduct(row));
});

router.put('/products/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, price, category, description, image, stock, allowBrewing, allowFreezing } = req.body;

  const db = getDb();
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: '商品不存在' });
    return;
  }

  db.prepare(`
    UPDATE products SET name=?, price=?, category=?, description=?, image=?, stock=?, allow_brewing=?, allow_freezing=?
    WHERE id=?
  `).run(
    name ?? existing.name, price ?? existing.price,
    category ?? existing.category,
    description ?? existing.description, image ?? existing.image,
    stock ?? existing.stock,
    allowBrewing !== undefined ? (allowBrewing ? 1 : 0) : existing.allow_brewing,
    allowFreezing !== undefined ? (allowFreezing ? 1 : 0) : existing.allow_freezing,
    id
  );

  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  res.json(serializeProduct(row));
});

router.delete('/products/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;

  const db = getDb();
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: '商品不存在' });
    return;
  }

  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
