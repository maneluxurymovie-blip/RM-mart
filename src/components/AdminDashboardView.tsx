import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Lock,
  MessageSquare,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  deleteProductFromFirestore,
  saveProductToFirestore,
  sendAdminReplyToFirestore,
  subscribeAllConversationsForAdmin,
  subscribeConversationMessages,
  subscribeCustomersForAdmin,
  updateConversationStatusInFirestore,
  updateOrderPaymentStatusInFirestore,
  updateOrderStatusInFirestore,
  updateProductStockInFirestore,
} from '../lib/storeService';
import { getFirebaseProjectInfo, uploadProductImage } from '../lib/firebase';
import { calculateDiscountPercent, formatINR } from '../utils/commerce';
import { sanitizeProductInput } from '../utils/validation';
import {
  buildEnrichedCustomers,
  buildRecentActivity,
  computeAdminMetrics,
  computeRevenueByCategory,
} from '../utils/adminMetrics';
import { DEMO_PRODUCTS } from '../data/demoProducts';
import {
  ORDER_STATUSES,
  PRODUCT_CATEGORIES,
  type ChatMessage,
  type CustomerRecord,
  type Order,
  type OrderStatus,
  type PaymentStatus,
  type Product,
  type ProductCategory,
  type SupportConversation,
} from '../types';

type AdminTab = 'overview' | 'products' | 'orders' | 'customers' | 'chats';
type ChatFilter = 'all' | 'human' | 'unread' | 'open' | 'resolved';

interface AdminDashboardViewProps {
  user: User | null;
  isOwner: boolean;
  products: Product[];
  usingDemoCatalog: boolean;
  orders: Order[];
  onSignIn: () => void;
  onReturnStorefront: () => void;
  onNotify: (msg: string) => void;
  onOrderStatusUpdatedLocal: (orderId: string, status: OrderStatus) => void;
  onOrderPaymentUpdatedLocal: (orderId: string, paymentStatus: PaymentStatus) => void;
}

