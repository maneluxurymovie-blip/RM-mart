import type { CartItem, OrderLineItem, Product } from '../types';

export const FREE_DELIVERY_THRESHOLD_INR = 999;
export const STANDARD_DELIVERY_FEE_INR = 79;

export interface CartTotals {
  itemCount: number;
  mrpTotal: number;
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  finalTotal: number;
  freeDeliveryRemaining: number;
  lineItems: OrderLineItem[];
}

export function formatINR(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(safe);
}

export function calculateDiscountPercent(price: number, originalPrice: number): number {
  if (!Number.isFinite(price) || !Number.isFinite(originalPrice) || originalPrice <= 0) {
    return 0;
  }
  if (price >= originalPrice) {
    return 0;
  }
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

export function addOrIncrementCartItem(
  cart: CartItem[],
  productId: string,
  maxStock: number,
  delta = 1
): CartItem[] {
  if (maxStock <= 0 || delta <= 0) return cart;
  const existingIndex = cart.findIndex((item) => item.productId === productId);
  if (existingIndex === -1) {
    return [...cart, { productId, quantity: Math.min(delta, maxStock) }];
  }
  return cart.map((item, idx) =>
    idx === existingIndex
      ? { ...item, quantity: Math.min(item.quantity + delta, maxStock) }
      : item
  );
}

export function updateCartItemQuantity(
  cart: CartItem[],
  productId: string,
  quantity: number,
  maxStock: number
): CartItem[] {
  if (quantity <= 0) {
    return cart.filter((item) => item.productId !== productId);
  }
  const bounded = Math.min(Math.floor(quantity), Math.max(1, maxStock));
  return cart.map((item) =>
    item.productId === productId ? { ...item, quantity: bounded } : item
  );
}

export function removeCartItem(cart: CartItem[], productId: string): CartItem[] {
  return cart.filter((item) => item.productId !== productId);
}

export function toggleWishlistItem(wishlist: string[], productId: string): string[] {
  if (wishlist.includes(productId)) {
    return wishlist.filter((id) => id !== productId);
  }
  return [productId, ...wishlist].slice(0, 100);
}

export function calculateCartTotals(cart: CartItem[], products: Product[]): CartTotals {
  const productMap = new Map(products.map((p) => [p.id, p]));
  const lineItems: OrderLineItem[] = [];
  let itemCount = 0;
  let mrpTotal = 0;
  let subtotal = 0;

  for (const entry of cart) {
    const product = productMap.get(entry.productId);
    if (!product || entry.quantity <= 0) continue;
    const qty = Math.min(entry.quantity, Math.max(1, product.stock));
    const lineTotal = product.price * qty;
    const lineMrp = Math.max(product.originalPrice, product.price) * qty;

    itemCount += qty;
    subtotal += lineTotal;
    mrpTotal += lineMrp;

    lineItems.push({
      productId: product.id,
      name: product.name,
      image: product.images[0] || '',
      price: product.price,
      originalPrice: Math.max(product.originalPrice, product.price),
      quantity: qty,
      lineTotal,
    });
  }

  const discountTotal = Math.max(0, mrpTotal - subtotal);
  const deliveryFee =
    subtotal === 0
      ? 0
      : subtotal >= FREE_DELIVERY_THRESHOLD_INR
        ? 0
        : STANDARD_DELIVERY_FEE_INR;
  const finalTotal = subtotal + deliveryFee;
  const freeDeliveryRemaining =
    subtotal > 0 && subtotal < FREE_DELIVERY_THRESHOLD_INR
      ? FREE_DELIVERY_THRESHOLD_INR - subtotal
      : 0;

  return {
    itemCount,
    mrpTotal,
    subtotal,
    discountTotal,
    deliveryFee,
    finalTotal,
    freeDeliveryRemaining,
    lineItems,
  };
}

export function generateOrderNumber(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RMM-${y}${m}${d}-${suffix}`;
}
