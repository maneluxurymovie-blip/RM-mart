import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, type FirebaseStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

export const OWNER_EMAIL = (
  import.meta.env.VITE_OWNER_EMAIL || 'ravindramane@990email.com'
).toLowerCase();

export const OWNER_EMAILS = Array.from(
  new Set([OWNER_EMAIL, 'ravindramane@990email.com', 'maneluxurymovie@gmail.com'])
);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig &&
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.projectId !== 'remixed-project-id'
);

let app: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;
let storageInstance: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  dbInstance = firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
  authInstance = getAuth(app);
  storageInstance = getStorage(app);
}

export const db = dbInstance;
export const auth = authInstance;
export const storage = storageInstance;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<{
  connected: boolean;
  offline: boolean;
  message?: string;
}> {
  if (!db) {
    return {
      connected: false,
      offline: true,
      message: 'Firebase configuration missing. Review DEPLOYMENT.md to connect your project.',
    };
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { connected: true, offline: false };
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return {
        connected: false,
        offline: true,
        message: 'Unable to reach Firestore (client is offline). Check Firebase configuration.',
      };
    }
    // Any server-side response (including permission-denied before rules deploy) proves online connectivity
    return { connected: true, offline: false };
  }
}

export async function signInWithGoogle(): Promise<User> {
  if (!auth) {
    throw new Error('Firebase Auth is not configured.');
  }
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  if (!auth) return;
  await firebaseSignOut(auth);
}

export function isVerifiedOwnerAccount(user: User | null): boolean {
  if (!user || !user.email || !user.emailVerified) return false;
  return OWNER_EMAILS.includes(user.email.toLowerCase());
}

export async function checkUserAdminAccess(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if (isVerifiedOwnerAccount(user)) return true;
  if (!db) return false;
  try {
    const snap = await getDocFromServer(doc(db, 'admins', user.uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function uploadProductImage(productId: string, file: File): Promise<string> {
  if (!storage) {
    throw new Error('Firebase Storage is not configured.');
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files (JPEG, PNG, WebP, AVIF) are allowed.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image size must be 5MB or smaller.');
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageRef = ref(storage, `products/${productId}/${Date.now()}_${safeName}`);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

/**
 * Resolves a Firebase Storage reference (gs:// bucket URI or storage object path)
 * into a signed HTTPS download URL using the configured Firebase Storage SDK.
 */
export async function resolveStorageImageUrl(pathOrUrl: string): Promise<string> {
  const trimmed = pathOrUrl.trim();
  if (!trimmed || !storage) return trimmed;
  if (/^https?:\/\//i.test(trimmed) || /^(data:image\/|blob:)/i.test(trimmed)) {
    return trimmed;
  }
  if (/^gs:\/\//i.test(trimmed) || /^products\/[^/]+\/.+/i.test(trimmed)) {
    const storageRef = ref(storage, trimmed);
    return getDownloadURL(storageRef);
  }
  return trimmed;
}

export function getFirebaseProjectInfo() {
  return {
    configured: isFirebaseConfigured,
    projectId: firebaseConfig?.projectId || '',
    databaseId: firebaseConfig?.firestoreDatabaseId || '(default)',
    storageBucket: firebaseConfig?.storageBucket || '',
    ownerEmail: OWNER_EMAIL,
  };
}
