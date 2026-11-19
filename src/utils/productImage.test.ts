import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolveProductImageUrl, resolveProductImages } from './productImage';
import { DEMO_PRODUCTS, DEMO_PRODUCT_IMAGE_FILES } from '../data/demoCatalogData';

const MOCK_BUNDLED_MAP: Record<string, string> = {
  'hero_rm_mart_1795061028667.jpg': '/RM-mart/assets/hero_rm_mart_1795061028667-hash.jpg',
  'product_brass_flask_1795061043408.jpg': '/RM-mart/assets/product_brass_flask_1795061043408-hash.jpg',
  'product_darjeeling_almonds_1795061029450.jpg': '/RM-mart/assets/product_darjeeling_almonds_1795061029450-hash.jpg',
  'product_emerald_headphones_1795061027404.jpg': '/RM-mart/assets/product_emerald_headphones_1795061027404-hash.jpg',
  'product_linen_loafers_1795061029094.jpg': '/RM-mart/assets/product_linen_loafers_1795061029094-hash.jpg',
  'product_saffron_serum_1795061035441.jpg': '/RM-mart/assets/product_saffron_serum_1795061035441-hash.jpg',
};

test('all 8 demo products reference real existing image files in src/assets/images/', () => {
  assert.equal(DEMO_PRODUCTS.length, 8);
  const imagesDir = path.resolve(process.cwd(), 'src/assets/images');
  const existingFiles = new Set(fs.readdirSync(imagesDir));

  for (const product of DEMO_PRODUCTS) {
    const fileName = DEMO_PRODUCT_IMAGE_FILES[product.id];
    assert.ok(fileName, `Missing image filename mapping for product ${product.id}`);
    assert.ok(
      existingFiles.has(fileName),
      `Image file ${fileName} for product ${product.id} does not exist in src/assets/images/`
    );
  }
});

test('resolves legacy /src/assets/images/ paths to Vite-bundled /RM-mart/ URLs', () => {
  const resolved = resolveProductImageUrl(
    '/src/assets/images/product_saffron_serum_1795061035441.jpg',
    { baseUrl: '/RM-mart/', bundledByFilename: MOCK_BUNDLED_MAP }
  );
  assert.equal(resolved, '/RM-mart/assets/product_saffron_serum_1795061035441-hash.jpg');
});

test('recovers case-mismatched and localhost dev URLs cleanly', () => {
  const caseMismatch = resolveProductImageUrl(
    'src/assets/images/Product_Emerald_Headphones_1795061027404.JPG',
    { baseUrl: '/RM-mart/', bundledByFilename: MOCK_BUNDLED_MAP }
  );
  assert.equal(caseMismatch, '/RM-mart/assets/product_emerald_headphones_1795061027404-hash.jpg');

  const localhostUrl = resolveProductImageUrl(
    'http://localhost:3000/src/assets/images/product_brass_flask_1795061043408.jpg',
    { baseUrl: '/RM-mart/', bundledByFilename: MOCK_BUNDLED_MAP }
  );
  assert.equal(localhostUrl, '/RM-mart/assets/product_brass_flask_1795061043408-hash.jpg');
});

test('preserves Firebase Storage HTTPS download URLs and converts gs:// URIs', () => {
  const downloadUrl =
    'https://firebasestorage.googleapis.com/v0/b/silent-liberty-lxq1s.firebasestorage.app/o/products%2Frm-1%2Fphoto.jpg?alt=media&token=abc-123';
  assert.equal(
    resolveProductImageUrl(downloadUrl, {
      baseUrl: '/RM-mart/',
      bundledByFilename: MOCK_BUNDLED_MAP,
      storageBucket: 'silent-liberty-lxq1s.firebasestorage.app',
    }),
    downloadUrl
  );

  const gsUri = 'gs://silent-liberty-lxq1s.firebasestorage.app/products/rm-1/photo.jpg';
  assert.equal(
    resolveProductImageUrl(gsUri, {
      baseUrl: '/RM-mart/',
      storageBucket: 'silent-liberty-lxq1s.firebasestorage.app',
    }),
    'https://firebasestorage.googleapis.com/v0/b/silent-liberty-lxq1s.firebasestorage.app/o/products%2Frm-1%2Fphoto.jpg?alt=media'
  );

  const relativeBucketPath = 'products/rm-1/photo.jpg';
  assert.equal(
    resolveProductImageUrl(relativeBucketPath, {
      baseUrl: '/RM-mart/',
      storageBucket: 'silent-liberty-lxq1s.firebasestorage.app',
    }),
    'https://firebasestorage.googleapis.com/v0/b/silent-liberty-lxq1s.firebasestorage.app/o/products%2Frm-1%2Fphoto.jpg?alt=media'
  );
});

test('does not double-prefix already resolved /RM-mart/ asset URLs', () => {
  const alreadyPrefixed = '/RM-mart/assets/product_linen_loafers_1795061029094-hash.jpg';
  assert.equal(
    resolveProductImageUrl(alreadyPrefixed, {
      baseUrl: '/RM-mart/',
      bundledByFilename: MOCK_BUNDLED_MAP,
    }),
    alreadyPrefixed
  );

  const list = resolveProductImages(
    [
      '/src/assets/images/product_saffron_serum_1795061035441.jpg',
      alreadyPrefixed,
      '',
    ],
    { baseUrl: '/RM-mart/', bundledByFilename: MOCK_BUNDLED_MAP }
  );
  assert.deepEqual(list, [
    '/RM-mart/assets/product_saffron_serum_1795061035441-hash.jpg',
    alreadyPrefixed,
  ]);
});
