# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

窝里蹲点单系统 (Wolidun Ordering System) — a dormitory convenience store ordering SPA. No-login flow: fill nickname + dorm → browse → order → copy to WeChat. Admin panel with order notifications and product CRUD. Full-stack: React 19 + Express/SQLite, Docker deployment. Tailwind CSS v4, `motion`, lucide-react.

## Commands

```bash
npm run dev          # Vite dev server on :3000 (frontend only, binds 0.0.0.0)
npm run dev:server   # Express backend on :3001 (API only; tsx watch = auto-restart)
npm run dev:all      # Both concurrently via concurrently package (:3000 + :3001)
npm run build        # Vite production build → dist/
npm run start        # Production server (tsx server/index.ts, serves API + dist/)
npm run lint         # TypeScript type-check (tsc --noEmit)
npm run clean        # Remove dist/
npm run preview      # Vite preview server (preview the built dist/)
```

There is no test suite — running tests is not applicable.

## Architecture

### Client-side routing
Uses pathname-based routing via `window.location.pathname.startsWith('/admin')`, not React Router:
- `/` → `CustomerApp` — identity form (first visit) → product browsing → cart → order confirmation with clipboard copy → order tracker
- `/admin` → `AdminGate` → `AdminPanel` — admin key prompt → order management (with notifications) + product CRUD

### Backend (`server/`)
- `server/index.ts` — Express entry; initializes DB, mounts routes at `/api`, provides `/api/health`; in production (`NODE_ENV=production`), also serves `dist/` static files with SPA fallback (`*` → `index.html`). Body limit: 10MB (supports base64 image uploads).
- `server/db.ts` — SQLite via better-sqlite3 (WAL mode, foreign keys on). Auto-migration to schema v2: drops `users` table, removes `variants` from `products`, removes `user_id` FK from `orders`. Seeds 5 default products on first run.
- `server/middleware/auth.ts` — `requireAdmin` only (X-Admin-Key header). No more JWT/requireAuth.
- `server/routes/products.ts` — CRUD at `/api/products`; GET is public, POST/PUT/DELETE require `requireAdmin`; also `POST /api/admin/verify`. No more `variants` field.
- `server/routes/orders.ts` — `POST /api/orders` (no auth, accepts `nickname`+`dorm`+`items`; stock in transaction), `GET /api/orders` (filters: `?status=` or `?nickname=&dorm=`), `GET /api/orders/:id` (single lookup), `PUT /api/orders/:id` (admin status update; cancelling restores stock). Statuses: pending/preparing/delivered/cancelled.

### Frontend (`src/`)
- `src/App.tsx` — All UI components:
  - `IdentityForm` — Nickname + dorm form (first visit only, saved to localStorage)
  - `ProductCard` — Simplified: no variant selection, brewing/freezing checkboxes, stock badge
  - `CustomerApp` — Identity → browsing → cart → order confirmation → order tracker
  - `CartPanel` — Shared cart UI (desktop sidebar + mobile bottom sheet)
  - `OrderTracker` — Look up order by ID, see status
  - `AdminGate` — Admin key verification → `AdminPanel`
  - `AdminPanel` — Orders tab (with 5s polling, sound + title flash + Notification API for new orders) + Products tab (simple form + list)
  - `OrderCard` — Expandable order card with status action buttons
- `src/api.ts` — No more JWT. Identity in `localStorage.wolidun_identity`. `createOrder` takes `nickname`+`dorm`. Added `fetchOrderById(id)`, `fetchOrders(params?)`.
- `src/types.ts` — `Product`, `CartItem`, `Category`, `Order` (no more `User`)
- `src/constants.ts` — 5 default categories + 5 products (no variants)
- `src/index.css` — Tailwind CSS v4 import + `.scrollbar-none` utility class for hiding scrollbars on mobile category tabs
- `vite.config.ts` — Proxies `/api` to `localhost:3001` in dev; injects `GEMINI_API_KEY` from env via `define`; `@` alias resolves to project root

### Data flow
- **Identity**: `localStorage.wolidun_identity` → `{nickname, dorm}`. No registration, no password, no JWT.
- **Products**: Loaded from `GET /api/products` on mount + 30s auto-refresh; fallback to `DEFAULT_PRODUCTS` if API fails
- **Orders**: Created via `POST /api/orders` (`{nickname, dorm, items, isDelivery}`). Stock deducted in transaction. Order text auto-copied to clipboard for WeChat sharing.
- **Order tracking**: Customer looks up order by ID via `GET /api/orders/:id`, sees status
- **Delivery fee**: ¥1.00 if order subtotal < ¥20; free otherwise
- **Admin**: Key verified via `POST /api/admin/verify`. Admin panel polls `GET /api/orders?status=pending` every 5s. New pending orders trigger: sound + `document.title` flash + Notification API.
- **Status flow**: pending → preparing (备货中) → delivered (已送达) | cancelled (已取消, restores stock)

