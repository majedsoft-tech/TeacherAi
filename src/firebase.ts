import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import originalFirebaseConfig from '../firebase-applet-config.json';

// Persistent fallback to the platform's official Firebase project (which has all development/preview domains authorized)
const defaultPlatformConfig = {
  projectId: "spheric-reporter-w07pf",
  appId: "1:265490755228:web:30a2daac6eeb1298dfc759",
  apiKey: "AIzaSyAE53PHUU04iPCpiGQxcm9qDRTAzH57d8s",
  authDomain: "spheric-reporter-w07pf.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-2b9971df-0c42-4582-adb4-6decb429c112",
  storageBucket: "spheric-reporter-w07pf.firebasestorage.app",
  messagingSenderId: "265490755228"
};

export const defaultFirebaseConfig = defaultPlatformConfig;

export function getDefaultFirestore() {
  const apps = getApps();
  let defaultApp = apps.find(app => app.name === 'default_platform_app');
  if (!defaultApp) {
    defaultApp = initializeApp(defaultPlatformConfig, 'default_platform_app');
  }
  const dbId = defaultPlatformConfig.firestoreDatabaseId || "ai-studio-2b9971df-0c42-4582-adb4-6decb429c112";
  return getFirestore(defaultApp, dbId);
}

export function getFirestoreForDb(databaseId: string, customConfig?: any) {
  const apps = getApps();
  const configToUse = customConfig || defaultPlatformConfig;
  const safeDbId = typeof databaseId === "string" ? databaseId : "";
  const dbIdToUse = safeDbId.trim() || "(default)";
  const sanitizedId = dbIdToUse.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const appName = `source_app_${configToUse.projectId || 'proj'}_${sanitizedId}`;
  
  let sourceApp = apps.find(app => app.name === appName);
  if (!sourceApp) {
    try {
      sourceApp = initializeApp({ ...configToUse, firestoreDatabaseId: dbIdToUse }, appName);
    } catch (e) {
      sourceApp = apps.find(app => app.name === appName) || apps[0];
    }
  }
  return getFirestore(sourceApp, dbIdToUse);
}

export function getDefaultAuth() {
  const apps = getApps();
  let defaultApp = apps.find(app => app.name === 'default_platform_app');
  if (!defaultApp) {
    defaultApp = initializeApp(defaultPlatformConfig, 'default_platform_app');
  }
  return getAuth(defaultApp);
}

// Check if there is a custom Firebase config in localStorage
let customConfig: any = null;
if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
  try {
    const stored = localStorage.getItem("custom_firebase_config");
    if (stored) {
      customConfig = JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to parse custom_firebase_config from localStorage", e);
  }
}

// Allow overriding Firebase config via VITE_ environment variables (for Vercel or other custom hosting)
const metaEnv = (import.meta as any).env || {};
const isCustomProject = !!metaEnv.VITE_FIREBASE_PROJECT_ID || !!(customConfig && customConfig.projectId);
export const firebaseConfig = {
  apiKey: (customConfig && customConfig.apiKey) || metaEnv.VITE_FIREBASE_API_KEY || originalFirebaseConfig.apiKey,
  authDomain: (customConfig && customConfig.authDomain) || metaEnv.VITE_FIREBASE_AUTH_DOMAIN || originalFirebaseConfig.authDomain,
  projectId: (customConfig && customConfig.projectId) || metaEnv.VITE_FIREBASE_PROJECT_ID || originalFirebaseConfig.projectId,
  storageBucket: (customConfig && customConfig.storageBucket) || metaEnv.VITE_FIREBASE_STORAGE_BUCKET || originalFirebaseConfig.storageBucket,
  messagingSenderId: (customConfig && customConfig.messagingSenderId) || metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || originalFirebaseConfig.messagingSenderId,
  appId: (customConfig && customConfig.appId) || metaEnv.VITE_FIREBASE_APP_ID || originalFirebaseConfig.appId,
  firestoreDatabaseId: (customConfig && customConfig.firestoreDatabaseId) || metaEnv.VITE_FIREBASE_DATABASE_ID || (isCustomProject ? "(default)" : ((originalFirebaseConfig as any).firestoreDatabaseId || "(default)"))
};

export function saveCustomFirebaseConfig(config: any) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("custom_firebase_config", JSON.stringify(config));
  }
}

export function clearCustomFirebaseConfig() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("custom_firebase_config");
  }
}

export function getCustomFirebaseConfig() {
  if (typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem("custom_firebase_config");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function isCustomFirebaseActive() {
  return firebaseConfig.projectId !== defaultPlatformConfig.projectId;
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth();

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
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  if (typeof navigator !== 'undefined' && navigator.webdriver) {
    // Skip in headless testing environments to avoid false positives
    return;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration.");
    }
  }
}

testConnection();
