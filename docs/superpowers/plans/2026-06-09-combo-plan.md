# 套餐功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现套餐功能——组合已有商品并给予优惠折扣，支持智能购物车合并检测。

**Architecture:** 新增 `combos` 表 + 独立 API 路由，前端将套餐作为虚拟商品卡片混排在商品列表中。购物车 reducer 在每次变动后运行 `detectCombos` 自动合并符合套餐条件的单品。管理后台新增套餐管理 Tab。

**Tech Stack:** React 19 + TypeScript + Express + SQLite (better-sqlite3) + Tailwind CSS v4 + Vitest

---

### Task 1: 数据库迁移 v7 — 创建 combos 表

**Files:**
- Modify: `server/db.ts:184` (在 v6 迁移后追加 v7)

- [ ] **Step 1: 添加 v7 迁移逻辑**

在 `runMigrations()` 函数中，v6 迁移块之后（第 183 行 `}` 之后），追加：

```typescript
  if (current < 7) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS combos (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        discount REAL NOT NULL DEFAULT 0,
        items TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
    db.prepare('INSERT INTO schema_version (version) VALUES (7)').run();
    console.log('[DB] Migrated to schema v7 (combos).');
  }
```

- [ ] **Step 2: 验证迁移**

```bash
npx tsx -e "const { getDb } = require('./server/db'); const db = getDb(); const v = db.prepare('SELECT MAX(version) as v FROM schema_version').get(); console.log('Schema version:', v.v); const cols = db.prepare('PRAGMA table_info(combos)').all(); console.log('combos columns:', cols.map(c=>c.name).join(', '))"
```

Expected: `Schema version: 7`, `combos columns: id, name, discount, items, created_at`

- [ ] **Step 3: 提交**

```bash
git add server/db.ts
git commit -m "feat: db migration v7 — combos table"
```

---

### Task 2: 新增类型定义

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: 在 types.ts 末尾追加 Combo 类型和 CartItem 扩展字段**

```typescript
// src/shared/types.ts — 在现有类型定义后追加

export interface ComboItem {
  productId: string;
  variantId?: string | null;
  productName?: string;
  productPrice?: number;
  image?: string;
}

export interface Combo {
  id: string;
  name: string;
  discount: number;
  originalPrice: number;
  comboPrice: number;
  items: ComboItem[];
}
```

同时修改 `CartItem`，新增可选字段（保留现有字段不变）：

```typescript
export interface CartItem extends Product {
  quantity: number;
  isBrewingSelected?: boolean;
  isFreezingSelected?: boolean;
  variantId?: string;
  variantName?: string;
  note?: string;
  comboId?: string;          // 所属套餐 ID
  comboItems?: ComboItem[];  // 套餐子项
  comboDiscount?: number;    // 套餐优惠金额
}
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/shared/types.ts
git commit -m "feat: add Combo/ComboItem types, extend CartItem with combo fields"
```

---

### Task 3: 新增 API 客户端函数

**Files:**
- Modify: `src/shared/api.ts`

- [ ] **Step 1: 新增套餐 API 函数**

在 `src/shared/api.ts` 末尾（`src/shared/types.ts` import 已引入 `Combo`）：

