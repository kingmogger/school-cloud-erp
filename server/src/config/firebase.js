import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'node:crypto';
import { env } from './env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DATA_DIR = path.resolve(__dirname, '../../data');
const LOCAL_DB_FILE = path.join(LOCAL_DATA_DIR, 'firestore_local.json');

let firestoreInstance = null;
let isCloudMode = false;
let activeProjectId = 'schoolcloud-firebase-local';

// Simple thread-safe local JSON persistence for offline/embedded mode
class LocalCollection {
  constructor(name, getStore, saveStore) {
    this.name = name;
    this.getStore = getStore;
    this.saveStore = saveStore;
  }

  _getCollectionDocs() {
    const store = this.getStore();
    if (!store[this.name]) {
      store[this.name] = {};
    }
    return store[this.name];
  }

  doc(id) {
    const docId = id || crypto.randomBytes(12).toString('hex');
    const self = this;

    return {
      id: docId,
      path: `${self.name}/${docId}`,
      async get() {
        const docs = self._getCollectionDocs();
        const data = docs[docId] || null;
        return {
          id: docId,
          exists: !!data,
          data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
        };
      },
      async set(data, options = {}) {
        const docs = self._getCollectionDocs();
        const existing = docs[docId] || {};
        const merged = options.merge ? { ...existing, ...data } : { ...data };
        merged._id = docId;
        merged.id = docId;
        merged.createdAt = merged.createdAt || new Date().toISOString();
        merged.updatedAt = new Date().toISOString();
        docs[docId] = merged;
        self.saveStore();
        return { writeTime: new Date() };
      },
      async update(data) {
        const docs = self._getCollectionDocs();
        if (!docs[docId]) {
          throw new Error(`Document ${docId} does not exist in collection ${self.name}`);
        }
        docs[docId] = {
          ...docs[docId],
          ...data,
          _id: docId,
          id: docId,
          updatedAt: new Date().toISOString(),
        };
        self.saveStore();
        return { writeTime: new Date() };
      },
      async delete() {
        const docs = self._getCollectionDocs();
        delete docs[docId];
        self.saveStore();
        return { writeTime: new Date() };
      },
    };
  }

  async add(data) {
    const docRef = this.doc();
    await docRef.set(data);
    return docRef;
  }

  where(field, op, value) {
    return new LocalQuery(this, [{ field, op, value }], [], null, null);
  }

  orderBy(field, direction = 'asc') {
    return new LocalQuery(this, [], [{ field, direction }], null, null);
  }

  limit(count) {
    return new LocalQuery(this, [], [], count, null);
  }

  async get() {
    return new LocalQuery(this, [], [], null, null).get();
  }
}

class LocalQuery {
  constructor(collection, filters = [], sorts = [], limitCount = null, offsetCount = null) {
    this.collection = collection;
    this.filters = filters;
    this.sorts = sorts;
    this.limitCount = limitCount;
    this.offsetCount = offsetCount;
  }

  where(field, op, value) {
    return new LocalQuery(this.collection, [...this.filters, { field, op, value }], this.sorts, this.limitCount, this.offsetCount);
  }

  orderBy(field, direction = 'asc') {
    return new LocalQuery(this.collection, this.filters, [...this.sorts, { field, direction }], this.limitCount, this.offsetCount);
  }

  limit(count) {
    return new LocalQuery(this.collection, this.filters, this.sorts, count, this.offsetCount);
  }

  offset(count) {
    return new LocalQuery(this.collection, this.filters, this.sorts, this.limitCount, count);
  }

