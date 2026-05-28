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
}

export interface CartItem extends Product {
  quantity: number;
  isBrewingSelected?: boolean;
  isFreezingSelected?: boolean;
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
