import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import type { Express } from 'express';

let app: Express;

beforeAll(() => {
  app = createApp();
});

// ============================================================
// Health
// ============================================================
describe('GET /api/health', () => {
  it('returns ok with timestamp', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

// ============================================================
// Products (public)
// ============================================================
describe('GET /api/products', () => {
  it('returns a non-empty product array', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    // Each product should have required fields
    const p = res.body[0];
    expect(p.id).toBeDefined();
    expect(p.name).toBeDefined();
    expect(typeof p.price).toBe('number');
  });

  it('returns 404 for unknown product id', async () => {
    const res = await request(app).get('/api/products/nonexistent-id');
    expect(res.status).toBe(404);
  });
});

// ============================================================
// Orders
// ============================================================
describe('POST /api/orders', () => {
  it('creates an order and returns it', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        nickname: '测试用户',
        dorm: 'A101',
        isDelivery: true,
        items: [
          { id: 'p1', name: '招牌红烧肉套餐', price: 38, quantity: 1, isBrewing: false, isFreezing: false },
        ],
      });
    expect(res.status).toBe(200);
    // API returns the order directly, not wrapped
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('pending');
    expect(res.body.nickname).toBe('测试用户');
    expect(res.body.dorm).toBe('A101');
  });

  it('returns 400 when items is empty', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ nickname: '测试', dorm: 'A101', items: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when nickname is missing', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ dorm: 'A101', items: [{ id: 'p1', name: 'x', price: 1, quantity: 1 }] });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/orders', () => {
  it('returns orders for a given nickname+dorm', async () => {
    const res = await request(app)
      .get('/api/orders')
      .query({ nickname: '测试用户', dorm: 'A101' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Should find the order we created above
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe('GET /api/orders/:id', () => {
  it('returns 404 for nonexistent order', async () => {
    const res = await request(app).get('/api/orders/nonexistent-id');
    expect(res.status).toBe(404);
  });
});

// ============================================================
// Admin
// ============================================================
describe('POST /api/admin/verify', () => {
  it('rejects wrong admin key', async () => {
    const res = await request(app)
      .post('/api/admin/verify')
      .set('X-Admin-Key', 'wrong-key');
    expect(res.status).toBe(403);
  });
});
