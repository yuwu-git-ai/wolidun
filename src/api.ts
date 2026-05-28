const BASE = '/api';

// ── Identity (replaces auth) ──
const IDENTITY_KEY = 'wolidun_identity';

export interface Identity {
  nickname: string;
  dorm: string;
}

export function getIdentity(): Identity | null {
  const raw = localStorage.getItem(IDENTITY_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setIdentity(nickname: string, dorm: string) {
  localStorage.setItem(IDENTITY_KEY, JSON.stringify({ nickname, dorm }));
}

export function clearIdentity() {
  localStorage.removeItem(IDENTITY_KEY);
}

// ── Admin token ──
const ADMIN_KEY = 'wolidun_admin_key';

export function getAdminKey(): string | null {
  return localStorage.getItem(ADMIN_KEY);
}

export function setAdminKey(key: string) {
  localStorage.setItem(ADMIN_KEY, key);
}

// ── Request helper ──
async function request(url: string, options: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: '请求失败' }));
    throw new Error(data.error || '请求失败');
  }

  return res.json();
}

// ── Admin ──
export async function verifyAdmin(adminKey: string) {
  return request(`${BASE}/admin/verify`, {
    method: 'POST',
    headers: { 'X-Admin-Key': adminKey },
  });
}

// ── Products ──
export async function fetchProducts() {
  return request(`${BASE}/products`);
}

export async function createProduct(product: any, adminKey: string) {
  return request(`${BASE}/products`, {
    method: 'POST',
    headers: { 'X-Admin-Key': adminKey },
    body: JSON.stringify(product),
  });
}

export async function updateProduct(id: string, product: any, adminKey: string) {
  return request(`${BASE}/products/${id}`, {
    method: 'PUT',
    headers: { 'X-Admin-Key': adminKey },
    body: JSON.stringify(product),
  });
}

export async function deleteProduct(id: string, adminKey: string) {
  return request(`${BASE}/products/${id}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Key': adminKey },
  });
}

// ── Orders ──
export async function createOrder(params: {
  nickname: string;
  dorm: string;
  isDelivery: boolean;
  items: any[];
}) {
  return request(`${BASE}/orders`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function fetchOrders(params?: { status?: string; nickname?: string; dorm?: string }) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.nickname) qs.set('nickname', params.nickname);
  if (params?.dorm) qs.set('dorm', params.dorm);
  const q = qs.toString();
  return request(`${BASE}/orders${q ? '?' + q : ''}`);
}

export async function fetchOrderById(id: string) {
  return request(`${BASE}/orders/${id}`);
}

export async function updateOrderStatus(orderId: string, status: string, adminKey: string) {
  return request(`${BASE}/orders/${orderId}`, {
    method: 'PUT',
    headers: { 'X-Admin-Key': adminKey },
    body: JSON.stringify({ status }),
  });
}
