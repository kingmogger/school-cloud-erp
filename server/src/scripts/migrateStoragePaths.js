import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDB } from '../config/db.js';
import { getStorageBucket } from '../config/firebase.js';
import { runWithoutTenant, runWithTenant } from '../utils/tenantContext.js';
import { Assignment } from '../models/Assignment.js';
import { StudyMaterial } from '../models/StudyMaterial.js';
import { Submission } from '../models/Submission.js';
import { SchoolSettings } from '../models/SchoolSettings.js';
import { School } from '../models/School.js';
import { StorageFile } from '../models/StorageFile.js';
import {
  LOCAL_UPLOADS_ROOT,
  normalizeCategory,
  recalculateSchoolUsage,
} from '../services/storage.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_ROOT = path.resolve(__dirname, '../../backups');

async function backupLocalState() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destDir = path.join(BACKUP_ROOT, `storage-migration-${stamp}`);
  await fs.mkdir(destDir, { recursive: true });

  if (fsSync.existsSync(LOCAL_UPLOADS_ROOT)) {
    await fs.cp(LOCAL_UPLOADS_ROOT, path.join(destDir, 'uploads'), { recursive: true });
  }
  const localDb = path.resolve(__dirname, '../../data/firestore_local.json');
  if (fsSync.existsSync(localDb)) {
    await fs.copyFile(localDb, path.join(destDir, 'firestore_local.json'));
  }
  console.log(`✅ Backup created at ${destDir}`);
}

async function migrateRecord({ doc, urlField, pathField, fileIdField, category, entityType }) {
  const rawUrl = doc[urlField];
  if (!rawUrl) return false;
  if (doc[pathField]?.startsWith(`schools/${doc.schoolId}/`) && doc[fileIdField]) {
    return false; // Already migrated (idempotent)
  }

  const normalizedCat = normalizeCategory(category);
  let storagePath = doc[pathField] || '';
  let sizeBytes = doc.fileSizeBytes || 0;
  let originalName = path.basename(rawUrl.split('?')[0] || 'migrated-file');
  let migrated = false;

  // Handle legacy local /uploads/... files
  if (rawUrl.startsWith('/uploads/')) {
    const relLegacy = rawUrl.replace(/^\/uploads\//, '');
    const legacyFullPath = path.join(LOCAL_UPLOADS_ROOT, relLegacy);
    const fileName = path.basename(legacyFullPath);
    storagePath = `schools/${doc.schoolId}/${normalizedCat}/${fileName}`;
    const targetFullPath = path.join(LOCAL_UPLOADS_ROOT, storagePath);

    if (fsSync.existsSync(legacyFullPath)) {
      const stat = await fs.stat(legacyFullPath);
      sizeBytes = stat.size;
      const bucket = getStorageBucket();
      if (bucket) {
        await bucket.upload(legacyFullPath, { destination: storagePath });
      } else {
        await fs.mkdir(path.dirname(targetFullPath), { recursive: true });
        if (!fsSync.existsSync(targetFullPath)) {
          await fs.copyFile(legacyFullPath, targetFullPath);
        }
      }
      migrated = true;
    } else if (fsSync.existsSync(targetFullPath)) {
      const stat = await fs.stat(targetFullPath);
      sizeBytes = stat.size;
      migrated = true;
    }
  }

  if (!migrated) return false;

  const existingFile = await runWithTenant(doc.schoolId, () =>
    StorageFile.findOne({ storagePath }).lean()
  );

  const fileDoc =
    existingFile ||
    (await runWithTenant(doc.schoolId, () =>
      StorageFile.create({
        schoolId: String(doc.schoolId),
        category: normalizedCat,
        storagePath,
        fileName: path.basename(storagePath),
        originalName,
        mimeType: doc.fileType || 'application/octet-stream',
        sizeBytes,
        uploadedById: null,
        uploaderName: 'Migrated',
        entityType,
        entityId: String(doc._id),
      })
    ));

  doc[pathField] = storagePath;
  doc[fileIdField] = fileDoc._id;
  doc[urlField] = `/api/v1/storage/files/${fileDoc._id}/download`;
  if ('fileSizeBytes' in doc || sizeBytes) doc.fileSizeBytes = sizeBytes;
  await doc.save();
  return true;
}

export async function runStorageMigration({ skipBackup = false } = {}) {
  await connectDB();
  if (!skipBackup) {
    await backupLocalState();
  }

  let migratedCount = 0;
  await runWithoutTenant(async () => {
    const assignments = await Assignment.find({ attachmentUrl: { $ne: '' } });
    for (const doc of assignments) {
      if (
        await migrateRecord({
          doc,
          urlField: 'attachmentUrl',
          pathField: 'attachmentStoragePath',
          fileIdField: 'attachmentFileId',
          category: 'assignments',
          entityType: 'assignment',
        })
      ) {
        migratedCount += 1;
      }
    }

    const materials = await StudyMaterial.find({ fileUrl: { $ne: '' } });
    for (const doc of materials) {
      if (
        await migrateRecord({
          doc,
          urlField: 'fileUrl',
          pathField: 'storagePath',
          fileIdField: 'storageFileId',
          category: 'study-materials',
          entityType: 'studyMaterial',
        })
      ) {
        migratedCount += 1;
      }
    }

    const submissions = await Submission.find({ fileUrl: { $ne: '' } });
    for (const doc of submissions) {
      if (
        await migrateRecord({
          doc,
          urlField: 'fileUrl',
          pathField: 'storagePath',
          fileIdField: 'storageFileId',
          category: 'submissions',
          entityType: 'submission',
        })
      ) {
        migratedCount += 1;
      }
    }

    const settingsList = await SchoolSettings.find({ logoUrl: { $ne: '' } });
    for (const doc of settingsList) {
      if (
        await migrateRecord({
          doc,
          urlField: 'logoUrl',
          pathField: 'logoStoragePath',
          fileIdField: 'logoFileId',
          category: 'other',
          entityType: 'schoolLogo',
        })
      ) {
        migratedCount += 1;
      }
    }

    const schools = await School.find({ softDeletedAt: null }).lean();
    for (const s of schools) {
      await recalculateSchoolUsage(s._id);
    }
  });

  console.log(`✅ Storage migration complete. Migrated ${migratedCount} file(s).`);
  return { migratedCount };
}

if (process.argv[1] && process.argv[1].endsWith('migrateStoragePaths.js')) {
  runStorageMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Storage migration failed:', err);
      process.exit(1);
    });
}
