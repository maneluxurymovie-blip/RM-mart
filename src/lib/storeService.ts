import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from './firebase';
import { resolveBundledProductImage, resolveBundledProductImages } from './productImageResolver';
import { calculateDiscountPercent } from '../utils/commerce';
import type {
  ChatMessage,
  CustomerRecord,
  Order,
  OrderLineItem,
  OrderStatus,
  Product,
  SupportConversation,
} from '../types';

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

export function subscribeProducts(
  onProducts: (products: Product[], fromFirestore: boolean) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!db) {
    onProducts([], false);
    return () => {};
  }
  const productsRef = collection(db, 'products');
  return onSnapshot(
    productsRef,
    (snapshot) => {
      const items: Product[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          name: String(d.name || ''),
          description: String(d.description || ''),
          category: d.category,
          price: Number(d.price || 0),
          originalPrice: Number(d.originalPrice || d.price || 0),
          discountPercent: Number(d.discountPercent || 0),
          stock: Number(d.stock || 0),
          rating: typeof d.rating === 'number' && d.reviewCount > 0 ? d.rating : null,
          reviewCount: Number(d.reviewCount || 0),
          images: resolveBundledProductImages(
            Array.isArray(d.images) ? d.images.map(String) : []
          ),
          featured: Boolean(d.featured),
          bestSeller: Boolean(d.bestSeller),
          newArrival: Boolean(d.newArrival),
          specialOffer: Boolean(d.specialOffer),
          isDemo: Boolean(d.isDemo),
          createdAt: toIsoString(d.createdAt),
          updatedAt: toIsoString(d.updatedAt),
        };
      });
      items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      onProducts(items, true);
    },
    (error) => {
      console.warn('Products snapshot fallback:', error.message);
      if (onError) onError(error);
      onProducts([], false);
    }
  );
}

export async function saveProductToFirestore(
  product: Omit<Product, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  if (!db) throw new Error('Firestore is not configured.');
  const safeId = product.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
  const ref = doc(db, 'products', safeId);
  const price = Math.max(1, Math.round(product.price));
  const originalPrice = Math.max(price, Math.round(product.originalPrice));
  const discountPercent = calculateDiscountPercent(price, originalPrice);

  const payload = {
    name: product.name.trim().slice(0, 140),
    description: product.description.trim().slice(0, 2000),
    category: product.category,
    price,
    originalPrice,
    discountPercent,
    stock: Math.max(0, Math.floor(product.stock)),
    rating: typeof product.rating === 'number' ? product.rating : 0,
    reviewCount: Math.max(0, Math.floor(product.reviewCount || 0)),
    images: product.images.filter(Boolean).slice(0, 5),
    featured: Boolean(product.featured),
    bestSeller: Boolean(product.bestSeller),
    newArrival: Boolean(product.newArrival),
    specialOffer: Boolean(product.specialOffer),
    isDemo: Boolean(product.isDemo),
    updatedAt: serverTimestamp(),
  };

  try {
    if (isNew) {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      const existing = await getDoc(ref);
      if (existing.exists()) {
        await updateDoc(ref, payload);
      } else {
        await setDoc(ref, {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, `products/${safeId}`);
  }
}

export async function deleteProductFromFirestore(productId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not configured.');
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `products/${productId}`);
  }
}

export async function syncUserProfileAndWishlist(
  user: User,
  localWishlist: string[]
): Promise<string[]> {
  if (!db || !user.emailVerified) return localWishlist;
  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const merged = Array.from(new Set(localWishlist)).slice(0, 100);
      await setDoc(userRef, {
        uid: user.uid,
        displayName: (user.displayName || 'RM Mart Customer').slice(0, 100),
        email: (user.email || '').slice(0, 200),
        phone: '',
        address: '',
        wishlist: merged,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return merged;
    }
    const data = snap.data();
    const remoteWishlist: string[] = Array.isArray(data.wishlist) ? data.wishlist.map(String) : [];
    const merged = Array.from(new Set([...remoteWishlist, ...localWishlist])).slice(0, 100);
    if (merged.length !== remoteWishlist.length) {
      await updateDoc(userRef, {
        wishlist: merged,
        updatedAt: serverTimestamp(),
      });
    }
    return merged;
  } catch (error) {
    console.warn('Wishlist Firestore sync warning:', error);
    return localWishlist;
  }
}

export async function updateUserWishlistInFirestore(
  user: User,
  wishlist: string[]
): Promise<void> {
  if (!db || !user.emailVerified) return;
  const userRef = doc(db, 'users', user.uid);
  const bounded = Array.from(new Set(wishlist)).slice(0, 100);
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: (user.displayName || 'RM Mart Customer').slice(0, 100),
        email: (user.email || '').slice(0, 200),
        phone: '',
        address: '',
        wishlist: bounded,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        wishlist: bounded,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
  }
}