```typescript
// ── Combos ──
export async function fetchCombos(): Promise<Combo[]> {
  return request(`${BASE}/combos`);
}

export async function createCombo(combo: { name: string; discount: number; items: { productId: string; variantId?: string | null }[] }, adminKey: string): Promise<Combo> {
  return request(`${BASE}/combos`, {
    method: 'POST',
    headers: { 'X-Admin-Key': adminKey },
    body: JSON.stringify(combo),
  });
}

export async function updateCombo(id: string, combo: { name?: string; discount?: number; items?: { productId: string; variantId?: string | null }[] }, adminKey: string): Promise<Combo> {
  return request(`${BASE}/combos/${id}`, {
    method: 'PUT',
    headers: { 'X-Admin-Key': adminKey },
    body: JSON.stringify(combo),
  });
}

export async function deleteCombo(id: string, adminKey: string): Promise<{ success: boolean }> {
  return request(`${BASE}/combos/${id}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Key': adminKey },
  });
}
```

确保顶部 import 包含 `Combo`：
```typescript
import type { Product, CartItem, Order, Combo } from './types';
```

- [ ] **Step 2: 提交**

```bash
git add src/shared/api.ts
git commit -m "feat: add combo API client functions"
```

---

### Task 4: 后端套餐路由 + 订单逻辑修改

**Files:**
- Create: `server/routes/combos.ts`
- Modify: `server/routes/orders.ts:39-72` (下单事务中的价格计算和库存扣减)
- Modify: `server/routes/orders.ts:135-147` (取消订单恢复库存)
- Modify: `server/app.ts:6` (import), `server/app.ts:30` (注册路由)

- [ ] **Step 1: 创建 `server/routes/combos.ts`**

```typescript
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
    const p = db.prepare('SELECT id, name, price, image FROM products WHERE id = ?').get(ci.productId) as any;
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
  // Verify all products exist
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
```

- [ ] **Step 2: 注册路由 `server/app.ts`**

在 import 区添加：
```typescript
import comboRoutes from './routes/combos';
```

在 `app.use('/api', postRoutes);` 后添加：
```typescript
app.use('/api', comboRoutes);
```

- [ ] **Step 3: 修改下单逻辑 `server/routes/orders.ts`**

修改 `POST /api/orders` 中的交易逻辑（第 36-71 行），替换价格计算和库存扣减部分。

在 `for (const item of items)` 循环体内，在获取 `product` 之后、价格计算之前，加入 combo 判断：

```typescript
    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.id) as any;
      if (!product) {
        throw new Error(`商品 "${item.name}" 已下架`);
      }

      // ── Combo handling ──
      if (item.comboId) {
        const combo = db.prepare('SELECT * FROM combos WHERE id = ?').get(item.comboId) as any;
        if (!combo) {
          throw new Error(`套餐 "${item.name}" 已下架`);
        }
        const comboItems: { productId: string; variantId?: string | null }[] =
          typeof combo.items === 'string' ? JSON.parse(combo.items) : combo.items;
        const comboDiscount: number = combo.discount;

        let comboSubtotal = 0;
        for (const ci of comboItems) {
          const cp = db.prepare('SELECT * FROM products WHERE id = ?').get(ci.productId) as any;
          if (!cp) {
            throw new Error(`套餐中的商品已下架`);
          }
          let unitPrice = cp.price;
          if (item.isBrewingSelected) unitPrice += 1;
          if (item.isFreezingSelected) unitPrice += 0.5;

          // Deduct stock for combo sub-items
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
          comboSubtotal += unitPrice;
        }
        itemsTotal += (comboSubtotal - comboDiscount) * item.quantity;
        continue; // skip normal product handling below
      }

      // ── Normal product handling (existing logic) ──
      let unitPrice = product.price;
      // ... rest of existing logic unchanged ...
