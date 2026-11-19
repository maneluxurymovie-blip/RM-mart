import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { DEMO_PRODUCTS } from './src/data/demoProducts';
import {
  calculateCartTotals,
  FREE_DELIVERY_THRESHOLD_INR,
  generateOrderNumber,
  STANDARD_DELIVERY_FEE_INR,
} from './src/utils/commerce';
import { hasValidationErrors, validateCheckoutForm } from './src/utils/validation';
import type {
  CartItem,
  ChatMessage,
  CustomerDetails,
  Order,
  OrderStatus,
  PaymentMethod,
  Product,
  SupportConversation,
} from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'ravindramane@990email.com').toLowerCase();
const AUTHORIZED_OWNER_EMAILS = new Set([
  OWNER_EMAIL,
  'ravindramane@990email.com',
  'maneluxurymovie@gmail.com',
]);

function isAuthorizedOwnerEmail(email?: string): boolean {
  if (!email) return false;
  return AUTHORIZED_OWNER_EMAILS.has(email.trim().toLowerCase());
}

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Authoritative server-side catalog mirror (synced with Firestore by owner / storefront)
const catalogStore = new Map<string, Product>(
  DEMO_PRODUCTS.map((product) => [product.id, { ...product }])
);

// Server-side order registry for idempotency, stock verification, and verified status lookup
const orderByIdempotencyKey = new Map<string, Order>();
const ordersStore = new Map<string, Order>();

// Server-side conversation mirror so both guest and signed-in chats persist for owner replies
const conversationsStore = new Map<string, SupportConversation>();

