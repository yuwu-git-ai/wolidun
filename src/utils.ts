import { CartItem } from './types';
import { getIdentity } from './api';

// ── Status helpers ──

export const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  preparing: '备货中',
  delivered: '已送达',
  cancelled: '已取消',
};

export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-orange-100 text-orange-700',
  preparing: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

// ── Cart helpers ──

export function getCartKey(item: { id: string; isBrewingSelected?: boolean; isFreezingSelected?: boolean }): string {
  return `${item.id}-${item.isBrewingSelected ? 'b' : ''}-${item.isFreezingSelected ? 'f' : ''}`;
}

export function getItemUnitPrice(item: { price: number; isBrewingSelected?: boolean; isFreezingSelected?: boolean }): number {
  return item.price + (item.isBrewingSelected ? 1 : 0) + (item.isFreezingSelected ? 0.5 : 0);
}

// ── Cart Storage ──

export function getCartStorageKey(): string {
  const id = getIdentity();
  return id ? `wolidun_cart_${id.nickname}_${id.dorm}` : 'wolidun_cart';
}

export function loadCartFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(getCartStorageKey());
    return raw ? JSON.parse(raw) : [];
  } catch { /* localStorage parse error */ return []; }
}

export function saveCartToStorage(items: CartItem[]) {
  try {
    if (items.length > 0) {
      localStorage.setItem(getCartStorageKey(), JSON.stringify(items));
    } else {
      localStorage.removeItem(getCartStorageKey());
    }
  } catch { /* localStorage write failed */ }
}

// ── Error helper ──

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return '操作失败';
}
