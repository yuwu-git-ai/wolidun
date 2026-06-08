import { useReducer, useEffect, useMemo, useCallback } from 'react';
import { Product, CartItem } from '../../../shared/types';
import { DEFAULT_PRODUCTS } from '../../../shared/constants';
import {
  getIdentity, clearIdentity,
  fetchProducts, createOrder, fetchStats,
} from '../../../shared/api';
import { getItemUnitPrice, loadCartFromStorage, saveCartToStorage, getErrorMessage } from '../../../shared/utils';
import {
  customerReducer, createInitialState,
  type CustomerRawState,
} from '../customerReducer';

// ── Composite state (raw + computed) ──

export interface CustomerAppState extends CustomerRawState {
  sortedCart: CartItem[];
  itemsTotal: number;
  deliveryFee: number;
  totalPrice: number;
  filteredProducts: Product[];
  cartCount: number;
}

// ── Actions interface ──

export interface CustomerAppActions {
  addToCart: (product: Product, variantId?: string, isBrewing?: boolean, isFreezing?: boolean) => void;
  removeFromCart: (item: CartItem) => void;
  clearCart: () => void;
  reorder: (items: CartItem[]) => void;
  updateCartNote: (item: CartItem, note: string) => void;
  setActiveCategory: (id: string) => void;
  setSearchQuery: (q: string) => void;
  setCopied: (v: boolean) => void;
  setShowConfirm: (v: boolean) => void;
  setShowIdentityForm: (v: boolean) => void;
  setShowOrderHistory: (v: boolean) => void;
  setShowProfileForm: (v: boolean) => void;
  setIsDelivery: (v: boolean) => void;
  setIsMobileCartOpen: (v: boolean) => void;
  copyToClipboard: (text: string) => boolean;
  confirmAndCopy: () => Promise<void>;
  handleSaveIdentity: (nickname: string, dorm: string) => void;
  handleUpdateProfile: (nickname: string, dorm: string) => void;
  handleLogout: () => void;
}

// ── Hook ──