function buildStoreContext(products: Product[]): string {
  return products
    .slice(0, 40)
    .map(
      (p) =>
        `- ${p.name} | Category: ${p.category} | Price: ₹${p.price} (MRP ₹${p.originalPrice}, ${p.discountPercent}% off) | Stock: ${
          p.stock > 0 ? `${p.stock} available` : 'Out of stock'
        }${p.isDemo ? ' [Demo item]' : ''}`
    )
    .join('\n');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'RM Mart',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      upiMerchantVpa: process.env.VITE_UPI_MERCHANT_VPA || 'rmmart@upi',
      upiMerchantName: process.env.VITE_UPI_MERCHANT_NAME || 'RM Mart',
      upiProviderVerified: process.env.VITE_UPI_PROVIDER_VERIFIED === 'true',
    });
  });

  // Sync live Firestore catalog into server validator & AI assistant context
  app.post('/api/catalog/sync', (req, res) => {
    const incoming = req.body?.products;
    if (!Array.isArray(incoming)) {
      return res.status(400).json({ error: 'products array is required.' });
    }
    for (const item of incoming) {
      if (item && typeof item.id === 'string' && typeof item.price === 'number') {
        catalogStore.set(item.id, item as Product);
      }
    }
    res.json({ synced: catalogStore.size });
  });

  app.get('/api/catalog', (_req, res) => {
    res.json({ products: Array.from(catalogStore.values()) });
  });

  // Server-side authoritative order validation, stock check, and duplicate submission prevention
  app.post('/api/orders/validate', (req, res) => {
    const {
      idempotencyKey,
      userId,
      customerDetails,
      items,
      paymentMethod,
      upiReference,
      catalogSnapshot,
    } = req.body as {
      idempotencyKey?: string;
      userId?: string;
      customerDetails?: CustomerDetails;
      items?: CartItem[];
      paymentMethod?: PaymentMethod;
      upiReference?: string;
      catalogSnapshot?: Product[];
    };

    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.length < 8) {
      return res.status(400).json({ error: 'Valid idempotencyKey is required to prevent duplicate orders.' });
    }

    // Duplicate order prevention
    const existingOrder = orderByIdempotencyKey.get(idempotencyKey);
    if (existingOrder) {
      return res.status(200).json({
        duplicatePrevented: true,
        order: existingOrder,
      });
    }

    if (!customerDetails) {
      return res.status(400).json({ error: 'Customer delivery details are required.' });
    }

    const method: PaymentMethod = paymentMethod === 'UPI' ? 'UPI' : 'COD';
    const validationErrors = validateCheckoutForm(customerDetails, method, upiReference || '');
    if (hasValidationErrors(validationErrors)) {
      return res.status(400).json({
        error: 'Please correct the highlighted checkout fields.',
        fieldErrors: validationErrors,
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty.' });
    }

    // Merge any Firestore-only custom products not yet mirrored to server
    if (Array.isArray(catalogSnapshot)) {
      for (const p of catalogSnapshot) {
        if (p && typeof p.id === 'string' && !catalogStore.has(p.id)) {
          catalogStore.set(p.id, p);
        }
      }
    }

    const authoritativeProducts = Array.from(catalogStore.values());
    const productMap = new Map(authoritativeProducts.map((p) => [p.id, p]));

    // Deduplicate cart items and check authoritative stock & prices
    const mergedCart = new Map<string, number>();
    for (const entry of items) {
      if (!entry || typeof entry.productId !== 'string' || typeof entry.quantity !== 'number') {
        continue;
      }
      const qty = Math.floor(entry.quantity);
      if (qty <= 0) continue;
      mergedCart.set(entry.productId, (mergedCart.get(entry.productId) || 0) + qty);
    }

    if (mergedCart.size === 0) {
      return res.status(400).json({ error: 'No valid products found in your cart.' });
    }

    const normalizedItems: CartItem[] = [];
    for (const [productId, qty] of mergedCart.entries()) {
      const product = productMap.get(productId);
      if (!product) {
        return res.status(400).json({
          error: `Product "${productId}" is no longer available in the catalog.`,
        });
      }
      if (product.stock < qty) {
        return res.status(409).json({
          error: `Only ${product.stock} unit(s) of "${product.name}" remain in stock.`,
        });
      }
      normalizedItems.push({ productId, quantity: qty });
    }

    const totals = calculateCartTotals(normalizedItems, authoritativeProducts);
    if (totals.lineItems.length === 0 || totals.finalTotal <= 0) {
      return res.status(400).json({ error: 'Order total could not be verified.' });
    }

    // Decrement authoritative stock
    for (const line of totals.lineItems) {
      const product = catalogStore.get(line.productId);
      if (product) {
        product.stock = Math.max(0, product.stock - line.quantity);
      }
    }

    const nowIso = new Date().toISOString();
    const orderNumber = generateOrderNumber();
    const orderId = orderNumber.toLowerCase();

    // Never claim UPI payment succeeded unless a verified payment provider confirms it
    const paymentStatus =
      method === 'COD' ? 'Pending on Delivery' : 'Pending UPI Verification';

    const order: Order = {
      id: orderId,
      orderNumber,
      idempotencyKey,
      userId: userId && typeof userId === 'string' ? userId : `guest-${Date.now()}`,
      customerName: customerDetails.customerName.trim(),
      customerMobile: customerDetails.customerMobile.trim(),
      customerEmail: customerDetails.customerEmail.trim().toLowerCase(),
      deliveryAddress: customerDetails.deliveryAddress.trim(),
      city: customerDetails.city.trim(),
      pincode: customerDetails.pincode.trim(),
      items: totals.lineItems,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      deliveryFee: totals.deliveryFee,
      finalTotal: totals.finalTotal,
      paymentMethod: method,
      paymentStatus,
      orderStatus: 'Pending',
      upiReference: method === 'UPI' ? (upiReference || '').trim() : '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    orderByIdempotencyKey.set(idempotencyKey, order);
    ordersStore.set(order.id, order);

    return res.status(201).json({
      duplicatePrevented: false,
      order,
    });
  });

  // Verified order lookup for Order Tracking & AI Support
  app.get('/api/orders/lookup', (req, res) => {
    const orderNumber = String(req.query.orderNumber || '').trim().toUpperCase();
    const contact = String(req.query.contact || '').trim().toLowerCase();
    if (!orderNumber || !contact) {
      return res.status(400).json({
        error: 'Both orderNumber and registered mobile or email are required for verification.',
      });
    }
    const found = Array.from(ordersStore.values()).find((o) => {
      if (o.orderNumber.toUpperCase() !== orderNumber) return false;
      const mobileDigits = o.customerMobile.replace(/\D/g, '');
      const contactDigits = contact.replace(/\D/g, '');
      const emailMatch = o.customerEmail.toLowerCase() === contact;
      const mobileMatch =
        contactDigits.length >= 10 &&
        mobileDigits.endsWith(contactDigits.slice(-10));
      return emailMatch || mobileMatch;
    });

    if (!found) {
      return res.status(404).json({
        error: 'No matching order found for that Order ID and mobile/email combination.',
      });
    }
    return res.json({ order: found });
  });

  // Update order status mirror (admin status sync)
  app.patch('/api/orders/:id/status', (req, res) => {
    const { orderStatus, ownerEmail } = req.body as {
      orderStatus?: OrderStatus;
      ownerEmail?: string;
    };
    if (!isAuthorizedOwnerEmail(ownerEmail)) {
      return res.status(403).json({ error: 'Owner authorization required.' });
    }
    const order = ordersStore.get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found on server mirror.' });
    }
    if (orderStatus) {
      order.orderStatus = orderStatus;
      order.updatedAt = new Date().toISOString();
    }
    return res.json({ order });
  });

  // Update UPI payment verification status mirror (owner-only)
  app.patch('/api/orders/:id/payment', (req, res) => {
    const { paymentStatus, ownerEmail } = req.body as {
      paymentStatus?: Order['paymentStatus'];
      ownerEmail?: string;
    };
    if (!isAuthorizedOwnerEmail(ownerEmail)) {
      return res.status(403).json({ error: 'Owner authorization required.' });
    }
    const order = ordersStore.get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found on server mirror.' });
    }
    if (paymentStatus) {
      order.paymentStatus = paymentStatus;
      order.updatedAt = new Date().toISOString();
    }
    return res.json({ order });
  });

  // --- Customer Support Chat & Gemini Multilingual Assistant ---
  app.post('/api/chat', async (req, res) => {
    try {
      const {
        conversationId,
        customerUid,
        customerName,
        customerEmail,
        message,
        products,
        verifyOrderNumber,
        verifyContact,
      } = req.body as {
        conversationId?: string;
        customerUid?: string;
        customerName?: string;
        customerEmail?: string;
        message?: string;
        products?: Product[];
        verifyOrderNumber?: string;
        verifyContact?: string;
      };

      const trimmedMessage = (message || '').trim();
      if (!trimmedMessage || trimmedMessage.length > 2000) {
        return res.status(400).json({ error: 'Please enter a message between 1 and 2000 characters.' });
      }

      const convId =
        conversationId && /^[a-zA-Z0-9_-]{4,128}$/.test(conversationId)
          ? conversationId
          : `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const nowIso = new Date().toISOString();
      let conv = conversationsStore.get(convId);
      if (!conv) {
        conv = {
          id: convId,
          customerUid: customerUid || `guest_${convId}`,
          customerName: (customerName || 'Guest Shopper').slice(0, 120),
          customerEmail: customerEmail || '',
          lastMessage: trimmedMessage.slice(0, 500),
          needsHumanSupport: false,
          unreadByAdmin: 1,
          unreadByCustomer: 0,
          status: 'open',
          createdAt: nowIso,
          updatedAt: nowIso,
          messages: [],
        };
        conversationsStore.set(convId, conv);
      }

      const customerMsg: ChatMessage = {
        id: `msg_${Date.now()}_c`,
        senderRole: 'customer',
        senderName: conv.customerName,
        text: trimmedMessage,
        createdAt: nowIso,
      };
      conv.messages = [...(conv.messages || []), customerMsg];
      conv.lastMessage = trimmedMessage.slice(0, 500);
      conv.unreadByAdmin = (conv.unreadByAdmin || 0) + 1;
      conv.updatedAt = nowIso;

      // Ground catalog using live Firestore snapshot or authoritative server catalog
      const catalogList =
        Array.isArray(products) && products.length > 0
          ? products
          : Array.from(catalogStore.values());

      // Optional verified order status lookup
      let verifiedOrderSummary = 'No order verified yet in this session.';
      if (verifyOrderNumber && verifyContact) {
        const ordNum = verifyOrderNumber.trim().toUpperCase();
        const contactLower = verifyContact.trim().toLowerCase();
        const contactDigits = contactLower.replace(/\D/g, '');
        const matched = Array.from(ordersStore.values()).find((o) => {
          if (o.orderNumber.toUpperCase() !== ordNum) return false;
          const mobileDigits = o.customerMobile.replace(/\D/g, '');
          return (
            o.customerEmail.toLowerCase() === contactLower ||
            (contactDigits.length >= 10 && mobileDigits.endsWith(contactDigits.slice(-10)))
          );
        });
        if (matched) {
          verifiedOrderSummary = `VERIFIED ORDER ${matched.orderNumber}: Status = ${matched.orderStatus}, Payment = ${matched.paymentMethod} (${matched.paymentStatus}), Total = ₹${matched.finalTotal}, Items = ${matched.items
            .map((i) => `${i.name} x${i.quantity}`)
            .join(', ')}.`;
        } else {
          verifiedOrderSummary = `Order verification attempted for ${ordNum} but no matching record was found with that email/mobile.`;
        }
      }

      if (!ai) {
        return res.status(503).json({
          error:
            'AI support is temporarily unavailable because GEMINI_API_KEY is not configured on the server. Click "Request Human Support" to reach Ravindra Mane directly.',
          conversationId: convId,
        });
      }

      const systemInstruction = `You are the official AI Customer Support Assistant for RM Mart ("Everything You Need, Delivered with Ease"), an Indian e-commerce storefront owned by Ravindra Mane.

STRICT RULES:
1. Language: Automatically reply in the exact language the customer uses — English, Hindi (हिन्दी), or Marathi (मराठी). If the user writes in Hinglish or Marathi in Latin script, reply warmly in natural Hindi/Marathi or English as appropriate.
2. Honesty & Grounding: ONLY reference products, INR (₹) prices, discounts, and stock counts from the LIVE CATALOG below. NEVER invent products, discounts, stock availability, or order statuses.
3. Order Privacy: Only share specific order status if it appears under VERIFIED ORDER STATUS below. If a customer asks about their order without verifying, politely ask them to enter their Order ID and registered mobile/email using the Verify Order button in chat or visit the Orders page.
4. Store Policies (Verified):
   - Currency: Indian Rupees (₹ / INR).
   - Delivery: Free delivery on orders ₹${FREE_DELIVERY_THRESHOLD_INR} and above; standard delivery fee ₹${STANDARD_DELIVERY_FEE_INR} for orders under ₹${FREE_DELIVERY_THRESHOLD_INR}. Pan-India shipping in 3–6 business days.
   - Payments: Cash on Delivery (COD) available across serviceable PIN codes. UPI orders are recorded as "Pending UPI Verification" until confirmed by the merchant — never claim an unverified UPI payment succeeded.
   - Returns: 7-day easy replacement/return for unused items in original packaging (excluding opened perishable food items).
   - Human Support: Customers can click "Request Human Support" in this chatbox anytime to notify RM Mart owner Ravindra Mane.
5. Tone: Friendly, refined, concise (2–4 short sentences or a clean short list).

LIVE CATALOG:
${buildStoreContext(catalogList)}

VERIFIED ORDER STATUS:
${verifiedOrderSummary}`;

      const recentHistory = (conv.messages || []).slice(-10).map((m) => ({
        role: m.senderRole === 'customer' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));

      const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
      let response = null;
      let lastError: unknown = null;

      for (const modelName of modelsToTry) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            response = await ai.models.generateContent({
              model: modelName,
              contents: recentHistory,
              config: {
                systemInstruction,
              },
            });
            break;
          } catch (err) {
            lastError = err;
            const errStr = err instanceof Error ? err.message : String(err);
            const isTransient = errStr.includes('503') || errStr.includes('UNAVAILABLE') || errStr.includes('high demand');
            if (!isTransient) throw err;
            if (attempt === 0) {
              await new Promise((resolve) => setTimeout(resolve, 600));
            }
          }
        }
        if (response) break;
      }

      if (!response) {
        throw lastError || new Error('Gemini support service is temporarily busy. Please retry shortly.');
      }

      const replyText =
        response.text?.trim() ||
        'Thank you for contacting RM Mart. How may I assist you with our products, delivery, or your order today?';

      const aiMsg: ChatMessage = {
        id: `msg_${Date.now()}_a`,
        senderRole: 'ai',
        senderName: 'RM Mart Assistant',
        text: replyText,
        createdAt: new Date().toISOString(),
      };
      conv.messages = [...(conv.messages || []), aiMsg];
      conv.lastMessage = replyText.slice(0, 500);
      conv.updatedAt = aiMsg.createdAt;

      return res.json({
        conversationId: convId,
        reply: replyText,
        messages: conv.messages,
      });
    } catch (error) {
      console.error('Gemini chat error:', error);
      let friendlyMessage = 'RM Mart AI Assistant is momentarily busy. Please try again in a moment or click Human Support.';
      if (error instanceof Error) {
        try {
          const parsed = JSON.parse(error.message);
          if (parsed?.error?.message) {
            friendlyMessage = `${parsed.error.message} You can also click Human Support to message Ravindra Mane directly.`;
          }
        } catch {
          if (!error.message.startsWith('{')) {
            friendlyMessage = error.message;
          }
        }
      }
      return res.status(503).json({ error: friendlyMessage });
    }
  });

  app.post('/api/conversations/:id/human', (req, res) => {
    const conv = conversationsStore.get(req.params.id);
    if (!conv) {
      const nowIso = new Date().toISOString();
      const newConv: SupportConversation = {
        id: req.params.id,
        customerUid: String(req.body?.customerUid || `guest_${req.params.id}`),
        customerName: String(req.body?.customerName || 'Guest Shopper'),
        customerEmail: String(req.body?.customerEmail || ''),
        lastMessage: 'Customer requested human support from Ravindra Mane.',
        needsHumanSupport: true,
        unreadByAdmin: 1,
        unreadByCustomer: 0,
        status: 'open',
        createdAt: nowIso,
        updatedAt: nowIso,
        messages: [
          {
            id: `msg_${Date.now()}_h`,
            senderRole: 'customer',
            senderName: String(req.body?.customerName || 'Guest Shopper'),
            text: 'Requested human support from RM Mart team.',
            createdAt: nowIso,
          },
        ],
      };
      conversationsStore.set(newConv.id, newConv);
      return res.json({ conversation: newConv });
    }
    conv.needsHumanSupport = true;
    conv.unreadByAdmin = (conv.unreadByAdmin || 0) + 1;
    conv.updatedAt = new Date().toISOString();
    return res.json({ conversation: conv });
  });

  app.get('/api/conversations/:id', (req, res) => {
    const conv = conversationsStore.get(req.params.id);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }
    return res.json({ conversation: conv });
  });

  app.get('/api/admin/conversations', (req, res) => {
    const ownerEmail = String(req.headers['x-owner-email'] || '');
    if (!isAuthorizedOwnerEmail(ownerEmail)) {
      return res.status(403).json({ error: 'Owner authorization required.' });
    }
    const list = Array.from(conversationsStore.values()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
    return res.json({ conversations: list });
  });

  app.post('/api/admin/conversations/:id/reply', (req, res) => {
    const ownerEmail = String(req.headers['x-owner-email'] || '');
    if (!isAuthorizedOwnerEmail(ownerEmail)) {
      return res.status(403).json({ error: 'Owner authorization required.' });
    }
    const conv = conversationsStore.get(req.params.id);
    const text = String(req.body?.text || '').trim();
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }
    if (!text || text.length > 3000) {
      return res.status(400).json({ error: 'Reply text is required.' });
    }
    const nowIso = new Date().toISOString();
    const adminMsg: ChatMessage = {
      id: `msg_${Date.now()}_admin`,
      senderRole: 'admin',
      senderName: 'Ravindra Mane (Owner)',
      text,
      createdAt: nowIso,
    };
    conv.messages = [...(conv.messages || []), adminMsg];
    conv.lastMessage = text.slice(0, 500);
    conv.unreadByAdmin = 0;
    conv.unreadByCustomer = (conv.unreadByCustomer || 0) + 1;
    conv.updatedAt = nowIso;
    return res.json({ conversation: conv, message: adminMsg });
  });

  app.patch('/api/admin/conversations/:id/status', (req, res) => {
    const ownerEmail = String(req.headers['x-owner-email'] || '');
    if (!isAuthorizedOwnerEmail(ownerEmail)) {
      return res.status(403).json({ error: 'Owner authorization required.' });
    }
    const conv = conversationsStore.get(req.params.id);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }
    const status = String(req.body?.status || '');
    if (status !== 'open' && status !== 'resolved') {
      return res.status(400).json({ error: 'Invalid conversation status.' });
    }
    conv.status = status;
    conv.unreadByAdmin = 0;
    conv.updatedAt = new Date().toISOString();
    return res.json({ conversation: conv });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RM Mart server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
