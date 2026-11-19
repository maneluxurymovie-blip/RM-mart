/**
 * Firebase Cloud Functions (2nd Gen) reference implementation for RM Mart.
 * Deploy with: `firebase deploy --only functions`
 * Configure secret: `firebase functions:secrets:set GEMINI_API_KEY`
 */
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { GoogleGenAI } from '@google/genai';

admin.initializeApp();
const db = admin.firestore();
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'ravindramane@990email.com').toLowerCase();
const AUTHORIZED_OWNER_EMAILS = new Set([
  OWNER_EMAIL,
  'ravindramane@990email.com',
  'maneluxurymovie@gmail.com',
]);

/**
 * Verifies product stock and prices from Firestore, prevents duplicate submissions
 * via idempotencyKey, decrements inventory atomically, and persists the order.
 */
export const placeVerifiedOrder = onCall(async (request) => {
  if (!request.auth || !request.auth.token.email_verified) {
    throw new HttpsError('unauthenticated', 'Verified authentication is required.');
  }

  const { idempotencyKey, items, customerDetails, paymentMethod, upiReference } = request.data || {};
  if (!idempotencyKey || !Array.isArray(items) || items.length === 0) {
    throw new HttpsError('invalid-argument', 'Valid idempotencyKey and cart items are required.');
  }

  const existing = await db
    .collection('orders')
    .where('idempotencyKey', '==', idempotencyKey)
    .limit(1)
    .get();
  if (!existing.empty) {
    return { duplicatePrevented: true, orderId: existing.docs[0].id, order: existing.docs[0].data() };
  }

  return db.runTransaction(async (tx) => {
    let subtotal = 0;
    let mrpTotal = 0;
    const verifiedItems: Array<Record<string, unknown>> = [];

    for (const item of items) {
      const productRef = db.collection('products').doc(String(item.productId));
      const snap = await tx.get(productRef);
      if (!snap.exists) {
        throw new HttpsError('not-found', `Product ${item.productId} not found.`);
      }
      const data = snap.data()!;
      const qty = Math.floor(Number(item.quantity));
      if (qty <= 0 || data.stock < qty) {
        throw new HttpsError('failed-precondition', `Insufficient stock for ${data.name}.`);
      }

      tx.update(productRef, {
        stock: data.stock - qty,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const lineTotal = data.price * qty;
      subtotal += lineTotal;
      mrpTotal += Math.max(data.originalPrice || data.price, data.price) * qty;
      verifiedItems.push({
        productId: snap.id,
        name: data.name,
        image: Array.isArray(data.images) ? data.images[0] || '' : '',
        price: data.price,
        originalPrice: Math.max(data.originalPrice || data.price, data.price),
        quantity: qty,
        lineTotal,
      });
    }

    const discountTotal = Math.max(0, mrpTotal - subtotal);
    const deliveryFee = subtotal >= 999 ? 0 : 79;
    const finalTotal = subtotal + deliveryFee;
    const orderNumber = `RMM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;

    const orderRef = db.collection('orders').doc(orderNumber.toLowerCase());
    const orderPayload = {
      orderNumber,
      idempotencyKey,
      userId: request.auth!.uid,
      ...customerDetails,
      items: verifiedItems,
      subtotal,
      discountTotal,
      deliveryFee,
      finalTotal,
      paymentMethod: paymentMethod === 'UPI' ? 'UPI' : 'COD',
      paymentStatus: paymentMethod === 'UPI' ? 'Pending UPI Verification' : 'Pending on Delivery',
      orderStatus: 'Pending',
      upiReference: paymentMethod === 'UPI' ? String(upiReference || '') : '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    tx.set(orderRef, orderPayload);
    return { duplicatePrevented: false, orderId: orderRef.id, orderNumber };
  });
});

/**
 * Multilingual Gemini AI Support Cloud Function grounded in live Firestore catalog data.
 */
export const rmMartSupportChat = onRequest(
  { secrets: [GEMINI_API_KEY], cors: true },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { message } = req.body || {};
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'message is required' });
        return;
      }

      const productsSnap = await db.collection('products').limit(50).get();
      const catalogSummary = productsSnap.docs
        .map((d) => {
          const p = d.data();
          return `- ${p.name} (${p.category}): ₹${p.price}, Stock: ${p.stock}`;
        })
        .join('\n');

      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: message,
        config: {
          systemInstruction: `You are RM Mart's customer support assistant (Owner: Ravindra Mane). Reply in the customer's language (English, Hindi, or Marathi). Only cite products from this live catalog:\n${catalogSummary}`,
        },
      });

      res.json({ reply: response.text || 'How can we assist you today?' });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Support error' });
    }
  }
);

/**
 * Owner-only utility to grant admin custom claims or allowlist records safely.
 */
export const verifyOwnerRole = onCall(async (request) => {
  if (!request.auth || !request.auth.token.email_verified) {
    throw new HttpsError('unauthenticated', 'Verified sign-in required.');
  }
  const email = (request.auth.token.email || '').toLowerCase();
  if (!AUTHORIZED_OWNER_EMAILS.has(email)) {
    throw new HttpsError('permission-denied', 'Only the verified store owner can access admin functions.');
  }
  await db.collection('admins').doc(request.auth.uid).set(
    {
      email,
      role: 'owner',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return { authorized: true, role: 'owner' };
});
