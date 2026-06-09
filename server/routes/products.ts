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

function loadVariants(productId: string) {
  const db = getDb();
  const rows = db.prepare('SELECT id, name, price, stock FROM product_variants WHERE product_id = ? ORDER BY name ASC').all(productId) as any[];
  return rows.map((v: any) => ({
    id: v.id,
    name: v.name,
    price: v.price ?? undefined,
    stock: v.stock,
  }));
}

function serializeProduct(p: any) {
  const variants = loadVariants(p.id);
  const computedStock = variants.length > 0 ? variants.reduce((sum, v) => sum + v.stock, 0) : p.stock;
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    category: p.category,
    description: p.description || '',
    image: p.image || '',
    stock: computedStock,
    allowBrewing: p.allow_brewing === 1 || p.allow_brewing === true,
    allowFreezing: p.allow_freezing === 1 || p.allow_freezing === true,
    isHot: p.is_hot === 1 || p.is_hot === true,
    variants,
  };
}

function upsertVariants(productId: string, variants: { name: string; price?: number; stock?: number }[]) {
  const db = getDb();
  // Delete existing variants for this product
  db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(productId);
  // Insert new variants
  const stmt = db.prepare(
    'INSERT INTO product_variants (id, product_id, name, price, stock) VALUES (?, ?, ?, ?, ?)'
  );
  for (const v of variants) {
    stmt.run(uuid(), productId, v.name, v.price ?? null, v.stock ?? 0);
  }
}

router.get('/products', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM products ORDER BY price ASC').all();
  res.json(rows.map(serializeProduct));
});

router.post('/products', requireAdmin, (req: Request, res: Response) => {
  const { name, price, category, description, image, stock, allowBrewing, allowFreezing, isHot, variants } = req.body;

  if (!name || price == null || !category) {
    res.status(400).json({ error: '请填写商品名称、价格和分类' });
    return;
  }

  const db = getDb();
  const id = uuid();

  db.prepare(`
    INSERT INTO products (id, name, price, category, description, image, stock, allow_brewing, allow_freezing, is_hot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, name, price, category,
    description || '', image || '', stock ?? 999,
    allowBrewing ? 1 : 0, allowFreezing ? 1 : 0, isHot ? 1 : 0
  );

  // Insert variants if provided
  if (variants && Array.isArray(variants) && variants.length > 0) {
    upsertVariants(id, variants);
  }

  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  res.json(serializeProduct(row));
});

router.put('/products/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, price, category, description, image, stock, allowBrewing, allowFreezing, isHot, variants } = req.body;

  const db = getDb();
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: '商品不存在' });
    return;
  }

  db.prepare(`
    UPDATE products SET name=?, price=?, category=?, description=?, image=?, stock=?, allow_brewing=?, allow_freezing=?, is_hot=?
    WHERE id=?
  `).run(
    name ?? existing.name, price ?? existing.price,
    category ?? existing.category,
    description ?? existing.description, image ?? existing.image,
    stock ?? existing.stock,
    allowBrewing !== undefined ? (allowBrewing ? 1 : 0) : existing.allow_brewing,
    allowFreezing !== undefined ? (allowFreezing ? 1 : 0) : existing.allow_freezing,
    isHot !== undefined ? (isHot ? 1 : 0) : existing.is_hot,
    id
  );

  // Upsert variants if provided
  if (variants !== undefined) {
    upsertVariants(id, variants || []);
  }

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
