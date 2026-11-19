import React, { useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Lock, Smartphone, Truck } from 'lucide-react';
import type { User } from 'firebase/auth';
import { calculateCartTotals, formatINR } from '../utils/commerce';
import {
  hasValidationErrors,
  validateCheckoutForm,
  type CheckoutValidationErrors,
} from '../utils/validation';
import { persistOrderToFirestore } from '../lib/storeService';
import type { CartItem, CustomerDetails, Order, PaymentMethod, Product } from '../types';

interface CheckoutViewProps {
  cart: CartItem[];
  products: Product[];
  user: User | null;
  onBackToCart: () => void;
  onOrderComplete: (order: Order) => void;
  onSignIn: () => void;
}

const UPI_VPA = import.meta.env.VITE_UPI_MERCHANT_VPA || 'rmmart@upi';
const UPI_NAME = import.meta.env.VITE_UPI_MERCHANT_NAME || 'RM Mart';

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  cart,
  products,
  user,
  onBackToCart,
  onOrderComplete,
  onSignIn,
}) => {
  const totals = calculateCartTotals(cart, products);

  const [details, setDetails] = useState<CustomerDetails>({
    customerName: user?.displayName || '',
    customerMobile: '',
    customerEmail: user?.email || '',
    deliveryAddress: '',
    city: '',
    pincode: '',
  });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [upiReference, setUpiReference] = useState('');
  const [errors, setErrors] = useState<CheckoutValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Unique idempotency key per cart fingerprint to prevent duplicate submissions
  const idempotencyKey = useMemo(() => {
    const sig = cart.map((c) => `${c.productId}_${c.quantity}`).join('-');
    const rand = Math.random().toString(36).slice(2, 10);
    return `idem_${Date.now()}_${rand}_${sig.slice(0, 24)}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  }, [cart]);

  const handleField = (key: keyof CustomerDetails, value: string) => {
    setDetails((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const fieldErrors = validateCheckoutForm(details, paymentMethod, upiReference);
    if (hasValidationErrors(fieldErrors)) {
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const response = await fetch('/api/orders/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey,
          userId: user?.uid || undefined,
          customerDetails: details,
          items: cart,
          paymentMethod,
          upiReference: paymentMethod === 'UPI' ? upiReference.trim() : '',
          catalogSnapshot: products,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.fieldErrors) {
          setErrors({ ...data.fieldErrors, general: data.error });
        } else {
          setErrors({ general: data.error || 'Could not validate your order. Please try again.' });
        }
        setSubmitting(false);
        return;
      }

      const validatedOrder: Order = data.order;

      // Save to Firestore for authenticated verified users
      if (user && user.emailVerified) {
        try {
          const synced = await persistOrderToFirestore(validatedOrder, user);
          validatedOrder.syncedToFirestore = synced;
        } catch (fsError) {
          console.warn('Firestore order sync note:', fsError);
        }
      }

      onOrderComplete(validatedOrder);
    } catch (err) {
      setErrors({
        general:
          err instanceof Error
            ? err.message
            : 'Network error while verifying order. Please retry.',
      });
      setSubmitting(false);
    }
  };

  if (totals.lineItems.length === 0) {
    return (
      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="font-serif-display text-2xl font-semibold text-[#0D3B2E]">
          No items to check out
        </h1>
        <button
          type="button"
          onClick={onBackToCart}
          className="mt-4 px-5 py-2.5 bg-[#0D3B2E] text-[#FAF7F2] text-sm font-medium rounded-lg"
        >
          Return to Cart
        </button>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <button
        type="button"
        onClick={onBackToCart}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#52605B] hover:text-[#0D3B2E]"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>Back to Cart</span>
      </button>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-b border-[#E5DEC9] pb-5">
        <div>
          <h1 className="font-serif-display text-3xl font-semibold text-[#0D3B2E]">
            Checkout
          </h1>
          <p className="mt-1 text-sm text-[#52605B]">
            Enter your delivery details and choose your preferred payment method.
          </p>
        </div>

        {!user && (
          <button
            type="button"
            onClick={onSignIn}
            className="text-xs font-semibold text-[#0D3B2E] underline hover:text-[#092A20]"
          >
            Sign in with Google to sync order history across devices
          </button>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        {/* Left: Customer Details & Payment */}
        <div className="lg:col-span-7 space-y-6">
          {errors.general && (
            <div
              role="alert"
              className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-sm text-red-800"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errors.general}</span>
            </div>
          )}

          {/* Customer Delivery Details */}
          <div className="bg-white border border-[#E5DEC9] rounded-xl p-6">
            <h2 className="font-serif-display text-xl font-semibold text-[#0D3B2E]">
              1. Delivery Information
            </h2>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="checkout-name" className="block text-xs font-semibold text-[#14211D]">
                  Full Name *
                </label>
                <input
                  id="checkout-name"
                  type="text"
                  required
                  value={details.customerName}
                  onChange={(e) => handleField('customerName', e.target.value)}
                  placeholder="e.g. Aarav Kulkarni"
                  className="mt-1.5 w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#D8D0C1] rounded-lg text-sm focus:outline-none focus:border-[#0D3B2E]"
                />
                {errors.customerName && (
                  <p className="mt-1 text-xs text-red-700">{errors.customerName}</p>
                )}
              </div>

              <div>
                <label htmlFor="checkout-mobile" className="block text-xs font-semibold text-[#14211D]">
                  Mobile Number (India) *
                </label>
                <input
                  id="checkout-mobile"
                  type="tel"
                  required
                  value={details.customerMobile}
                  onChange={(e) => handleField('customerMobile', e.target.value)}
                  placeholder="10-digit mobile e.g. 9876543210"
                  className="mt-1.5 w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#D8D0C1] rounded-lg text-sm focus:outline-none focus:border-[#0D3B2E]"
                />
                {errors.customerMobile && (
                  <p className="mt-1 text-xs text-red-700">{errors.customerMobile}</p>
                )}
              </div>

              <div>
                <label htmlFor="checkout-email" className="block text-xs font-semibold text-[#14211D]">
                  Email Address *
                </label>
                <input
                  id="checkout-email"
                  type="email"
                  required
                  value={details.customerEmail}
                  onChange={(e) => handleField('customerEmail', e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1.5 w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#D8D0C1] rounded-lg text-sm focus:outline-none focus:border-[#0D3B2E]"
                />
                {errors.customerEmail && (
                  <p className="mt-1 text-xs text-red-700">{errors.customerEmail}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="checkout-address" className="block text-xs font-semibold text-[#14211D]">
                  Delivery Address *
                </label>
                <textarea
                  id="checkout-address"
                  rows={3}
                  required
                  value={details.deliveryAddress}
                  onChange={(e) => handleField('deliveryAddress', e.target.value)}
                  placeholder="Flat / House no., Building, Street, Area, Landmark"
                  className="mt-1.5 w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#D8D0C1] rounded-lg text-sm focus:outline-none focus:border-[#0D3B2E]"
                />
                {errors.deliveryAddress && (
                  <p className="mt-1 text-xs text-red-700">{errors.deliveryAddress}</p>
                )}
              </div>

              <div>
                <label htmlFor="checkout-city" className="block text-xs font-semibold text-[#14211D]">
                  City / District *
                </label>
                <input
                  id="checkout-city"
                  type="text"
                  required
                  value={details.city}
                  onChange={(e) => handleField('city', e.target.value)}
                  placeholder="e.g. Pune, Mumbai, Bengaluru"
                  className="mt-1.5 w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#D8D0C1] rounded-lg text-sm focus:outline-none focus:border-[#0D3B2E]"
                />
                {errors.city && <p className="mt-1 text-xs text-red-700">{errors.city}</p>}
              </div>

              <div>
                <label htmlFor="checkout-pincode" className="block text-xs font-semibold text-[#14211D]">
                  PIN Code (6 digits) *
                </label>
                <input
                  id="checkout-pincode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={details.pincode}
                  onChange={(e) => handleField('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="e.g. 411045"
                  className="mt-1.5 w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#D8D0C1] rounded-lg text-sm font-mono tabular-nums focus:outline-none focus:border-[#0D3B2E]"
                />
                {errors.pincode && <p className="mt-1 text-xs text-red-700">{errors.pincode}</p>}
              </div>
            </div>
          </div>

          {/* Payment Selection */}
          <div className="bg-white border border-[#E5DEC9] rounded-xl p-6">
            <h2 className="font-serif-display text-xl font-semibold text-[#0D3B2E]">
              2. Payment Method
            </h2>

            <div className="mt-4 space-y-3">
              <label
                className={`flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-colors ${
                  paymentMethod === 'COD'
                    ? 'border-[#0D3B2E] bg-[#FAF7F2]'
                    : 'border-[#E5DEC9] hover:bg-[#FAF7F2]/60'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="COD"
                  checked={paymentMethod === 'COD'}
                  onChange={() => setPaymentMethod('COD')}
                  className="mt-1 accent-[#0D3B2E]"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#14211D]">
                    <Truck className="w-4 h-4 text-[#0D3B2E]" aria-hidden="true" />
                    <span>Cash on Delivery (COD)</span>
                  </div>
                  <p className="mt-1 text-xs text-[#52605B]">
                    Pay {formatINR(totals.finalTotal)} in cash or UPI upon doorstep delivery.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-colors ${
                  paymentMethod === 'UPI'
                    ? 'border-[#0D3B2E] bg-[#FAF7F2]'
                    : 'border-[#E5DEC9] hover:bg-[#FAF7F2]/60'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="UPI"
                  checked={paymentMethod === 'UPI'}
                  onChange={() => setPaymentMethod('UPI')}
                  className="mt-1 accent-[#0D3B2E]"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#14211D]">
                    <Smartphone className="w-4 h-4 text-[#0D3B2E]" aria-hidden="true" />
                    <span>UPI Payment (Merchant Verification Required)</span>
                  </div>
                  <p className="mt-1 text-xs text-[#52605B]">
                    Merchant VPA: <span className="font-mono text-[#14211D]">{UPI_VPA}</span> (
                    {UPI_NAME}). Note: Live automated UPI gateway is not yet connected—your order
                    will be recorded as <strong>Pending UPI Verification</strong> until confirmed by
                    the store owner.
                  </p>
                </div>
              </label>

              {paymentMethod === 'UPI' && (
                <div className="pl-7 pt-1">
                  <label
                    htmlFor="upi-ref"
                    className="block text-xs font-semibold text-[#14211D]"
                  >
                    Optional UPI UTR / Transaction Reference (if already transferred)
                  </label>
                  <input
                    id="upi-ref"
                    type="text"
                    value={upiReference}
                    onChange={(e) => setUpiReference(e.target.value)}
                    placeholder="e.g. 432198765432 (optional)"
                    className="mt-1.5 w-full px-3.5 py-2 bg-white border border-[#D8D0C1] rounded-lg text-sm font-mono focus:outline-none focus:border-[#0D3B2E]"
                  />
                  {errors.upiReference && (
                    <p className="mt-1 text-xs text-red-700">{errors.upiReference}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Order Summary & Place Order CTA */}
        <aside className="lg:col-span-5 bg-white border border-[#E5DEC9] rounded-xl p-6 sticky top-24">
          <h2 className="font-serif-display text-xl font-semibold text-[#0D3B2E]">
            Order Summary ({totals.itemCount})
          </h2>

          <ul className="mt-4 divide-y divide-[#F2ECE1] max-h-72 overflow-y-auto pr-1">
            {totals.lineItems.map((item) => (
              <li key={item.productId} className="py-3 flex items-center gap-3.5">
                <div className="w-14 h-11 rounded-md overflow-hidden bg-[#F2ECE1] shrink-0">
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
                  <p className="text-sm font-medium text-[#14211D] truncate">{item.name}</p>
                  <p className="text-xs text-[#52605B] tabular-nums">
                    Qty {item.quantity} × {formatINR(item.price)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-[#14211D] tabular-nums shrink-0">
                  {formatINR(item.lineTotal)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-5 pt-4 border-t border-[#E5DEC9] space-y-2.5 text-sm">
            <div className="flex justify-between text-[#52605B]">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{formatINR(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between text-[#0D3B2E]">
              <dt>Discount Savings</dt>
              <dd className="tabular-nums">−{formatINR(totals.discountTotal)}</dd>
            </div>
            <div className="flex justify-between text-[#52605B]">
              <dt>Delivery Fee</dt>
              <dd className="tabular-nums">
                {totals.deliveryFee === 0 ? 'Free' : formatINR(totals.deliveryFee)}
              </dd>
            </div>
            <div className="pt-3 border-t border-[#E5DEC9] flex justify-between text-base font-bold text-[#14211D]">
              <dt>Total Payable</dt>
              <dd className="tabular-nums">{formatINR(totals.finalTotal)}</dd>
            </div>
          </dl>

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full py-3.5 px-5 bg-[#0D3B2E] text-[#FAF7F2] text-sm font-semibold rounded-lg hover:bg-[#092A20] disabled:opacity-60 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            <span>
              {submitting
                ? 'Validating Stock & Placing Order...'
                : `Place Order · ${formatINR(totals.finalTotal)}`}
            </span>
          </button>

          <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#52605B]">
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Server-verified stock, INR prices & duplicate order protection</span>
          </div>
        </aside>
      </form>
    </section>
  );
};