export function useCustomerApp(): { state: CustomerAppState; actions: CustomerAppActions } {
  // Lazy initial state
  const identity = getIdentity();
  const initialState: CustomerRawState = {
    ...createInitialState(),
    identity,
    showIdentityForm: !identity,
    cart: loadCartFromStorage(),
  };

  const [rawState, dispatch] = useReducer(customerReducer, initialState);

  // ── Side effects ──

  // 1. Load products on mount
  useEffect(() => {
    fetchProducts()
      .then(products => dispatch({ type: 'SET_PRODUCTS', payload: products }))
      .catch(err => {
        console.warn('Failed to load products:', err);
        dispatch({
          type: 'SET_PRODUCTS',
          payload: DEFAULT_PRODUCTS.map(p => ({ ...p, stock: p.stock || 999 })),
        });
      });
  }, []);  

  // 2. Load popular products
  useEffect(() => {
    fetchStats()
      .then(s => dispatch({ type: 'SET_POPULAR_IDS', payload: new Set(s.popular.map(p => p.id)) }))
      .catch(err => console.warn('Failed to load popular products:', err));
  }, []);  

  // 3. Persist cart to localStorage
  useEffect(() => {
    saveCartToStorage(rawState.cart);
  }, [rawState.cart]);

  // 4. Auto-refresh stock every 30s
  useEffect(() => {
    const t = setInterval(() => {
      fetchProducts()
        .then(products => dispatch({ type: 'SET_PRODUCTS', payload: products }))
        .catch(err => console.warn('Failed to refresh products:', err));
    }, 30000);
    return () => clearInterval(t);
  }, []);  

  // ── Computed values ──

  const sortedCart = useMemo(() =>
    [...rawState.cart].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    [rawState.cart]
  );

  const itemsTotal = useMemo(() =>
    sortedCart.reduce((sum, item) => {
      let p = item.price;
      if (item.isBrewingSelected) p += 1;
      if (item.isFreezingSelected) p += 0.5;
      return sum + p * item.quantity;
    }, 0),
    [sortedCart]
  );

  const deliveryFee = rawState.isDelivery && itemsTotal < 20 ? 1 : 0;
  const totalPrice = itemsTotal + deliveryFee;

  const filteredProducts = useMemo(() => {
    const inStock = rawState.products.filter(p => {
      if (p.variants && p.variants.length > 0) {
        return p.variants.reduce((sum, v) => sum + v.stock, 0) > 0;
      }
      return p.stock > 0;
    });
    const list = rawState.searchQuery
      ? inStock.filter(p =>
          p.name.toLowerCase().includes(rawState.searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(rawState.searchQuery.toLowerCase())
        )
      : inStock.filter(p => p.category === rawState.activeCategory);
    return list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }, [rawState.products, rawState.activeCategory, rawState.searchQuery]);

  const cartCount = rawState.cart.reduce((s, i) => s + i.quantity, 0);

  const state: CustomerAppState = {
    ...rawState,
    sortedCart,
    itemsTotal,
    deliveryFee,
    totalPrice,
    filteredProducts,
    cartCount,
  };

  // ── Action creators ──

  const addToCart = (product: Product, variantId?: string, isBrewing?: boolean, isFreezing?: boolean) =>
    dispatch({ type: 'ADD_TO_CART', payload: { product, variantId, isBrewing, isFreezing } });

  const removeFromCart = (item: CartItem) =>
    dispatch({ type: 'REMOVE_FROM_CART', payload: item });

  const clearCart = () => dispatch({ type: 'CLEAR_CART' });

  const reorder = (items: CartItem[]) => dispatch({ type: 'REORDER', payload: items });

  const updateCartNote = (item: CartItem, note: string) =>
    dispatch({ type: 'UPDATE_CART_NOTE', payload: { item, note } });

  const setActiveCategory = (id: string) => dispatch({ type: 'SET_ACTIVE_CATEGORY', payload: id });

  const setSearchQuery = (q: string) => dispatch({ type: 'SET_SEARCH_QUERY', payload: q });

  const setCopied = (v: boolean) => dispatch({ type: 'SET_COPIED', payload: v });

  const setShowConfirm = (v: boolean) => dispatch({ type: 'SET_SHOW_CONFIRM', payload: v });

  const setShowIdentityForm = (v: boolean) => dispatch({ type: 'SET_SHOW_IDENTITY_FORM', payload: v });

  const setShowOrderHistory = (v: boolean) => dispatch({ type: 'SET_SHOW_ORDER_HISTORY', payload: v });

  const setShowProfileForm = (v: boolean) => dispatch({ type: 'SET_SHOW_PROFILE_FORM', payload: v });

  const setIsDelivery = (v: boolean) => dispatch({ type: 'SET_IS_DELIVERY', payload: v });

  const setIsMobileCartOpen = (v: boolean) => dispatch({ type: 'SET_IS_MOBILE_CART_OPEN', payload: v });

  // Robust clipboard copy — works in WeChat browser, HTTP, and HTTPS
  const copyToClipboard = (text: string): boolean => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(err => console.warn('Clipboard write failed:', err));
      return true;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* execCommand may throw */ }
    document.body.removeChild(ta);
    return ok;
  };

  // Identity form save — sets identity + closes identity form + reloads cart
  const handleSaveIdentity = useCallback((nickname: string, dorm: string) => {
    dispatch({ type: 'SET_IDENTITY', payload: { nickname, dorm } });
    dispatch({ type: 'SET_SHOW_IDENTITY_FORM', payload: false });
    dispatch({ type: 'SET_CART', payload: loadCartFromStorage() });
  }, []);

  // Profile form save — sets identity + closes profile form only
  const handleUpdateProfile = useCallback((nickname: string, dorm: string) => {
    dispatch({ type: 'SET_IDENTITY', payload: { nickname, dorm } });
    dispatch({ type: 'SET_SHOW_PROFILE_FORM', payload: false });
  }, []);

  const handleLogout = useCallback(() => {
    clearIdentity();
    dispatch({ type: 'CLEAR_IDENTITY' });
    dispatch({ type: 'SET_SHOW_IDENTITY_FORM', payload: true });
  }, []);

  const confirmAndCopy = useCallback(async () => {
    if (!rawState.identity) return;
    if (rawState.cart.length === 0) {
      alert('购物车是空的，请先添加商品');
      return;
    }
    try {
      const result = await createOrder({
        nickname: rawState.identity.nickname,
        dorm: rawState.identity.dorm,
        isDelivery: rawState.isDelivery,
        items: sortedCart,
      });

      const orderLines = sortedCart.map(item => {
        const svc: string[] = [];
        if (item.isBrewingSelected) svc.push('帮泡+¥1');
        if (item.isFreezingSelected) svc.push('冰镇+¥0.5');
        const svcStr = svc.length > 0 ? ` [${svc.join(', ')}]` : '';
        const variantStr = item.variantName ? ` · ${item.variantName}` : '';
        const noteStr = item.note ? ` (${item.note})` : '';
        const up = getItemUnitPrice(item);
        return `${item.name}${variantStr}${svcStr}${noteStr} x${item.quantity} - ¥${(up * item.quantity).toFixed(2)}`;
      });
      const dInfo = rawState.isDelivery
        ? `配送: 送到 ${rawState.identity.dorm} (${deliveryFee === 0 ? '免配送费' : '¥1.00'})`
        : '取餐方式: 自提';
      const text = `--- 窝里蹲点单 ---\n下单人: ${rawState.identity.nickname}\n${dInfo}\n---\n${orderLines.join('\n')}${rawState.isDelivery ? `\n配送费: ¥${deliveryFee.toFixed(2)}` : ''}\n---\n总计: ¥${totalPrice.toFixed(2)}\n订单号: ${result.id}`;

      copyToClipboard(text);

      // Reload products after order
      fetchProducts()
        .then(products => dispatch({ type: 'SET_PRODUCTS', payload: products }))
        .catch(err => console.warn('Failed to reload products after order:', err));

      dispatch({ type: 'SET_COPIED', payload: true });
      dispatch({ type: 'SET_SHOW_CONFIRM', payload: false });
      dispatch({ type: 'CLEAR_CART' });
      setTimeout(() => dispatch({ type: 'SET_COPIED', payload: false }), 2000);
    } catch (err) {
      alert(getErrorMessage(err) || '下单失败');
    }
  }, [rawState.cart.length, rawState.identity, rawState.isDelivery, sortedCart, deliveryFee, totalPrice]);

  // ── Memoized actions object ──

  const actions = useMemo<CustomerAppActions>(() => ({
    addToCart,
    removeFromCart,
    clearCart,
    reorder,
    updateCartNote,
    setActiveCategory,
    setSearchQuery,
    setCopied,
    setShowConfirm,
    setShowIdentityForm,
    setShowOrderHistory,
    setShowProfileForm,
    setIsDelivery,
    setIsMobileCartOpen,
    copyToClipboard,
    confirmAndCopy,
    handleSaveIdentity,
    handleUpdateProfile,
    handleLogout,
  }), [confirmAndCopy, handleSaveIdentity, handleUpdateProfile, handleLogout]);

  return { state, actions };
}
