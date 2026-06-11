import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db';


const router = Router();

function serializeOrder(o: any) {
  const db = getDb();
  let items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;

  // Resolve variant names for combo sub-items (old orders may not have them)
  for (const item of items) {
    if (item.comboId && item.comboItems) {
      for (const ci of item.comboItems) {
        if (ci.variantId && !ci.variantName) {
          const v = db.prepare('SELECT name FROM product_variants WHERE id = ?').get(ci.variantId) as any;
          if (v) ci.variantName = v.name;
        }
      }
    }
    // Also resolve variant name for regular items
    if (item.variantId && !item.variantName) {
      const v = db.prepare('SELECT name FROM product_variants WHERE id = ?').get(item.variantId) as any;
      if (v) item.variantName = v.name;
    }
  }

  return {
    id: o.id,
    nickname: o.nickname,
    dorm: o.dorm,
    isDelivery: o.is_delivery === 1,
    items,
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

/** Restore stock for all items (used when cancelling or before re-editing). */
function restoreStock(items: any[]) {
  const db = getDb();
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
}

/** Deduct stock for all items (same logic as POST). */
function deductStock(items: any[]) {
  const db = getDb();
  for (const item of items) {
    if (item.comboId) {
      const subItems = item.comboItems || [];
      for (const ci of subItems) {
        if (ci.variantId) {
          const v = db.prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?').get(ci.variantId, ci.productId) as any;
          if (v) {
            const newStock = v.stock - item.quantity;
            if (newStock < 0) throw new Error(`商品 "${ci.productName || ci.productId}（${v.name}）" 库存不足`);
            db.prepare('UPDATE product_variants SET stock = ? WHERE id = ?').run(newStock, ci.variantId);
          }
        } else {
          const cp = db.prepare('SELECT * FROM products WHERE id = ?').get(ci.productId) as any;
          if (cp) {
            const newStock = cp.stock - item.quantity;
            if (newStock < 0) throw new Error(`商品 "${cp.name}" 库存不足`);
            db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, cp.id);
          }
        }
      }
    } else if (item.variantId) {
      const v = db.prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?').get(item.variantId, item.id) as any;
      if (v) {
        const newStock = v.stock - item.quantity;
        if (newStock < 0) throw new Error(`商品 "${item.name}（${v.name}）" 库存不足`);
        db.prepare('UPDATE product_variants SET stock = ? WHERE id = ?').run(newStock, item.variantId);
      }
    } else {
      const p = db.prepare('SELECT * FROM products WHERE id = ?').get(item.id) as any;
      if (p) {
        const newStock = p.stock - item.quantity;
        if (newStock < 0) throw new Error(`商品 "${p.name}" 库存不足`);
        db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, item.id);
      }
    }
  }
}

function isAdminReq(req: Request): boolean {
  const adminKey = req.headers['x-admin-key'] as string;
  const expectedKey = process.env.ADMIN_KEY || 'admin123';
  return adminKey === expectedKey;
}

/**
 * Recalculate total price from items using DB prices (same logic as POST).
 * Returns { itemsTotal, deliveryFee, totalPrice }.
 */
function recalcTotal(items: any[], isDelivery: boolean): { itemsTotal: number; deliveryFee: number; totalPrice: number } {
  const db = getDb();
  let itemsTotal = 0;

  for (const item of items) {
    if (item.comboId) {
      const combo = db.prepare('SELECT * FROM combos WHERE id = ?').get(item.comboId) as any;
      const comboDiscount: number = combo ? combo.discount : 0;
      const subItems = item.comboItems || [];
      let comboSubtotal = 0;
      for (const ci of subItems) {
        const cp = db.prepare('SELECT * FROM products WHERE id = ?').get(ci.productId) as any;
        if (!cp) continue;
        let unitPrice = cp.price;
        if (ci.variantId) {
          const v = db.prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?').get(ci.variantId, ci.productId) as any;
          if (v && v.price != null) unitPrice = v.price;
        }
        if (ci.selectedBrewing) unitPrice += 1;
        if (ci.selectedFreezing) unitPrice += 0.5;
        comboSubtotal += unitPrice;
      }
      itemsTotal += (comboSubtotal - comboDiscount) * item.quantity;
      continue;
    }

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.id) as any;
    if (!product) continue;
    let unitPrice = product.price;
    if (item.variantId) {
      const variant = db.prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?').get(item.variantId, item.id) as any;
      if (variant && variant.price != null) unitPrice = variant.price;
    }
    if (item.isBrewingSelected) unitPrice += 1;
    if (item.isFreezingSelected) unitPrice += 0.5;
    itemsTotal += unitPrice * item.quantity;
  }

  const deliveryFee = isDelivery && itemsTotal < 20 ? 1 : 0;
  return { itemsTotal, deliveryFee, totalPrice: itemsTotal + deliveryFee };
}

// Update order — admin can change status; owner/admin can edit fields
router.put('/orders/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, isDelivery, items, nickname } = req.body;

  const db = getDb();
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: '订单不存在' });
    return;
  }

  const admin = isAdminReq(req);
  const isOwner = nickname && existing.nickname === nickname;

  // ── Status change (admin only) ──
  if (status && !items && typeof isDelivery !== 'boolean') {
    if (!admin) {
      res.status(403).json({ error: '仅管理员可修改订单状态' });
      return;
    }

    if (status === 'cancelled' && existing.status !== 'cancelled') {
      const existingItems = JSON.parse(existing.items);
      const restoreTx = db.transaction(() => {
        for (const item of existingItems) {
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
    return;
  }

  // ── Edit order fields (owner or admin) ──
  if (!admin && !isOwner) {
    res.status(403).json({ error: '无权修改该订单' });
    return;
  }

  // Only admin can change items; users can only toggle delivery on pending orders
  const hasItemChanges = items && JSON.stringify(items) !== existing.items;
  if (hasItemChanges && !admin) {
    res.status(403).json({ error: '仅管理员可修改订单商品' });
    return;
  }

  const currentDelivery: boolean = existing.is_delivery === 1;
  const newDelivery = typeof isDelivery === 'boolean' ? isDelivery : currentDelivery;
  const oldItems = JSON.parse(existing.items);
  const newItems = hasItemChanges ? items : oldItems;

  const { totalPrice } = recalcTotal(newItems, newDelivery);

  if (hasItemChanges) {
    // Reverse old stock + apply new stock in one transaction
    const editTx = db.transaction(() => {
      // 1. Restore old stock
      restoreStock(oldItems);
      // 2. Deduct new stock
      deductStock(newItems);
      // 3. Update order
      db.prepare('UPDATE orders SET is_delivery = ?, items = ?, total_price = ? WHERE id = ?')
        .run(newDelivery ? 1 : 0, JSON.stringify(newItems), totalPrice, id);
    });
    editTx();
  } else if (typeof isDelivery === 'boolean') {
    db.prepare('UPDATE orders SET is_delivery = ?, total_price = ? WHERE id = ?')
      .run(newDelivery ? 1 : 0, totalPrice, id);
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
