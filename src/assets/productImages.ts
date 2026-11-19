import heroRmMartImg from './images/hero_rm_mart_1795061028667.jpg';
import brassFlaskImg from './images/product_brass_flask_1795061043408.jpg';
import darjeelingAlmondsImg from './images/product_darjeeling_almonds_1795061029450.jpg';
import emeraldHeadphonesImg from './images/product_emerald_headphones_1795061027404.jpg';
import linenLoafersImg from './images/product_linen_loafers_1795061029094.jpg';
import saffronSerumImg from './images/product_saffron_serum_1795061035441.jpg';

/**
 * Vite-bundled static ES imports for all RM Mart product and hero imagery.
 * Vite hashes and emits these into dist/assets/ and automatically prefixes
 * them with the configured base path (e.g., /RM-mart/ on GitHub Pages).
 */
export const PRODUCT_IMAGE_ASSETS = {
  heroRmMart: heroRmMartImg,
  brassFlask: brassFlaskImg,
  darjeelingAlmonds: darjeelingAlmondsImg,
  emeraldHeadphones: emeraldHeadphonesImg,
  linenLoafers: linenLoafersImg,
  saffronSerum: saffronSerumImg,
} as const;

export type ProductImageAssetKey = keyof typeof PRODUCT_IMAGE_ASSETS;

/**
 * Case-insensitive filename map (lowercase filename -> Vite bundled asset URL)
 * used to recover legacy or Firestore-stored /src/assets/images/... paths.
 */
export const BUNDLED_IMAGES_BY_FILENAME: Record<string, string> = {
  'hero_rm_mart_1795061028667.jpg': heroRmMartImg,
  'product_brass_flask_1795061043408.jpg': brassFlaskImg,
  'product_darjeeling_almonds_1795061029450.jpg': darjeelingAlmondsImg,
  'product_emerald_headphones_1795061027404.jpg': emeraldHeadphonesImg,
  'product_linen_loafers_1795061029094.jpg': linenLoafersImg,
  'product_saffron_serum_1795061035441.jpg': saffronSerumImg,
};
