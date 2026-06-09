import type { Product, CartItem, Order, Combo } from './types';

const BASE = '/api';

// ── Auth (register + login) ──
export async function register(nickname: string, dorm: string, password: string): Promise<{ nickname: string; dorm: string }> {
  return request(`${BASE}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ nickname, dorm, password }),
  });
}

export async function login(nickname: string, password: string): Promise<{ nickname: string; dorm: string }> {
  return request(`${BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ nickname, password }),
  });
}

export async function updateProfile(nickname: string, dorm: string, password: string): Promise<{ nickname: string; dorm: string }> {
  return request(`${BASE}/auth/profile`, {
    method: 'PUT',
    body: JSON.stringify({ nickname, dorm, password }),
  });
}

export async function changePassword(nickname: string, oldPassword: string, newPassword: string): Promise<{ success: boolean }> {
  return request(`${BASE}/auth/password`, {
    method: 'PUT',
    body: JSON.stringify({ nickname, oldPassword, newPassword }),
  });
}

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

function isRetryableError(err: unknown): boolean {
  // Retry on network errors (fetch rejects with TypeError)
  if (err instanceof TypeError) return true;
  // Retry on 5xx server errors
  if (err instanceof Error) {
    const statusMatch = err.message.match(/^\[(\d+)\]/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      return status >= 500 && status < 600;
    }
  }
  return false;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let _globalAdminUser: string | undefined;
export function setGlobalAdminUser(user: string | undefined) {
  _globalAdminUser = user;
}

function buildAdminHeaders(adminKey?: string, adminUser?: string): Record<string, string> {
  const h: Record<string, string> = {};
  if (adminKey) h['X-Admin-Key'] = adminKey;
  const user = adminUser || _globalAdminUser;
  if (user) h['X-User'] = user;
  return h;
}

async function request<T = unknown>(url: string, options: RequestInit = {}, retries = 3): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...options, headers });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: '请求失败' }));
        const errMsg = `[${res.status}] ${data.error || '请求失败'}`;
        // Only retry on 5xx; 4xx errors fail immediately
        if (res.status >= 500 && res.status < 600 && attempt < retries) {
          console.warn(`API ${res.status} (attempt ${attempt + 1}/${retries + 1}), retrying in ${Math.pow(2, attempt)}s...`);
          await delay(Math.pow(2, attempt) * 1000);
          continue;
        }
        throw new Error(errMsg);
      }

      return res.json();
    } catch (err) {
      if (attempt < retries && isRetryableError(err)) {
        console.warn(`API request failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${Math.pow(2, attempt)}s...`, getErrorMessage(err));
        await delay(Math.pow(2, attempt) * 1000);
        continue;
      }
      throw err;
    }
  }

  throw new Error('请求失败：已达到最大重试次数');
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return '未知错误';
}

// ── Admin ──
export async function verifyAdmin(adminKey: string): Promise<{ valid: boolean }> {
  return request(`${BASE}/admin/verify`, {
    method: 'POST',
    headers: buildAdminHeaders(adminKey),
  });
}

// ── Products ──
export async function fetchProducts(): Promise<Product[]> {
  return request(`${BASE}/products`);
}

export async function createProduct(product: Omit<Product, 'id'>, adminKey: string): Promise<Product> {
  return request(`${BASE}/products`, {
    method: 'POST',
    headers: buildAdminHeaders(adminKey),
    body: JSON.stringify(product),
  });
}

export async function updateProduct(id: string, product: Partial<Product>, adminKey: string): Promise<Product> {
  return request(`${BASE}/products/${id}`, {
    method: 'PUT',
    headers: buildAdminHeaders(adminKey),
    body: JSON.stringify(product),
  });
}

export async function deleteProduct(id: string, adminKey: string): Promise<{ success: boolean }> {
  return request(`${BASE}/products/${id}`, {
    method: 'DELETE',
    headers: buildAdminHeaders(adminKey),
  });
}