```

- [ ] **Step 4: 修改取消订单恢复库存 `server/routes/orders.ts`**

修改 `PUT /api/orders/:id` 中取消订单的恢复逻辑（第 135-147 行），在 `for (const item of items)` 循环内：

```typescript
      for (const item of items) {
        if (item.comboId) {
          // Restore stock for combo sub-items
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
```

- [ ] **Step 5: 验证路由**

```bash
npx tsx -e "
const { createApp } = require('./server/app');
const app = createApp();
const server = app.listen(3099, () => {
  console.log('Test server on :3099');
  fetch('http://localhost:3099/api/combos').then(r=>r.json()).then(d=>{console.log('GET /api/combos:', JSON.stringify(d).substring(0,100)); server.close()}).catch(e=>{console.error(e); server.close()});
});
"
```

Expected: `GET /api/combos: []`（空数组，因为还没创建套餐）

- [ ] **Step 6: 提交**

```bash
git add server/routes/combos.ts server/routes/orders.ts server/app.ts
git commit -m "feat: combo API routes + order combo support"
```

---

### Task 5: 工具函数 — cart key 扩展 + detectCombos

**Files:**
- Modify: `src/shared/utils.ts`

- [ ] **Step 1: 扩展 `getCartKey` 加入 comboId**

修改现有 `getCartKey` 函数签名和实现：

```typescript
export function getCartKey(item: { id: string; variantId?: string; isBrewingSelected?: boolean; isFreezingSelected?: boolean; comboId?: string }): string {
  return `${item.comboId ? 'c' + item.comboId : item.id}-${item.variantId || ''}-${item.isBrewingSelected ? 'b' : ''}-${item.isFreezingSelected ? 'f' : ''}`;
}
```

- [ ] **Step 2: 新增 `detectCombos` 函数**

在 `getErrorMessage` 之前追加：

```typescript
import { CartItem, Combo } from './types';

// ── Combo detection ──

/**
 * Given a cart and available combos, merge matching individual items into combo entries.
 * Returns a new cart array. Does not mutate input.
 */
export function detectCombos(cart: CartItem[], combos: Combo[]): CartItem[] {
  if (!combos || combos.length === 0) return cart;

  let result = cart.map(item => ({ ...item })); // shallow clone
  let changed = true;
  const maxIter = 50; // safety limit
  let iter = 0;

  while (changed && iter < maxIter) {
    changed = false;
    iter++;

    for (const combo of combos) {
      // Find matching individual items for each combo sub-item
      interface Match {
        comboItem: { productId: string; variantId?: string | null };
        cartItems: { idx: number; item: CartItem; qty: number }[];
      }
      const matches: Match[] = [];

      let allMatched = true;
      for (const ci of combo.items) {
        // Find all individual (non-combo) cart items that match this combo sub-item
        const matching = result
          .map((item, idx) => ({ idx, item }))
          .filter(({ item }) =>
            !item.comboId &&
            item.id === ci.productId &&
            (ci.variantId == null || item.variantId === ci.variantId)
          );

        if (matching.length === 0) {
          allMatched = false;
          break;
        }
        matches.push({
          comboItem: ci,
          cartItems: matching.map(m => ({ idx: m.idx, item: m.item, qty: m.item.quantity })),
        });
      }

      if (!allMatched || matches.length !== combo.items.length) continue;

      // Calculate how many combos can be formed (min total qty across all match groups)
      const matchGroupQtys = matches.map(m =>
        m.cartItems.reduce((sum, mi) => sum + mi.qty, 0)
      );
      let n = Math.min(...matchGroupQtys);
      if (n <= 0) continue;

      // Subtract n from each matched item's quantity
      for (const match of matches) {
        let remaining = n;
        for (const mi of match.cartItems) {
          if (remaining <= 0) break;
          const ded = Math.min(remaining, mi.qty);
          result[mi.idx] = { ...result[mi.idx], quantity: result[mi.idx].quantity - ded };
          remaining -= ded;
        }
      }

      // Remove zero-quantity items
      result = result.filter(item => item.quantity > 0);

      // Check if combo already exists in cart (same comboId + same variant/brand matching)
      const comboKey = `c${combo.id}`;
      const existingComboIdx = result.findIndex(item => item.comboId === combo.id);
      if (existingComboIdx >= 0) {
        result[existingComboIdx] = { ...result[existingComboIdx], quantity: result[existingComboIdx].quantity + n };
      } else {
        // Build the combo cart item
        const firstMatchedItem = matches[0].cartItems[0].item;
        result.push({
          ...firstMatchedItem,
          id: combo.id,
          name: combo.name,
          price: combo.comboPrice,
          quantity: n,
          comboId: combo.id,
          comboItems: combo.items.map(ci => ({
            productId: ci.productId,
            variantId: ci.variantId || null,
            productName: undefined,
            productPrice: undefined,
            image: undefined,
          })),
          comboDiscount: combo.discount,
          isBrewingSelected: false,
          isFreezingSelected: false,
          variantId: undefined,
          variantName: undefined,
        } as CartItem);
      }

      changed = true;
      break; // restart scan after a successful merge
    }
  }

  return result;
}
```

- [ ] **Step 3: 添加 detectCombos 单元测试**

创建/修改 `src/__tests__/utils.test.ts`，追加：

```typescript
import { describe, it, expect } from 'vitest';
import { detectCombos } from '../shared/utils';
import type { CartItem, Combo } from '../shared/types';

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'p1', name: 'test', price: 10, category: '1', description: '', stock: 999,
    quantity: 1, ...overrides,
  };
}

