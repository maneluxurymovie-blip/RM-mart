import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Static & invariant verification test suite for RM Mart Firestore Security Rules.
 * Verifies every Dirty Dozen rule guard from security_spec.md is enforced in firestore.rules.
 */
const rulesPath = path.resolve(
  process.cwd(),
  fs.existsSync(path.resolve(process.cwd(), 'firestore.rules'))
    ? 'firestore.rules'
    : 'DRAFT_firestore.rules'
);
const rules = fs.readFileSync(rulesPath, 'utf8');

test('Rule 1: Global default-deny safety net is declared first', () => {
  assert.match(rules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);
});

test('Rule 2: Admin allowlist blocks all client writes', () => {
  assert.match(rules, /match \/admins\/\{adminId\}[\s\S]*allow list, create, update, delete: if false;/);
});

test('Rule 3: Email spoofing blocked by requiring email_verified == true and configured owner email', () => {
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /ravindramane@990email\.com/);
});

test('Rule 4: Products mutations require isAdmin() and isValidProduct()', () => {
  assert.match(rules, /match \/products\/\{productId\}[\s\S]*isValidProduct\(incoming\(\)\)[\s\S]*isAdmin\(\)/);
});

test('Rule 5: Users PII collection blocks shadow keys and cross-user reads', () => {
  assert.match(rules, /data\.keys\(\)\.hasOnly\(\['uid', 'displayName', 'email', 'phone', 'address', 'wishlist', 'createdAt', 'updatedAt'\]\)/);
  assert.match(rules, /allow get: if isValidId\(userId\) && \(isOwner\(userId\) \|\| isAdmin\(\)\);/);
});

test('Rule 6: Orders enforce userId match, Pending start, non-Verified payment, and terminal state lock', () => {
  assert.match(rules, /incoming\(\)\.userId == request\.auth\.uid/);
  assert.match(rules, /incoming\(\)\.orderStatus == 'Pending'/);
  assert.match(rules, /incoming\(\)\.paymentStatus != 'Verified'/);
  assert.match(rules, /existing\(\)\.orderStatus == 'Pending' &&\s*incoming\(\)\.orderStatus == 'Cancelled'/);
});

test('Rule 7: Conversations messages subcollection uses Master Gate parent get() and blocks admin role spoofing', () => {
  assert.match(rules, /match \/messages\/\{messageId\}[\s\S]*get\(\/databases\/\$\(database\)\/documents\/conversations\/\$\(conversationId\)\)\.data\.customerUid == request\.auth\.uid/);
  assert.match(rules, /\(isAdmin\(\) && incoming\(\)\.senderRole == 'admin'\)/);
  assert.match(rules, /incoming\(\)\.senderRole in \['customer', 'ai'\]/);
});

test('Rule 8: Path ID poisoning and temporal integrity enforced via isValidId and request.time', () => {
  assert.match(rules, /function isValidId\(id\)/);
  assert.match(rules, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rules, /incoming\(\)\.updatedAt == request\.time/);
});
