import React from 'react';
import { ArrowRight, Heart } from 'lucide-react';
import type { User } from 'firebase/auth';
import { ProductCard } from './ProductCard';
import type { Product } from '../types';

interface WishlistViewProps {
  products: Product[];
  wishlist: string[];
  user: User | null;
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (productId: string) => void;
  onSelectProduct: (product: Product) => void;
  onContinueShopping: () => void;
  onSignIn: () => void;
}

export const WishlistView: React.FC<WishlistViewProps> = ({
  products,
  wishlist,
  user,
  onAddToCart,
  onToggleWishlist,
  onSelectProduct,
  onContinueShopping,
  onSignIn,
}) => {
  const savedProducts = products.filter((p) => wishlist.includes(p.id));

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E5DEC9] pb-5">
        <div>
          <h1 className="font-serif-display text-3xl font-semibold text-[#0D3B2E]">
            Saved Wishlist
          </h1>
          <p className="mt-1 text-sm text-[#52605B]">
            {savedProducts.length} saved item{savedProducts.length === 1 ? '' : 's'}
            {user ? ' · Synced with your Google account' : ' · Saved on this device'}
          </p>
        </div>

        {!user && (
          <button
            type="button"
            onClick={onSignIn}
            className="text-xs font-semibold text-[#0D3B2E] underline hover:text-[#092A20]"
          >
            Sign in with Google to sync wishlist across devices
          </button>
        )}
      </div>

      {savedProducts.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {savedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isWishlisted={true}
              onAddToCart={onAddToCart}
              onToggleWishlist={onToggleWishlist}
              onSelectProduct={onSelectProduct}
            />
          ))}
        </div>
      ) : (
        <div className="mt-10 bg-white border border-[#E5DEC9] rounded-2xl p-12 text-center">
          <Heart className="w-9 h-9 text-[#0D3B2E] mx-auto opacity-70" aria-hidden="true" />
          <h2 className="mt-4 font-serif-display text-2xl font-semibold text-[#0D3B2E]">
            Your wishlist is empty
          </h2>
          <p className="mt-2 text-sm text-[#52605B] max-w-md mx-auto">
            Tap the heart icon on any product to keep track of favorites and add them to your cart
            later.
          </p>
          <button
            type="button"
            onClick={onContinueShopping}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[#0D3B2E] text-[#FAF7F2] text-sm font-semibold rounded-lg hover:bg-[#092A20] transition-colors"
          >
            <span>Explore Storefront</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
};