describe('detectCombos', () => {
  const combos: Combo[] = [
    {
      id: 'c1', name: '泡面+玉米肠套餐', discount: 0.5, originalPrice: 9, comboPrice: 8.5,
      items: [
        { productId: 'p3', variantId: null },
        { productId: 'p99', variantId: null },
      ],
    },
  ];

  it('merges matching items into combo', () => {
    const cart: CartItem[] = [
      makeItem({ id: 'p3', name: '泡面', price: 6 }),
      makeItem({ id: 'p99', name: '玉米肠', price: 3 }),
    ];
    const result = detectCombos(cart, combos);
    expect(result).toHaveLength(1);
    expect(result[0].comboId).toBe('c1');
    expect(result[0].name).toBe('泡面+玉米肠套餐');
    expect(result[0].quantity).toBe(1);
  });

  it('handles extra quantity correctly', () => {
    const cart: CartItem[] = [
      makeItem({ id: 'p3', name: '泡面', price: 6, quantity: 2 }),
      makeItem({ id: 'p99', name: '玉米肠', price: 3 }),
    ];
    const result = detectCombos(cart, combos);
    expect(result).toHaveLength(2);
    const combo = result.find(i => i.comboId === 'c1');
    const extra = result.find(i => i.id === 'p3');
    expect(combo?.quantity).toBe(1);
    expect(extra?.quantity).toBe(1);
  });

  it('does nothing when no combo matches', () => {
    const cart: CartItem[] = [
      makeItem({ id: 'p3', name: '泡面', price: 6 }),
      makeItem({ id: 'pxxx', name: '其他', price: 5 }),
    ];
    const result = detectCombos(cart, combos);
    expect(result).toHaveLength(2);
    expect(result.every(i => !i.comboId)).toBe(true);
  });

  it('does nothing when combos list is empty', () => {
    const cart: CartItem[] = [makeItem({ id: 'p3', name: '泡面' })];
    const result = detectCombos(cart, []);
    expect(result).toEqual(cart);
  });
});
```

- [ ] **Step 4: 运行测试**

```bash
npx vitest run src/__tests__/utils.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: 提交**

```bash
git add src/shared/utils.ts src/__tests__/utils.test.ts
git commit -m "feat: extend getCartKey, add detectCombos with tests"
```

---

### Task 6: Reducer — 购物车智能合并

**Files:**
- Modify: `src/features/ordering/customerReducer.ts`

- [ ] **Step 1: State 新增 combos 字段；新增 SET_COMBOS action；修改 ADD_TO_CART/REMOVE_FROM_CART**

在 `CustomerRawState` 中添加：
```typescript
  combos: Combo[];
```

在 `createInitialState()` 中：
```typescript
    combos: [],
```

在 `CustomerAction` 联合类型中添加：
```typescript
  | { type: 'SET_COMBOS'; payload: Combo[] }
```

在顶部 import 添加：
```typescript
import { Combo } from '../../shared/types';
import { detectCombos } from '../../shared/utils';
```

在 `customerReducer` 的 switch 中添加 `SET_COMBOS` case：
```typescript
    case 'SET_COMBOS':
      return { ...state, combos: action.payload };
```

