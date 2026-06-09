# 套餐功能设计文档

## 概述

在现有点单系统中新增套餐功能。套餐将多个已有商品组合在一起，给予一定优惠。套餐本身作为"虚拟商品"展示，顾客可主动选择；同时购物车智能检测——当顾客分别加入套餐内的商品时，自动合并为套餐条目。

## 需求要点

- 套餐 = 组合已有商品 + 优惠折扣（如泡面 ¥6 + 玉米肠 ¥3 = ¥9，套餐优惠 ¥0.5，实付 ¥8.5）
- 套餐在商品列表中展示为独立卡片，点击可对子商品选规格
- **智能检测**：购物车中若包含套餐所需全部商品，自动合并为套餐条目
- 管理后台可 CRUD 套餐

---

## 一、数据库

### 新表 `combos`（迁移版本 v7）

```sql
CREATE TABLE combos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  items TEXT NOT NULL,          -- JSON: [{productId, variantId?}]
  created_at TEXT DEFAULT (datetime('now'))
);
```

- `discount`：套餐优惠金额（正值，从子商品总价中扣减）
- `items`：JSON 数组，每项 `{productId: string, variantId?: string | null}`
  - `variantId` 为 null/不填 → 该子商品不限规格
  - `variantId` 指定 → 锁定到具体规格

---

## 二、API 路由

### `GET /api/combos` — 公开

返回所有套餐，附带子商品详情（名称、价格、图片）：

```json
[{
  "id": "c1",
  "name": "泡面+玉米肠套餐",
  "discount": 0.5,
  "originalPrice": 9.0,
  "comboPrice": 8.5,
  "items": [
    { "productId": "p3", "productName": "...", "productPrice": 6, "image": "...", "variantId": null },
    { "productId": "p99", "productName": "玉米肠", "productPrice": 3, "image": "...", "variantId": null }
  ]
}]
```

### `POST /api/combos` — 管理员

创建套餐。Body: `{name, discount, items: [{productId, variantId?}]}`。验证子商品必须存在。

### `PUT /api/combos/:id` — 管理员

修改套餐。

### `DELETE /api/combos/:id` — 管理员

删除套餐。

### 下单 `POST /api/orders` 修改

- CartItem 新增可选字段 `comboId`、`comboItems`、`comboDiscount`
- 当 `comboId` 存在时：
  - 验证套餐存在
  - 遍历 `comboItems` 扣减各子商品/规格库存
  - 价格 = sum(子商品单价 + 帮泡/冰镇) - comboDiscount
- 取消订单恢复库存同理：遍历 comboItems 恢复各子商品库存

---

## 三、前端类型

```typescript
// 新增
export interface ComboItem {
  productId: string;
  variantId?: string | null;
  productName?: string;     // API 计算字段
  productPrice?: number;    // API 计算字段
  image?: string;           // API 计算字段
}

export interface Combo {
  id: string;
  name: string;
  discount: number;
  originalPrice: number;    // 计算字段
  comboPrice: number;       // 计算字段
  items: ComboItem[];
}

// CartItem 扩展
export interface CartItem extends Product {
  // ... 现有字段
  comboId?: string;
  comboItems?: ComboItem[];
  comboDiscount?: number;
}
```

---

## 四、API 客户端

```typescript
fetchCombos(): Promise<Combo[]>
createCombo(combo, adminKey): Promise<Combo>
updateCombo(id, combo, adminKey): Promise<Combo>
deleteCombo(id, adminKey): Promise<void>
```

---

## 五、状态管理

### Cart key 扩展

`getCartKey()` 加入 `comboId` 字段，区分套餐条目与普通单品。

### 智能合并检测 `detectCombos(cart, combos)`

在 `ADD_TO_CART` 和 `REMOVE_FROM_CART` 后运行：

```
对每个 combo:
  找到购物车中匹配 combo.items 的单品条目
  若所有必需单品的数量 >= 1:
    按最小匹配数量合并：
      n = min(各匹配单品的 quantity)
      扣减各单品 quantity n 个（quantity 归零则移除）
      创建/追加 combo 条目（quantity = n）
处理剩余碎片和数量不匹配
```

**示例**：
- 购物车：[泡面 x2, 玉米肠 x1] + 规则(泡面+玉米肠→优惠0.5)
- → [🍱套餐 x1, 泡面 x1]

### hook 层加载套餐

`useCustomerApp` 新增 `fetchCombos()` 调用，传入 reducer 供检测使用。

---

## 六、顾客端 UI

### 套餐卡片（ComboCard）

- 在商品网格中和 ProductCard 混排
- 显示子商品缩略图（2 列 mini 图）、原价划线、套餐价高亮、省金额
- 子商品有规格时，先弹出规格选择再入车
- 点击"加入购物车"一次性将套餐条目加入购物车

### 购物车套餐展示

- 套餐条目折叠展示：套餐名 + 子商品列表 + 优惠行
- 加减按钮针对整个套餐条目操作
- 备注输入框复用

### 下单文案

```
🍱套餐: 泡面+玉米肠套餐
  - 康师傅红烧牛肉面 x1         ¥6.00
  - 玉米肠 x1                   ¥3.00
  套餐优惠                     -¥0.50
```

---

## 七、管理后台 UI

AdminPanel 新增第三个 tab「套餐管理」：

- **列表**：表格展示（名称、子商品、原价、优惠、套餐价、操作按钮）
- **新增/编辑**：侧边表单 — 名称输入 + 子商品选择器（下拉搜索/多选，可锁定规格）+ 优惠金额
- **删除**：确认弹窗

---

## 八、改动文件清单

| 文件 | 改动 |
|------|------|
| `server/db.ts` | v7 迁移：创建 combos 表 |
| `server/routes/combos.ts` | **新建**：套餐 CRUD 路由 |
| `server/routes/orders.ts` | 修改下单/取消逻辑，支持 comboId |
| `server/app.ts` | 注册 `/api/combos` 路由 |
| `src/shared/types.ts` | 新增 Combo、ComboItem；CartItem 扩展 |
| `src/shared/api.ts` | 新增套餐 API 函数 |
| `src/shared/utils.ts` | getCartKey 扩展 comboId；新增 detectCombos |
| `src/shared/constants.ts` | 无改动 |
| `src/features/ordering/customerReducer.ts` | ADD_TO_CART/REMOVE 后调用 detectCombos；新增 combo 相关 action |
| `src/features/ordering/hooks/useCustomerApp.ts` | 加载 combos；价格计算含 combo |
| `src/features/ordering/components/ComboCard.tsx` | **新建**：套餐卡片 |
| `src/features/ordering/components/CartPanel.tsx` | 套餐条目展示 |
| `src/features/admin/components/AdminPanel.tsx` | 新增套餐管理 tab + 表单 |
