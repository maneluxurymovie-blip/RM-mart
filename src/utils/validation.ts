import type { CustomerDetails, PaymentMethod } from '../types';

export interface CheckoutValidationErrors {
  customerName?: string;
  customerMobile?: string;
  customerEmail?: string;
  deliveryAddress?: string;
  city?: string;
  pincode?: string;
  upiReference?: string;
  general?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const INDIAN_MOBILE_REGEX = /^(?:\+91[\s-]?)?[6-9]\d{9}$/;
const INDIAN_PINCODE_REGEX = /^[1-9][0-9]{5}$/;

export function validateCheckoutForm(
  details: CustomerDetails,
  paymentMethod: PaymentMethod,
  upiReference = ''
): CheckoutValidationErrors {
  const errors: CheckoutValidationErrors = {};

  const name = details.customerName.trim();
  if (name.length < 2 || name.length > 120) {
    errors.customerName = 'Please enter your full name (2–120 characters).';
  }

  const mobile = details.customerMobile.trim();
  if (!INDIAN_MOBILE_REGEX.test(mobile)) {
    errors.customerMobile = 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210).';
  }

  const email = details.customerEmail.trim();
  if (!EMAIL_REGEX.test(email) || email.length > 200) {
    errors.customerEmail = 'Enter a valid email address for order updates.';
  }

  const address = details.deliveryAddress.trim();
  if (address.length < 10 || address.length > 500) {
    errors.deliveryAddress = 'Enter a complete delivery address (house/flat, street, landmark).';
  }

  const city = details.city.trim();
  if (city.length < 2 || city.length > 80) {
    errors.city = 'Enter your city or town.';
  }

  const pincode = details.pincode.trim();
  if (!INDIAN_PINCODE_REGEX.test(pincode)) {
    errors.pincode = 'Enter a valid 6-digit Indian PIN code.';
  }

  if (paymentMethod === 'UPI' && upiReference.trim().length > 100) {
    errors.upiReference = 'UPI reference must be under 100 characters.';
  }

  return errors;
}

export function hasValidationErrors(errors: CheckoutValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function sanitizeProductInput(input: {
  name: string;
  description: string;
  price: number;
  originalPrice: number;
  stock: number;
}): string | null {
  if (input.name.trim().length < 2 || input.name.trim().length > 140) {
    return 'Product name must be between 2 and 140 characters.';
  }
  if (input.description.trim().length < 10 || input.description.trim().length > 2000) {
    return 'Description must be between 10 and 2000 characters.';
  }
  if (!Number.isFinite(input.price) || input.price <= 0) {
    return 'Selling price must be greater than ₹0.';
  }
  if (!Number.isFinite(input.originalPrice) || input.originalPrice < input.price) {
    return 'Original MRP must be greater than or equal to selling price.';
  }
  if (!Number.isFinite(input.stock) || input.stock < 0) {
    return 'Stock count cannot be negative.';
  }
  return null;
}
