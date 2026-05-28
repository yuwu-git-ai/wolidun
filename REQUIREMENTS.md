# 窝里蹲点单系统 · 需求文档 v2.0

## 产品定位

楼内便利店线上点单。网页链接发微信群 → 楼友下单 → 5 分钟送达。
**核心差异化：** 帮泡面（热面送到）+ 冰镇饮料 — 淘宝做不到的即食状态。

## 用户角色

| 角色 | 描述 |
|------|------|
| 顾客 | 楼内邻居，微信群点链接进来，填昵称+宿舍号直接下单 |
| 店主 | 管理商品、处理订单、发货 |

## 功能清单

### P0 · 必须上线

#### 1. 免登录下单
- 顾客填写**昵称** + **宿舍号**即可下单，无需注册/密码
- 首次下单后浏览器 localStorage 记住身份，下次自动填入
- 不做账号体系，不做密码，不做 JWT

#### 2. 商品浏览
- 按分类展示商品（保留现有 5 个分类）
- 商品卡片：图片、名称、价格、库存、帮泡/冰镇选项
- 响应式：手机 2 列、平板 3 列、桌面 4 列
- 库存实时显示（下单后立即扣减，其他用户看到的是最新库存）

#### 3. 购物车 & 下单
- 保留现有加车/减量/删除交互
- 保留帮泡（+¥1）和冰镇（+¥0.5）选项
- **去掉多规格变体选择** — 便利店单品不需要"微辣/中辣/特辣"
- 订单确认页：商品清单 + 总价 + 配送费（满 ¥20 免配送费，否则 ¥1）
- 提交后生成订单，**一键复制订单内容到剪贴板**发微信群

#### 4. 订单通知（店主端）
- 新订单产生时，店主收到提醒
- 方案：管理面板**轮询**新订单（每 5 秒查一次），有未处理订单时：
  - 页面标题闪烁 `🔔 新订单！`
  - 浏览器通知（Notification API）
  - 声音提示

#### 5. 库存实时显示
- 下单时服务端事务扣减库存
- 前端定时刷新商品列表（每 30 秒），保证看到的库存是最新的
- 库存为 0 时显示"已售罄"，不可加车

### P1 · 重要

#### 6. 订单状态追踪
- 顾客下单后看到订单状态：
  - `pending` → "已下单，等待备货"
  - `preparing` → "备货中"
  - `delivered` → "已送达"
  - `cancelled` → "已取消"
- 顾客页面通过订单号查询状态
- 店主在管理面板修改状态

#### 7. 管理面板 · 精简版
- 去掉复杂管理 UI，改为：
  - 订单列表（按状态筛选：全部/待处理/备货中/已送达/已取消）
  - 点击订单展开详情
  - 一键切换状态（备货中 → 已送达）
  - 商品管理保留：添加/编辑/删除商品（简单表单即可）
- 管理员入口：密钥验证保留（`ADMIN_KEY` 环境变量），但 UI 简化

### P2 · 锦上添花

#### 8. 前端重设计
- 用 frontend-design skill 重新设计 UI
- 定位：便利店风格，清爽、快捷、亲和
- 参考：美团/饿了么便利店页面

#### 9. 商品图片上传
- 管理面板支持本地上传商品图片（当前只支持 URL）
- 图片存服务器本地 `data/images/`，通过 Express 静态文件服务

## 技术方案

### 架构不变
- 前端：React 19 + Tailwind CSS v4 + motion + lucide-react
- 后端：Express + better-sqlite3 + tsx
- 部署：Docker 单容器，阿里云 ECS 47.121.198.81:3001

### 数据库变更

```sql
-- users 表：删除（不再需要注册/登录）

-- products 表：删除 variants 字段（不再需要多规格）
-- 改后：
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  image TEXT DEFAULT '',
  stock INTEGER DEFAULT 999,
  allow_brewing INTEGER DEFAULT 0,   -- 帮泡面 +¥1
  allow_freezing INTEGER DEFAULT 0,   -- 冰镇 +¥0.5
  created_at TEXT DEFAULT (datetime('now'))
);

-- orders 表：user_id 改为可选（无账号体系），新增 dorm 字段保留
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,            -- 顾客昵称（下单时填）
  dorm TEXT NOT NULL,                -- 宿舍号（下单时填）
  is_delivery INTEGER DEFAULT 0,
  items TEXT NOT NULL,               -- JSON: [{id, name, price, quantity, isBrewing, isFreezing}]
  total_price REAL NOT NULL,
  status TEXT DEFAULT 'pending',     -- pending | preparing | delivered | cancelled
  created_at TEXT DEFAULT (datetime('now'))
);
```

### API 变更

| 端点 | 变更 |
|------|------|
| `POST /api/auth/login` | **删除** |
| `POST /api/auth/register` | **删除** |
| `GET /api/products` | 不变（public） |
| `POST /api/products` | 简化：去掉 variants 字段 |
| `PUT /api/products/:id` | 简化：去掉 variants 字段 |
| `DELETE /api/products/:id` | 不变 |
| `POST /api/orders` | **去 auth**：body 改为 `{nickname, dorm, isDelivery, items}` |
| `GET /api/orders` | 去 auth；支持 `?status=pending` 筛选；支持 `?nickname=xxx&dorm=xxx` 查自己的单 |
| `GET /api/orders/:id` | 新增：按订单号查询单个订单状态 |
| `PUT /api/orders/:id` | admin key 验证保留；支持更新 status |
| `POST /api/admin/verify` | 不变 |

### 前端变更

| 文件 | 变更 |
|------|------|
| `src/types.ts` | 删除 `User`；`Product` 去掉 `variants`；`CartItem` 去掉 `selectedVariant` |
| `src/api.ts` | 删除 login/register；`createOrder` 改为传 nickname/dorm；新增 `fetchOrder(id)` |
| `src/constants.ts` | `DEFAULT_PRODUCTS` 去掉 variants 字段 |
| `src/App.tsx` | 重写：去掉 AuthScreen → 直接进入下单页；首屏弹窗填昵称+宿舍号；去掉变体选择 UI |
| `src/index.css` | 不变 |

### 订单通知方案

店主浏览器开管理面板时：
1. 每 5 秒 `GET /api/orders?status=pending` 查询待处理订单数
2. 数量 > 0 且与上次不同 → 触发通知
3. 通知方式：`document.title` 闪烁 + `Notification.requestPermission()` + `<audio>` 播放提示音

### 库存刷新方案

顾客端：
1. 每 30 秒自动 `GET /api/products` 刷新商品列表
2. 静默更新，不打断用户操作（不显示 loading）
3. 如果某商品在购物车中但库存已变，购物车数量自动调整

## 不做的事

- ❌ 用户注册/登录/JWT
- ❌ 多规格变体选择
- ❌ 支付集成（线下现金/微信转账）
- ❌ 外卖配送（自配送，不接地图 API）
- ❌ 订单历史（顾客端不需要，管理端有就行）
- ❌ 评价/评分系统
- ❌ 优惠券/满减（太复杂，便利店不需要）
- ❌ WebSocket（轮询够用，5s 间隔对便利店场景足够）
- ❌ 手机号验证
