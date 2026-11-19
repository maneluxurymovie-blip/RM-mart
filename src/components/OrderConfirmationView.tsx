import React from 'react';
import { ArrowRight, CheckCircle2, PackageCheck } from 'lucide-react';
import { formatINR } from '../utils/commerce';
import { resolveBundledProductImage } from '../lib/productImageResolver';
import type { Order } from '../types';

interface OrderConfirmationViewProps {
  order: Order | null;
  onViewOrders: () => void;
  onContinueShopping: () => void;
}

const STEPS = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered'] as const;

export const OrderConfirmationView: React.FC<OrderConfirmationViewProps> = ({
  order,
  onViewOrders,
  onContinueShopping,
}) => {
  if (!order) {
    return (
      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="font-serif-display text-2xl font-semibold text-[#0D3B2E]">
          No recent order found
        </h1>
        <button
          type="button"
          onClick={onContinueShopping}
          className="mt-4 px-5 py-2.5 bg-[#0D3B2E] text-[#FAF7F2] text-sm font-medium rounded-lg"
        >
          Return to Storefront
        </button>
      </section>
    );
  }

  const activeStepIdx = Math.max(
    0,
    STEPS.indexOf(order.orderStatus as (typeof STEPS)[number])
  );

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white border border-[#E5DEC9] rounded-2xl p-6 sm:p-10">
        <div className="flex items-start gap-4">
          <CheckCircle2 className="w-9 h-9 text-[#0D3B2E] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold text-[#8A6B2F]">Order Received</p>
            <h1 className="mt-1 font-serif-display text-3xl font-semibold text-[#0D3B2E]">
              Thank you, {order.customerName}
            </h1>
            <p className="mt-2 text-sm text-[#52605B]">
              Order ID:{' '}
              <strong
                data-testid="confirmed-order-number"
                className="font-mono text-[#14211D]"
              >
                {order.orderNumber}
              </strong>{' '}
              · Status: <strong className="text-[#0D3B2E]">{order.orderStatus}</strong> · Payment:{' '}
              <strong>
                {order.paymentMethod} ({order.paymentStatus})
              </strong>
            </p>
            {order.paymentMethod === 'UPI' && (
              <p className="mt-2 text-xs text-[#8A6B2F] bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-3 py-2">
                Your UPI order is recorded as <strong>Pending UPI Verification</strong>. RM Mart
                will confirm payment verification before dispatching.
              </p>
            )}
          </div>
        </div>

        {/* Tracking Timeline */}
        <div className="mt-8 pt-6 border-t border-[#F2ECE1]">
          <h2 className="text-xs font-semibold text-[#52605B] uppercase tracking-wider">
            Fulfillment Progress
          </h2>
          <ol className="mt-4 grid grid-cols-5 gap-2 text-center">
            {STEPS.map((step, index) => {
              const reached = index <= activeStepIdx;
              return (
                <li key={step} className="flex flex-col items-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold tabular-nums ${
                      reached
                        ? 'bg-[#0D3B2E] text-[#FAF7F2]'
                        : 'bg-[#F2ECE1] text-[#52605B]'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span
                    className={`mt-2 text-xs ${
                      reached ? 'font-semibold text-[#0D3B2E]' : 'text-[#52605B]'
                    }`}
                  >
                    {step}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Delivery & Line Items */}
        <div className="mt-8 pt-6 border-t border-[#E5DEC9] grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="font-semibold text-[#14211D]">Delivery Address</h3>
            <p className="mt-1.5 text-[#52605B] leading-relaxed">
              {order.customerName}
              <br />
              {order.deliveryAddress}
              <br />
              {order.city} – {order.pincode}
              <br />
              Mobile: {order.customerMobile} · {order.customerEmail}
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-[#14211D]">Amount Summary</h3>
            <dl className="mt-1.5 space-y-1 text-[#52605B]">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatINR(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Savings</dt>
                <dd className="tabular-nums text-[#0D3B2E]">−{formatINR(order.discountTotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Delivery</dt>
                <dd className="tabular-nums">
                  {order.deliveryFee === 0 ? 'Free' : formatINR(order.deliveryFee)}
                </dd>
              </div>
              <div className="pt-2 border-t border-[#F2ECE1] flex justify-between font-bold text-[#14211D]">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatINR(order.finalTotal)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <ul className="mt-6 pt-6 border-t border-[#F2ECE1] divide-y divide-[#F2ECE1]">
          {order.items.map((item) => (
            <li key={item.productId} className="py-3 flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-10 rounded overflow-hidden bg-[#F2ECE1] shrink-0">
                  {item.image && (
                    <img
                      src={resolveBundledProductImage(item.image)}
                      alt={item.name}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div>
                  <p className="font-medium text-[#14211D]">{item.name}</p>
                  <p className="text-xs text-[#52605B] tabular-nums">
                    Qty {item.quantity} × {formatINR(item.price)}
                  </p>
                </div>
              </div>
              <span className="font-semibold tabular-nums text-[#14211D]">
                {formatINR(item.lineTotal)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onViewOrders}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#0D3B2E] text-[#FAF7F2] text-sm font-semibold rounded-lg hover:bg-[#092A20] transition-colors"
          >
            <PackageCheck className="w-4 h-4" aria-hidden="true" />
            <span>Track & View Orders</span>
          </button>
          <button
            type="button"
            onClick={onContinueShopping}
            className="inline-flex items-center gap-2 px-5 py-3 border border-[#0D3B2E]/25 text-[#0D3B2E] text-sm font-medium rounded-lg hover:bg-[#F2ECE1] transition-colors"
          >
            <span>Continue Shopping</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
};