修改 `ADD_TO_CART` case：在现有逻辑完成后（return 之前），对新的 cart 运行 detectCombos。将两个 return 后的逻辑改为先赋值再统一返回：

```typescript
    case 'ADD_TO_CART': {
      const { product, variantId, isBrewing, isFreezing } = action.payload;
      const variant = variantId ? product.variants?.find(v => v.id === variantId) : undefined;
      const variantPrice = variant?.price;
      const key = getCartKey({ id: product.id, variantId, isBrewingSelected: isBrewing, isFreezingSelected: isFreezing });
      const existingIdx = state.cart.findIndex(item => getCartKey(item) === key);
      let newCart: CartItem[];
      if (existingIdx >= 0) {
        newCart = state.cart.map((item, idx) =>
          idx === existingIdx ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        newCart = [...state.cart, {
          ...product,
          quantity: 1,
          variantId,
          variantName: variant?.name,
          price: variantPrice != null ? variantPrice : product.price,
          isBrewingSelected: isBrewing,
          isFreezingSelected: isFreezing,
        }];
      }
      // Run combo detection
      newCart = detectCombos(newCart, state.combos);
      return { ...state, cart: newCart };
    }
```

修改 `REMOVE_FROM_CART` case，在返回前也运行 detectCombos：

```typescript
    case 'REMOVE_FROM_CART': {
      const key = getCartKey(action.payload);
      const existingIdx = state.cart.findIndex(i => getCartKey(i) === key);
      let newCart: CartItem[];
      if (existingIdx >= 0 && state.cart[existingIdx].quantity > 1) {
        newCart = state.cart.map((item, idx) =>
          idx === existingIdx ? { ...item, quantity: item.quantity - 1 } : item
        );
      } else {
        newCart = state.cart.filter(i => getCartKey(i) !== key);
      }
      // If we removed a combo item, check if remaining items re-form combos
      // Also if we removed an individual item that was part of a combo, re-detect
      newCart = detectCombos(newCart, state.combos);
      return { ...state, cart: newCart };
    }
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/features/ordering/customerReducer.ts
git commit -m "feat: reducer combo detection on add/remove from cart"
```

---

### Task 7: Hook — 加载套餐 + 套餐价格计算

**Files:**
- Modify: `src/features/ordering/hooks/useCustomerApp.ts`

- [ ] **Step 1: 加载 combos、combo 价格计算、传入 dispatch**

在 import 中添加：
```typescript
import { fetchCombos } from '../../../shared/api';
import type { Combo } from '../../../shared/types';
```

在 `CustomerAppState` 中添加：
```typescript
  combos: Combo[];
```

在副作用区域（第 66-76 行 useEffect 加载 products 之后）追加加载 combos 的 useEffect：
```typescript
  useEffect(() => {
    fetchCombos()
      .then(combos => dispatch({ type: 'SET_COMBOS', payload: combos }))
      .catch(err => console.warn('Failed to load combos:', err));
  }, []);
```

修改 `itemsTotal` 计算逻辑（第 107-115 行），对 combo 条目使用 comboDiscount：

```typescript
  const itemsTotal = useMemo(() =>
    sortedCart.reduce((sum, item) => {
      if (item.comboId) {
        // For combo items: sum of sub-item prices (including brew/freeze) minus discount
        const subTotal = (item.comboItems || []).reduce((s, ci) => {
          let sp = ci.productPrice || 0;
          if (item.isBrewingSelected) sp += 1;
          if (item.isFreezingSelected) sp += 0.5;
          return s + sp;
        }, 0);
        return sum + (subTotal - (item.comboDiscount || 0)) * item.quantity;
      }
      let p = item.price;
      if (item.isBrewingSelected) p += 1;
      if (item.isFreezingSelected) p += 0.5;
      return sum + p * item.quantity;
    }, 0),
    [sortedCart]
  );
```

