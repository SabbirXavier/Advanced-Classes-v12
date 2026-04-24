import { initializeApp, getApp, getApps, FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import { getAnalytics } from 'firebase/analytics';

// ✅ Import the Firebase configuration
import firebaseConfigData from '../firebase-applet-config.json';

// ✅ Config type with firestoreDatabaseId
type FirebaseConfig = FirebaseOptions & {
  firestoreDatabaseId?: string;
};

// Use environment variables if available (VITE_ prefix for client-side)
// Fallback to the JSON config file (useful for AI Studio and local dev)
const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigData.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigData.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigData.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigData.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigData.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigData.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigData.measurementId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfigData.firestoreDatabaseId,
};

// ✅ Initialize Primary Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Check for placeholders in production
if (import.meta.env.PROD) {
  const placeholders = ['remixed-project-id', 'remixed-app-id', 'remixed-api-key'];
  if (placeholders.includes(firebaseConfig.projectId || '') || !firebaseConfig.apiKey) {
    console.error('⚠️ FIREBASE CONFIGURATION MISSING OR USING PLACEHOLDERS. Please set your VITE_FIREBASE_* environment variables in your hosting provider (e.g. Render).');
  }
}

// ✅ Services
export const auth = getAuth(app);
export const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
export const rtdb = (firebaseConfigData as any).databaseURL ? getDatabase(app) : null;
export const storage = getStorage(app);

export const primaryConfig = firebaseConfig;

// ✅ Analytics (safe for SSR)
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}
export { analytics };

// ✅ Helper for secondary apps (cleaned type)
export const initializeSecondaryApp = (
  name: string,
  config: FirebaseOptions
): FirebaseApp => {
  const existing = getApps().find(app => app.name === name);
  return existing ? getApp(name) : initializeApp(config, name);
};

export default app;