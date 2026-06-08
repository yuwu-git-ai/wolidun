import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db';
import { requireAdmin } from '../middleware/auth';

const router = Router();

interface ComboItemInput {
  productId: string;
  variantId?: string | null;
}

function serializeCombo(c: any) {
  const db = getDb();
  const items: ComboItemInput[] = typeof c.items === 'string' ? JSON.parse(c.items) : c.items;
  let originalPrice = 0;

  const enrichedItems = items.map((ci: ComboItemInput) => {
    const p = db.prepare('SELECT id, name, price, image, allow_brewing, allow_freezing FROM products WHERE id = ?').get(ci.productId) as any;
    if (p) {
      let price = p.price;
      if (ci.variantId) {
        const v = db.prepare('SELECT price FROM product_variants WHERE id = ? AND product_id = ?').get(ci.variantId, ci.productId) as any;
        if (v && v.price != null) price = v.price;
      }
      originalPrice += price;
      return {
        productId: ci.productId,
        variantId: ci.variantId || null,
        productName: p.name,
        productPrice: price,
        image: p.image || '',
        allowBrewing: p.allow_brewing === 1,
        allowFreezing: p.allow_freezing === 1,
      };
    }
    return { productId: ci.productId, variantId: ci.variantId || null, productName: '', productPrice: 0, image: '' };
  });

  return {
    id: c.id,
    name: c.name,
    discount: c.discount,
    originalPrice,
    comboPrice: Math.max(0, originalPrice - c.discount),
    items: enrichedItems,
  };
}

// GET /api/combos — public
router.get('/combos', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM combos ORDER BY created_at DESC').all();
  res.json(rows.map(serializeCombo));
});

// POST /api/combos — admin
router.post('/combos', requireAdmin, (req: Request, res: Response) => {
  const { name, discount, items } = req.body;

  if (!name || discount == null || !items || !Array.isArray(items) || items.length < 2) {
    res.status(400).json({ error: '请填写套餐名称、优惠金额，且至少需要2个子商品' });
    return;
  }

  const db = getDb();
  for (const item of items) {
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(item.productId);
    if (!product) {
      res.status(400).json({ error: `商品 ID "${item.productId}" 不存在` });
      return;
    }
  }

  const id = uuid();
  db.prepare('INSERT INTO combos (id, name, discount, items) VALUES (?, ?, ?, ?)').run(
    id, name, discount, JSON.stringify(items)
  );

  const row = db.prepare('SELECT * FROM combos WHERE id = ?').get(id);
  res.json(serializeCombo(row));
});

// PUT /api/combos/:id — admin
router.put('/combos/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, discount, items } = req.body;

  const db = getDb();
  const existing = db.prepare('SELECT * FROM combos WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: '套餐不存在' });
    return;
  }

  if (items !== undefined) {
    if (!Array.isArray(items) || items.length < 2) {
      res.status(400).json({ error: '套餐至少需要2个子商品' });
      return;
    }
    for (const item of items) {
      const product = db.prepare('SELECT id FROM products WHERE id = ?').get(item.productId);
      if (!product) {
        res.status(400).json({ error: `商品 ID "${item.productId}" 不存在` });
        return;
      }
    }
  }

  db.prepare('UPDATE combos SET name=?, discount=?, items=? WHERE id=?').run(
    name ?? existing.name,
    discount ?? existing.discount,
    items !== undefined ? JSON.stringify(items) : existing.items,
    id
  );

  const row = db.prepare('SELECT * FROM combos WHERE id = ?').get(id);
  res.json(serializeCombo(row));
});

// DELETE /api/combos/:id — admin
router.delete('/combos/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM combos WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: '套餐不存在' });
    return;
  }
  db.prepare('DELETE FROM combos WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
