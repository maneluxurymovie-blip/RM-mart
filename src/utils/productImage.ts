export interface ResolveImageOptions {
  /** Vite BASE_URL (e.g. "/" in dev or "/RM-mart/" on GitHub Pages) */
  baseUrl?: string;
  /** Map of lowercase filename -> Vite-bundled URL */
  bundledByFilename?: Record<string, string>;
  /** Firebase Storage bucket (e.g. "silent-liberty-lxq1s.firebasestorage.app") */
  storageBucket?: string;
}

function normalizeBaseUrl(baseUrl?: string): string {
  if (!baseUrl || baseUrl === './' || baseUrl === '.') return '/';
  const withLeading = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

function extractFilename(inputPath: string): string {
  const withoutQuery = inputPath.split('?')[0].split('#')[0];
  const segments = withoutQuery.split('/').filter(Boolean);
  return (segments[segments.length - 1] || '').toLowerCase();
}

function buildFirebaseStorageDownloadUrl(bucket: string, objectPath: string): string {
  const cleanBucket = bucket.replace(/^gs:\/\//i, '').replace(/\/+$/, '');
  const cleanObject = objectPath.replace(/^\/+/, '');
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
    cleanBucket
  )}/o/${encodeURIComponent(cleanObject)}?alt=media`;
}

/**
 * Resolves any RM Mart product image reference into a deploy-safe browser URL:
 * - Preserves valid HTTPS/HTTP remote URLs (including Firebase Storage download URLs), data URIs, and blob URIs.
 * - Strips accidental localhost / 127.0.0.1 origins and resolves their asset paths cleanly.
 * - Converts Firebase Storage `gs://` URIs and relative `products/...` storage paths to HTTPS download URLs.
 * - Maps legacy or Firestore-stored `/src/assets/images/...` paths (case-insensitively) to Vite-bundled imports.
 * - Ensures relative or unprefixed paths respect Vite's base path (`/RM-mart/` on GitHub Pages).
 */
export function resolveProductImageUrl(
  rawUrl: string | undefined | null,
  options: ResolveImageOptions = {}
): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';

  const base = normalizeBaseUrl(options.baseUrl);
  const bundledMap = options.bundledByFilename || {};
  const storageBucket = (options.storageBucket || '').trim();

  // Preserve inline data URIs and object blob URLs
  if (/^(data:image\/|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  // Convert gs://bucket/path Firebase Storage URIs to HTTPS download URLs
  if (/^gs:\/\//i.test(trimmed)) {
    const withoutScheme = trimmed.slice(5);
    const firstSlash = withoutScheme.indexOf('/');
    if (firstSlash > 0) {
      const bucket = withoutScheme.slice(0, firstSlash);
      const objectPath = withoutScheme.slice(firstSlash + 1);
      if (objectPath) {
        return buildFirebaseStorageDownloadUrl(bucket, objectPath);
      }
    }
    return '';
  }

  // Handle full HTTP(S) URLs — strip localhost dev URLs, keep real remote & Firebase Storage URLs
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const isLocalhost =
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '0.0.0.0';
      if (!isLocalhost) {
        return trimmed;
      }
      // Recover path portion from accidental localhost URLs
      const localPath = parsed.pathname;
      const localFile = extractFilename(localPath);
      if (localFile && bundledMap[localFile]) {
        return bundledMap[localFile];
      }
      const cleanLocal = localPath.replace(/^\/+/, '');
      return `${base}${cleanLocal}`;
    } catch {
      return trimmed;
    }
  }

  // Normalize Windows slashes if any
  const normalizedPath = trimmed.replace(/\\/g, '/');

  // If this points to any bundled studio image in src/assets/images/ (case-insensitive)
  const fileName = extractFilename(normalizedPath);
  if (
    fileName &&
    bundledMap[fileName] &&
    /(^|\/)(src\/)?assets\/images\//i.test(normalizedPath)
  ) {
    return bundledMap[fileName];
  }

  // Also recover bare bundled filenames (e.g., "product_saffron_serum_1795061035441.jpg")
  if (!normalizedPath.includes('/') && fileName && bundledMap[fileName]) {
    return bundledMap[fileName];
  }

  // Convert bare Firebase Storage object paths like "products/rm-123/photo.jpg"
  if (/^products\/[^/]+\/.+/i.test(normalizedPath) && storageBucket) {
    return buildFirebaseStorageDownloadUrl(storageBucket, normalizedPath);
  }

  // Already prefixed with the configured base path (e.g. "/RM-mart/assets/...")
  if (base !== '/' && normalizedPath.startsWith(base)) {
    return normalizedPath;
  }

  // Any other relative or root-relative path: prefix safely with base URL
  const withoutLeadingDotOrSlash = normalizedPath.replace(/^(\.\/)+/, '').replace(/^\/+/, '');
  return `${base}${withoutLeadingDotOrSlash}`;
}

/**
 * Resolves and deduplicates a product's image array into usable URLs.
 */
export function resolveProductImages(
  images: readonly string[] | undefined | null,
  options: ResolveImageOptions = {}
): string[] {
  if (!Array.isArray(images)) return [];
  const resolved: string[] = [];
  for (const img of images) {
    const url = resolveProductImageUrl(img, options);
    if (url && !resolved.includes(url)) {
      resolved.push(url);
    }
  }
  return resolved;
}