将 `state: CustomerAppState` 赋值中加入 `combos: rawState.combos`。

在下单文案生成（`confirmAndCopy` 中第 234-248 行），修改 orderLines 生成逻辑，支持 combo 条目：

```typescript
      const orderLines = sortedCart.map(item => {
        if (item.comboId && item.comboItems) {
          // Combo order line
          const subLines = item.comboItems.map(ci => {
            const subP = (ci.productPrice || 0);
            return `  - ${ci.productName || '商品'} x${item.quantity}  ¥${(subP * item.quantity).toFixed(2)}`;
          }).join('\n');
          return `🍱套餐: ${item.name}\n${subLines}\n  套餐优惠  -¥${((item.comboDiscount || 0) * item.quantity).toFixed(2)}`;
        }
        const svc: string[] = [];
        if (item.isBrewingSelected) svc.push('帮泡+¥1');
        if (item.isFreezingSelected) svc.push('冰镇+¥0.5');
        const svcStr = svc.length > 0 ? ` [${svc.join(', ')}]` : '';
        const variantStr = item.variantName ? ` · ${item.variantName}` : '';
        const noteStr = item.note ? ` (${item.note})` : '';
        const up = getItemUnitPrice(item);
        return `${item.name}${variantStr}${svcStr}${noteStr} x${item.quantity} - ¥${(up * item.quantity).toFixed(2)}`;
      });
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/features/ordering/hooks/useCustomerApp.ts
git commit -m "feat: load combos in hook, combo price calculation, combo order text"
```

---

### Task 8: ComboCard — 套餐商品卡片

**Files:**
- Create: `src/features/ordering/components/ComboCard.tsx`
- Modify: `src/App.tsx`（引入 combo 列表和 ComboCard）

- [ ] **Step 1: 创建 `ComboCard.tsx`**

```typescript
import { useState, useEffect } from 'react';
import { Plus, Package } from 'lucide-react';
import { Combo, Product, CartItem } from '../../../shared/types';

interface ComboCardProps {
  combo: Combo;
  products: Product[];
  cart: CartItem[];
  onAddCombo: (combo: Combo, selections: { productId: string; variantId?: string }[]) => void;
}

export default function ComboCard({ combo, cart, onAddCombo }: ComboCardProps) {
  const [selections, setSelections] = useState<{ productId: string; variantId?: string }[]>([]);

  useEffect(() => {
    setSelections([]);
  }, [combo.id]);

  // Check if all required selections are made
  const allSelected = combo.items.every(ci => {
    if (!ci.variantId) return true; // no variant constraint
    return selections.some(s => s.productId === ci.productId && s.variantId);
  });

  // Check stock
  const comboQtyInCart = cart
    .filter(c => c.comboId === combo.id)
    .reduce((s, i) => s + i.quantity, 0);

  const canAdd = allSelected && comboQtyInCart < 99; // simple cap

  return (
    <div className="bg-white p-2.5 sm:p-4 rounded-[16px] sm:rounded-[32px] shadow-sm border border-amber-200 flex flex-col gap-2 sm:gap-4 group hover:shadow-md transition-all duration-300 ring-1 ring-amber-100">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-sm">🍱</span>
        <span className="text-[9px] sm:text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">套餐</span>
      </div>

      <h3 className="font-bold text-xs sm:text-lg leading-tight group-hover:text-amber-600 transition-colors">
        {combo.name}
      </h3>

      {/* Sub-items with variant selection */}
      <div className="flex flex-col gap-2">
        {combo.items.map(ci => (
          <div key={ci.productId} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
            <div className="w-10 h-10 bg-white rounded-lg overflow-hidden shrink-0 border border-slate-200">
              {ci.image ? (
                <img src={ci.image} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-lg">📦</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs font-bold truncate">{ci.productName}</p>
            </div>
            <span className="text-[10px] sm:text-xs text-slate-400">¥{ci.productPrice}</span>
          </div>
        ))}
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-2">
        <span className="text-slate-400 line-through text-[10px] sm:text-xs">¥{combo.originalPrice.toFixed(1)}</span>
        <span className="font-bold text-amber-600 text-base sm:text-xl">¥{combo.comboPrice.toFixed(1)}</span>
        <span className="text-[9px] sm:text-[10px] text-green-600 font-bold">省 ¥{combo.discount.toFixed(1)}</span>
      </div>

      <button
        onClick={() => onAddCombo(combo, selections)}
        disabled={!canAdd}
        className="w-full min-h-10 bg-amber-500 text-white py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-bold text-[11px] sm:text-base hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98] flex items-center justify-center gap-1 sm:gap-2 disabled:bg-slate-200 disabled:shadow-none disabled:text-slate-400"
      >
        <Plus size={16} /> 加入购物车
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 在 App.tsx 中集成 ComboCard**

需要阅读 `App.tsx` 了解现有结构，在商品网格中混排 ComboCard。

- [ ] **Step 3: 在 reducer 中增加 ADD_COMBO_TO_CART action**

在 `customerReducer.ts` 中新增：

```typescript
  | { type: 'ADD_COMBO_TO_CART'; payload: { combo: Combo; selections: { productId: string; variantId?: string }[] } }
