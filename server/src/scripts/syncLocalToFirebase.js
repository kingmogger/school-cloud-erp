import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../config/env.js';
import { initFirebase, isCloudFirebase } from '../config/firebase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DB_FILE = path.resolve(__dirname, '../../data/firestore_local.json');

async function syncLocalToFirebase() {
  const db = initFirebase();

  if (!isCloudFirebase()) {
    console.error('❌ Cloud Firebase is not configured.');
    console.error('   Place your downloaded serviceAccountKey.json in server/serviceAccountKey.json');
    console.error('   or set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env.');
    process.exit(1);
  }

  if (!fs.existsSync(LOCAL_DB_FILE)) {
    console.error(`❌ Local data file not found at ${LOCAL_DB_FILE}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf-8'));
  let totalUploaded = 0;

  for (const [collectionName, docsMap] of Object.entries(raw)) {
    if (!docsMap || typeof docsMap !== 'object') continue;
    const entries = Object.entries(docsMap);
    if (entries.length === 0) continue;

    console.log(`📦 Uploading ${entries.length} docs to '${collectionName}'...`);
    let batch = db.batch();
    let count = 0;

    for (const [docId, docData] of entries) {
      const ref = db.collection(collectionName).doc(String(docId));
      batch.set(ref, docData, { merge: true });
      count++;
      totalUploaded++;

      if (count % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }

    if (count % 400 !== 0) {
      await batch.commit();
    }
  }

  console.log(`✅ Successfully synced ${totalUploaded} documents to Cloud Firestore!`);
  process.exit(0);
}

syncLocalToFirebase().catch((err) => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