  async get() {
    const docsObj = this.collection._getCollectionDocs();
    let records = Object.values(docsObj);

    // Apply filters
    for (const { field, op, value } of this.filters) {
      records = records.filter((rec) => {
        const recVal = rec[field];
        if (op === '==' || op === '===') return String(recVal) === String(value);
        if (op === '!=') return String(recVal) !== String(value);
        if (op === '>') return recVal > value;
        if (op === '>=') return recVal >= value;
        if (op === '<') return recVal < value;
        if (op === '<=') return recVal <= value;
        if (op === 'array-contains') return Array.isArray(recVal) && recVal.includes(value);
        if (op === 'in') return Array.isArray(value) && value.includes(recVal);
        return true;
      });
    }

    // Apply sorts
    for (const { field, direction } of this.sorts) {
      records.sort((a, b) => {
        const va = a[field];
        const vb = b[field];
        if (va < vb) return direction === 'asc' ? -1 : 1;
        if (va > vb) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    if (this.offsetCount) {
      records = records.slice(this.offsetCount);
    }
    if (this.limitCount) {
      records = records.slice(0, this.limitCount);
    }

    const docs = records.map((data) => ({
      id: data._id || data.id,
      exists: true,
      data: () => JSON.parse(JSON.stringify(data)),
    }));

    return {
      empty: docs.length === 0,
      size: docs.length,
      docs,
    };
  }
}

class LocalFirestore {
  constructor() {
    this._store = {};
    this._initStore();
  }

  _initStore() {
    try {
      if (!fs.existsSync(LOCAL_DATA_DIR)) {
        fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(LOCAL_DB_FILE)) {
        const raw = fs.readFileSync(LOCAL_DB_FILE, 'utf-8');
        this._store = JSON.parse(raw);
      } else {
        this._store = {};
        this._save();
      }
    } catch (err) {
      console.warn('⚠️ Could not load local firestore file, starting in-memory:', err.message);
      this._store = {};
    }
  }

  _save() {
    try {
      if (!fs.existsSync(LOCAL_DATA_DIR)) {
        fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(this._store, null, 2), 'utf-8');
    } catch (err) {
      console.error('⚠️ Could not persist local firestore store:', err.message);
    }
  }

  collection(name) {
    return new LocalCollection(name, () => this._store, () => this._save());
  }

  async listCollections() {
    return Object.keys(this._store).map((name) => this.collection(name));
  }
}

export function initFirebase() {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  // Look for service account key in server root or workspace
  const possibleKeyPaths = [
    env.FIREBASE_SERVICE_ACCOUNT_PATH,
    path.resolve(process.cwd(), 'serviceAccountKey.json'),
    path.resolve(__dirname, '../../serviceAccountKey.json'),
    path.resolve(__dirname, '../../../serviceAccountKey.json'),
  ].filter(Boolean);

  let keyFileFound = null;
  for (const kp of possibleKeyPaths) {
    if (fs.existsSync(kp)) {
      keyFileFound = kp;
      break;
    }
  }

  if (keyFileFound) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(keyFileFound, 'utf-8'));
      const apps = admin.getApps ? admin.getApps() : (admin.apps || []);
      if (!apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id || env.FIREBASE_PROJECT_ID,
        });
      }
      firestoreInstance = getFirestore();
      isCloudMode = true;
      activeProjectId = serviceAccount.project_id || 'cloud-firestore';
      console.log(`🔥 [Firebase Firestore] Connected to Cloud Project: ${activeProjectId}`);
      return firestoreInstance;
    } catch (err) {
      console.error('⚠️ Failed to initialize Cloud Firebase with serviceAccountKey.json:', err.message);
    }
  } else if (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY && env.FIREBASE_PROJECT_ID) {
    try {
      const apps = admin.getApps ? admin.getApps() : (admin.apps || []);
      if (!apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
            privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }),
        });
      }
      firestoreInstance = getFirestore();
      isCloudMode = true;
      activeProjectId = env.FIREBASE_PROJECT_ID;
      console.log(`🔥 [Firebase Firestore] Connected to Cloud Project: ${activeProjectId}`);
      return firestoreInstance;
    } catch (err) {
      console.error('⚠️ Failed to initialize Cloud Firebase with env credentials:', err.message);
    }
  }

  // Fallback to local Firestore
  console.log(`🔥 [Firebase Database] Initialized Firestore Local Store (Zero config, persisted at: server/data/firestore_local.json)`);
  console.log(`ℹ️  To connect to Google Cloud Firestore, place your 'serviceAccountKey.json' in server/ or root directory.`);
  firestoreInstance = new LocalFirestore();
  isCloudMode = false;
  activeProjectId = 'schoolcloud-firebase-local';
  return firestoreInstance;
}

export function getDb() {
  if (!firestoreInstance) {
    return initFirebase();
  }
  return firestoreInstance;
}

export function isCloudFirebase() {
  return isCloudMode;
}

export function getFirebaseInfo() {
  const db = getDb();
  let collections = [];
  let totalDocs = 0;

  if (!isCloudMode && db._store) {
    collections = Object.keys(db._store).map((col) => {
      const count = Object.keys(db._store[col] || {}).length;
      totalDocs += count;
      return { name: col, count };
    });
  }

  return {
    isCloud: isCloudMode,
    projectId: activeProjectId,
    collections,
    totalDocuments: totalDocs,
    storagePath: isCloudMode ? 'Google Cloud Firestore' : LOCAL_DB_FILE,
  };
}

