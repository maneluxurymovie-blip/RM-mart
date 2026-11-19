import React, { useMemo, useState } from 'react';
import { ArrowRight, Search, ShieldCheck, Sparkles, Truck, X } from 'lucide-react';
import { HERO_BANNER_IMAGE } from '../data/demoProducts';
import { PRODUCT_CATEGORIES, type Product, type ProductCategory } from '../types';
import { ProductCard } from './ProductCard';
import { formatINR, FREE_DELIVERY_THRESHOLD_INR } from '../utils/commerce';

type CollectionFilter = 'all' | 'featured' | 'bestSeller' | 'newArrival' | 'specialOffer';

interface HomeViewProps {
  products: Product[];
  usingDemoCatalog: boolean;
  wishlist: string[];
  onAddToCart: (product: Product) => void;
  onToggleWishlist: (productId: string) => void;
  onSelectProduct: (product: Product) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  products,
  usingDemoCatalog,
  wishlist,
  onAddToCart,
  onToggleWishlist,
  onSelectProduct,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | ProductCategory>('All');
  const [collectionTab, setCollectionTab] = useState<CollectionFilter>('all');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategory !== 'All' && p.category !== selectedCategory) {
        return false;
      }
      if (collectionTab === 'featured' && !p.featured) return false;
      if (collectionTab === 'bestSeller' && !p.bestSeller) return false;
      if (collectionTab === 'newArrival' && !p.newArrival) return false;
      if (collectionTab === 'specialOffer' && !p.specialOffer) return false;

      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
  }, [products, searchQuery, selectedCategory, collectionTab]);

  const scrollToCatalog = () => {
    const el = document.getElementById('catalog-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div>
      {/* Slim Dismissible Promotional Strip (<= 38px) */}
      {!bannerDismissed && (
        <div className="bg-[#0D3B2E] text-[#FAF7F2] text-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-9 flex items-center justify-between gap-4">
            <p className="truncate">
              Complimentary Pan-India delivery on orders {formatINR(FREE_DELIVERY_THRESHOLD_INR)}+ · Cash on Delivery available
            </p>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss announcement banner"
              className="p-1 text-[#E8D5A8] hover:text-white transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Editorial Storefront Hero — Balanced 2-Column Split */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12 lg:pt-12 lg:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          <div className="lg:col-span-5 flex flex-col justify-center py-4 lg:py-8">
            <p className="text-xs font-medium tracking-wider text-[#8A6B2F]">
              Curated by Ravindra Mane · India
            </p>
            <h1 className="mt-3 font-serif-display text-4xl sm:text-5xl font-semibold text-[#0D3B2E] leading-[1.12]">
              Everything You Need, Delivered with Ease.
            </h1>
            <p className="mt-5 text-base text-[#52605B] leading-relaxed max-w-md">
              Thoughtfully selected botanical skincare, acoustic electronics, tailored linen apparel,
              daily essentials, and artisanal Indian pantry staples—priced transparently in ₹.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={scrollToCatalog}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#0D3B2E] text-[#FAF7F2] text-sm font-semibold rounded-lg hover:bg-[#092A20] transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] focus-visible:ring-offset-2"
              >
                <span>Shop Now</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setCollectionTab('specialOffer');
                  setSelectedCategory('All');
                  scrollToCatalog();
                }}
                className="inline-flex items-center gap-2 px-5 py-3 border border-[#0D3B2E]/25 text-[#0D3B2E] text-sm font-medium rounded-lg hover:bg-[#F2ECE1] transition-colors whitespace-nowrap"
              >
                Explore Special Offers
              </button>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="relative h-full min-h-[280px] sm:min-h-[380px] rounded-2xl overflow-hidden bg-[#F2ECE1] border border-[#E5DEC9]">
              <img
                src={HERO_BANNER_IMAGE}
                alt="RM Mart curated collection of Kashmiri skincare, emerald wireless headphones, pure linen apparel, and Darjeeling tea"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#14211D]/80 via-[#14211D]/30 to-transparent p-6 sm:p-8">
                <p className="text-xs text-[#E8D5A8] font-medium">
                  The RM Mart Signature Edit
                </p>
                <p className="mt-1 font-serif-display text-xl sm:text-2xl text-[#FAF7F2]">
                  Five everyday departments, one trusted Indian storefront
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog Section: Search, Categories, Collection Filter & Uniform Grid */}
      <section
        id="catalog-section"
        className="scroll-mt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 border-t border-[#E5DEC9]"
      >
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <h2 className="font-serif-display text-3xl font-semibold text-[#0D3B2E]">
              Storefront Collection
            </h2>
            <p className="mt-1.5 text-sm text-[#52605B]">
              Browse by department or search by product name and category.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full lg:w-96">
            <label htmlFor="product-search" className="sr-only">
              Search products by name or category
            </label>
            <Search
              className="w-4 h-4 text-[#52605B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="product-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search saffron serum, headphones, linen, tea..."
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#D8D0C1] rounded-lg text-sm text-[#14211D] placeholder:text-[#7E8A85] focus:outline-none focus:border-[#0D3B2E] focus:ring-2 focus:ring-[#0D3B2E]/15"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search query"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52605B] hover:text-[#14211D]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Interactive Category Navigation */}
        <div
          role="tablist"
          aria-label="Product categories"
          className="mt-6 flex items-center gap-2 overflow-x-auto pb-2"
        >
          {(['All', ...PRODUCT_CATEGORIES] as const).map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#0D3B2E] text-[#FAF7F2]'
                    : 'bg-[#F2ECE1] text-[#14211D] hover:bg-[#E7DEC9]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Collection Filter Row (Featured / Best Sellers / New Arrivals / Special Offers) */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-b border-[#E5DEC9] pb-4">
          <div className="flex items-center gap-5 overflow-x-auto">
            {(
              [
                ['all', 'All Products'],
                ['featured', 'Featured'],
                ['bestSeller', 'Best Sellers'],
                ['newArrival', 'New Arrivals'],
                ['specialOffer', 'Special Offers'],
              ] as [CollectionFilter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCollectionTab(key)}
                className={`text-sm font-medium pb-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  collectionTab === key
                    ? 'text-[#0D3B2E] border-[#C5A059]'
                    : 'text-[#52605B] border-transparent hover:text-[#0D3B2E]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <p className="text-xs text-[#52605B] tabular-nums">
            Showing {filteredProducts.length} of {products.length} items
          </p>
        </div>

        {/* Transparent Demo Catalog Notice */}
        {usingDemoCatalog && (
          <div className="mt-6 px-4 py-3 bg-[#F2ECE1] border border-[#E5DEC9] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#52605B]">
            <p>
              <strong className="font-semibold text-[#14211D]">Sample Catalog Mode:</strong>{' '}
              Displaying editable RM Mart demo products until the store owner adds live inventory
              from the Admin Dashboard. No fake customer reviews are shown.
            </p>
          </div>
        )}

        {/* 3-Column Uniform Product Grid */}
        {filteredProducts.length > 0 ? (
          <div
            data-testid="product-grid"
            className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7"
          >
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isWishlisted={wishlist.includes(product.id)}
                onAddToCart={onAddToCart}
                onToggleWishlist={onToggleWishlist}
                onSelectProduct={onSelectProduct}
              />
            ))}
          </div>
        ) : (
          <div className="mt-10 py-16 text-center bg-white border border-[#E5DEC9] rounded-xl px-6">
            <h3 className="font-serif-display text-xl font-semibold text-[#0D3B2E]">
              No matching products found
            </h3>
            <p className="mt-2 text-sm text-[#52605B]">
              Try clearing your search or switching to another department.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                setCollectionTab('all');
              }}
              className="mt-5 px-5 py-2.5 bg-[#0D3B2E] text-[#FAF7F2] text-sm font-medium rounded-lg hover:bg-[#092A20] transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}
      </section>

      {/* RM Mart Promise Strip (4-Column Full-Width Row Below Catalog) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 border-t border-[#E5DEC9]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <Truck className="w-5 h-5 text-[#0D3B2E]" aria-hidden="true" />
            <h3 className="mt-3 font-sans text-sm font-semibold text-[#14211D]">
              Pan-India Dispatch
            </h3>
            <p className="mt-1.5 text-sm text-[#52605B] leading-relaxed">
              Free shipping on orders above {formatINR(FREE_DELIVERY_THRESHOLD_INR)}, flat ₹79
              otherwise with reliable doorstep tracking.
            </p>
          </div>
          <div>
            <ShieldCheck className="w-5 h-5 text-[#0D3B2E]" aria-hidden="true" />
            <h3 className="mt-3 font-sans text-sm font-semibold text-[#14211D]">
              Honest INR Pricing
            </h3>
            <p className="mt-1.5 text-sm text-[#52605B] leading-relaxed">
              Every cart total, MRP discount, and stock count is verified server-side before order
              acceptance.
            </p>
          </div>
          <div>
            <Sparkles className="w-5 h-5 text-[#0D3B2E]" aria-hidden="true" />
            <h3 className="mt-3 font-sans text-sm font-semibold text-[#14211D]">
              Flexible Payments
            </h3>
            <p className="mt-1.5 text-sm text-[#52605B] leading-relaxed">
              Pay safely with Cash on Delivery or initiate a UPI transfer with transparent merchant
              verification.
            </p>
          </div>
          <div>
            <ArrowRight className="w-5 h-5 text-[#0D3B2E]" aria-hidden="true" />
            <h3 className="mt-3 font-sans text-sm font-semibold text-[#14211D]">
              Hindi, Marathi & English Help
            </h3>
            <p className="mt-1.5 text-sm text-[#52605B] leading-relaxed">
              Instant product assistance via our support chatbox with direct escalation to owner
              Ravindra Mane.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