export async function persistOrderToFirestore(order: Order, user: User): Promise<boolean> {
  if (!db || !user.emailVerified) return false;
  const safeId = order.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
  const orderRef = doc(db, 'orders', safeId);
  try {
    await setDoc(orderRef, {
      orderNumber: order.orderNumber.slice(0, 40),
      idempotencyKey: order.idempotencyKey.slice(0, 128),
      userId: user.uid,
      customerName: order.customerName.slice(0, 120),
      customerMobile: order.customerMobile.slice(0, 15),
      customerEmail: order.customerEmail.slice(0, 200),
      deliveryAddress: order.deliveryAddress.slice(0, 500),
      city: order.city.slice(0, 80),
      pincode: order.pincode.slice(0, 6),
      items: order.items.slice(0, 50),
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      deliveryFee: order.deliveryFee,
      finalTotal: order.finalTotal,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      orderStatus: 'Pending',
      upiReference: (order.upiReference || '').slice(0, 100),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Save latest contact details to user profile
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await updateDoc(userRef, {
        displayName: order.customerName.slice(0, 100),
        phone: order.customerMobile.slice(0, 20),
        address: `${order.deliveryAddress}, ${order.city} - ${order.pincode}`.slice(0, 500),
        updatedAt: serverTimestamp(),
      });
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `orders/${safeId}`);
  }
}

export function subscribeOrders(
  user: User | null,
  isAdmin: boolean,
  onOrders: (orders: Order[]) => void
): Unsubscribe {
  if (!db || !user) {
    onOrders([]);
    return () => {};
  }
  const ordersRef = collection(db, 'orders');
  const q = isAdmin
    ? query(ordersRef)
    : query(ordersRef, where('userId', '==', user.uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Order[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          orderNumber: String(d.orderNumber || docSnap.id),
          idempotencyKey: String(d.idempotencyKey || ''),
          userId: String(d.userId || ''),
          customerName: String(d.customerName || ''),
          customerMobile: String(d.customerMobile || ''),
          customerEmail: String(d.customerEmail || ''),
          deliveryAddress: String(d.deliveryAddress || ''),
          city: String(d.city || ''),
          pincode: String(d.pincode || ''),
          items: Array.isArray(d.items)
            ? (d.items as OrderLineItem[]).map((item) => ({
                ...item,
                image: resolveBundledProductImage(String(item?.image || '')),
              }))
            : [],
          subtotal: Number(d.subtotal || 0),
          discountTotal: Number(d.discountTotal || 0),
          deliveryFee: Number(d.deliveryFee || 0),
          finalTotal: Number(d.finalTotal || 0),
          paymentMethod: d.paymentMethod === 'UPI' ? 'UPI' : 'COD',
          paymentStatus: d.paymentStatus || 'Pending on Delivery',
          orderStatus: d.orderStatus || 'Pending',
          upiReference: d.upiReference ? String(d.upiReference) : '',
          createdAt: toIsoString(d.createdAt),
          updatedAt: toIsoString(d.updatedAt),
          syncedToFirestore: true,
        };
      });
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onOrders(list);
    },
    (error) => {
      console.warn('Orders subscription warning:', error.message);
      onOrders([]);
    }
  );
}

export async function updateProductStockInFirestore(
  productId: string,
  nextStock: number
): Promise<void> {
  if (!db) throw new Error('Firestore is not configured.');
  try {
    await updateDoc(doc(db, 'products', productId), {
      stock: Math.max(0, Math.floor(nextStock)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `products/${productId}`);
  }
}

export async function updateOrderStatusInFirestore(
  orderId: string,
  orderStatus: OrderStatus
): Promise<void> {
  if (!db) throw new Error('Firestore is not configured.');
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      orderStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
  }
}

export async function updateOrderPaymentStatusInFirestore(
  orderId: string,
  paymentStatus: 'Pending on Delivery' | 'Pending UPI Verification' | 'Verified'
): Promise<void> {
  if (!db) throw new Error('Firestore is not configured.');
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      paymentStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
  }
}

