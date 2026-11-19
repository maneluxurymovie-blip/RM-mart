import firebaseConfig from '../../firebase-applet-config.json';
import { BUNDLED_IMAGES_BY_FILENAME } from '../assets/productImages';
import { resolveProductImages, resolveProductImageUrl } from '../utils/productImage';

const BROWSER_IMAGE_OPTIONS = {
  baseUrl: import.meta.env.BASE_URL || '/',
  bundledByFilename: BUNDLED_IMAGES_BY_FILENAME,
  storageBucket: firebaseConfig?.storageBucket || '',
};

/**
 * Resolves a single product image URL for browser rendering,
 * automatically recovering legacy /src/assets/images/... paths from Firestore
 * and respecting the Vite GitHub Pages base path (/RM-mart/).
 */
export function resolveBundledProductImage(rawUrl: string | undefined | null): string {
  return resolveProductImageUrl(rawUrl, BROWSER_IMAGE_OPTIONS);
}

/**
 * Resolves an array of product image URLs for browser rendering.
 */
export function resolveBundledProductImages(
  images: readonly string[] | undefined | null
): string[] {
  return resolveProductImages(images, BROWSER_IMAGE_OPTIONS);
}
