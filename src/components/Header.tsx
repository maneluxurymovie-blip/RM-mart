import React, { useState } from 'react';
import { Menu, ShoppingBag, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { ActiveView } from '../types';

interface HeaderProps {
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  cartCount: number;
  wishlistCount: number;
  user: User | null;
  isOwner: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onNavigate,
  cartCount,
  wishlistCount,
  user,
  isOwner,
  onSignIn,
  onSignOut,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (view: ActiveView) => {
    onNavigate(view);
    setMobileMenuOpen(false);
  };

  const navLinkClass = (view: ActiveView) =>
    `text-sm font-medium transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
      activeView === view
        ? 'text-[#0D3B2E] border-[#C5A059]'
        : 'text-[#52605B] border-transparent hover:text-[#0D3B2E]'
    }`;

  return (
    <header className="sticky top-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E5DEC9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="font-serif-display text-2xl font-semibold tracking-tight text-[#0D3B2E] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D3B2E] rounded"
        >
          RM Mart
        </button>

        {/* Zone 2: 4-5 concise single-line text nav links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7"
        >
          <button
            type="button"
            onClick={() => handleNav('home')}
            className={navLinkClass('home')}
          >
            Shop
          </button>
          <button
            type="button"
            onClick={() => handleNav('wishlist')}
            className={navLinkClass('wishlist')}
          >
            Wishlist{wishlistCount > 0 ? ` (${wishlistCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => handleNav('orders')}
            className={navLinkClass('orders')}
          >
            Orders
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={() => handleNav('admin')}
              className={navLinkClass('admin')}
            >
              Admin
            </button>
          )}
          {user ? (
            <button
              type="button"
              onClick={onSignOut}
              className="text-sm font-medium text-[#52605B] hover:text-[#0D3B2E] transition-colors whitespace-nowrap shrink-0"
              title={user.email || undefined}
            >
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="text-sm font-medium text-[#52605B] hover:text-[#0D3B2E] transition-colors whitespace-nowrap shrink-0"
            >
              Sign In
            </button>
          )}
        </nav>

        {/* Zone 3: Primary Action CTA + Mobile Drawer Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleNav('cart')}
            aria-label={`Open shopping cart with ${cartCount} items`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0D3B2E] text-[#FAF7F2] text-sm font-medium rounded-lg hover:bg-[#092A20] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] focus-visible:ring-offset-2"
          >
            <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            <span>Cart</span>
            <span className="tabular-nums font-mono text-xs text-[#E8D5A8]" data-testid="cart-count">
              ({cartCount})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            className="md:hidden p-2.5 text-[#0D3B2E] rounded-lg border border-[#E5DEC9] hover:bg-[#F2ECE1] transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile navigation"
          className="md:hidden border-t border-[#E5DEC9] bg-[#FAF7F2] px-4 py-4 space-y-2"
        >
          <button
            type="button"
            onClick={() => handleNav('home')}
            className="block w-full text-left px-3 py-2.5 text-sm font-medium text-[#14211D] hover:bg-[#F2ECE1] rounded-lg"
          >
            Shop Catalog
          </button>
          <button
            type="button"
            onClick={() => handleNav('wishlist')}
            className="block w-full text-left px-3 py-2.5 text-sm font-medium text-[#14211D] hover:bg-[#F2ECE1] rounded-lg"
          >
            Wishlist ({wishlistCount})
          </button>
          <button
            type="button"
            onClick={() => handleNav('orders')}
            className="block w-full text-left px-3 py-2.5 text-sm font-medium text-[#14211D] hover:bg-[#F2ECE1] rounded-lg"
          >
            My Orders & Tracking
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={() => handleNav('admin')}
              className="block w-full text-left px-3 py-2.5 text-sm font-medium text-[#0D3B2E] hover:bg-[#F2ECE1] rounded-lg"
            >
              Owner Admin Dashboard
            </button>
          )}
          <div className="pt-2 border-t border-[#E5DEC9]">
            {user ? (
              <button
                type="button"
                onClick={() => {
                  onSignOut();
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-2.5 text-sm font-medium text-[#52605B] hover:bg-[#F2ECE1] rounded-lg"
              >
                Sign Out ({user.displayName || user.email})
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onSignIn();
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-2.5 text-sm font-medium text-[#0D3B2E] hover:bg-[#F2ECE1] rounded-lg"
              >
                Sign In with Google
              </button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
};
