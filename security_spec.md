# RM Mart Security Specification (Phase 0 — Payload-First Security TDD)

## 1. Data Invariants
1. **Default Deny**: Any unmatched path in Firestore is unconditionally denied (`allow read, write: if false`).
2. **Owner-Only Admin Authority**: Only verified Firebase Auth accounts matching the trusted owner email (`email_verified == true`) or present in `/admins/{uid}` can create, update, or delete `/products/{productId}`, list all `/orders`, list all `/users`, list all `/conversations`, or reply as `admin`.
3. **Zero Client RBAC Escalation**: `/admins/{uid}` is strictly read-only from client SDKs (`allow write: if false`). Users cannot attach `role` or `isAdmin` shadow keys to `/users/{userId}`.
4. **PII Isolation**: `/users/{userId}` and `/orders/{orderId}` contain customer mobile, email, and delivery address. Non-owner authenticated users cannot `get` or `list` another customer's profile or orders.
5. **Order Integrity & Terminal State Locking**: Customers can only create orders for their own `userId == request.auth.uid`, strictly starting with `orderStatus == 'Pending'` and `paymentStatus != 'Verified'`. Once an order reaches `Delivered` or `Cancelled`, non-admin updates are unconditionally locked.
6. **Master Gate on Subcollections**: `/conversations/{conversationId}/messages/{messageId}` verifies the parent `/conversations/{conversationId}` document via `get()` so only the conversation's `customerUid` or an admin can read or append messages. Customers can never spoof `senderRole: 'admin'`.
7. **Temporal & Structural Integrity**: Document IDs must pass `isValidId()` (`^[a-zA-Z0-9_-]{1,128}$`), all strings enforce `.size()` ceilings, arrays enforce `.size() <= MAX` and element checks, and `createdAt`/`updatedAt` must match `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return `PERMISSION_DENIED`)
1. **Shadow Field Injection on User Profile**: Creating `/users/{uid}` with extra field `{ "isAdmin": true, "role": "owner" }`.
2. **Admin Allowlist Tampering**: Authenticated customer attempting to create `/admins/{uid}` with `{ "role": "owner" }`.
3. **Unverified Email Spoofing**: Admin-matching email with `email_verified: false` attempting to create a product in `/products/{id}`.
4. **Customer Catalog Manipulation**: Regular customer attempting to update `/products/{id}` price to `1`.
5. **Cross-Customer PII Snooping**: Customer A attempting `get` on `/users/customerB` or `/orders/orderB`.
6. **Blanket Order Scraping**: Customer A issuing an unfiltered `list` query on `/orders` without `where('userId', '==', uid)`.
7. **Order Payment Forgery**: Customer creating `/orders/{id}` with `paymentStatus: "Verified"` or `orderStatus: "Delivered"`.
8. **Order Identity Spoofing**: Customer A creating `/orders/{id}` with `userId: "customerB"`.
9. **Terminal State Mutation**: Customer attempting to cancel or modify an order already marked `Delivered`.
10. **Chat Admin Spoofing**: Customer writing a message into `/conversations/{convId}/messages/{msgId}` with `senderRole: "admin"`.
11. **Cross-Customer Chat Snooping**: Customer A reading `/conversations/convB/messages/msg1`.
12. **Resource Exhaustion / ID Poisoning**: Writing a document with a 500-character junk ID or a 100KB `description` string or client-forged `createdAt` timestamp.
