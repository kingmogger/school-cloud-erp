import { initFirebase, getDb, isCloudFirebase, getFirebaseInfo } from './firebase.js';

export async function connectDB() {
  try {
    const db = initFirebase();
    console.log(`✅ [Firebase Database] Initialized successfully`);
    return db;
  } catch (err) {
    console.error(`⚠️ [Firebase Database Initialization Error]:`, err.message);
    return null;
  }
}

export function isDbConnected() {
  return true;
}

export async function disconnectDB() {
  return true;
}

export { getDb, isCloudFirebase, getFirebaseInfo };
