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
      // ── Combo handling ──
      if (item.comboId) {
        const combo = db.prepare('SELECT * FROM combos WHERE id = ?').get(item.comboId) as any;
        if (!combo) {
          throw new Error(`套餐 "${item.name}" 已下架`);
        }
        const comboDiscount: number = combo.discount;
        const subItems = item.comboItems || [];

        let comboSubtotal = 0;
        for (const ci of subItems) {
          const cp = db.prepare('SELECT * FROM products WHERE id = ?').get(ci.productId) as any;
          if (!cp) {
            throw new Error('套餐中的商品已下架');
          }
          let unitPrice = cp.price;

          if (ci.variantId) {
            const v = db.prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?').get(ci.variantId, ci.productId) as any;
            if (v) {
              if (v.price != null) unitPrice = v.price;
              const newStock = v.stock - item.quantity;
              if (newStock < 0) throw new Error(`商品 "${cp.name}（${v.name}）" 库存不足`);
              db.prepare('UPDATE product_variants SET stock = ? WHERE id = ?').run(newStock, ci.variantId);
            }
          } else {
            const newStock = cp.stock - item.quantity;
            if (newStock < 0) throw new Error(`商品 "${cp.name}" 库存不足`);
            db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, cp.id);
          }

          if (ci.selectedBrewing) unitPrice += 1;
          if (ci.selectedFreezing) unitPrice += 0.5;
          comboSubtotal += unitPrice;
        }
        itemsTotal += (comboSubtotal - comboDiscount) * item.quantity;
        continue;
      }

      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.id) as any;
      if (!product) {
        throw new Error(`商品 "${item.name}" 已下架`);
      }

      let unitPrice = product.price;

      // If variant selected, use variant price override and deduct variant stock
      if (item.variantId) {
        const variant = db.prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?').get(item.variantId, item.id) as any;
        if (!variant) {
          throw new Error(`商品 "${product.name}" 的规格 "${item.variantName || '未知'}" 已下架`);
        }
        if (variant.price != null) unitPrice = variant.price;
        if (item.isBrewingSelected) unitPrice += 1;
        if (item.isFreezingSelected) unitPrice += 0.5;
        const newStock = variant.stock - item.quantity;
        if (newStock < 0) {
          throw new Error(`商品 "${product.name}（${variant.name}）" 库存不足，仅剩 ${variant.stock} 件`);
        }
        db.prepare('UPDATE product_variants SET stock = ? WHERE id = ?').run(newStock, item.variantId);
      } else {
        if (item.isBrewingSelected) unitPrice += 1;
        if (item.isFreezingSelected) unitPrice += 0.5;
        const newStock = product.stock - item.quantity;
        if (newStock < 0) {
          throw new Error(`商品 "${product.name}" 库存不足，仅剩 ${product.stock} 件`);
        }
        db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, product.id);
      }

      itemsTotal += unitPrice * item.quantity;
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
        if (item.comboId) {
          const combo = db.prepare('SELECT * FROM combos WHERE id = ?').get(item.comboId) as any;
          if (combo) {
            const comboItems: { productId: string; variantId?: string | null }[] =
              typeof combo.items === 'string' ? JSON.parse(combo.items) : combo.items;
            for (const ci of comboItems) {
              if (ci.variantId) {
                db.prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ?').run(item.quantity, ci.variantId);
              } else {
                db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.quantity, ci.productId);
              }
            }
          }
        } else if (item.variantId) {
          db.prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ?').run(item.quantity, item.variantId);
        } else {
          db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.quantity, item.id);
        }
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

// DELETE /api/orders/:id — owner or admin
router.delete('/orders/:id', (req: Request, res: Response) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as any;
  if (!order) return res.status(404).json({ error: '订单不存在' });

  const { nickname, reason } = req.body;
  const adminKey = req.headers['x-admin-key'] as string;
  const expectedKey = process.env.ADMIN_KEY || 'admin123';
  const isAdmin = adminKey === expectedKey;
  if (!isAdmin && order.nickname !== nickname) return res.status(403).json({ error: '无权删除' });

  // If admin deletes with a reason, notify the user
  if (isAdmin && reason && order.nickname !== nickname) {
    const notifId = uuid();
    db.prepare(
      'INSERT INTO notifications (id, user_id, title, content) VALUES (?, ?, ?, ?)'
    ).run(notifId, order.nickname, '订单被退回', reason);
  }

  // Restore stock
  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  for (const item of items) {
    if (item.comboId) {
      const combo = db.prepare('SELECT * FROM combos WHERE id = ?').get(item.comboId) as any;
      if (combo) {
        const comboItems: { productId: string; variantId?: string | null }[] =
          typeof combo.items === 'string' ? JSON.parse(combo.items) : combo.items;
        for (const ci of comboItems) {
          if (ci.variantId) {
            db.prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ?').run(item.quantity, ci.variantId);
          } else {
            db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.quantity, ci.productId);
          }
        }
      }
    } else if (item.variantId) {
      db.prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ?').run(item.quantity, item.variantId);
    } else {
      db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.quantity, item.id);
    }
  }

  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
