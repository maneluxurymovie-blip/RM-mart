import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addOrIncrementCartItem,
  calculateCartTotals,
  calculateDiscountPercent,
  FREE_DELIVERY_THRESHOLD_INR,
  removeCartItem,
  STANDARD_DELIVERY_FEE_INR,
  toggleWishlistItem,
  updateCartItemQuantity,
} from './commerce';
import { DEMO_PRODUCTS } from '../data/demoProducts';

test('prevent duplicate cart entries by incrementing quantity up to stock cap', () => {
  const first = addOrIncrementCartItem([], 'rm-saffron-elixir', 5, 1);
  assert.deepEqual(first, [{ productId: 'rm-saffron-elixir', quantity: 1 }]);

  const second = addOrIncrementCartItem(first, 'rm-saffron-elixir', 5, 2);
  assert.equal(second.length, 1);
  assert.equal(second[0].quantity, 3);

  const capped = addOrIncrementCartItem(second, 'rm-saffron-elixir', 5, 10);
  assert.equal(capped[0].quantity, 5);
});

test('updating quantity to zero removes product cleanly', () => {
  const cart = [{ productId: 'rm-saffron-elixir', quantity: 2 }];
  assert.deepEqual(updateCartItemQuantity(cart, 'rm-saffron-elixir', 0, 10), []);
  assert.deepEqual(removeCartItem(cart, 'rm-saffron-elixir'), []);
});

test('calculates subtotal, discount savings, delivery fee threshold, and final total accurately', () => {
  // Darjeeling Tea is ₹899 (MRP ₹1150) — below ₹999 threshold -> ₹79 delivery fee
  const underThreshold = calculateCartTotals(
    [{ productId: 'rm-darjeeling-tea-almonds', quantity: 1 }],
    DEMO_PRODUCTS
  );
  assert.equal(underThreshold.subtotal, 899);
  assert.equal(underThreshold.discountTotal, 251);
  assert.equal(underThreshold.deliveryFee, STANDARD_DELIVERY_FEE_INR);
  assert.equal(underThreshold.finalTotal, 899 + STANDARD_DELIVERY_FEE_INR);
  assert.equal(underThreshold.freeDeliveryRemaining, FREE_DELIVERY_THRESHOLD_INR - 899);

  // Quantity 2 -> ₹1798 -> free delivery
  const overThreshold = calculateCartTotals(
    [{ productId: 'rm-darjeeling-tea-almonds', quantity: 2 }],
    DEMO_PRODUCTS
  );
  assert.equal(overThreshold.subtotal, 1798);
  assert.equal(overThreshold.discountTotal, 502);
  assert.equal(overThreshold.deliveryFee, 0);
  assert.equal(overThreshold.finalTotal, 1798);
  assert.equal(overThreshold.freeDeliveryRemaining, 0);
});

test('discount percentage calculation handles edge cases safely', () => {
  assert.equal(calculateDiscountPercent(1499, 1999), 25);
  assert.equal(calculateDiscountPercent(500, 500), 0);
  assert.equal(calculateDiscountPercent(600, 500), 0);
});

test('wishlist toggle adds and removes without duplicates', () => {
  const added = toggleWishlistItem([], 'rm-saffron-elixir');
  assert.deepEqual(added, ['rm-saffron-elixir']);
  const removed = toggleWishlistItem(added, 'rm-saffron-elixir');
  assert.deepEqual(removed, []);
});
