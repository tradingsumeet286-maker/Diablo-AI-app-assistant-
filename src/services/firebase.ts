import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { UserFact } from '../types';

// User-provided Firebase configuration
export const firebaseConfig = {
  apiKey: 'AIzaSyCvcpraU0gJWkIePc1b7QqN-dkZPblFquc',
  authDomain: 'diablo-f1f3.firebaseapp.com',
  projectId: 'diablo-f1f3',
  storageBucket: 'diablo-f1f3.firebasestorage.app',
  messagingSenderId: '51941270224',
  appId: '1:51941270224:web:506b174aa7261a1c40f4d5',
  measurementId: 'G-3FB77RPD99',
};

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
googleProvider.addScope('email');
googleProvider.addScope('profile');

/**
 * Check if the application is running embedded inside an iframe
 */
export function isRunningInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Sign in with Google Popup
 * Ensures synchronous user gesture activation is preserved and scopes are set.
 */
export async function signInWithGoogle(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  provider.addScope('email');
  provider.addScope('profile');

  try {
    const result = await signInWithPopup(auth, provider);
    console.log('[Firebase Auth] Signed in successfully:', result.user.email);
    return result.user;
  } catch (error: any) {
    console.error('[Firebase Auth] Sign in error:', error?.code, error?.message || error);
    throw error;
  }
}

/**
 * Sign out of current account
 */
export async function logOut(): Promise<void> {
  try {
    await signOut(auth);
    console.log('[Firebase Auth] Signed out successfully');
  } catch (error: any) {
    console.error('[Firebase Auth] Sign out error:', error.message || error);
    throw error;
  }
}

/**
 * Subscribe to auth state changes
 */
export function onAuthUserChanged(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Utility to generate a safe Firestore document ID from a fact key
 */
function toSafeFactDocId(key: string): string {
  return (
    key
      .trim()
      .toLowerCase()
      .replace(/[\/\\]/g, '_')
      .replace(/[^a-z0-9_\-\u0900-\u097F]/gi, '_')
      .replace(/_+/g, '_')
      .slice(0, 100) || `fact_${Date.now()}`
  );
}

/**
 * Save user personal fact into Firestore under /users/{userId}/facts/{safeDocId}
 */
export async function saveUserFactToFirestore(
  userId: string,
  factKey: string,
  factValue: string
): Promise<void> {
  if (!userId || !factKey || !factValue) return;
  try {
    const safeKey = toSafeFactDocId(factKey);
    const factRef = doc(db, 'users', userId, 'facts', safeKey);
    await setDoc(
      factRef,
      {
        userId,
        key: factKey.trim(),
        value: factValue.trim(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`[Firestore Memory] Saved fact for user ${userId}: "${factKey}" = "${factValue}" (doc: ${safeKey})`);
  } catch (err: any) {
    console.error('[Firestore Memory] Error saving fact:', err.message || err);
  }
}

/**
 * Load all user facts from Firestore for the specific logged-in user
 */
export async function loadUserFactsFromFirestore(userId: string): Promise<UserFact[]> {
  if (!userId) return [];
  try {
    const factsCol = collection(db, 'users', userId, 'facts');
    const snapshot = await getDocs(factsCol);
    const facts: UserFact[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.key && data.value) {
        facts.push({
          id: docSnap.id,
          key: data.key,
          value: data.value,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        });
      }
    });
    console.log(`[Firestore Memory] Loaded ${facts.length} facts from Firestore for user ${userId}`);
    return facts;
  } catch (err: any) {
    console.error('[Firestore Memory] Error loading user facts:', err.message || err);
    return [];
  }
}

/**
 * Delete a user fact from Firestore
 */
export async function deleteUserFactFromFirestore(userId: string, factKey: string): Promise<void> {
  if (!userId || !factKey) return;
  try {
    const safeKey = toSafeFactDocId(factKey);
    const factRef = doc(db, 'users', userId, 'facts', safeKey);
    await deleteDoc(factRef);
    console.log(`[Firestore Memory] Deleted fact for user ${userId}:`, factKey);
  } catch (err: any) {
    console.error('[Firestore Memory] Error deleting fact:', err.message || err);
  }
}

/**
 * Save a conversation turn into Firestore for the specific logged-in user
 */
export async function saveConversationTurnToFirestore(
  userId: string,
  role: 'user' | 'assistant',
  text: string
): Promise<void> {
  if (!userId || !text) return;
  try {
    const convCol = collection(db, 'users', userId, 'conversations');
    const newDoc = doc(convCol);
    await setDoc(newDoc, {
      userId,
      role,
      text,
      timestamp: serverTimestamp(),
    });
  } catch (err: any) {
    console.error('[Firestore Memory] Error saving conversation:', err.message || err);
  }
}

/**
 * Load recent conversation turns from Firestore for the specific logged-in user
 */
export async function loadConversationHistoryFromFirestore(
  userId: string,
  turnLimit = 20
): Promise<{ role: string; text: string }[]> {
  if (!userId) return [];
  try {
    const convCol = collection(db, 'users', userId, 'conversations');
    const q = query(convCol, orderBy('timestamp', 'desc'), limit(turnLimit));
    const snapshot = await getDocs(q);
    const history: { role: string; text: string }[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.role && data.text) {
        history.push({ role: data.role, text: data.text });
      }
    });
    // Reverse to chronological order
    return history.reverse();
  } catch (err: any) {
    console.error('[Firestore Memory] Error loading conversation history:', err.message || err);
    return [];
  }
}
