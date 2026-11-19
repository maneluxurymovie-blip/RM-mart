import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import {
  auth,
  checkUserAdminAccess,
  isFirebaseConfigured,
  isVerifiedOwnerAccount,
  signInWithGoogle,
  signOutUser,
  testFirestoreConnection,
} from './lib/firebase';
import {
  subscribeOrders,
  subscribeProducts,
  syncUserProfileAndWishlist,
  updateOrderStatusInFirestore,
  updateUserWishlistInFirestore,
} from './lib/storeService';
import { DEMO_PRODUCTS } from './data/demoProducts';
import {
  addOrIncrementCartItem,
  removeCartItem,
  toggleWishlistItem,
  updateCartItemQuantity,
} from './utils/commerce';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import { CartView } from './components/CartView';
import { CheckoutView } from './components/CheckoutView';
import { OrderConfirmationView } from './components/OrderConfirmationView';
import { WishlistView } from './components/WishlistView';
import { OrdersView } from './components/OrdersView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { ProductDetailModal } from './components/ProductDetailModal';
import { SupportChatWidget } from './components/SupportChatWidget';
import { Footer } from './components/Footer';
import type { ActiveView, CartItem, Order, OrderStatus, PaymentStatus, Product } from './types';

const CART_STORAGE_KEY = 'rm_mart_cart_v1';
const WISHLIST_STORAGE_KEY = 'rm_mart_wishlist_v1';
const LOCAL_ORDERS_STORAGE_KEY = 'rm_mart_orders_v1';

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getInitialViewFromLocation(): ActiveView {
  if (typeof window === 'undefined') return 'home';
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  if (path === '/admin' || path.startsWith('/admin/') || hash === '#admin') {
    return 'admin';
  }
  return 'home';
}

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>(getInitialViewFromLocation);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  const [firestoreProducts, setFirestoreProducts] = useState<Product[]>([]);
  const [firestoreConnected, setFirestoreConnected] = useState(true);
  const [firebaseNotice, setFirebaseNotice] = useState('');

  const [cart, setCart] = useState<CartItem[]>(() => readStorage(CART_STORAGE_KEY, []));
  const [wishlist, setWishlist] = useState<string[]>(() =>
    readStorage(WISHLIST_STORAGE_KEY, [])
  );
  const [localOrders, setLocalOrders] = useState<Order[]>(() =>
    readStorage(LOCAL_ORDERS_STORAGE_KEY, [])
  );
  const [firestoreOrders, setFirestoreOrders] = useState<Order[]>([]);
  const [latestOrder, setLatestOrder] = useState<Order | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) {
      setIsOwner(false);
      return;
    }
    if (isVerifiedOwnerAccount(user)) {
      setIsOwner(true);
      return;
    }
    checkUserAdminAccess(user).then((allowed) => {
      if (active) setIsOwner(allowed);
    });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    const onPopState = () => {
      setActiveView(getInitialViewFromLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const usingDemoCatalog = firestoreProducts.length === 0;
  const products = useMemo(
    () => (firestoreProducts.length > 0 ? firestoreProducts : DEMO_PRODUCTS),
    [firestoreProducts]
  );

  // Merge Firestore synced orders and local guest orders without duplicates
  const orders = useMemo(() => {
    const map = new Map<string, Order>();
    for (const o of localOrders) map.set(o.id, o);
    for (const o of firestoreOrders) map.set(o.id, o);
    return Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [localOrders, firestoreOrders]);

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const showToast = (message: string) => {
    setToast(message);
  };

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Persist cart, wishlist, and session orders across page refreshes
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore quota error
    }
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
    } catch {
      // ignore
    }
  }, [wishlist]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_ORDERS_STORAGE_KEY, JSON.stringify(localOrders.slice(0, 30)));
    } catch {
      // ignore
    }
  }, [localOrders]);

  // Boot-time Firebase connectivity probe
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setFirestoreConnected(false);
      setFirebaseNotice(
        'Firebase configuration is missing. See DEPLOYMENT.md to configure firebase-applet-config.json.'
      );
      setAuthReady(true);
      return;
    }

    testFirestoreConnection().then((res) => {
      if (res.offline) {
        setFirestoreConnected(false);
        setFirebaseNotice(res.message || 'Firestore appears offline.');
      }
    });

    if (!auth) {
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
  }, []);

  // Subscribe to live Firestore catalog
  useEffect(() => {
    return subscribeProducts((items) => {
      setFirestoreProducts(items);
    });
  }, []);

  // Keep Express server validator & AI assistant synchronized with live catalog
  useEffect(() => {
    if (firestoreProducts.length === 0) return;
    fetch('/api/catalog/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: firestoreProducts }),
    }).catch(() => {});
  }, [firestoreProducts]);

  // Sync wishlist with Firestore when authenticated
  useEffect(() => {
    if (!authReady || !user) return;
    syncUserProfileAndWishlist(user, wishlist).then((merged) => {
      setWishlist(merged);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user?.uid]);

  // Subscribe to Firestore orders when authenticated
  useEffect(() => {
    if (!authReady || !user) {
      setFirestoreOrders([]);
      return;
    }
    return subscribeOrders(user, isOwner, setFirestoreOrders);
  }, [authReady, user, isOwner]);

  const handleSignIn = async () => {
    try {
      const signedIn = await signInWithGoogle();
      showToast(`Welcome, ${signedIn.displayName || signedIn.email}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in cancelled or unavailable.';
      showToast(msg);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    if (activeView === 'admin') {
      setActiveView('home');
      if (typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/admin')) {
        window.history.pushState({}, '', '/');
      }
    }
    showToast('Signed out cleanly.');
  };

  const handleAddToCart = (product: Product, delta = 1) => {
    if (product.stock <= 0) {
      showToast(`${product.name} is currently out of stock.`);
      return;
    }
    setCart((prev) => addOrIncrementCartItem(prev, product.id, product.stock, delta));
    showToast(`Added "${product.name}" to your cart.`);
  };

  const handleUpdateCartQty = (productId: string, quantity: number) => {
    const product = products.find((p) => p.id === productId);
    const maxStock = product?.stock ?? 99;
    setCart((prev) => updateCartItemQuantity(prev, productId, quantity, maxStock));
  };

  const handleRemoveCartItem = (productId: string) => {
    setCart((prev) => removeCartItem(prev, productId));
    showToast('Item removed from cart.');
  };

  const handleToggleWishlist = (productId: string) => {
    const exists = wishlist.includes(productId);
    const next = toggleWishlistItem(wishlist, productId);
    setWishlist(next);
    showToast(exists ? 'Removed from wishlist.' : 'Saved to wishlist.');
    if (user && user.emailVerified) {
      updateUserWishlistInFirestore(user, next).catch(() => {});
    }
  };

  const handleOrderComplete = (order: Order) => {
    setCart([]);
    setLatestOrder(order);
    setLocalOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
    setActiveView('confirmation');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Order ${order.orderNumber} placed successfully.`);
  };

  const handleCancelPendingOrder = async (orderId: string) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target || target.orderStatus !== 'Pending') return;
    if (target.syncedToFirestore && user) {
      try {
        await updateOrderStatusInFirestore(orderId, 'Cancelled');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Unable to cancel order in Firestore.');
        return;
      }
    }
    setLocalOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, orderStatus: 'Cancelled' } : o))
    );
    showToast(`Order ${target.orderNumber} cancelled.`);
  };

  const handleOrderStatusUpdatedLocal = (orderId: string, status: OrderStatus) => {
    setLocalOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, orderStatus: status } : o))
    );
  };

  const handleOrderPaymentUpdatedLocal = (orderId: string, paymentStatus: PaymentStatus) => {
    setLocalOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, paymentStatus } : o))
    );
  };

  const handleNavigate = (view: ActiveView) => {
    setActiveView(view);
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname.toLowerCase();
      if (view === 'admin' && currentPath !== '/admin') {
        window.history.pushState({}, '', '/admin');
      } else if (view !== 'admin' && (currentPath === '/admin' || currentPath.startsWith('/admin/'))) {
        window.history.pushState({}, '', '/');
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#14211D]">
        <Header
          activeView={activeView}
          onNavigate={handleNavigate}
          cartCount={cartCount}
          wishlistCount={wishlist.length}
          user={user}
          isOwner={isOwner}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
        />

        {!firestoreConnected && firebaseNotice && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900">
            <div className="max-w-7xl mx-auto flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{firebaseNotice}</span>
            </div>
          </div>
        )}

        <main className="flex-1">
          {activeView === 'home' && (
            <HomeView
              products={products}
              usingDemoCatalog={usingDemoCatalog}
              wishlist={wishlist}
              onAddToCart={(product) => handleAddToCart(product, 1)}
              onToggleWishlist={handleToggleWishlist}
              onSelectProduct={setSelectedProduct}
            />
          )}

          {activeView === 'cart' && (
            <CartView
              cart={cart}
              products={products}
              onUpdateQty={handleUpdateCartQty}
              onRemoveItem={handleRemoveCartItem}
              onProceedCheckout={() => handleNavigate('checkout')}
              onContinueShopping={() => handleNavigate('home')}
            />
          )}

          {activeView === 'checkout' && (
            <CheckoutView
              cart={cart}
              products={products}
              user={user}
              onBackToCart={() => handleNavigate('cart')}
              onOrderComplete={handleOrderComplete}
              onSignIn={handleSignIn}
            />
          )}

          {activeView === 'confirmation' && (
            <OrderConfirmationView
              order={latestOrder}
              onViewOrders={() => handleNavigate('orders')}
              onContinueShopping={() => handleNavigate('home')}
            />
          )}

          {activeView === 'wishlist' && (
            <WishlistView
              products={products}
              wishlist={wishlist}
              user={user}
              onAddToCart={(product) => handleAddToCart(product, 1)}
              onToggleWishlist={handleToggleWishlist}
              onSelectProduct={setSelectedProduct}
              onContinueShopping={() => handleNavigate('home')}
              onSignIn={handleSignIn}
            />
          )}

          {activeView === 'orders' && (
            <OrdersView
              orders={orders}
              user={user}
              onCancelPendingOrder={handleCancelPendingOrder}
              onContinueShopping={() => handleNavigate('home')}
              onSignIn={handleSignIn}
            />
          )}

          {activeView === 'admin' && (
            <AdminDashboardView
              user={user}
              isOwner={isOwner}
              products={products}
              usingDemoCatalog={usingDemoCatalog}
              orders={orders}
              onSignIn={handleSignIn}
              onNotify={showToast}
              onReturnStorefront={() => handleNavigate('home')}
              onOrderStatusUpdatedLocal={handleOrderStatusUpdatedLocal}
              onOrderPaymentUpdatedLocal={handleOrderPaymentUpdatedLocal}
            />
          )}
        </main>

        <Footer
          onNavigate={handleNavigate}
          isOwner={isOwner}
          isSignedIn={Boolean(user)}
          onSignIn={handleSignIn}
        />

        {/* Product Detail Modal */}
        <ProductDetailModal
          product={selectedProduct}
          isWishlisted={selectedProduct ? wishlist.includes(selectedProduct.id) : false}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
          onToggleWishlist={handleToggleWishlist}
        />

        {/* Floating AI Customer Support Chatbox on Customer Pages */}
        {activeView !== 'admin' && <SupportChatWidget products={products} user={user} />}

        {/* Toast Notification */}
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-5 left-5 z-50 max-w-sm bg-[#0D3B2E] text-[#FAF7F2] px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 text-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-[#C5A059] shrink-0" aria-hidden="true" />
            <span className="flex-1">{toast}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
              className="text-[#FAF7F2]/75 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
