import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db';
import { requireAdmin } from '../middleware/auth';

const router = Router();

function serializeOrder(o: any) {
  return {
    id: o.id,
    nickname: o.nickname,
    dorm: o.dorm,
    isDelivery: o.is_delivery === 1,
    items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items,
    totalPrice: o.total_price,
    status: o.status,
    createdAt: o.created_at,
  };
}

// Place order — no auth required
router.post('/orders', (req: Request, res: Response) => {
  const { nickname, dorm, isDelivery, items } = req.body;

  if (!nickname || !dorm) {
    res.status(400).json({ error: '请填写昵称和宿舍号' });
    return;
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: '订单不能为空' });
    return;
  }

  const db = getDb();

  const createOrderTx = db.transaction(() => {
    let itemsTotal = 0;

    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.id) as any;
      if (!product) {
        throw new Error(`商品 "${item.name}" 已下架`);
      }

      let unitPrice = product.price;
      if (item.isBrewingSelected) unitPrice += 1;
      if (item.isFreezingSelected) unitPrice += 0.5;

      itemsTotal += unitPrice * item.quantity;

      const newStock = product.stock - item.quantity;
      if (newStock < 0) {
        throw new Error(`商品 "${product.name}" 库存不足，仅剩 ${product.stock} 件`);
      }
      db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, product.id);
    }

    const deliveryFee = isDelivery && itemsTotal < 20 ? 1 : 0;
    const totalPrice = itemsTotal + deliveryFee;

    const orderId = uuid();
    db.prepare(`
      INSERT INTO orders (id, nickname, dorm, is_delivery, items, total_price, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(orderId, nickname, dorm, isDelivery ? 1 : 0, JSON.stringify(items), totalPrice);

    return orderId;
  });

  try {
    const orderId = createOrderTx();
    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    res.json(serializeOrder(row));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// List orders — no auth required. Filter by ?status= or ?nickname=&dorm=
router.get('/orders', (req: Request, res: Response) => {
  const db = getDb();
  const { status, nickname, dorm } = req.query;

  let rows: any[];
  if (status) {
    rows = db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC').all(status);
  } else if (nickname && dorm) {
    rows = db.prepare('SELECT * FROM orders WHERE nickname = ? AND dorm = ? ORDER BY created_at DESC').all(nickname, dorm);
  } else {
    rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  }

  res.json(rows.map(serializeOrder));
});

// Get single order by ID
router.get('/orders/:id', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!row) {
    res.status(404).json({ error: '订单不存在' });
    return;
  }
  res.json(serializeOrder(row));
});

// Update order status — admin only
router.put('/orders/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const db = getDb();
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: '订单不存在' });
    return;
  }

  if (status === 'cancelled' && existing.status !== 'cancelled') {
    const items = JSON.parse(existing.items);
    const restoreTx = db.transaction(() => {
      for (const item of items) {
        db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.quantity, item.id);
      }
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
    });
    restoreTx();
  } else {
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
  }

  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  res.json(serializeOrder(row));
});

export default router;
