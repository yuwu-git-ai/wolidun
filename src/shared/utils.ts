import { CartItem, Combo } from './types';
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

export function getCartKey(item: { id: string; variantId?: string; isBrewingSelected?: boolean; isFreezingSelected?: boolean; comboId?: string; comboItems?: { productId: string; selectedBrewing?: boolean; selectedFreezing?: boolean }[] }): string {
  if (item.comboId && item.comboItems) {
    // Encode per-sub-item brewing/freezing so different selections create different cart entries
    const brew = item.comboItems.filter(ci => ci.selectedBrewing).map(ci => ci.productId).join(',');
    const freez = item.comboItems.filter(ci => ci.selectedFreezing).map(ci => ci.productId).join(',');
    return `c${item.comboId}-b:${brew}-f:${freez}`;
  }
  return `${item.comboId ? 'c' + item.comboId : item.id}-${item.variantId || ''}-${item.isBrewingSelected ? 'b' : ''}-${item.isFreezingSelected ? 'f' : ''}`;
}

export function getItemUnitPrice(item: { price: number; variants?: { id?: string; price?: number }[]; variantId?: string; isBrewingSelected?: boolean; isFreezingSelected?: boolean }): number {
  let base = item.price;
  if (item.variantId && item.variants) {
    const v = item.variants.find(v => v.id === item.variantId);
    if (v && v.price != null) base = v.price;
  }
  return base + (item.isBrewingSelected ? 1 : 0) + (item.isFreezingSelected ? 0.5 : 0);
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

// ── Combo detection ──

/**
 * Given a cart and available combos, merge matching individual items into combo entries.
 * Returns a new cart array. Does not mutate input.
 */
export function detectCombos(cart: CartItem[], combos: Combo[]): CartItem[] {
  if (!combos || combos.length === 0) return cart;

  let result = cart.map(item => ({ ...item }));
  let changed = true;
  const maxIter = 50;
  let iter = 0;

  while (changed && iter < maxIter) {
    changed = false;
    iter++;

    for (const combo of combos) {
      interface Match {
        comboItem: { productId: string; variantId?: string | null };
        cartItems: { idx: number; item: CartItem; qty: number }[];
      }
      const matches: Match[] = [];

      let allMatched = true;
      for (const ci of combo.items) {
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

      const matchGroupQtys = matches.map(m =>
        m.cartItems.reduce((sum, mi) => sum + mi.qty, 0)
      );
      let n = Math.min(...matchGroupQtys);
      if (n <= 0) continue;

      for (const match of matches) {
        let remaining = n;
        for (const mi of match.cartItems) {
          if (remaining <= 0) break;
          const ded = Math.min(remaining, mi.qty);
          result[mi.idx] = { ...result[mi.idx], quantity: result[mi.idx].quantity - ded };
          remaining -= ded;
        }
      }

      result = result.filter(item => item.quantity > 0);

      const existingComboIdx = result.findIndex(item => item.comboId === combo.id);
      if (existingComboIdx >= 0) {
        result[existingComboIdx] = { ...result[existingComboIdx], quantity: result[existingComboIdx].quantity + n };
      } else {
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
      break;
    }
  }

  return result;
}

// ── Error helper ──

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return '操作失败';
}
