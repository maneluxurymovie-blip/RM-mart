import React from 'react';
import type { ActiveView } from '../types';

interface FooterProps {
  onNavigate: (view: ActiveView) => void;
  isOwner: boolean;
  isSignedIn: boolean;
  onSignIn: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onNavigate,
  isOwner,
  isSignedIn,
  onSignIn,
}) => {
  return (
    <footer className="bg-[#0D3B2E] text-[#FAF7F2] mt-16 border-t border-[#C5A059]/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <div className="font-serif-display text-2xl font-semibold tracking-tight">RM Mart</div>
          <p className="mt-2 text-sm text-[#E8D5A8]">
            Everything You Need, Delivered with Ease.
          </p>
          <p className="mt-4 text-xs text-[#FAF7F2]/75 leading-relaxed max-w-md">
            Owned and operated by Ravindra Mane for shoppers across India. Transparent INR (₹)
            pricing, Cash on Delivery, merchant-verified UPI checkout, and multilingual customer
            care in English, Hindi, and Marathi.
          </p>
        </div>

        <div>
          <h3 className="font-sans text-xs font-semibold tracking-wider uppercase text-[#E8D5A8]">
            Storefront
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm text-[#FAF7F2]/85">
            <li>
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="hover:text-white hover:underline"
              >
                Shop All Departments
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate('wishlist')}
                className="hover:text-white hover:underline"
              >
                Saved Wishlist
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate('cart')}
                className="hover:text-white hover:underline"
              >
                Shopping Cart
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate('orders')}
                className="hover:text-white hover:underline"
              >
                Orders & Tracking
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-sans text-xs font-semibold tracking-wider uppercase text-[#E8D5A8]">
            Policies & Care
          </h3>
          <ul className="mt-4 space-y-2.5 text-xs text-[#FAF7F2]/80 leading-relaxed">
            <li>Free delivery on orders ₹999+ · ₹79 flat below ₹999</li>
            <li>7-day easy replacement for unused items</li>
            <li>Cash on Delivery & Merchant-Verified UPI</li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="text-[#E8D5A8] font-medium hover:underline"
              >
                {isOwner ? 'Open Owner Admin Panel' : 'Owner Admin Portal'}
              </button>
            </li>
            {!isSignedIn && (
              <li>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="text-[#FAF7F2]/75 hover:text-white hover:underline"
                >
                  Customer Google Sign-In
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#FAF7F2]/65">
          <p>© {new Date().getFullYear()} RM Mart · Ravindra Mane. All rights reserved.</p>
          <p>Prices in Indian Rupees (₹) · Pan-India Shipping</p>
        </div>
      </div>
    </footer>
  );
};