```

对应的 case：
```typescript
    case 'ADD_COMBO_TO_CART': {
      const { combo, selections } = action.payload;
      const comboKey = `c${combo.id}`;
      const existingIdx = state.cart.findIndex(item => item.comboId === combo.id);
      let newCart: CartItem[];
      if (existingIdx >= 0) {
        newCart = state.cart.map((item, idx) =>
          idx === existingIdx ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        // Create combo cart item using combo info
        const comboItem: CartItem = {
          id: combo.id,
          name: combo.name,
          price: combo.comboPrice,
          category: '',
          description: '',
          stock: 999,
          quantity: 1,
          comboId: combo.id,
          comboItems: combo.items.map(ci => ({
            productId: ci.productId,
            variantId: ci.variantId || null,
            productName: ci.productName,
            productPrice: ci.productPrice,
            image: ci.image,
          })),
          comboDiscount: combo.discount,
        };
        newCart = [...state.cart, comboItem];
      }
      newCart = detectCombos(newCart, state.combos);
      return { ...state, cart: newCart };
    }
```

- [ ] **Step 4: 在 hook 中暴露 addComboToCart action**

在 `useCustomerApp.ts` 中添加：
```typescript
  const addComboToCart = (combo: Combo, selections: { productId: string; variantId?: string }[]) =>
    dispatch({ type: 'ADD_COMBO_TO_CART', payload: { combo, selections } });
```

并在 actions 对象中导出。

- [ ] **Step 5: 类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: 提交**

```bash
git add src/features/ordering/components/ComboCard.tsx src/features/ordering/customerReducer.ts src/features/ordering/hooks/useCustomerApp.ts src/App.tsx
git commit -m "feat: ComboCard component + ADD_COMBO_TO_CART action"
```

---

### Task 9: 购物车套餐展示 + App 集成

**Files:**
- Modify: `src/features/ordering/components/CartPanel.tsx`
- Modify: `src/App.tsx`（将 combos 传入 CartPanel）

- [ ] **Step 1: CartPanel 套餐条目展示**

在 CartPanel 的 cart.map 渲染中，判断 `item.comboId` 来渲染不同的 UI：

```tsx
{cart.map(item => (
  <motion.div key={getCartKey(item)} ...>
    {item.comboId ? (
      // Combo entry
      <>
        <div className="w-14 h-14 bg-amber-50 rounded-xl overflow-hidden shrink-0 shadow-sm border border-amber-200 flex items-center justify-center">
          <span className="text-2xl">🍱</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between font-bold text-sm mb-1">
            <span className="truncate">{item.name}</span>
            <span className="ml-2 text-amber-600">
              ¥{(item.price * item.quantity).toFixed(2)}
            </span>
          </div>
          {/* Sub-items */}
          {(item.comboItems || []).map(ci => (
            <div key={ci.productId} className="text-[9px] text-slate-400 flex justify-between">
              <span>  └ {ci.productName}</span>
              <span>¥{((ci.productPrice || 0) * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          {/* Discount line */}
          {item.comboDiscount && item.comboDiscount > 0 && (
            <div className="text-[9px] text-green-600 font-bold flex justify-between">
              <span>  套餐优惠</span>
              <span>-¥{((item.comboDiscount || 0) * item.quantity).toFixed(2)}</span>
            </div>
          )}
          {/* Note and quantity controls same as normal items */}
          ... (rest of controls same as non-combo)
        </div>
      </>
    ) : (
      // Existing normal item rendering — unchanged
      ...
    )}
  </motion.div>
))}
```

- [ ] **Step 2: 提交**

```bash
git add src/features/ordering/components/CartPanel.tsx src/App.tsx
git commit -m "feat: combo display in CartPanel"
```

---

### Task 10: 管理后台套餐管理 Tab

**Files:**
- Modify: `src/features/admin/components/AdminPanel.tsx`

- [ ] **Step 1: 阅读现有 AdminPanel 结构**

需要先确认 AdminPanel 的 tab 切换和表单模式，然后添加第三个 tab。

- [ ] **Step 2: 添加套餐管理 tab 和 CRUD UI**

在 AdminPanel 中添加：
- Tab 切换：「订单管理」「商品管理」「套餐管理」
- 套餐列表表格（名称、子商品列表、折扣、操作）
- 套餐表单（名称、子商品选择器（多选已有商品）、优惠金额）

- [ ] **Step 3: 提交**

```bash
git add src/features/admin/components/AdminPanel.tsx
git commit -m "feat: admin combo management tab"
```

---

### Task 11: 端到端验证

- [ ] **Step 1: 启动完整应用**

```bash
npm run dev:all
```

- [ ] **Step 2: 验证流程**

1. 创建测试套餐：用 curl 或管理后台创建"泡面+玉米肠套餐"（优惠 ¥0.5）
2. 顾客端验证：套餐卡片出现在商品列表中
3. 加购套餐：点击套餐 → 确认子商品 → 加入购物车 → 查看折叠展示
4. 智能检测：分别加泡面和玉米肠 → 购物车自动合并为套餐
5. 下单确认：订单文案正确显示套餐优惠
6. 管理后台：套餐 CRUD 正常

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "feat: combo feature complete — verification done"
```

---

## 改动文件总览

| 文件 | 操作 | 说明 |
|------|------|------|
| `server/db.ts` | 修改 | v7 迁移：combos 表 |
| `server/routes/combos.ts` | **新建** | 套餐 CRUD 路由 |
| `server/routes/orders.ts` | 修改 | 下单/取消支持 combo |
| `server/app.ts` | 修改 | 注册 combos 路由 |
| `src/shared/types.ts` | 修改 | Combo, ComboItem 类型 |
| `src/shared/api.ts` | 修改 | 套餐 API 函数 |
| `src/shared/utils.ts` | 修改 | getCartKey 扩展, detectCombos |
| `src/__tests__/utils.test.ts` | 修改 | detectCombos 测试 |
| `src/features/ordering/customerReducer.ts` | 修改 | combo 检测 + ADD_COMBO action |
| `src/features/ordering/hooks/useCustomerApp.ts` | 修改 | 加载 combos, combo 价格 |
| `src/features/ordering/components/ComboCard.tsx` | **新建** | 套餐卡片 |
| `src/features/ordering/components/CartPanel.tsx` | 修改 | 套餐条目展示 |
| `src/features/admin/components/AdminPanel.tsx` | 修改 | 套餐管理 tab |
| `src/App.tsx` | 修改 | 集成 ComboCard |
