import test from 'node:test';
import assert from 'node:assert/strict';
import { hasValidationErrors, sanitizeProductInput, validateCheckoutForm } from './validation';

test('rejects empty checkout form fields', () => {
  const errors = validateCheckoutForm(
    {
      customerName: '',
      customerMobile: '',
      customerEmail: '',
      deliveryAddress: '',
      city: '',
      pincode: '',
    },
    'COD'
  );
  assert.equal(hasValidationErrors(errors), true);
  assert.ok(errors.customerName);
  assert.ok(errors.customerMobile);
  assert.ok(errors.customerEmail);
  assert.ok(errors.deliveryAddress);
  assert.ok(errors.city);
  assert.ok(errors.pincode);
});

test('accepts valid Indian checkout details', () => {
  const errors = validateCheckoutForm(
    {
      customerName: 'Aarav Kulkarni',
      customerMobile: '9876543210',
      customerEmail: 'aarav@example.in',
      deliveryAddress: 'Flat 402, Emerald Residency, Baner Road',
      city: 'Pune',
      pincode: '411045',
    },
    'COD'
  );
  assert.equal(hasValidationErrors(errors), false);
});

test('rejects invalid Indian PIN codes and mobile numbers', () => {
  const errors = validateCheckoutForm(
    {
      customerName: 'Priya Sharma',
      customerMobile: '1234567890',
      customerEmail: 'priya@example.in',
      deliveryAddress: '12 MG Road, Camp Area, Pune',
      city: 'Pune',
      pincode: '012345',
    },
    'UPI'
  );
  assert.ok(errors.customerMobile);
  assert.ok(errors.pincode);
});

test('validates product pricing and stock invariants', () => {
  assert.equal(
    sanitizeProductInput({
      name: 'Silk Stole',
      description: 'Handwoven emerald silk stole from Varanasi.',
      price: 1999,
      originalPrice: 1500,
      stock: 5,
    }),
    'Original MRP must be greater than or equal to selling price.'
  );
  assert.equal(
    sanitizeProductInput({
      name: 'Silk Stole',
      description: 'Handwoven emerald silk stole from Varanasi.',
      price: 1999,
      originalPrice: 2499,
      stock: 5,
    }),
    null
  );
});
