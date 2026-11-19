import React, { useState } from 'react';
import { Check, Heart, Minus, Plus, ShieldCheck, Truck, X } from 'lucide-react';
import { formatINR, FREE_DELIVERY_THRESHOLD_INR } from '../utils/commerce';
import type { Product } from '../types';

interface ProductDetailModalProps {
  product: Product | null;
  isWishlisted: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, qty: number) => void;
  onToggleWishlist: (productId: string) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  isWishlisted,
  onClose,
  onAddToCart,
  onToggleWishlist,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedImg, setSelectedImg] = useState(0);

  if (!product) return null;
  const outOfStock = product.stock <= 0;
  const images = product.images.length > 0 ? product.images : [''];
  const activeSrc = images[selectedImg] || images[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdp-title"
      className="fixed inset-0 z-50 bg-[#14211D]/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      <div className="relative bg-[#FAF7F2] border border-[#E5DEC9] rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl my-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close product details"
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/90 text-[#14211D] flex items-center justify-center hover:bg-white transition-colors border border-[#E5DEC9]"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 items-stretch">
          {/* Left Gallery */}
          <div className="bg-[#F2ECE1] p-6 flex flex-col justify-center">
            <div className="aspect-[4/3] rounded-xl overflow-hidden bg-white">
              {activeSrc && (
                <img
                  src={activeSrc}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-4 flex gap-3 overflow-x-auto">
                {images.map((src, index) => (
                  <button
                    key={src + index}
                    type="button"
                    onClick={() => setSelectedImg(index)}
                    className={`w-16 h-12 rounded-lg overflow-hidden border-2 shrink-0 ${
                      selectedImg === index ? 'border-[#0D3B2E]' : 'border-transparent'
                    }`}
                  >
                    <img
                      src={src}
                      alt={`${product.name} view ${index + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Contiguous Purchase Module */}
          <div className="p-6 sm:p-8 flex flex-col justify-between bg-white">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#52605B]">
                <span>{product.category}</span>
                {product.isDemo && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#8A6B2F] font-medium">Demo Catalog Sample</span>
                  </>
                )}
              </div>

              <h2
                id="pdp-title"
                className="mt-2 font-serif-display text-2xl sm:text-3xl font-semibold text-[#14211D] leading-tight"
              >
                {product.name}
              </h2>

              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-2xl font-bold text-[#0D3B2E] tabular-nums">
                  {formatINR(product.price)}
                </span>
                {product.originalPrice > product.price && (
                  <>
                    <span className="text-sm text-[#52605B] line-through tabular-nums">
                      MRP {formatINR(product.originalPrice)}
                    </span>
                    <span className="text-sm font-semibold text-[#8A6B2F]">
                      {product.discountPercent}% off
                    </span>
                  </>
                )}
              </div>
              <p className="mt-1 text-xs text-[#52605B]">Inclusive of all taxes</p>

              <p className="mt-5 text-sm text-[#52605B] leading-relaxed">
                {product.description}
              </p>

              <div className="mt-5 pt-5 border-t border-[#F2ECE1] space-y-2 text-xs text-[#52605B]">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#0D3B2E] shrink-0" aria-hidden="true" />
                  <span>
                    Free Pan-India delivery on orders above {formatINR(FREE_DELIVERY_THRESHOLD_INR)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#0D3B2E] shrink-0" aria-hidden="true" />
                  <span>Cash on Delivery available · 7-day easy replacement policy</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#0D3B2E] shrink-0" aria-hidden="true" />
                  <span>
                    {outOfStock
                      ? 'Currently out of stock'
                      : `${product.stock} unit(s) ready to dispatch`}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-[#E5DEC9] space-y-3">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center border border-[#D8D0C1] rounded-lg bg-[#FAF7F2]">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-10 h-10 flex items-center justify-center text-[#14211D] hover:bg-[#F2ECE1] rounded-l-lg"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-10 text-center text-sm font-semibold tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => setQuantity((q) => Math.min(Math.max(1, product.stock), q + 1))}
                    className="w-10 h-10 flex items-center justify-center text-[#14211D] hover:bg-[#F2ECE1] rounded-r-lg"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={() => {
                    onAddToCart(product, quantity);
                    onClose();
                  }}
                  className="flex-1 py-2.5 px-5 bg-[#0D3B2E] text-[#FAF7F2] text-sm font-semibold rounded-lg hover:bg-[#092A20] disabled:bg-[#D5CEC2] disabled:text-[#52605B] transition-colors whitespace-nowrap"
                >
                  {outOfStock ? 'Out of Stock' : `Add to Cart · ${formatINR(product.price * quantity)}`}
                </button>

                <button
                  type="button"
                  onClick={() => onToggleWishlist(product.id)}
                  aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                  className={`w-11 h-11 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                    isWishlisted
                      ? 'bg-[#0D3B2E] border-[#0D3B2E] text-[#FAF7F2]'
                      : 'border-[#D8D0C1] text-[#14211D] hover:bg-[#F2ECE1]'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