const EMPTY_PRODUCT_FORM = {
  id: '',
  name: '',
  description: '',
  category: 'Fashion & Beauty' as ProductCategory,
  price: 999,
  originalPrice: 1299,
  stock: 10,
  images: [''],
  featured: true,
  bestSeller: false,
  newArrival: true,
  specialOffer: false,
  isDemo: false,
};

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  user,
  isOwner,
  products,
  usingDemoCatalog,
  orders,
  onSignIn,
  onReturnStorefront,
  onNotify,
  onOrderStatusUpdatedLocal,
  onOrderPaymentUpdatedLocal,
}) => {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [firestoreChats, setFirestoreChats] = useState<SupportConversation[]>([]);
  const [serverChats, setServerChats] = useState<SupportConversation[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChatMessages, setSelectedChatMessages] = useState<ChatMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Filters & interactive expansion
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<'All' | ProductCategory>('All');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'All' | OrderStatus>('All');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [chatSearch, setChatSearch] = useState('');
  const [chatFilter, setChatFilter] = useState<ChatFilter>('all');

  // Product editor state
  const [editingProduct, setEditingProduct] = useState<typeof EMPTY_PRODUCT_FORM | null>(null);
  const [isNewProduct, setIsNewProduct] = useState(true);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productFormError, setProductFormError] = useState('');
  const [seedingDemo, setSeedingDemo] = useState(false);

  const projectInfo = getFirebaseProjectInfo();

  useEffect(() => {
    if (!isOwner) return;
    const unsubCust = subscribeCustomersForAdmin(true, setCustomers);
    const unsubChats = subscribeAllConversationsForAdmin(true, setFirestoreChats);
    return () => {
      unsubCust();
      unsubChats();
    };
  }, [isOwner]);

  // Fetch server-mirrored guest/active chats for owner review
  useEffect(() => {
    if (!isOwner || !user?.email) return;
    const fetchServerChats = async () => {
      try {
        const res = await fetch('/api/admin/conversations', {
          headers: { 'x-owner-email': user.email || '' },
        });
        if (res.ok) {
          const data = await res.json();
          setServerChats(data.conversations || []);
        }
      } catch {
        // ignore transient errors
      }
    };
    fetchServerChats();
    const timer = window.setInterval(fetchServerChats, 10000);
    return () => window.clearInterval(timer);
  }, [isOwner, user]);

  // Merge Firestore + Server conversations by ID
  const allConversations = useMemo(() => {
    const map = new Map<string, SupportConversation>();
    for (const c of serverChats) map.set(c.id, c);
    for (const c of firestoreChats) {
      const existing = map.get(c.id);
      map.set(c.id, existing ? { ...existing, ...c } : c);
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [firestoreChats, serverChats]);

  // Subscribe to messages for selected conversation
  useEffect(() => {
    if (!isOwner || !selectedChatId || !user) {
      setSelectedChatMessages([]);
      return;
    }
    const serverMatch = serverChats.find((c) => c.id === selectedChatId);
    if (serverMatch?.messages && serverMatch.messages.length > 0) {
      setSelectedChatMessages(serverMatch.messages);
    }
    return subscribeConversationMessages(selectedChatId, user, (msgs) => {
      if (msgs.length > 0) setSelectedChatMessages(msgs);
    });
  }, [isOwner, selectedChatId, user, serverChats]);

  // STRICT SECURITY GATE: Never render admin controls or store data to unauthenticated users or non-owners
  if (!user || !isOwner) {
    return (
      <section className="max-w-xl mx-auto px-4 sm:px-6 py-16">
        <div className="bg-white border border-[#E5DEC9] rounded-2xl p-8 sm:p-10">
          <div className="flex items-center justify-between gap-4 pb-5 border-b border-[#F2ECE1]">
            <div className="flex items-center gap-2.5 text-[#0D3B2E]">
              <Lock className="w-5 h-5" aria-hidden="true" />
              <span className="text-xs font-semibold tracking-wider uppercase text-[#8A6B2F]">
                RM Mart Owner Portal
              </span>
            </div>
            <button
              type="button"
              onClick={onReturnStorefront}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#52605B] hover:text-[#0D3B2E]"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Storefront</span>
            </button>
          </div>

          <div className="mt-6">
            <h1 className="font-serif-display text-3xl font-semibold text-[#0D3B2E]">
              Owner Admin Panel
            </h1>
            <p className="mt-3 text-sm text-[#52605B] leading-relaxed">
              Manage RM Mart products, Firebase Storage photography, inventory, orders, customer
              analytics, and live customer support replies. Access is strictly limited to the
              verified owner account (Ravindra Mane).
            </p>
          </div>

          <div className="mt-6 p-4 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl space-y-2 text-xs text-[#52605B]">
            <div className="flex items-center gap-2 font-semibold text-[#14211D]">
              <ShieldCheck className="w-4 h-4 text-[#0D3B2E] shrink-0" aria-hidden="true" />
              <span>Server &amp; Firestore Security Rules Enforced</span>
            </div>
            <p>
              Primary Owner Email:{' '}
              <span className="font-mono font-semibold text-[#0D3B2E]">{projectInfo.ownerEmail}</span>
            </p>
            <p>
              Authorization requires verified Google Sign-In matching the configured owner identity
              or an allowlisted UID in <span className="font-mono text-[#14211D]">/admins/{'{uid}'}</span>.
              Customers cannot read or modify admin data.
            </p>
          </div>

          {!user ? (
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onSignIn}
                className="flex-1 px-6 py-3 bg-[#0D3B2E] text-[#FAF7F2] text-sm font-semibold rounded-lg hover:bg-[#092A20] transition-colors"
              >
                Sign In with Owner Google Account
              </button>
              <button
                type="button"
                onClick={onReturnStorefront}
                className="px-5 py-3 border border-[#D8D0C1] text-[#14211D] text-sm font-medium rounded-lg hover:bg-[#F2ECE1] transition-colors"
              >
                Back to Shop
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div
                role="alert"
                className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl p-4 leading-relaxed"
              >
                Signed in as <strong>{user.email}</strong>, which is not authorized as an RM Mart
                owner account. Sign out and sign in with the verified owner Google account to access
                this dashboard.
              </div>
              <button
                type="button"
                onClick={onReturnStorefront}
                className="w-full px-5 py-2.5 bg-[#0D3B2E] text-[#FAF7F2] text-sm font-semibold rounded-lg hover:bg-[#092A20]"
              >
                Return to RM Mart Storefront
              </button>
            </div>
          )}
        </div>
      </section>
    );
  }

  // Verified Owner Analytics & Derived Lists
  const metrics = useMemo(
    () => computeAdminMetrics(products, orders, allConversations),
    [products, orders, allConversations]
  );

  const revenueByCategory = useMemo(
    () => computeRevenueByCategory(products, orders),
    [products, orders]
  );

  const enrichedCustomers = useMemo(
    () => buildEnrichedCustomers(customers, orders, products),
    [customers, orders, products]
  );

  const recentActivity = useMemo(
    () => buildRecentActivity(orders, allConversations, 8),
    [orders, allConversations]
  );

  const filteredProducts = products.filter((p) => {
    if (productCategoryFilter !== 'All' && p.category !== productCategoryFilter) return false;
    const q = productSearch.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });

  const filteredOrders = orders.filter((o) => {
    if (orderStatusFilter !== 'All' && o.orderStatus !== orderStatusFilter) return false;
    const q = orderSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerEmail.toLowerCase().includes(q) ||
      o.customerMobile.includes(q)
    );
  });

  const filteredChats = allConversations.filter((c) => {
    if (chatFilter === 'human' && !c.needsHumanSupport) return false;
    if (chatFilter === 'unread' && (c.unreadByAdmin || 0) <= 0) return false;
    if (chatFilter === 'open' && c.status !== 'open') return false;
    if (chatFilter === 'resolved' && c.status !== 'resolved') return false;
    const q = chatSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      c.customerName.toLowerCase().includes(q) ||
      (c.customerEmail || '').toLowerCase().includes(q) ||
      c.lastMessage.toLowerCase().includes(q)
    );
  });

  const selectedChat = allConversations.find((c) => c.id === selectedChatId) || null;

  const handleSeedDemoToFirestore = async () => {
    setSeedingDemo(true);
    try {
      for (const p of DEMO_PRODUCTS) {
        await saveProductToFirestore(
          {
            id: p.id,
            name: p.name,
            description: p.description,
            category: p.category,
            price: p.price,
            originalPrice: p.originalPrice,
            discountPercent: p.discountPercent,
            stock: p.stock,
            rating: 0,
            reviewCount: 0,
            images: p.images,
            featured: p.featured,
            bestSeller: p.bestSeller,
            newArrival: p.newArrival,
            specialOffer: p.specialOffer,
            isDemo: false,
          },
          true
        );
      }
      onNotify('Starter catalog published to Firestore. All items are now live and editable.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to publish starter catalog.');
    } finally {
      setSeedingDemo(false);
    }
  };

  const handleQuickStockAdjust = async (product: Product, delta: number) => {
    if (usingDemoCatalog) {
      onNotify('Publish the starter catalog to Firestore first to edit live inventory stock.');
      return;
    }
    const nextStock = Math.max(0, product.stock + delta);
    try {
      await updateProductStockInFirestore(product.id, nextStock);
      onNotify(`Updated stock for "${product.name}" to ${nextStock}.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not update stock.');
    }
  };

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingProduct) return;
    setUploadingImg(true);
    setProductFormError('');
    try {
      const targetId = editingProduct.id || `prod_${Date.now()}`;
      const downloadUrl = await uploadProductImage(targetId, file);
      setEditingProduct((prev) =>
        prev
          ? {
              ...prev,
              id: targetId,
              images: [downloadUrl, ...prev.images.filter(Boolean)].slice(0, 5),
            }
          : null
      );
      onNotify('Product photo uploaded to Firebase Storage.');
    } catch (err) {
      setProductFormError(
        err instanceof Error ? err.message : 'Image upload failed. Check Firebase Storage rules.'
      );
    } finally {
      setUploadingImg(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    const errMsg = sanitizeProductInput({
      name: editingProduct.name,
      description: editingProduct.description,
      price: Number(editingProduct.price),
      originalPrice: Number(editingProduct.originalPrice),
      stock: Number(editingProduct.stock),
    });
    if (errMsg) {
      setProductFormError(errMsg);
      return;
    }
    const cleanImages = editingProduct.images.map((s) => s.trim()).filter(Boolean);
    if (cleanImages.length === 0) {
      setProductFormError('Please upload a product photo or enter at least one valid image URL.');
      return;
    }

    setSavingProduct(true);
    setProductFormError('');
    try {
      const id =
        editingProduct.id ||
        `${editingProduct.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 40)}-${Date.now().toString(36)}`;

      await saveProductToFirestore(
        {
          id,
          name: editingProduct.name.trim(),
          description: editingProduct.description.trim(),
          category: editingProduct.category,
          price: Number(editingProduct.price),
          originalPrice: Number(editingProduct.originalPrice),
          discountPercent: calculateDiscountPercent(
            Number(editingProduct.price),
            Number(editingProduct.originalPrice)
          ),
          stock: Number(editingProduct.stock),
          rating: 0,
          reviewCount: 0,
          images: cleanImages,
          featured: editingProduct.featured,
          bestSeller: editingProduct.bestSeller,
          newArrival: editingProduct.newArrival,
          specialOffer: editingProduct.specialOffer,
          isDemo: false,
        },
        isNewProduct
      );
      setEditingProduct(null);
      onNotify(isNewProduct ? 'Product added to Firestore.' : 'Product changes saved to Firestore.');
    } catch (err) {
      setProductFormError(err instanceof Error ? err.message : 'Could not save product.');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (productId: string, name: string) => {
    if (usingDemoCatalog) {
      onNotify('Publish the starter catalog to Firestore first before deleting sample products.');
      return;
    }
    try {
      await deleteProductFromFirestore(productId);
      onNotify(`Deleted "${name}" from live catalog.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to delete product.');
    }
  };

  const handleOrderStatusChange = async (order: Order, nextStatus: OrderStatus) => {
    try {
      if (order.syncedToFirestore) {
        await updateOrderStatusInFirestore(order.id, nextStatus);
      }
      await fetch(`/api/orders/${encodeURIComponent(order.id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: nextStatus, ownerEmail: user.email }),
      });
      onOrderStatusUpdatedLocal(order.id, nextStatus);
      onNotify(`Order ${order.orderNumber} updated to ${nextStatus}.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not update order status.');
    }
  };

  const handleVerifyUpiPayment = async (order: Order) => {
    try {
      if (order.syncedToFirestore) {
        await updateOrderPaymentStatusInFirestore(order.id, 'Verified');
      }
      await fetch(`/api/orders/${encodeURIComponent(order.id)}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: 'Verified', ownerEmail: user.email }),
      });
      onOrderPaymentUpdatedLocal(order.id, 'Verified');
      onNotify(`Marked UPI payment for ${order.orderNumber} as Verified.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not verify payment status.');
    }
  };

  const handleToggleChatResolved = async (conv: SupportConversation) => {
    const nextStatus = conv.status === 'resolved' ? 'open' : 'resolved';
    try {
      if (firestoreChats.some((c) => c.id === conv.id)) {
        await updateConversationStatusInFirestore(conv.id, nextStatus);
      }
      await fetch(`/api/admin/conversations/${encodeURIComponent(conv.id)}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-owner-email': user.email || '',
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      setServerChats((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, status: nextStatus, unreadByAdmin: 0 } : c))
      );
      onNotify(
        nextStatus === 'resolved'
          ? 'Conversation marked as resolved.'
          : 'Conversation reopened.'
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not update conversation status.');
    }
  };

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChatId || !replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      const text = replyText.trim();
      const inFirestore = firestoreChats.some((c) => c.id === selectedChatId);
      if (inFirestore) {
        await sendAdminReplyToFirestore(selectedChatId, text);
      }
      const res = await fetch(
        `/api/admin/conversations/${encodeURIComponent(selectedChatId)}/reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-owner-email': user.email || '',
          },
          body: JSON.stringify({ text }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.conversation?.messages) {
          setSelectedChatMessages(data.conversation.messages);
        }
      }
      setReplyText('');
      onNotify('Reply sent to customer chatbox.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not send reply.');
    } finally {
      setSendingReply(false);
    }
  };

  const previewDiscount = editingProduct
    ? calculateDiscountPercent(Number(editingProduct.price), Number(editingProduct.originalPrice))
    : 0;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header Bar */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E5DEC9] pb-5">
        <div>
          <p className="text-xs font-semibold text-[#8A6B2F]">
            Verified Owner · {user.displayName || 'Ravindra Mane'} · {user.email}
          </p>
          <h1 className="mt-1 font-serif-display text-3xl font-semibold text-[#0D3B2E]">
            RM Mart Owner Admin Panel
          </h1>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {(
            [
              ['overview', 'Overview', BarChart3],
              ['products', `Products (${products.length})`, Package],
              ['orders', `Orders (${orders.length})`, ShoppingBag],
              ['customers', `Customers (${enrichedCustomers.length})`, Users],
              [
                'chats',
                `Support Chats${metrics.unreadChatCount > 0 ? ` (${metrics.unreadChatCount})` : ''}`,
                MessageSquare,
              ],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                tab === key
                  ? 'bg-[#0D3B2E] text-[#FAF7F2]'
                  : 'bg-[#F2ECE1] text-[#14211D] hover:bg-[#E7DEC9]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <div className="mt-8 space-y-8">
          {usingDemoCatalog && (
            <div className="p-5 bg-[#F2ECE1] border border-[#C5A059]/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-[#0D3B2E]">
                  Publish Your Live Catalog to Firestore
                </h2>
                <p className="mt-1 text-xs text-[#52605B]">
                  Your Firestore <span className="font-mono">/products</span> collection is empty,
                  so shoppers currently see editable sample items. Publish them in one click or add
                  your first custom product under Products.
                </p>
              </div>
              <button
                type="button"
                disabled={seedingDemo}
                onClick={handleSeedDemoToFirestore}
                className="px-4 py-2.5 bg-[#0D3B2E] text-[#FAF7F2] text-xs font-semibold rounded-lg hover:bg-[#092A20] whitespace-nowrap shrink-0"
              >
                {seedingDemo ? 'Publishing...' : 'Publish Starter Catalog to Firestore'}
              </button>
            </div>
          )}

          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white border border-[#E5DEC9] rounded-xl p-5">
              <p className="text-xs text-[#52605B]">Total Revenue</p>
              <p className="mt-2 text-2xl font-bold text-[#0D3B2E] tabular-nums">
                {formatINR(metrics.totalRevenue)}
              </p>
              <p className="mt-1 text-xs text-[#52605B] tabular-nums">
                {metrics.activeOrderCount} active · {metrics.deliveredOrdersCount} delivered
              </p>
            </div>

            <div className="bg-white border border-[#E5DEC9] rounded-xl p-5">
              <p className="text-xs text-[#52605B]">Total Orders</p>
              <p className="mt-2 text-2xl font-bold text-[#14211D] tabular-nums">
                {metrics.totalOrdersCount}
              </p>
              <p className="mt-1 text-xs text-[#8A6B2F] tabular-nums">
                {metrics.pendingOrdersCount} pending · {metrics.pendingUpiCount} UPI awaiting check
              </p>
            </div>

            <div className="bg-white border border-[#E5DEC9] rounded-xl p-5">
              <p className="text-xs text-[#52605B]">Customers</p>
              <p className="mt-2 text-2xl font-bold text-[#14211D] tabular-nums">
                {enrichedCustomers.length}
              </p>
              <p className="mt-1 text-xs text-[#52605B] tabular-nums">
                {metrics.humanEscalationsCount} open human support request(s)
              </p>
            </div>

            <div className="bg-white border border-[#E5DEC9] rounded-xl p-5">
              <p className="text-xs text-[#52605B]">Products &amp; Stock</p>
              <p className="mt-2 text-2xl font-bold text-[#14211D] tabular-nums">
                {products.length}
              </p>
              <p className="mt-1 text-xs text-[#8A6B2F] tabular-nums">
                {metrics.lowStockProducts.length} low stock · {metrics.outOfStockCount} out of stock
              </p>
            </div>
          </div>

          {/* Analytics + Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 bg-white border border-[#E5DEC9] rounded-xl p-6">
              <h2 className="font-serif-display text-xl font-semibold text-[#0D3B2E]">
                Sales by Department (INR)
              </h2>
              <div className="mt-5 space-y-4">
                {revenueByCategory.map((row) => (
                  <div key={row.category}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium text-[#14211D]">{row.category}</span>
                      <span className="font-mono tabular-nums text-[#52605B]">
                        {formatINR(row.revenue)} · {row.unitsSold} sold
                      </span>
                    </div>
                    <div className="h-2 bg-[#F2ECE1] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0D3B2E] rounded-full transition-all"
                        style={{ width: `${row.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6 bg-white border border-[#E5DEC9] rounded-xl p-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-serif-display text-xl font-semibold text-[#0D3B2E]">
                  Recent Store Activity
                </h2>
                <Clock className="w-4 h-4 text-[#8A6B2F]" aria-hidden="true" />
              </div>

              {recentActivity.length === 0 ? (
                <p className="mt-6 text-sm text-[#52605B]">
                  No recent orders or support chats recorded yet.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-[#F2ECE1]">
                  {recentActivity.map((ev) => (
                    <li key={ev.id} className="py-3 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#14211D] truncate">{ev.title}</p>
                        <p className="text-xs text-[#52605B] line-clamp-1 mt-0.5">{ev.subtitle}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <button
                          type="button"
                          onClick={() => setTab(ev.type === 'order' ? 'orders' : 'chats')}
                          className="text-xs font-semibold text-[#0D3B2E] hover:underline"
                        >
                          {ev.emphasis || 'View'}
                        </button>
                        <div className="text-[11px] text-[#52605B] tabular-nums">
                          {new Date(ev.timestamp).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Firebase Infrastructure & Security Details */}
          <div className="bg-white border border-[#E5DEC9] rounded-xl p-6">
            <h2 className="font-serif-display text-lg font-semibold text-[#0D3B2E]">
              Firebase Connection &amp; Owner Security Details
            </h2>
            <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-[#FAF7F2] rounded-lg border border-[#F2ECE1]">
                <dt className="text-[#52605B]">Project ID</dt>
                <dd className="mt-1 font-mono text-[#14211D] truncate">{projectInfo.projectId}</dd>
              </div>
              <div className="p-3 bg-[#FAF7F2] rounded-lg border border-[#F2ECE1]">
                <dt className="text-[#52605B]">Firestore Database</dt>
                <dd className="mt-1 font-mono text-[#14211D] truncate">{projectInfo.databaseId}</dd>
              </div>
              <div className="p-3 bg-[#FAF7F2] rounded-lg border border-[#F2ECE1]">
                <dt className="text-[#52605B]">Storage Bucket</dt>
                <dd className="mt-1 font-mono text-[#14211D] truncate">
                  {projectInfo.storageBucket}
                </dd>
              </div>
              <div className="p-3 bg-[#FAF7F2] rounded-lg border border-[#F2ECE1]">
                <dt className="text-[#52605B]">Your Owner UID</dt>
                <dd className="mt-1 font-mono text-[#0D3B2E] truncate">{user.uid}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* PRODUCTS & INVENTORY TAB */}
      {tab === 'products' && (
        <div className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-[#52605B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search catalog products..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#D8D0C1] rounded-lg text-sm"
                />
              </div>

              <select
                aria-label="Filter products by category"
                value={productCategoryFilter}
                onChange={(e) =>
                  setProductCategoryFilter(e.target.value as 'All' | ProductCategory)
                }
                className="px-3 py-2 bg-white border border-[#D8D0C1] rounded-lg text-xs font-medium"
              >
                <option value="All">All Categories</option>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsNewProduct(true);
                setEditingProduct({ ...EMPTY_PRODUCT_FORM });
                setProductFormError('');
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0D3B2E] text-[#FAF7F2] text-xs font-semibold rounded-lg hover:bg-[#092A20] whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          </div>

          {editingProduct && (
            <form
              onSubmit={handleSaveProduct}
              className="bg-white border border-[#0D3B2E]/30 rounded-xl p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-serif-display text-xl font-semibold text-[#0D3B2E]">
                  {isNewProduct ? 'Add New Product' : 'Edit Product'}
                </h2>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="text-xs font-medium text-[#52605B] hover:text-[#14211D]"
                >
                  Cancel
                </button>
              </div>

              {productFormError && (
                <p
                  role="alert"
                  className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3"
                >
                  {productFormError}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#14211D]">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProduct.name}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, name: e.target.value })
                    }
                    className="mt-1 w-full px-3 py-2 bg-[#FAF7F2] border border-[#D8D0C1] rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#14211D]">Category *</label>
                  <select
                    value={editingProduct.category}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        category: e.target.value as ProductCategory,
                      })
                    }
                    className="mt-1 w-full px-3 py-2 bg-[#FAF7F2] border border-[#D8D0C1] rounded-lg text-sm"
                  >
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#14211D]">
                    Selling Price (₹) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editingProduct.price}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, price: Number(e.target.value) })
                    }
                    className="mt-1 w-full px-3 py-2 bg-[#FAF7F2] border border-[#D8D0C1] rounded-lg text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#14211D]">
                    Original MRP (₹) *{' '}
                    <span className="font-normal text-[#8A6B2F]">
                      ({previewDiscount}% discount)
                    </span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editingProduct.originalPrice}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        originalPrice: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full px-3 py-2 bg-[#FAF7F2] border border-[#D8D0C1] rounded-lg text-sm tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#14211D]">
                    Stock Quantity *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editingProduct.stock}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, stock: Number(e.target.value) })
                    }
                    className="mt-1 w-full px-3 py-2 bg-[#FAF7F2] border border-[#D8D0C1] rounded-lg text-sm tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#14211D]">
                    Product Photo (Firebase Storage Upload or URL)
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#F2ECE1] border border-[#D8D0C1] rounded-lg text-xs font-semibold text-[#0D3B2E] cursor-pointer hover:bg-[#E7DEC9] whitespace-nowrap">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingImg ? 'Uploading...' : 'Upload Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileUpload}
                        className="sr-only"
                      />
                    </label>
                    <input
                      type="text"
                      value={editingProduct.images[0] || ''}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, images: [e.target.value] })
                      }
                      placeholder="/src/assets/images/... or https://..."
                      className="flex-1 px-3 py-2 bg-[#FAF7F2] border border-[#D8D0C1] rounded-lg text-xs"
                    />
                  </div>
                </div>

                {editingProduct.images[0] && (
                  <div className="md:col-span-2 flex items-center gap-4 p-3 bg-[#FAF7F2] rounded-lg border border-[#E5DEC9]">
                    <div className="w-20 h-16 rounded-md overflow-hidden bg-[#F2ECE1] shrink-0">
                      <img
                        src={editingProduct.images[0]}
                        alt="Product preview"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-xs text-[#52605B] truncate">
                      <p className="font-semibold text-[#14211D]">Primary Image Preview</p>
                      <p className="truncate mt-0.5 font-mono">{editingProduct.images[0]}</p>
                    </div>
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-[#14211D]">
                    Description *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={editingProduct.description}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, description: e.target.value })
                    }
                    className="mt-1 w-full px-3 py-2 bg-[#FAF7F2] border border-[#D8D0C1] rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-5 text-xs text-[#14211D]">
                {(
                  [
                    ['featured', 'Featured'],
                    ['bestSeller', 'Best Seller'],
                    ['newArrival', 'New Arrival'],
                    ['specialOffer', 'Special Offer'],
                  ] as const
                ).map(([flag, label]) => (
                  <label key={flag} className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingProduct[flag]}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, [flag]: e.target.checked })
                      }
                      className="accent-[#0D3B2E]"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-5 py-2.5 bg-[#0D3B2E] text-[#FAF7F2] text-xs font-semibold rounded-lg hover:bg-[#092A20] disabled:opacity-60"
                >
                  {savingProduct ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-[#E5DEC9] rounded-xl overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAF7F2] border-b border-[#E5DEC9] text-xs text-[#52605B]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Product</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Price (₹)</th>
                  <th className="py-3 px-4 font-semibold">Stock</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE1]">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-[#FAF7F2]/60">
                    <td className="py-3 px-4 font-medium text-[#14211D]">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-9 rounded bg-[#F2ECE1] overflow-hidden shrink-0">
                          {p.images[0] && (
                            <img
                              src={p.images[0]}
                              alt={p.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <span className="line-clamp-1">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#52605B]">{p.category}</td>
                    <td className="py-3 px-4 tabular-nums font-medium">
                      {formatINR(p.price)}{' '}
                      <span className="text-xs text-[#52605B] line-through">
                        {formatINR(p.originalPrice)}
                      </span>
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuickStockAdjust(p, -1)}
                          aria-label={`Decrease stock for ${p.name}`}
                          className="w-6 h-6 rounded border border-[#D8D0C1] flex items-center justify-center hover:bg-[#F2ECE1]"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span
                          className={`min-w-[28px] text-center font-semibold ${
                            p.stock <= 10 ? 'text-red-700' : 'text-[#14211D]'
                          }`}
                        >
                          {p.stock}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuickStockAdjust(p, 1)}
                          aria-label={`Increase stock for ${p.name}`}
                          className="w-6 h-6 rounded border border-[#D8D0C1] flex items-center justify-center hover:bg-[#F2ECE1]"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewProduct(false);
                          setEditingProduct({
                            id: p.id,
                            name: p.name,
                            description: p.description,
                            category: p.category,
                            price: p.price,
                            originalPrice: p.originalPrice,
                            stock: p.stock,
                            images: p.images.length > 0 ? p.images : [''],
                            featured: p.featured,
                            bestSeller: p.bestSeller,
                            newArrival: p.newArrival,
                            specialOffer: p.specialOffer,
                            isDemo: false,
                          });
                          setProductFormError('');
                        }}
                        aria-label={`Edit ${p.name}`}
                        className="p-2 text-[#0D3B2E] hover:bg-[#F2ECE1] rounded-lg"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(p.id, p.name)}
                        aria-label={`Delete ${p.name}`}
                        className="p-2 text-red-700 hover:bg-red-50 rounded-lg ml-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ORDERS TAB */}
      {tab === 'orders' && (
        <div className="mt-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#52605B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Search Order ID, name, mobile..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#D8D0C1] rounded-lg text-sm"
              />
            </div>

            <select
              aria-label="Filter orders by status"
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value as 'All' | OrderStatus)}
              className="px-3.5 py-2 bg-white border border-[#D8D0C1] rounded-lg text-xs font-medium"
            >
              <option value="All">All Statuses</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white border border-[#E5DEC9] rounded-xl overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAF7F2] border-b border-[#E5DEC9] text-xs text-[#52605B]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Order ID</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Payment</th>
                  <th className="py-3 px-4 font-semibold">Total</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE1]">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-[#52605B]">
                      No orders match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const isExpanded = expandedOrderId === order.id;
                    return (
                      <React.Fragment key={order.id}>
                        <tr className="hover:bg-[#FAF7F2]/60">
                          <td className="py-3.5 px-4 font-mono text-xs font-semibold text-[#0D3B2E]">
                            {order.orderNumber}
                            <div className="font-sans font-normal text-[#52605B] mt-0.5">
                              {new Date(order.createdAt).toLocaleDateString('en-IN')}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-[#14211D]">{order.customerName}</div>
                            <div className="text-xs text-[#52605B]">
                              {order.customerMobile} · {order.city} {order.pincode}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <div className="font-medium text-[#14211D]">{order.paymentMethod}</div>
                            <div className="text-[#52605B]">{order.paymentStatus}</div>
                          </td>
                          <td className="py-3.5 px-4 font-semibold tabular-nums">
                            {formatINR(order.finalTotal)}
                          </td>
                          <td className="py-3.5 px-4">
                            <select
                              aria-label={`Update status for ${order.orderNumber}`}
                              value={order.orderStatus}
                              onChange={(e) =>
                                handleOrderStatusChange(order, e.target.value as OrderStatus)
                              }
                              className="px-3 py-1.5 bg-[#FAF7F2] border border-[#D8D0C1] rounded-lg text-xs font-semibold text-[#0D3B2E]"
                            >
                              {ORDER_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedOrderId(isExpanded ? null : order.id)
                              }
                              aria-expanded={isExpanded}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D3B2E] hover:underline"
                            >
                              <span>{isExpanded ? 'Hide' : 'Inspect'}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-[#FAF7F2]">
                            <td colSpan={6} className="px-5 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                                <div>
                                  <p className="font-semibold text-[#0D3B2E]">Delivery &amp; Contact</p>
                                  <p className="mt-1 text-[#14211D]">
                                    {order.deliveryAddress}, {order.city} – {order.pincode}
                                  </p>
                                  <p className="mt-1 text-[#52605B]">
                                    Email: {order.customerEmail} · Mobile: {order.customerMobile}
                                  </p>
                                  {order.paymentMethod === 'UPI' && (
                                    <div className="mt-3 pt-3 border-t border-[#E5DEC9] flex flex-wrap items-center justify-between gap-2">
                                      <div>
                                        <span className="font-semibold text-[#14211D]">
                                          UPI Reference:{' '}
                                        </span>
                                        <span className="font-mono text-[#52605B]">
                                          {order.upiReference || 'Not provided'}
                                        </span>
                                      </div>
                                      {order.paymentStatus === 'Pending UPI Verification' && (
                                        <button
                                          type="button"
                                          onClick={() => handleVerifyUpiPayment(order)}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0D3B2E] text-[#FAF7F2] font-semibold rounded-md hover:bg-[#092A20]"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          <span>Mark UPI Verified</span>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <p className="font-semibold text-[#0D3B2E]">
                                    Ordered Items ({order.items.length})
                                  </p>
                                  <ul className="mt-1.5 space-y-1.5">
                                    {order.items.map((item) => (
                                      <li
                                        key={item.productId}
                                        className="flex justify-between gap-3 text-[#14211D]"
                                      >
                                        <span>
                                          {item.name} × {item.quantity}
                                        </span>
                                        <span className="font-semibold tabular-nums">
                                          {formatINR(item.lineTotal)}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CUSTOMERS & WISHLIST INSIGHTS TAB */}
      {tab === 'customers' && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white border border-[#E5DEC9] rounded-xl overflow-x-auto">
            <div className="p-5 border-b border-[#E5DEC9]">
              <h2 className="font-serif-display text-lg font-semibold text-[#0D3B2E]">
                Customer Directory &amp; Wishlist Interest
              </h2>
              <p className="mt-1 text-xs text-[#52605B]">
                Registered accounts and order customers with spend totals and saved wishlist items.
              </p>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAF7F2] border-b border-[#E5DEC9] text-xs text-[#52605B]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Orders &amp; Spend</th>
                  <th className="py-3 px-4 font-semibold">Saved Wishlist Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE1]">
                {enrichedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-sm text-[#52605B]">
                      No customer profiles or orders recorded yet.
                    </td>
                  </tr>
                ) : (
                  enrichedCustomers.map((c) => (
                    <tr key={c.uid + c.email}>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#14211D]">{c.displayName}</div>
                        <div className="text-xs text-[#52605B]">
                          {c.email}
                          {c.phone ? ` · ${c.phone}` : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 tabular-nums text-xs">
                        <div className="font-semibold text-[#0D3B2E]">
                          {formatINR(c.totalSpent)}
                        </div>
                        <div className="text-[#52605B]">{c.orderCount} order(s)</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#52605B]">
                        {c.wishlistProductNames.length > 0 ? (
                          <span className="text-[#14211D]">
                            {c.wishlistProductNames.slice(0, 3).join(' · ')}
                            {c.wishlistProductNames.length > 3
                              ? ` +${c.wishlistProductNames.length - 3} more`
                              : ''}
                          </span>
                        ) : (
                          <span>{c.wishlistCount || 0} saved</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-4 bg-white border border-[#E5DEC9] rounded-xl p-5">
            <h2 className="font-serif-display text-lg font-semibold text-[#0D3B2E]">
              Low Stock Watchlist
            </h2>
            <p className="mt-1 text-xs text-[#52605B]">Products with 10 or fewer units left.</p>
            <ul className="mt-4 divide-y divide-[#F2ECE1] text-sm">
              {metrics.lowStockProducts.length === 0 ? (
                <li className="py-4 text-xs text-[#52605B]">All items are well stocked.</li>
              ) : (
                metrics.lowStockProducts.map((p) => (
                  <li key={p.id} className="py-3 flex justify-between gap-3">
                    <span className="truncate text-[#14211D]">{p.name}</span>
                    <span className="font-semibold text-red-700 tabular-nums shrink-0">
                      {p.stock} left
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}

      {/* CUSTOMER CHAT HISTORY & OWNER REPLIES TAB */}
      {tab === 'chats' && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
          <div className="lg:col-span-4 bg-white border border-[#E5DEC9] rounded-xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[#E5DEC9] space-y-2.5">
              <input
                type="search"
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                placeholder="Search customer chats..."
                className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#D8D0C1] rounded-lg text-xs"
              />
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['all', 'All'],
                    ['human', 'Human Req'],
                    ['unread', 'Unread'],
                    ['open', 'Open'],
                    ['resolved', 'Resolved'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setChatFilter(key)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                      chatFilter === key
                        ? 'bg-[#0D3B2E] text-[#FAF7F2]'
                        : 'bg-[#F2ECE1] text-[#14211D] hover:bg-[#E7DEC9]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#F2ECE1]">
              {filteredChats.length === 0 ? (
                <p className="p-6 text-xs text-center text-[#52605B]">
                  No customer support conversations match this filter.
                </p>
              ) : (
                filteredChats.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedChatId(c.id)}
                    className={`w-full text-left p-4 transition-colors ${
                      selectedChatId === c.id ? 'bg-[#E8F0EC]' : 'hover:bg-[#FAF7F2]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#14211D] truncate">
                        {c.customerName}
                      </span>
                      {c.unreadByAdmin > 0 && (
                        <span className="text-[11px] font-bold text-[#8A6B2F] tabular-nums">
                          {c.unreadByAdmin} unread
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[#52605B] line-clamp-1">{c.lastMessage}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#52605B]">
                      <span>{new Date(c.updatedAt).toLocaleString('en-IN')}</span>
                      <span aria-hidden="true">·</span>
                      <span>{c.status}</span>
                      {c.needsHumanSupport && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#0D3B2E]">Human requested</span>
                        </>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-8 bg-white border border-[#E5DEC9] rounded-xl flex flex-col overflow-hidden">
            {!selectedChat ? (
              <div className="flex-1 flex items-center justify-center p-10 text-sm text-[#52605B]">
                Select a customer conversation to view full message history and send a reply.
              </div>
            ) : (
              <>
                <div className="px-5 py-4 border-b border-[#E5DEC9] bg-[#FAF7F2] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#0D3B2E]">
                      {selectedChat.customerName}
                      {selectedChat.customerEmail ? ` · ${selectedChat.customerEmail}` : ''}
                    </p>
                    <p className="text-xs text-[#52605B] font-mono">
                      ID: {selectedChat.id} · Replies appear live in customer chatbox
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleChatResolved(selectedChat)}
                    className="px-3.5 py-1.5 border border-[#0D3B2E]/25 text-[#0D3B2E] text-xs font-semibold rounded-lg hover:bg-[#E8F0EC] whitespace-nowrap"
                  >
                    {selectedChat.status === 'resolved' ? 'Reopen Thread' : 'Mark Resolved'}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3 max-h-[380px]">
                  {selectedChatMessages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${
                        m.senderRole === 'admin' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <span className="text-[10px] text-[#52605B] mb-1">
                        {m.senderName} · {new Date(m.createdAt).toLocaleTimeString('en-IN')}
                      </span>
                      <div
                        className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                          m.senderRole === 'admin'
                            ? 'bg-[#0D3B2E] text-[#FAF7F2]'
                            : m.senderRole === 'ai'
                              ? 'bg-[#FAF7F2] border border-[#E5DEC9] text-[#14211D]'
                              : 'bg-[#F2ECE1] text-[#14211D]'
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={handleSendAdminReply}
                  className="p-4 border-t border-[#E5DEC9] flex items-center gap-3"
                >
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Reply as Ravindra Mane (Owner)..."
                    className="flex-1 px-3.5 py-2.5 bg-[#FAF7F2] border border-[#D8D0C1] rounded-lg text-sm"
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !replyText.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#0D3B2E] text-[#FAF7F2] text-xs font-semibold rounded-lg hover:bg-[#092A20] disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Reply</span>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
