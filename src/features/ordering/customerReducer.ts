import { Product, CartItem, Combo } from '../../shared/types';
import { getCartKey, detectCombos } from '../../shared/utils';
import type { Identity } from '../../shared/api';

// ── State ──

export interface CustomerRawState {
  identity: Identity | null;
  products: Product[];
  cart: CartItem[];
  activeCategory: string;
  copied: boolean;
  showConfirm: boolean;
  showIdentityForm: boolean;
  showOrderHistory: boolean;
  showProfileForm: boolean;
  isDelivery: boolean;
  isMobileCartOpen: boolean;
  searchQuery: string;
  popularIds: Set<string>;
  combos: Combo[];
}

export function createInitialState(): CustomerRawState {
  return {
    identity: null,
    products: [],
    cart: [],
    activeCategory: '1',
    copied: false,
    showConfirm: false,
    showIdentityForm: true,
    showOrderHistory: false,
    showProfileForm: false,
    isDelivery: false,
    isMobileCartOpen: false,
    searchQuery: '',
    popularIds: new Set(),
    combos: [],
  };
}

// ── Actions ──

export type CustomerAction =
  | { type: 'SET_IDENTITY'; payload: Identity }
  | { type: 'CLEAR_IDENTITY' }
  | { type: 'SET_PRODUCTS'; payload: Product[] }
  | { type: 'SET_CART'; payload: CartItem[] }
  | { type: 'ADD_TO_CART'; payload: { product: Product; variantId?: string; isBrewing?: boolean; isFreezing?: boolean } }
  | { type: 'REMOVE_FROM_CART'; payload: CartItem }
  | { type: 'CLEAR_CART' }
  | { type: 'REORDER'; payload: CartItem[] }
  | { type: 'UPDATE_CART_NOTE'; payload: { item: CartItem; note: string } }
  | { type: 'SET_ACTIVE_CATEGORY'; payload: string }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_COPIED'; payload: boolean }
  | { type: 'SET_SHOW_CONFIRM'; payload: boolean }
  | { type: 'SET_SHOW_IDENTITY_FORM'; payload: boolean }
  | { type: 'SET_SHOW_ORDER_HISTORY'; payload: boolean }
  | { type: 'SET_SHOW_PROFILE_FORM'; payload: boolean }
  | { type: 'SET_IS_DELIVERY'; payload: boolean }
  | { type: 'SET_IS_MOBILE_CART_OPEN'; payload: boolean }
  | { type: 'SET_POPULAR_IDS'; payload: Set<string> }
  | { type: 'SET_COMBOS'; payload: Combo[] }
  | { type: 'ADD_COMBO_TO_CART'; payload: { combo: Combo; brewingIds: Set<string>; freezingIds: Set<string>; variantIds: Map<string, string> } };

// ── Reducer ──

export function customerReducer(state: CustomerRawState, action: CustomerAction): CustomerRawState {
  switch (action.type) {
    case 'SET_IDENTITY':
      return { ...state, identity: action.payload };

    case 'CLEAR_IDENTITY':
      return { ...state, identity: null, cart: [] };

    case 'SET_PRODUCTS':
      return { ...state, products: action.payload };

    case 'SET_CART':
      return { ...state, cart: action.payload };

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
      newCart = detectCombos(newCart, state.combos);
      return { ...state, cart: newCart };
    }

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
      newCart = detectCombos(newCart, state.combos);
      return { ...state, cart: newCart };
    }

    case 'CLEAR_CART':
      return { ...state, cart: [] };

    case 'REORDER': {
      // Immutable merge — fix the original mutation bug
      const merged = state.cart.map(item => ({ ...item }));
      for (const incoming of action.payload) {
        const key = getCartKey(incoming);
        const idx = merged.findIndex(i => getCartKey(i) === key);
        if (idx >= 0) {
          merged[idx] = { ...merged[idx], quantity: merged[idx].quantity + incoming.quantity };
        } else {
          merged.push({ ...incoming });
        }
      }
      return { ...state, cart: merged, showOrderHistory: false };
    }

    case 'UPDATE_CART_NOTE': {
      const { item, note } = action.payload;
      const key = getCartKey(item);
      return {
        ...state,
        cart: state.cart.map(i =>
          getCartKey(i) === key ? { ...i, note: note || undefined } : i
        ),
      };
    }

    case 'SET_ACTIVE_CATEGORY':
      return { ...state, activeCategory: action.payload };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };

    case 'SET_COPIED':
      return { ...state, copied: action.payload };

    case 'SET_SHOW_CONFIRM':
      return { ...state, showConfirm: action.payload };

    case 'SET_SHOW_IDENTITY_FORM':
      return { ...state, showIdentityForm: action.payload };

    case 'SET_SHOW_ORDER_HISTORY':
      return { ...state, showOrderHistory: action.payload };

    case 'SET_SHOW_PROFILE_FORM':
      return { ...state, showProfileForm: action.payload };

    case 'SET_IS_DELIVERY':
      return { ...state, isDelivery: action.payload };

    case 'SET_IS_MOBILE_CART_OPEN':
      return { ...state, isMobileCartOpen: action.payload };

    case 'SET_POPULAR_IDS':
      return { ...state, popularIds: action.payload };

    case 'SET_COMBOS':
      return { ...state, combos: action.payload };

    case 'ADD_COMBO_TO_CART': {
      const { combo, brewingIds, freezingIds, variantIds } = action.payload;
      const tempComboItems = combo.items.map(ci => {
        const selectedVariantId = variantIds.get(ci.productId) || ci.variantId || null;
        // Recalculate price based on selected variant
        let price = ci.productPrice || 0;
        let variantName: string | undefined;
        if (selectedVariantId) {
          const product = state.products.find(p => p.id === ci.productId);
          const variant = product?.variants?.find(v => v.id === selectedVariantId);
          if (variant) {
            if (variant.price != null) price = variant.price;
            variantName = variant.name;
          }
        }
        if (brewingIds.has(ci.productId)) price += 1;
        if (freezingIds.has(ci.productId)) price += 0.5;
        return {
          productId: ci.productId,
          variantId: selectedVariantId,
          variantName,
          productName: ci.productName,
          productPrice: price,
          image: ci.image,
          selectedBrewing: brewingIds.has(ci.productId),
          selectedFreezing: freezingIds.has(ci.productId),
        };
      });
      const lookupKey = getCartKey({ id: combo.id, comboId: combo.id, comboItems: tempComboItems });
      const existingIdx = state.cart.findIndex(item => getCartKey(item) === lookupKey);
      let newCart: CartItem[];
      if (existingIdx >= 0) {
        newCart = state.cart.map((item, idx) =>
          idx === existingIdx ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        const actualTotal = tempComboItems.reduce((s, ci) => s + ci.productPrice, 0);
        const actualPrice = Math.max(0, actualTotal - combo.discount);
        const comboItem: CartItem = {
          id: combo.id,
          name: combo.name,
          price: actualPrice,
          category: '',
          description: '',
          stock: 999,
          quantity: 1,
          comboId: combo.id,
          comboItems: tempComboItems,
          comboDiscount: combo.discount,
        };
        newCart = [...state.cart, comboItem];
      }
      newCart = detectCombos(newCart, state.combos);
      return { ...state, cart: newCart };
    }

    default:
      return state;
  }
}