### Database (SQLite v2)
`serialize*()` functions convert snake_case DB format to camelCase API format:
- `products(id TEXT, name TEXT, price REAL, category TEXT, description TEXT, image TEXT, stock INTEGER, allow_brewing INTEGER, allow_freezing INTEGER)` — no `variants` column
- `orders(id TEXT, nickname TEXT, dorm TEXT, is_delivery INTEGER, items TEXT, total_price REAL, status TEXT, created_at TEXT)` — no FK; `items` is JSON; statuses: pending/preparing/delivered/cancelled
- `schema_version(version INTEGER)` — migration tracking. v1→v2: drops `users` table, removes `variants` and `user_id` columns via table re-creation

## Responsive Design

Full mobile-first responsive design using Tailwind breakpoints. Three distinct layout tiers:

### Mobile (< 768px)
- **Categories**: Horizontal scrollable pill tabs (`overflow-x-auto`, hidden scrollbar via `.scrollbar-none`) with icon + label
- **Product grid**: 2 columns (`grid-cols-2`), square images (`aspect-square`), compact typography
- **Cart**: Fixed bottom bar showing cart count + total + "去确认" button; tapping opens a **bottom sheet overlay** (80vh, spring-animated slide-up, frosted backdrop, sticky header/footer)
- **Admin**: Single-column layout, product list as touch-friendly cards (not table)
- **Auth**: Cards have `mx-2` margin to prevent edge-to-edge on narrow screens

### Tablet (768px - 1024px)
- **Categories**: Transition to vertical icon sidebar (`md:flex`)
- **Product grid**: Still 2 columns, larger images (`sm:aspect-video`), larger typography
- **Cart**: Still bottom bar + bottom sheet (sidebar only at lg+)

### Desktop (≥ 1024px)
- **Cart**: Persistent right sidebar (`w-80`, `lg:flex`), bottom bar hidden
- **Product grid**: 3 columns (`xl:grid-cols-3`)
- **Admin**: Form sidebar + data table layout (`md:grid-cols-12`)

### Touch interactions
- `active:scale-[0.98]` / `active:scale-95` on buttons for press feedback
- Larger touch targets on mobile (full-width buttons, bigger icons)

## Environment Variables

From `.env` (used locally; Docker reads via `env_file`):
- `PORT` — server port (default 3001)
- `JWT_SECRET` — signing key for JWTs
- `ADMIN_KEY` — admin panel access key (default `admin123`)
- `DB_PATH` — SQLite file path (default `./data/ordering.db`)
- `GEMINI_API_KEY` — Google Gemini AI key (injected into frontend bundle at build time)

## Docker Deployment

Single-container multi-stage build:
- **Stage 1** (build): `node:20` Debian, `npm ci` (mirror: npmmirror.com), `vite build` → `dist/`, `tsc --project tsconfig.server.json` → `dist-server/` (CommonJS)
- **Stage 2** (production): `node:20` Debian, copies `dist/`, `dist-server/`, `node_modules` from build; removes `"type": "module"` from `package.json` so compiled JS runs as CommonJS
- Production CMD: `node dist-server/server/index.js`
- DB persisted via Docker volume: `./data:/app/data`

### Deploy to server

Server: Alibaba Cloud ECS, Ubuntu 24.04, Docker + Docker Compose installed.
Project location on server: `/root/app/`

See `deploy.cjs` (not committed) for the deployment script.
Production URL: `http://<server-ip>:3001/` (customer), `http://<server-ip>:3001/admin` (admin)

## Build Notes

- `tsconfig.server.json` uses `"module": "commonjs"` — do NOT change to `"node16"` or ESM; the Dockerfile's production stage deletes `"type":"module"` from package.json so Node treats `.js` as CommonJS
- `better-sqlite3` is a native module — must compile on Debian (glibc), not Alpine (musl). Both Docker stages use `node:20` (Debian-based)
- npm mirror (`registry.npmmirror.com`) is configured in Dockerfile for GFW compatibility
- Server files use `process.cwd()` instead of `import.meta.url` / `__dirname` for CommonJS compatibility
