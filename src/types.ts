export type ProductCategory =
  | 'Fashion & Beauty'
  | 'Electronics & Gadgets'
  | 'Clothing & Shoes'
  | 'Daily Essentials'
  | 'Food & Snacks';

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'Fashion & Beauty',
  'Electronics & Gadgets',
  'Clothing & Shoes',
  'Daily Essentials',
  'Food & Snacks',
];

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Packed'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled';

export const ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Packed',
  'Shipped',
  'Delivered',
  'Cancelled',
];

export type PaymentMethod = 'COD' | 'UPI';
export type PaymentStatus = 'Pending on Delivery' | 'Pending UPI Verification' | 'Verified';

export interface Product {
  id: string;
  name: string;
  description: string;
  category: ProductCategory;
  price: number;
  originalPrice: number;
  discountPercent: number;
  stock: number;
  rating: number | null;
  reviewCount: number;
  images: string[];
  featured: boolean;
  bestSeller: boolean;
  newArrival: boolean;
  specialOffer: boolean;
  isDemo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface OrderLineItem {
  productId: string;
  name: string;
  image: string;
  price: number;
  originalPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface CustomerDetails {
  customerName: string;
  customerMobile: string;
  customerEmail: string;
  deliveryAddress: string;
  city: string;
  pincode: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  idempotencyKey: string;
  userId: string;
  customerName: string;
  customerMobile: string;
  customerEmail: string;
  deliveryAddress: string;
  city: string;
  pincode: string;
  items: OrderLineItem[];
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  finalTotal: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  upiReference?: string;
  createdAt: string;
  updatedAt: string;
  syncedToFirestore?: boolean;
}

export interface ChatMessage {
  id: string;
  senderRole: 'customer' | 'ai' | 'admin';
  senderName: string;
  text: string;
  language?: 'en' | 'hi' | 'mr';
  createdAt: string;
}

export interface SupportConversation {
  id: string;
  customerUid: string;
  customerName: string;
  customerEmail?: string;
  lastMessage: string;
  needsHumanSupport: boolean;
  unreadByAdmin: number;
  unreadByCustomer: number;
  status: 'open' | 'resolved';
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
}

export interface CustomerRecord {
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  address?: string;
  wishlistCount?: number;
  wishlistIds?: string[];
  orderCount?: number;
  totalSpent?: number;
}

export type ActiveView =
  | 'home'
  | 'cart'
  | 'checkout'
  | 'wishlist'
  | 'orders'
  | 'admin'
  | 'confirmation';
