import React from 'react';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import {
  calculateCartTotals,
  formatINR,
  FREE_DELIVERY_THRESHOLD_INR,
} from '../utils/commerce';
import type { CartItem, Product } from '../types';

interface CartViewProps {
  cart: CartItem[];
  products: Product[];
  onUpdateQty: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onProceedCheckout: () => void;
  onContinueShopping: () => void;
}

export const CartView: React.FC<CartViewProps> = ({
  cart,
  products,
  onUpdateQty,
  onRemoveItem,
  onProceedCheckout,
  onContinueShopping,
}) => {
  const totals = calculateCartTotals(cart, products);
  const productMap = new Map(products.map((p) => [p.id, p]));

  if (totals.lineItems.length === 0) {
    return (
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="bg-white border border-[#E5DEC9] rounded-2xl p-10 sm:p-14">
          <ShoppingBag className="w-10 h-10 text-[#0D3B2E] mx-auto opacity-75" aria-hidden="true" />
          <h1 className="mt-4 font-serif-display text-3xl font-semibold text-[#0D3B2E]">
            Your shopping cart is empty
          </h1>
          <p className="mt-2 text-sm text-[#52605B] max-w-md mx-auto">
            Explore RM Mart&apos;s curated selection of skincare, electronics, linen apparel, daily
            essentials, and gourmet teas.
          </p>
          <button
            type="button"
            onClick={onContinueShopping}
            className="mt-7 inline-flex items-center gap-2 px-6 py-3 bg-[#0D3B2E] text-[#FAF7F2] text-sm font-semibold rounded-lg hover:bg-[#092A20] transition-colors"
          >
            <span>Browse Storefront</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[#E5DEC9] pb-5">
        <div>
          <h1 className="font-serif-display text-3xl font-semibold text-[#0D3B2E]">
            Shopping Cart
          </h1>
          <p className="mt-1 text-sm text-[#52605B] tabular-nums">
            {totals.itemCount} item{totals.itemCount === 1 ? '' : 's'} ready for checkout
          </p>
        </div>
        <button
          type="button"
          onClick={onContinueShopping}
          className="text-sm font-medium text-[#0D3B2E] hover:underline"
        >
          Continue Shopping
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Line Items */}
        <div className="lg:col-span-8 space-y-4">
          {totals.lineItems.map((item) => {
            const product = productMap.get(item.productId);
            const maxStock = product?.stock ?? item.quantity;
            return (
              <div
                key={item.productId}
                data-testid={`cart-item-${item.productId}`}
                className="bg-white border border-[#E5DEC9] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center"
              >
                <div className="w-full sm:w-28 aspect-[4/3] rounded-lg overflow-hidden bg-[#F2ECE1] shrink-0">
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#52605B]">{product?.category || 'RM Mart'}</div>
                  <h2 className="mt-0.5 font-sans text-base font-semibold text-[#14211D]">
                    {item.name}
                  </h2>
                  <div className="mt-1.5 flex items-baseline gap-2.5">
                    <span className="text-sm font-semibold text-[#0D3B2E] tabular-nums">
                      {formatINR(item.price)}
                    </span>
                    {item.originalPrice > item.price && (
                      <span className="text-xs text-[#52605B] line-through tabular-nums">
                        {formatINR(item.originalPrice)}
                      </span>
                    )}
                    <span className="text-xs text-[#52605B]">· Max {maxStock} available</span>
                  </div>
                </div>

                <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#F2ECE1]">
                  <div className="inline-flex items-center border border-[#D8D0C1] rounded-lg bg-[#FAF7F2]">
                    <button
                      type="button"
                      aria-label={`Decrease quantity of ${item.name}`}
                      onClick={() => onUpdateQty(item.productId, item.quantity - 1)}
                      className="w-9 h-9 flex items-center justify-center text-[#14211D] hover:bg-[#F2ECE1] rounded-l-lg"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span
                      data-testid={`cart-qty-${item.productId}`}
                      className="w-9 text-center text-sm font-semibold tabular-nums"
                    >
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase quantity of ${item.name}`}
                      disabled={item.quantity >= maxStock}
                      onClick={() => onUpdateQty(item.productId, item.quantity + 1)}
                      className="w-9 h-9 flex items-center justify-center text-[#14211D] hover:bg-[#F2ECE1] disabled:opacity-40 rounded-r-lg"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right min-w-[84px]">
                    <div className="text-base font-semibold text-[#14211D] tabular-nums">
                      {formatINR(item.lineTotal)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.productId)}
                    aria-label={`Remove ${item.name} from cart`}
                    className="p-2 text-[#52605B] hover:text-red-700 transition-colors rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Panel */}
        <aside className="lg:col-span-4 bg-white border border-[#E5DEC9] rounded-xl p-6 sticky top-24">
          <h2 className="font-serif-display text-xl font-semibold text-[#0D3B2E]">
            Order Summary
          </h2>

          {totals.freeDeliveryRemaining > 0 ? (
            <p className="mt-3 text-xs text-[#8A6B2F] bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-3.5 py-2.5">
              Add <strong className="tabular-nums">{formatINR(totals.freeDeliveryRemaining)}</strong>{' '}
              more to unlock complimentary delivery (orders {formatINR(FREE_DELIVERY_THRESHOLD_INR)}+).
            </p>
          ) : (
            <p className="mt-3 text-xs text-[#0D3B2E] bg-[#E8F0EC] rounded-lg px-3.5 py-2.5 font-medium">
              Your order qualifies for complimentary Pan-India delivery.
            </p>
          )}

          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between text-[#52605B]">
              <dt>Total MRP</dt>
              <dd className="tabular-nums">{formatINR(totals.mrpTotal)}</dd>
            </div>
            <div className="flex justify-between text-[#0D3B2E]">
              <dt>Catalog Savings</dt>
              <dd className="tabular-nums font-medium">−{formatINR(totals.discountTotal)}</dd>
            </div>
            <div className="flex justify-between text-[#14211D]">
              <dt>Subtotal</dt>
              <dd className="tabular-nums font-medium" data-testid="cart-subtotal">
                {formatINR(totals.subtotal)}
              </dd>
            </div>
            <div className="flex justify-between text-[#52605B]">
              <dt>Delivery Fee</dt>
              <dd className="tabular-nums">
                {totals.deliveryFee === 0 ? 'Free' : formatINR(totals.deliveryFee)}
              </dd>
            </div>
            <div className="pt-3 border-t border-[#E5DEC9] flex justify-between text-base font-bold text-[#14211D]">
              <dt>Final Total</dt>
              <dd className="tabular-nums" data-testid="cart-final-total">
                {formatINR(totals.finalTotal)}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={onProceedCheckout}
            className="mt-6 w-full py-3 px-5 bg-[#0D3B2E] text-[#FAF7F2] text-sm font-semibold rounded-lg hover:bg-[#092A20] transition-colors inline-flex items-center justify-center gap-2"
          >
            <span>Proceed to Checkout</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>

          <p className="mt-3 text-xs text-center text-[#52605B]">
            Cash on Delivery & UPI configuration available at checkout
          </p>
        </aside>
      </div>
    </section>
  );
};