// ── Orders ──
export async function createOrder(params: {
  nickname: string;
  dorm: string;
  isDelivery: boolean;
  items: CartItem[];
}): Promise<Order> {
  return request(`${BASE}/orders`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function fetchOrders(params?: { status?: string; nickname?: string; dorm?: string }): Promise<Order[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.nickname) qs.set('nickname', params.nickname);
  if (params?.dorm) qs.set('dorm', params.dorm);
  const q = qs.toString();
  return request(`${BASE}/orders${q ? '?' + q : ''}`);
}

export async function fetchOrderById(id: string): Promise<Order> {
  return request(`${BASE}/orders/${id}`);
}

export async function deleteOrder(id: string, nickname: string, adminKey?: string): Promise<{ success: boolean }> {
  const headers: Record<string, string> = {};
  if (adminKey) headers['X-Admin-Key'] = adminKey;
  return request(`${BASE}/orders/${id}`, {
    method: 'DELETE',
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: JSON.stringify({ nickname }),
  });
}

// ── Stats ──
export async function fetchStats(params?: { view?: 'monthly' | 'yearly'; year?: number; month?: number }): Promise<{
  popular: { id: string; count: number }[];
  today: { orders: number; revenue: number };
  daily: { label: string; date: string; orders: number; revenue: number }[];
  monthly: { label: string; month: string; orders: number; revenue: number }[];
}> {
  const qs = new URLSearchParams();
  if (params?.view) qs.set('view', params.view);
  if (params?.year) qs.set('year', String(params.year));
  if (params?.month) qs.set('month', String(params.month));
  const q = qs.toString();
  return request(`${BASE}/stats${q ? '?' + q : ''}`);
}

export async function updateOrderStatus(orderId: string, status: string, adminKey: string): Promise<Order> {
  return request(`${BASE}/orders/${orderId}`, {
    method: 'PUT',
    headers: buildAdminHeaders(adminKey),
    body: JSON.stringify({ status }),
  });
}

// ── Posts (Square / 广场) ──

export interface Post {
  id: string;
  user_id: string;
  type: 'help' | 'skill' | 'feedback' | 'teamup';
  title: string;
  content: string;
  tags: string;
  price: string;
  status: 'open' | 'claimed' | 'done' | 'cancelled';
  claimed_by: string;
  players: number;
  max_players: number;
  anonymous: number;
  likes_count: number;
  comments_count: number;
  created_at: string;
  comments?: Comment[];
  joined?: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  anonymous: number;
  created_at: string;
}

export async function fetchPosts(params?: { type?: string; status?: string; page?: number; sort?: string; search?: string }): Promise<{
  posts: Post[];
  total: number;
  page: number;
  limit: number;
}> {
  const qs = new URLSearchParams();
  if (params?.type) qs.set('type', params.type);
  if (params?.status) qs.set('status', params.status);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.sort) qs.set('sort', params.sort);
  if (params?.search) qs.set('search', params.search);
  const q = qs.toString();
  return request(`${BASE}/posts${q ? '?' + q : ''}`);
}

export async function fetchPostById(id: string, userId?: string): Promise<Post> {
  const qs = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
  return request(`${BASE}/posts/${id}${qs}`);
}

