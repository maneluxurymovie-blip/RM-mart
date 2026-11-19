# RM Mart — Firebase Setup, Owner Configuration & Deployment Guide

## 1. Architecture Overview
- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 (Vite SPA)
- **Backend API**: Express (`server.ts`) for local/Cloud Run server-side Gemini AI support (`@google/genai`), authoritative order price/stock validation, duplicate order prevention, and verified order status lookup.
- **Firebase Services**:
  - **Firebase Authentication**: Google Sign-In (`signInWithPopup`).
  - **Cloud Firestore**: Database configured in `firebase-applet-config.json` with hardened Eight-Pillars `firestore.rules`.
  - **Firebase Storage**: Product image uploads guarded by `storage.rules` (owner-only write, max 5MB, image MIME types only).
  - **Firebase Cloud Functions**: Production reference in `functions/index.ts`.

## 2. Firestore Database Schema (`firebase-blueprint.json`)
- `/products/{productId}` — Storefront catalog (`name`, `description`, `category`, `price`, `originalPrice`, `discountPercent`, `stock`, `images`, `featured`, `bestSeller`, `newArrival`, `specialOffer`, `isDemo`, `createdAt`, `updatedAt`).
- `/users/{userId}` — Private customer profiles & synced wishlist (`uid`, `displayName`, `email`, `phone`, `address`, `wishlist`, `createdAt`, `updatedAt`).
- `/orders/{orderId}` — Customer orders (`orderNumber`, `idempotencyKey`, `userId`, delivery details, line items, INR totals, `paymentMethod`, `paymentStatus`, `orderStatus`, timestamps).
- `/conversations/{conversationId}` & `/conversations/{conversationId}/messages/{messageId}` — Private customer support threads and messages gated by parent `customerUid` or owner admin.
- `/admins/{adminId}` — Trusted owner UID allowlist (client writes unconditionally blocked).

## 3. Owner Account Setup (Ravindra Mane)
1. Sign in to RM Mart using **Google Sign-In** with the verified owner email configured in `VITE_OWNER_EMAIL` / `OWNER_EMAIL` (primary owner email: `ravindramane@990email.com`; AI Studio runtime owner `maneluxurymovie@gmail.com` is also allowlisted).
2. To add an additional owner/admin UID in the Firebase Console:
   - Open **Firestore Database → Data → Start collection `admins`**.
   - Set Document ID to the owner's Firebase Auth **UID**.
   - Add fields: `email` (string), `role` (`"owner"`), `createdAt` (timestamp).
3. Never hardcode passwords or secrets in frontend code. Security is enforced server-side and in `firestore.rules` + `storage.rules`.

## 4. Environment Variables (`.env`)
Copy `.env.example` to `.env` and populate values:
- `GEMINI_API_KEY`: Server-side Gemini API key (configured via Secrets in AI Studio / Cloud Functions).
- `OWNER_EMAIL` / `VITE_OWNER_EMAIL`: Verified Google email of the store owner.
- `VITE_UPI_MERCHANT_VPA`: Your merchant UPI ID (e.g., `rmmart@okaxis`).
- `VITE_UPI_MERCHANT_NAME`: Merchant display name (`RM Mart`).
- `VITE_UPI_PROVIDER_VERIFIED`: Keep `"false"` until a verified payment gateway webhook (e.g., Razorpay/Cashfree) is connected.

## 5. Deploying Security Rules & Hosting with Firebase CLI
```bash
npm install -g firebase-tools
firebase login
firebase use silent-liberty-lxq1s

# Deploy Firestore & Storage Security Rules
firebase deploy --only firestore:rules,storage

# Build and deploy frontend to Firebase Hosting
npm run build
firebase deploy --only hosting

# Optional: Deploy Cloud Functions with GEMINI_API_KEY secret
firebase functions:secrets:set GEMINI_API_KEY
firebase deploy --only functions
```
