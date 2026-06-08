export interface ProductVariant {
  id?: string;
  name: string;
  price?: number;
  stock: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
  image?: string;
  stock: number;
  allowBrewing?: boolean;
  allowFreezing?: boolean;
  variants?: ProductVariant[];
}

export interface CartItem extends Product {
  quantity: number;
  isBrewingSelected?: boolean;
  isFreezingSelected?: boolean;
  variantId?: string;
  variantName?: string;
  note?: string;
  comboId?: string;
  comboItems?: ComboItem[];
  comboDiscount?: number;
}

export interface ComboItem {
  productId: string;
  variantId?: string | null;
  productName?: string;
  productPrice?: number;
  image?: string;
  allowBrewing?: boolean;
  allowFreezing?: boolean;
  selectedBrewing?: boolean;
  selectedFreezing?: boolean;
}

export interface Combo {
  id: string;
  name: string;
  discount: number;
  originalPrice: number;
  comboPrice: number;
  items: ComboItem[];
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface Order {
  id: string;
  nickname: string;
  dorm: string;
  isDelivery: boolean;
  items: CartItem[];
  totalPrice: number;
  status: 'pending' | 'preparing' | 'delivered' | 'cancelled';
  createdAt: string;
}
