import React, { useState } from 'react';
import { Heart, Package, Plus, Star } from 'lucide-react';
import { formatINR } from '../utils/commerce';
import type { Product } from '../types';

interface ProductCardProps {
  product: Product;
  isWishlisted: boolean;
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (productId: string) => void;
  onSelectProduct: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isWishlisted,
  onAddToCart,
  onToggleWishlist,
  onSelectProduct,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const primaryImage = product.images[0] || '';
  const outOfStock = product.stock <= 0;

  return (
    <article className="group bg-white border border-[#E6DFD3] rounded-xl overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
      {/* Uniform 4:3 Imagery Container */}
      <div className="relative aspect-[4/3] bg-[#F2ECE1] overflow-hidden">
        {primaryImage && !imageFailed ? (
          <button
            type="button"
            onClick={() => onSelectProduct(product)}
            aria-label={`View details for ${product.name}`}
            className="block w-full h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0D3B2E]"
          >
            <img
              src={primaryImage}
              alt={product.name}
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSelectProduct(product)}
            className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#F2ECE1] to-[#E6DFD3] text-[#0D3B2E]"
          >
            <Package className="w-8 h-8 mb-2 opacity-60" aria-hidden="true" />
            <span className="text-xs font-medium text-[#52605B]">{product.name}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onToggleWishlist(product.id)}
          aria-label={
            isWishlisted
              ? `Remove ${product.name} from wishlist`
              : `Save ${product.name} to wishlist`
          }
          aria-pressed={isWishlisted}
          className={`absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D3B2E] ${
            isWishlisted
              ? 'bg-[#0D3B2E] text-[#FAF7F2]'
              : 'bg-[#FAF7F2]/90 text-[#14211D] hover:bg-white'
          }`}
        >
          <Heart
            className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Product Information — Zero-Pill Metadata Discipline */}
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center gap-1.5 text-xs text-[#52605B]">
          <span className="truncate">{product.category}</span>
          {product.discountPercent > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[#8A6B2F] whitespace-nowrap">
                Save {product.discountPercent}%
              </span>
            </>
          )}
          {product.isDemo && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#52605B] whitespace-nowrap">Sample</span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => onSelectProduct(product)}
          className="mt-1.5 text-left focus-visible:outline-none focus-visible:underline"
        >
          <h3 className="font-sans text-base font-semibold text-[#14211D] leading-snug line-clamp-2 group-hover:text-[#0D3B2E] transition-colors">
            {product.name}
          </h3>
        </button>

        {/* Honest Rating Line — Never Fabricated */}
        <div className="mt-2 flex items-center gap-1.5 text-xs text-[#52605B]">
          {product.rating !== null && product.reviewCount > 0 ? (
            <>
              <Star className="w-3.5 h-3.5 text-[#C5A059] fill-[#C5A059]" aria-hidden="true" />
              <span className="font-medium text-[#14211D] tabular-nums">
                {product.rating.toFixed(1)}
              </span>
              <span>({product.reviewCount} verified)</span>
            </>
          ) : (
            <span>No customer ratings yet</span>
          )}
          <span aria-hidden="true">·</span>
          <span className={outOfStock ? 'text-red-700 font-medium' : 'text-[#0D3B2E]'}>
            {outOfStock ? 'Out of stock' : `${product.stock} in stock`}
          </span>
        </div>

        {/* Price Baseline + Action */}
        <div className="mt-auto pt-4 flex items-end justify-between gap-3 border-t border-[#F2ECE1]">
          <div>
            <div className="text-lg font-semibold text-[#14211D] tabular-nums">
              {formatINR(product.price)}
            </div>
            {product.originalPrice > product.price && (
              <div className="text-xs text-[#52605B] line-through tabular-nums">
                MRP {formatINR(product.originalPrice)}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={outOfStock}
            onClick={() => onAddToCart(product)}
            aria-label={`Add ${product.name} to cart`}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#0D3B2E] text-[#FAF7F2] text-xs font-semibold rounded-lg hover:bg-[#092A20] disabled:bg-[#D5CEC2] disabled:text-[#52605B] disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] focus-visible:ring-offset-1"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{outOfStock ? 'Sold Out' : 'Add to Cart'}</span>
          </button>
        </div>
      </div>
    </article>
  );
};