export async function updateConversationStatusInFirestore(
  conversationId: string,
  status: 'open' | 'resolved'
): Promise<void> {
  if (!db) throw new Error('Firestore is not configured.');
  try {
    await updateDoc(doc(db, 'conversations', conversationId), {
      status,
      unreadByAdmin: 0,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `conversations/${conversationId}`);
  }
}

export function subscribeCustomersForAdmin(
  isAdmin: boolean,
  onCustomers: (customers: CustomerRecord[]) => void
): Unsubscribe {
  if (!db || !isAdmin) {
    onCustomers([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, 'users'),
    (snapshot) => {
      const list: CustomerRecord[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const wishlistIds = Array.isArray(d.wishlist) ? d.wishlist.map(String) : [];
        return {
          uid: docSnap.id,
          displayName: String(d.displayName || 'Customer'),
          email: String(d.email || ''),
          phone: d.phone ? String(d.phone) : '',
          address: d.address ? String(d.address) : '',
          wishlistCount: wishlistIds.length,
          wishlistIds,
        };
      });
      onCustomers(list);
    },
    (error) => {
      console.warn('Admin customers listener warning:', error.message);
      onCustomers([]);
    }
  );
}

export async function saveChatExchangeToFirestore(params: {
  conversationId: string;
  user: User;
  customerText: string;
  aiText: string;
  needsHumanSupport?: boolean;
}): Promise<void> {
  if (!db || !params.user.emailVerified) return;
  const convId = params.conversationId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const convRef = doc(db, 'conversations', convId);

  try {
    const snap = await getDoc(convRef);
    const prevUnread = snap.exists() ? Number(snap.data().unreadByAdmin || 0) : 0;

    if (!snap.exists()) {
      await setDoc(convRef, {
        customerUid: params.user.uid,
        customerName: (params.user.displayName || 'RM Mart Customer').slice(0, 120),
        customerEmail: (params.user.email || '').slice(0, 200),
        lastMessage: params.customerText.slice(0, 500),
        needsHumanSupport: Boolean(params.needsHumanSupport),
        unreadByAdmin: 1,
        unreadByCustomer: 0,
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(convRef, {
        lastMessage: params.aiText.slice(0, 500),
        needsHumanSupport: Boolean(params.needsHumanSupport || snap.data().needsHumanSupport),
        unreadByAdmin: prevUnread + 1,
        unreadByCustomer: 0,
        updatedAt: serverTimestamp(),
      });
    }

    const customerMsgId = `m_${Date.now()}_c`;
    await setDoc(doc(db, 'conversations', convId, 'messages', customerMsgId), {
      senderRole: 'customer',
      senderName: (params.user.displayName || 'Customer').slice(0, 120),
      text: params.customerText.slice(0, 3000),
      createdAt: serverTimestamp(),
    });

    const aiMsgId = `m_${Date.now() + 1}_ai`;
    await setDoc(doc(db, 'conversations', convId, 'messages', aiMsgId), {
      senderRole: 'ai',
      senderName: 'RM Mart Assistant',
      text: params.aiText.slice(0, 3000),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Conversation Firestore sync warning:', error);
  }
}

export function subscribeConversationMessages(
  conversationId: string | null,
  user: User | null,
  onMessages: (messages: ChatMessage[]) => void
): Unsubscribe {
  if (!db || !conversationId || !user) return () => {};
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const msgs: ChatMessage[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          senderRole: d.senderRole,
          senderName: String(d.senderName || ''),
          text: String(d.text || ''),
          createdAt: toIsoString(d.createdAt),
        };
      });
      onMessages(msgs);
    },
    (error) => {
      console.warn('Conversation messages warning:', error.message);
    }
  );
}

export function subscribeAllConversationsForAdmin(
  isAdmin: boolean,
  onConversations: (conversations: SupportConversation[]) => void
): Unsubscribe {
  if (!db || !isAdmin) {
    onConversations([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, 'conversations'),
    (snapshot) => {
      const list: SupportConversation[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          customerUid: String(d.customerUid || ''),
          customerName: String(d.customerName || 'Customer'),
          customerEmail: d.customerEmail ? String(d.customerEmail) : '',
          lastMessage: String(d.lastMessage || ''),
          needsHumanSupport: Boolean(d.needsHumanSupport),
          unreadByAdmin: Number(d.unreadByAdmin || 0),
          unreadByCustomer: Number(d.unreadByCustomer || 0),
          status: d.status === 'resolved' ? 'resolved' : 'open',
          createdAt: toIsoString(d.createdAt),
          updatedAt: toIsoString(d.updatedAt),
        };
      });
      list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      onConversations(list);
    },
    (error) => {
      console.warn('Admin conversations listener warning:', error.message);
      onConversations([]);
    }
  );
}

export async function sendAdminReplyToFirestore(
  conversationId: string,
  text: string
): Promise<void> {
  if (!db) throw new Error('Firestore is not configured.');
  const trimmed = text.trim().slice(0, 3000);
  if (!trimmed) return;
  try {
    const msgId = `m_${Date.now()}_admin`;
    await setDoc(doc(db, 'conversations', conversationId, 'messages', msgId), {
      senderRole: 'admin',
      senderName: 'Ravindra Mane (Owner)',
      text: trimmed,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'conversations', conversationId), {
      lastMessage: trimmed.slice(0, 500),
      unreadByAdmin: 0,
      unreadByCustomer: 1,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `conversations/${conversationId}/messages`);
  }
}
