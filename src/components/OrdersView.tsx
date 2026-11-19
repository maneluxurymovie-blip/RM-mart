import React, { useState } from 'react';
import { Package, Search, Truck } from 'lucide-react';
import type { User } from 'firebase/auth';
import { formatINR } from '../utils/commerce';
import type { Order } from '../types';

interface OrdersViewProps {
  orders: Order[];
  user: User | null;
  onCancelPendingOrder: (orderId: string) => void;
  onContinueShopping: () => void;
  onSignIn: () => void;
}

const PROGRESS_STEPS = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered'] as const;

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  user,
  onCancelPendingOrder,
  onContinueShopping,
  onSignIn,
}) => {
  const [lookupId, setLookupId] = useState('');
  const [lookupContact, setLookupContact] = useState('');
  const [lookupResult, setLookupResult] = useState<Order | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [searching, setSearching] = useState(false);

  const handleTrackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError('');
    setLookupResult(null);
    if (!lookupId.trim() || !lookupContact.trim()) {
      setLookupError('Enter both your Order ID and registered mobile number or email.');
      return;
    }

    setSearching(true);
    try {
      const params = new URLSearchParams({
        orderNumber: lookupId.trim(),
        contact: lookupContact.trim(),
      });
      const res = await fetch(`/api/orders/lookup?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        // Also check local session orders list if server restarted
        const localMatch = orders.find(
          (o) =>
            o.orderNumber.toUpperCase() === lookupId.trim().toUpperCase() &&
            (o.customerEmail.toLowerCase() === lookupContact.trim().toLowerCase() ||
              o.customerMobile.replace(/\D/g, '').endsWith(lookupContact.replace(/\D/g, '').slice(-10)))
        );
        if (localMatch) {
          setLookupResult(localMatch);
        } else {
          setLookupError(data.error || 'No matching order found.');
        }
      } else {
        setLookupResult(data.order);
      }
    } catch {
      setLookupError('Unable to check order status right now. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E5DEC9] pb-5">
        <div>
          <h1 className="font-serif-display text-3xl font-semibold text-[#0D3B2E]">
            Orders & Tracking
          </h1>
          <p className="mt-1 text-sm text-[#52605B]">
            Track any RM Mart shipment with verified Order ID lookup or review your order history.
          </p>
        </div>
        {!user && (
          <button
            type="button"
            onClick={onSignIn}
            className="text-xs font-semibold text-[#0D3B2E] underline"
          >
            Sign in with Google to view synced account orders
          </button>
        )}
      </div>

      {/* Verified Order Tracking Lookup */}
      <div className="bg-white border border-[#E5DEC9] rounded-xl p-6">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-[#0D3B2E]" aria-hidden="true" />
          <h2 className="font-serif-display text-xl font-semibold text-[#0D3B2E]">
            Track an Order
          </h2>
        </div>
        <p className="mt-1 text-xs text-[#52605B]">
          For your privacy, verify your Order ID along with the mobile number or email used at
          checkout.
        </p>

        <form onSubmit={handleTrackOrder} className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="track-order-id" className="sr-only">
              Order ID
            </label>
            <input
              id="track-order-id"
              type="text"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              placeholder="Order ID (e.g. RMM-20261118-ABCD)"
              className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#D8D0C1] rounded-lg text-sm font-mono focus:outline-none focus:border-[#0D3B2E]"
            />
          </div>
          <div>
            <label htmlFor="track-contact" className="sr-only">
              Registered Mobile or Email
            </label>
            <input
              id="track-contact"
              type="text"
              value={lookupContact}
              onChange={(e) => setLookupContact(e.target.value)}
              placeholder="Registered Mobile or Email"
              className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#D8D0C1] rounded-lg text-sm focus:outline-none focus:border-[#0D3B2E]"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="px-5 py-2.5 bg-[#0D3B2E] text-[#FAF7F2] text-sm font-semibold rounded-lg hover:bg-[#092A20] transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Search className="w-4 h-4" aria-hidden="true" />
            <span>{searching ? 'Checking...' : 'Track Order'}</span>
          </button>
        </form>

        {lookupError && (
          <p role="alert" className="mt-3 text-xs text-red-700">
            {lookupError}
          </p>
        )}

        {lookupResult && (
          <div className="mt-5 p-4 bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="font-mono text-[#0D3B2E]">{lookupResult.orderNumber}</strong>
              <span className="font-semibold text-[#14211D]">
                Status: {lookupResult.orderStatus} · {formatINR(lookupResult.finalTotal)}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#52605B]">
              Payment: {lookupResult.paymentMethod} ({lookupResult.paymentStatus}) · Delivering to{' '}
              {lookupResult.city} – {lookupResult.pincode}
            </p>
          </div>
        )}
      </div>

      {/* Order History List */}
      <div>
        <h2 className="font-serif-display text-2xl font-semibold text-[#0D3B2E]">
          Your Order History
        </h2>

        {orders.length === 0 ? (
          <div className="mt-6 bg-white border border-[#E5DEC9] rounded-2xl p-10 text-center">
            <Package className="w-9 h-9 text-[#0D3B2E] mx-auto opacity-70" aria-hidden="true" />
            <p className="mt-3 text-sm text-[#52605B]">
              You haven&apos;t placed any orders in this session yet.
            </p>
            <button
              type="button"
              onClick={onContinueShopping}
              className="mt-5 px-5 py-2.5 bg-[#0D3B2E] text-[#FAF7F2] text-sm font-semibold rounded-lg hover:bg-[#092A20]"
            >
              Start Shopping
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {orders.map((order) => {
              const stepIdx = PROGRESS_STEPS.indexOf(
                order.orderStatus as (typeof PROGRESS_STEPS)[number]
              );
              return (
                <article
                  key={order.id}
                  className="bg-white border border-[#E5DEC9] rounded-xl p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#F2ECE1]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#52605B]">
                        <span className="font-mono font-semibold text-[#0D3B2E]">
                          {order.orderNumber}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{new Date(order.createdAt).toLocaleString('en-IN')}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {order.paymentMethod} ({order.paymentStatus})
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-[#14211D]">
                        Status: {order.orderStatus}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-bold text-[#14211D] tabular-nums">
                        {formatINR(order.finalTotal)}
                      </div>
                      {order.orderStatus === 'Pending' && (
                        <button
                          type="button"
                          onClick={() => onCancelPendingOrder(order.id)}
                          className="mt-1 text-xs font-medium text-red-700 hover:underline"
                        >
                          Cancel Order
                        </button>
                      )}
                    </div>
                  </div>

                  {order.orderStatus !== 'Cancelled' && (
                    <div className="mt-4 grid grid-cols-5 gap-1 text-center text-[11px]">
                      {PROGRESS_STEPS.map((st, idx) => (
                        <div key={st} className="space-y-1">
                          <div
                            className={`h-1.5 rounded-full ${
                              idx <= stepIdx ? 'bg-[#0D3B2E]' : 'bg-[#EFE9DC]'
                            }`}
                          />
                          <span
                            className={
                              idx <= stepIdx
                                ? 'font-semibold text-[#0D3B2E]'
                                : 'text-[#52605B]'
                            }
                          >
                            {st}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <ul className="mt-4 divide-y divide-[#F2ECE1] text-sm">
                    {order.items.map((item) => (
                      <li key={item.productId} className="py-2.5 flex justify-between gap-4">
                        <span className="text-[#14211D]">
                          {item.name}{' '}
                          <span className="text-[#52605B] tabular-nums">× {item.quantity}</span>
                        </span>
                        <span className="font-medium tabular-nums text-[#14211D]">
                          {formatINR(item.lineTotal)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