export async function createPost(data: {
  user_id: string;
  type: string;
  title: string;
  content?: string;
  tags?: string;
  price?: string;
  anonymous?: boolean;
  players?: number;
  max_players?: number;
}): Promise<Post> {
  return request(`${BASE}/posts`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePost(id: string, data: { status: string; claimed_by?: string; user_id: string }): Promise<Post> {
  return request(`${BASE}/posts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function addComment(postId: string, data: { user_id: string; content: string; anonymous?: boolean }): Promise<Comment> {
  return request(`${BASE}/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteComment(postId: string, commentId: string, userId: string, adminKey?: string, reason?: string): Promise<{ success: boolean }> {
  const headers: Record<string, string> = {};
  if (adminKey) headers['X-Admin-Key'] = adminKey;
  return request(`${BASE}/posts/${postId}/comments/${commentId}`, {
    method: 'DELETE',
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: JSON.stringify({ user_id: userId, reason }),
  });
}

export async function toggleLike(postId: string, userId: string): Promise<{ liked: boolean }> {
  return request(`${BASE}/posts/${postId}/like`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function fetchJoinedPostIds(userId: string): Promise<string[]> {
  const data = await request<{ joined_ids: string[] }>(`${BASE}/posts/joined?user_id=${encodeURIComponent(userId)}`);
  return data.joined_ids;
}

export async function joinPost(postId: string, userId: string): Promise<Post> {
  return request(`${BASE}/posts/${postId}/join`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function leavePost(postId: string, userId: string): Promise<Post> {
  return request(`${BASE}/posts/${postId}/leave`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function deletePost(postId: string, userId: string): Promise<{ success: boolean }> {
  return request(`${BASE}/posts/${postId}`, {
    method: 'DELETE',
    body: JSON.stringify({ user_id: userId }),
  });
}

// ── Combos ──
export async function fetchCombos(): Promise<Combo[]> {
  return request(`${BASE}/combos`);
}

export async function createCombo(combo: { name: string; discount: number; items: { productId: string; variantId?: string | null }[] }, adminKey: string): Promise<Combo> {
  return request(`${BASE}/combos`, {
    method: 'POST',
    headers: buildAdminHeaders(adminKey),
    body: JSON.stringify(combo),
  });
}

export async function updateCombo(id: string, combo: { name?: string; discount?: number; items?: { productId: string; variantId?: string | null }[] }, adminKey: string): Promise<Combo> {
  return request(`${BASE}/combos/${id}`, {
    method: 'PUT',
    headers: buildAdminHeaders(adminKey),
    body: JSON.stringify(combo),
  });
}

export async function deleteCombo(id: string, adminKey: string): Promise<{ success: boolean }> {
  return request(`${BASE}/combos/${id}`, {
    method: 'DELETE',
    headers: buildAdminHeaders(adminKey),
  });
}

// ── Admin ──
export async function fetchAllUsers(adminKey: string, adminUser?: string): Promise<{ users: { nickname: string; dorm: string; created_at: string; friend_count: number; post_count: number; is_admin: number }[] }> {
  return request(`${BASE}/admin/users`, {
    headers: buildAdminHeaders(adminKey, adminUser),
  });
}

export async function toggleUserAdmin(adminKey: string, nickname: string, adminUser?: string): Promise<{ nickname: string; is_admin: boolean }> {
  return request(`${BASE}/admin/users/${encodeURIComponent(nickname)}/admin`, {
    method: 'PUT',
    headers: buildAdminHeaders(adminKey, adminUser),
  });
}

// ── Auth check ──
export async function checkIsAdmin(nickname: string): Promise<{ is_admin: boolean }> {
  return request(`${BASE}/admin/check?nickname=${encodeURIComponent(nickname)}`);
}

// ── Notifications ──
export async function fetchNotifications(userId: string): Promise<{ notifications: any[]; announcements: any[] }> {
  return request(`${BASE}/notifications?user_id=${encodeURIComponent(userId)}`);
}

export async function fetchUnreadCount(userId: string): Promise<{ count: number }> {
  return request(`${BASE}/notifications/unread-count?user_id=${encodeURIComponent(userId)}`);
}

export async function markNotificationRead(id: string): Promise<{ success: boolean }> {
  return request(`${BASE}/notifications/${id}/read`, { method: 'PUT' });
}

export async function broadcastNotification(adminKey: string, title: string, content: string, isGlobal?: boolean, userIds?: string[]): Promise<{ success: boolean; count: number; global?: boolean }> {
  return request(`${BASE}/notifications/broadcast`, {
    method: 'POST',
    headers: buildAdminHeaders(adminKey),
    body: JSON.stringify({ title, content, is_global: isGlobal, user_ids: userIds }),
  });
}

// ── Users & Profiles ──

export interface UserProfile {
  nickname: string;
  dorm: string;
  created_at: string;
  avatar: string;
  bio: string;
  skills: string[];
  contact: { wechat?: string; phone?: string; qq?: string };
  status_text: string;
  friend_count: number;
  posts: Post[];
  friendship: { id: string; from_user: string; to_user: string; status: string } | null;
}

export interface FriendInfo {
  id: string;
  from_user: string;
  to_user: string;
  accepted_at: string;
  friend_nickname: string;
  avatar: string;
  bio: string;
  status_text: string;
}

export interface Conversation {
  partner: string;
  dorm: string;
  avatar: string;
  last_message: Message | null;
  unread: number;
}

export interface Message {
  id: string;
  from_user: string;
  to_user: string;
  content: string;
  is_read: number;
  created_at: string;
}

export async function fetchUserProfile(nickname: string, viewer?: string): Promise<UserProfile> {
  const qs = viewer ? `?viewer=${encodeURIComponent(viewer)}` : '';
  return request(`${BASE}/users/${encodeURIComponent(nickname)}${qs}`);
}

export async function updateUserProfile(nickname: string, data: {
  avatar?: string; bio?: string; skills?: string[]; contact?: object; status_text?: string;
}): Promise<any> {
  return request(`${BASE}/users/${encodeURIComponent(nickname)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function searchUsers(q: string): Promise<{ users: { nickname: string; dorm: string }[] }> {
  return request(`${BASE}/users/search`, {
    method: 'POST',
    body: JSON.stringify({ q }),
  });
}

// ── Friends ──

export async function sendFriendRequest(from: string, to: string): Promise<{ ok: boolean; auto_accepted?: boolean }> {
  return request(`${BASE}/friends/request`, {
    method: 'POST',
    body: JSON.stringify({ from, to }),
  });
}

export async function respondFriendRequest(from: string, to: string, action: 'accept' | 'reject'): Promise<{ ok: boolean }> {
  return request(`${BASE}/friends/respond`, {
    method: 'PUT',
    body: JSON.stringify({ from, to, action }),
  });
}

export async function fetchFriends(userId: string): Promise<{ friends: FriendInfo[]; sent: any[]; received: any[] }> {
  return request(`${BASE}/friends?user_id=${encodeURIComponent(userId)}`);
}

export async function fetchPendingFriendCount(userId: string): Promise<{ count: number }> {
  return request(`${BASE}/friends/pending-count?user_id=${encodeURIComponent(userId)}`);
}

export async function deleteFriend(userId: string, friendNickname: string): Promise<{ ok: boolean }> {
  return request(`${BASE}/friends/${encodeURIComponent(friendNickname)}`, {
    method: 'DELETE',
    body: JSON.stringify({ user_id: userId }),
  });
}

// ── Messages ──

export async function sendMessage(from: string, to: string, content: string): Promise<Message> {
  return request(`${BASE}/messages`, {
    method: 'POST',
    body: JSON.stringify({ from, to, content }),
  });
}

export async function fetchConversation(userId: string, partner: string): Promise<{ messages: Message[] }> {
  return request(`${BASE}/messages/${encodeURIComponent(partner)}?user_id=${encodeURIComponent(userId)}`);
}

export async function fetchConversations(userId: string): Promise<{ conversations: Conversation[] }> {
  return request(`${BASE}/messages?user_id=${encodeURIComponent(userId)}`);
}

export async function fetchTotalUnread(userId: string): Promise<{ count: number }> {
  return request(`${BASE}/messages/unread-total?user_id=${encodeURIComponent(userId)}`);
}
