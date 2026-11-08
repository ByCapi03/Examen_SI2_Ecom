export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
}

export type Role = 'CLIENT' | 'ADMIN' | 'BRANCH_MANAGER' | 'CASHIER';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  availableSizes: string[];
  availableColors: string[];
}

export interface ProductVariant {
  id: string;
  productId: string;
  size: string;
  color: string;
  stock: number;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface Branch {
  id: string;
  name: string;
  city: string;
  address: string;
}

export interface Reservation {
  id: string;
  userId: string;
  branchId: string;
  items: ReservationItem[];
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  date: string;
}

export interface ReservationItem {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  total: number;
}

export interface CartItem {
  productId: string;
  variantId: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  variantId: string;
  quantity: number;
  price: number;
}

export interface Sale {
  id: string;
  orderId?: string;
  branchId: string;
  cashierId: string;
  total: number;
  createdAt: string;
}

export interface Payment {
  id: string;
  amount: number;
  method: 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH' | 'TRANSFER';
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
}