export function getFirebaseAuth() {
  const apps = admin.getApps ? admin.getApps() : (admin.apps || []);
  if (apps.length > 0) {
    return getAuth();
  }
  return null;
}

export async function createFirebaseAuthUser({ email, password, displayName }) {
  const normEmail = String(email || '').toLowerCase().trim();
  const apps = admin.getApps ? admin.getApps() : (admin.apps || []);

  // If Cloud Firebase Admin is initialized with active credentials
  if (apps.length > 0) {
    try {
      const auth = getAuth();
      const userRecord = await auth.createUser({
        email: normEmail,
        password,
        displayName: displayName || undefined,
      });
      console.log(`🔥 [Firebase Auth] Created account for ${normEmail} (UID: ${userRecord.uid})`);
      return userRecord;
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        const auth = getAuth();
        const existing = await auth.getUserByEmail(normEmail);
        await auth.updateUser(existing.uid, { password, displayName });
        return existing;
      }
      console.warn('⚠️ [Firebase Auth] Cloud createUser failed, continuing with local store:', err.message);
    }
  }

  // Local fallback persistence for Firebase Auth in offline / zero-config mode
  const db = getDb();
  const localAuthCol = db.collection('firebaseAuthUsers');
  const existingDocs = await localAuthCol.where('email', '==', normEmail).get();
  const uid = existingDocs.docs.length > 0 ? existingDocs.docs[0].id : crypto.randomBytes(14).toString('hex');

  // Never store plain-text password in Firestore
  await localAuthCol.doc(uid).set(
    {
      uid,
      email: normEmail,
      displayName: displayName || '',
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return {
    uid,
    email: normEmail,
    displayName: displayName || '',
  };
}

export async function deleteFirebaseAuthUser(uidOrEmail, optionalEmail) {
  let uid = null;
  let email = null;

  if (typeof uidOrEmail === 'object' && uidOrEmail !== null) {
    uid = uidOrEmail.uid || uidOrEmail.firebaseUid || null;
    email = uidOrEmail.email || null;
  } else if (typeof uidOrEmail === 'string') {
    if (uidOrEmail.includes('@')) {
      email = uidOrEmail;
    } else {
      uid = uidOrEmail;
    }
  }

  if (optionalEmail && typeof optionalEmail === 'string') {
    if (optionalEmail.includes('@')) {
      email = optionalEmail;
    } else if (!uid) {
      uid = optionalEmail;
    }
  }

  const normEmail = email ? String(email).toLowerCase().trim() : null;
  const normUid = uid ? String(uid).trim() : null;

  if (!normUid && !normEmail) return;

  const apps = admin.getApps ? admin.getApps() : (admin.apps || []);

  // 1. Cloud Firebase Authentication
  if (apps.length > 0) {
    try {
      const auth = getAuth();
      if (normUid) {
        try {
          await auth.deleteUser(normUid);
          console.log(`🔥 [Firebase Auth] Deleted account by UID: ${normUid}`);
        } catch (err) {
          if (err.code !== 'auth/user-not-found') {
            console.warn('⚠️ [Firebase Auth] deleteUser by UID failed:', err.message);
          }
        }
      }
      if (normEmail) {
        try {
          const userRecord = await auth.getUserByEmail(normEmail);
          if (userRecord && userRecord.uid) {
            await auth.deleteUser(userRecord.uid);
            console.log(`🔥 [Firebase Auth] Deleted account by Email: ${normEmail} (UID: ${userRecord.uid})`);
          }
        } catch (err) {
          if (err.code !== 'auth/user-not-found') {
            console.warn('⚠️ [Firebase Auth] deleteUser by Email failed:', err.message);
          }
        }
      }
    } catch (err) {
      console.warn('⚠️ [Firebase Auth] Cloud deletion error:', err.message);
    }
  }

  // 2. Local Firestore Auth persistence (firebaseAuthUsers collection)
  try {
    const db = getDb();
    const localAuthCol = db.collection('firebaseAuthUsers');
    if (normUid) {
      await localAuthCol.doc(normUid).delete();
      const uidDocs = await localAuthCol.where('uid', '==', normUid).get();
      for (const d of uidDocs.docs) {
        await localAuthCol.doc(d.id).delete();
      }
    }
    if (normEmail) {
      const emailDocs = await localAuthCol.where('email', '==', normEmail).get();
      for (const d of emailDocs.docs) {
        await localAuthCol.doc(d.id).delete();
      }
    }
  } catch (err) {
    console.warn('⚠️ [Firebase Auth] Local store deletion error:', err.message);
  }
}

