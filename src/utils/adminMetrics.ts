import {
  PRODUCT_CATEGORIES,
  type CustomerRecord,
  type Order,
  type Product,
  type SupportConversation,
} from '../types';

export interface CategoryRevenueRow {
  category: string;
  revenue: number;
  unitsSold: number;
  percent: number;
}

export interface ActivityEvent {
  id: string;
  type: 'order' | 'chat';
  title: string;
  subtitle: string;
  timestamp: string;
  emphasis?: string;
}

export interface EnrichedCustomer extends CustomerRecord {
  orderCount: number;
  totalSpent: number;
  wishlistProductNames: string[];
}

export function computeAdminMetrics(
  products: Product[],
  orders: Order[],
  conversations: SupportConversation[]
) {
  const activeOrders = orders.filter((o) => o.orderStatus !== 'Cancelled');
  const totalRevenue = activeOrders.reduce((sum, o) => sum + o.finalTotal, 0);
  const pendingOrdersCount = orders.filter((o) => o.orderStatus === 'Pending').length;
  const deliveredOrdersCount = orders.filter((o) => o.orderStatus === 'Delivered').length;
  const pendingUpiCount = orders.filter(
    (o) => o.paymentMethod === 'UPI' && o.paymentStatus === 'Pending UPI Verification' && o.orderStatus !== 'Cancelled'
  ).length;
  const lowStockProducts = products.filter((p) => p.stock <= 10);
  const outOfStockCount = products.filter((p) => p.stock <= 0).length;
  const unreadChatCount = conversations.reduce((sum, c) => sum + (c.unreadByAdmin || 0), 0);
  const humanEscalationsCount = conversations.filter(
    (c) => c.needsHumanSupport && c.status !== 'resolved'
  ).length;

  return {
    totalRevenue,
    activeOrderCount: activeOrders.length,
    totalOrdersCount: orders.length,
    pendingOrdersCount,
    deliveredOrdersCount,
    pendingUpiCount,
    lowStockProducts,
    outOfStockCount,
    unreadChatCount,
    humanEscalationsCount,
  };
}

export function computeRevenueByCategory(
  products: Product[],
  orders: Order[]
): CategoryRevenueRow[] {
  const prodCategory = new Map(products.map((p) => [p.id, p.category]));
  const revenueMap = new Map<string, number>();
  const unitsMap = new Map<string, number>();

  for (const cat of PRODUCT_CATEGORIES) {
    revenueMap.set(cat, 0);
    unitsMap.set(cat, 0);
  }

  for (const order of orders) {
    if (order.orderStatus === 'Cancelled') continue;
    for (const item of order.items) {
      const cat = prodCategory.get(item.productId) || 'Daily Essentials';
      revenueMap.set(cat, (revenueMap.get(cat) || 0) + item.lineTotal);
      unitsMap.set(cat, (unitsMap.get(cat) || 0) + item.quantity);
    }
  }

  const maxRev = Math.max(1, ...Array.from(revenueMap.values()));
  return PRODUCT_CATEGORIES.map((cat) => {
    const revenue = revenueMap.get(cat) || 0;
    return {
      category: cat,
      revenue,
      unitsSold: unitsMap.get(cat) || 0,
      percent: revenue > 0 ? Math.max(6, Math.round((revenue / maxRev) * 100)) : 0,
    };
  });
}

export function buildEnrichedCustomers(
  customers: CustomerRecord[],
  orders: Order[],
  products: Product[]
): EnrichedCustomer[] {
  const productNameMap = new Map(products.map((p) => [p.id, p.name]));

  // Include both Firestore-registered customers and order-derived customer emails
  const map = new Map<string, EnrichedCustomer>();
  for (const c of customers) {
    const key = (c.email || c.uid).toLowerCase();
    const wishlistIds = c.wishlistIds || [];
    map.set(key, {
      ...c,
      orderCount: 0,
      totalSpent: 0,
      wishlistCount: wishlistIds.length || c.wishlistCount || 0,
      wishlistProductNames: wishlistIds
        .map((id) => productNameMap.get(id))
        .filter((name): name is string => Boolean(name)),
    });
  }

  for (const order of orders) {
    const key = (order.customerEmail || order.userId).toLowerCase();
    const existing = map.get(key);
    const spendDelta = order.orderStatus === 'Cancelled' ? 0 : order.finalTotal;

    if (existing) {
      existing.orderCount += 1;
      existing.totalSpent += spendDelta;
      if (!existing.phone && order.customerMobile) existing.phone = order.customerMobile;
      if (!existing.address && order.deliveryAddress) {
        existing.address = `${order.deliveryAddress}, ${order.city} - ${order.pincode}`;
      }
    } else {
      map.set(key, {
        uid: order.userId,
        displayName: order.customerName,
        email: order.customerEmail,
        phone: order.customerMobile,
        address: `${order.deliveryAddress}, ${order.city} - ${order.pincode}`,
        wishlistCount: 0,
        wishlistIds: [],
        wishlistProductNames: [],
        orderCount: 1,
        totalSpent: spendDelta,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
}

export function buildRecentActivity(
  orders: Order[],
  conversations: SupportConversation[],
  limit = 8
): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const order of orders.slice(0, 10)) {
    events.push({
      id: `act_ord_${order.id}`,
      type: 'order',
      title: `Order ${order.orderNumber} · ${order.customerName}`,
      subtitle: `${order.items.length} item(s) · ${order.paymentMethod} (${order.paymentStatus})`,
      timestamp: order.updatedAt || order.createdAt,
      emphasis: order.orderStatus,
    });
  }

  for (const chat of conversations.slice(0, 10)) {
    events.push({
      id: `act_chat_${chat.id}`,
      type: 'chat',
      title: `Support chat · ${chat.customerName}`,
      subtitle: chat.lastMessage,
      timestamp: chat.updatedAt,
      emphasis: chat.needsHumanSupport ? 'Human Requested' : chat.status,
    });
  }

  return events
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}
