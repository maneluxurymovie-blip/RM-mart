import {
  BUNDLED_IMAGES_BY_FILENAME,
  PRODUCT_IMAGE_ASSETS,
} from '../assets/productImages';
import {
  DEMO_PRODUCTS as BASE_DEMO_PRODUCTS,
  DEMO_PRODUCT_IMAGE_FILES,
} from './demoCatalogData';
import type { Product } from '../types';

/**
 * Editable demo catalog for RM Mart with Vite-bundled static ES image imports.
 * Every image is emitted into dist/assets/ and automatically prefixed with
 * Vite's configured base path (/RM-mart/ on GitHub Pages).
 */
export const DEMO_PRODUCTS: Product[] = BASE_DEMO_PRODUCTS.map((product) => {
  const fileName = DEMO_PRODUCT_IMAGE_FILES[product.id];
  const bundledImage = fileName ? BUNDLED_IMAGES_BY_FILENAME[fileName.toLowerCase()] : '';
  return {
    ...product,
    images: bundledImage ? [bundledImage] : product.images,
  };
});

export const HERO_BANNER_IMAGE: string = PRODUCT_IMAGE_ASSETS.heroRmMart;
