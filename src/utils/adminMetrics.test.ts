import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEnrichedCustomers,
  buildRecentActivity,
  computeAdminMetrics,
  computeRevenueByCategory,
} from './adminMetrics';
import { DEMO_PRODUCTS } from '../data/demoProducts';
import type { Order, SupportConversation } from '../types';

const sampleOrders: Order[] = [
  {
    id: 'ord-1',
    orderNumber: 'RMM-20261118-AAA1',
    idempotencyKey: 'idem_1',
    userId: 'user-1',
    customerName: 'Aarav Kulkarni',
    customerMobile: '9876543210',
    customerEmail: 'aarav@example.in',
    deliveryAddress: 'Baner Road',
    city: 'Pune',
    pincode: '411045',
    items: [
      {
        productId: 'rm-aura-anc-headphones',
        name: 'Aura Studio Emerald ANC Wireless Headphones',
        image: '',
        price: 5499,
        originalPrice: 7499,
        quantity: 1,
        lineTotal: 5499,
      },
    ],
    subtotal: 5499,
    discountTotal: 2000,
    deliveryFee: 0,
    finalTotal: 5499,
    paymentMethod: 'UPI',
    paymentStatus: 'Pending UPI Verification',
    orderStatus: 'Pending',
    createdAt: '2026-11-18T10:00:00.000Z',
    updatedAt: '2026-11-18T10:00:00.000Z',
  },
  {
    id: 'ord-2',
    orderNumber: 'RMM-20261118-BBB2',
    idempotencyKey: 'idem_2',
    userId: 'user-2',
    customerName: 'Cancelled Buyer',
    customerMobile: '9822001122',
    customerEmail: 'cancel@example.in',
    deliveryAddress: 'FC Road',
    city: 'Pune',
    pincode: '411004',
    items: [
      {
        productId: 'rm-saffron-elixir',
        name: 'Zafaran Kashmiri Saffron Facial Elixir (30ml)',
        image: '',
        price: 1499,
        originalPrice: 1999,
        quantity: 1,
        lineTotal: 1499,
      },
    ],
    subtotal: 1499,
    discountTotal: 500,
    deliveryFee: 0,
    finalTotal: 1499,
    paymentMethod: 'COD',
    paymentStatus: 'Pending on Delivery',
    orderStatus: 'Cancelled',
    createdAt: '2026-11-18T11:00:00.000Z',
    updatedAt: '2026-11-18T11:00:00.000Z',
  },
];

const sampleChats: SupportConversation[] = [
  {
    id: 'conv-1',
    customerUid: 'user-1',
    customerName: 'Aarav Kulkarni',
    lastMessage: 'Please confirm my UPI payment.',
    needsHumanSupport: true,
    unreadByAdmin: 2,
    unreadByCustomer: 0,
    status: 'open',
    createdAt: '2026-11-18T12:00:00.000Z',
    updatedAt: '2026-11-18T12:05:00.000Z',
  },
];

test('computeAdminMetrics excludes cancelled orders from revenue and tracks pending UPI & escalations', () => {
  const m = computeAdminMetrics(DEMO_PRODUCTS, sampleOrders, sampleChats);
  assert.equal(m.totalRevenue, 5499);
  assert.equal(m.activeOrderCount, 1);
  assert.equal(m.pendingOrdersCount, 1);
  assert.equal(m.pendingUpiCount, 1);
  assert.equal(m.unreadChatCount, 2);
  assert.equal(m.humanEscalationsCount, 1);
});

test('computeRevenueByCategory maps active line items into product categories', () => {
  const rows = computeRevenueByCategory(DEMO_PRODUCTS, sampleOrders);
  const electronics = rows.find((r) => r.category === 'Electronics & Gadgets');
  const beauty = rows.find((r) => r.category === 'Fashion & Beauty');
  assert.equal(electronics?.revenue, 5499);
  assert.equal(electronics?.unitsSold, 1);
  assert.equal(beauty?.revenue, 0);
});

test('buildEnrichedCustomers resolves wishlist product names and aggregates order spend', () => {
  const enriched = buildEnrichedCustomers(
    [
      {
        uid: 'user-1',
        displayName: 'Aarav Kulkarni',
        email: 'aarav@example.in',
        wishlistIds: ['rm-saffron-elixir'],
      },
    ],
    sampleOrders,
    DEMO_PRODUCTS
  );
  const aarav = enriched.find((c) => c.email === 'aarav@example.in');
  assert.ok(aarav);
  assert.equal(aarav.orderCount, 1);
  assert.equal(aarav.totalSpent, 5499);
  assert.deepEqual(aarav.wishlistProductNames, [
    'Zafaran Kashmiri Saffron Facial Elixir (30ml)',
  ]);
});

test('buildRecentActivity sorts combined order and chat events newest first', () => {
  const feed = buildRecentActivity(sampleOrders, sampleChats, 5);
  assert.equal(feed[0].type, 'chat');
  assert.equal(feed[1].type, 'order');
});
