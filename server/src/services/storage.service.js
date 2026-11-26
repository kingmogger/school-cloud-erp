import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';
import { env } from '../config/env.js';
import { getDb, getStorageBucket, isCloudFirebase } from '../config/firebase.js';
import { School } from '../models/School.js';
import { StorageFile } from '../models/StorageFile.js';
import { StorageSnapshot } from '../models/StorageSnapshot.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { getCurrentSchoolId, runWithoutTenant, runWithTenant } from '../utils/tenantContext.js';
import { ALLOWED_MIMES, MAX_FILE_SIZE_BYTES } from '../middleware/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const LOCAL_UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

export const STORAGE_CATEGORIES = [
  'profile-photos',
  'study-materials',
  'assignments',
  'submissions',
  'receipts',
  'report-cards',
  'other',
];

export const DEFAULT_STORAGE_LIMIT_BYTES = env.STORAGE_DEFAULT_LIMIT_BYTES || 1073741824; // 1 GB

const CATEGORY_ALIASES = {
  materials: 'study-materials',
  'study-materials': 'study-materials',
  assignments: 'assignments',
  submissions: 'submissions',
  logos: 'other',
  logo: 'other',
  'profile-photos': 'profile-photos',
  photos: 'profile-photos',
  receipts: 'receipts',
  'report-cards': 'report-cards',
  other: 'other',
};

export function normalizeCategory(category = 'other') {
  const key = String(category || 'other').toLowerCase().trim();
  return CATEGORY_ALIASES[key] || 'other';
}

export function emptyCategoryUsage() {
  return {
    'profile-photos': 0,
    'study-materials': 0,
    assignments: 0,
    submissions: 0,
    receipts: 0,
    'report-cards': 0,
    other: 0,
  };
}

export function formatBytes(bytes = 0) {
  const num = Number(bytes) || 0;
  if (num <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(num) / Math.log(1024)), units.length - 1);
  if (i === 0) return `${num} B`;
  return `${(num / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

// Per-school async mutex for atomic local counter updates
const schoolLocks = new Map();
async function withSchoolLock(schoolId, fn) {
  const key = String(schoolId);
  const prev = schoolLocks.get(key) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  schoolLocks.set(key, prev.then(() => next));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (schoolLocks.get(key) === next) {
      schoolLocks.delete(key);
    }
  }
}

export function resolveSchoolStorageLimitBytes(school) {
  if (!school) return DEFAULT_STORAGE_LIMIT_BYTES;
  if (typeof school.storageLimitBytes === 'number' && school.storageLimitBytes > 0) {
    return school.storageLimitBytes;
  }
  if (school.planId && typeof school.planId === 'object') {
    if (typeof school.planId.storageLimitBytes === 'number' && school.planId.storageLimitBytes > 0) {
      return school.planId.storageLimitBytes;
    }
    if (typeof school.planId.storageLimitMb === 'number' && school.planId.storageLimitMb > 0) {
      return school.planId.storageLimitMb * 1024 * 1024;
    }
  }
  return DEFAULT_STORAGE_LIMIT_BYTES;
}

async function notifySchoolAdminsThreshold(school, pct, usedBytes, limitBytes) {
  try {
    await runWithTenant(school._id, async () => {
      const admins = await User.find({ role: 'school_admin', isActive: true }).lean();
      const level = pct >= 95 ? '95%' : '80%';
      const title =
        pct >= 95
          ? `Critical: Storage ${level} Full`
          : `Storage Usage Warning (${level})`;
      const message = `Your school is using ${formatBytes(usedBytes)} of ${formatBytes(limitBytes)} (${pct.toFixed(1)}%). Please free up space or contact the platform owner to upgrade your storage limit.`;

      for (const adminUser of admins) {
        await Notification.create({
          schoolId: school._id,
          userId: adminUser._id,
          type: 'general',
          title,
          message,
          link: '/admin/subscription',
        });
      }
    });
  } catch (err) {
    console.warn('⚠️ Failed to send storage threshold notification:', err.message);
  }
}

async function applySchoolStorageDelta(schoolId, deltaBytes, deltaCount, category, { enforceLimit = false } = {}) {
  const cat = normalizeCategory(category);

  if (isCloudFirebase()) {
    const db = getDb();
    const schoolRef = db.collection('schools').doc(String(schoolId));
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(schoolRef);
      if (!snap.exists) {
        throw new ApiError(404, 'School not found', 'NOT_FOUND');
      }
      const schoolData = snap.data();
      const limitBytes = resolveSchoolStorageLimitBytes(schoolData);
      const currentUsed = Number(schoolData.storageUsedBytes || 0);
      const currentCount = Number(schoolData.fileCount || 0);
      const byCat = { ...emptyCategoryUsage(), ...(schoolData.storageUsageByCategory || {}) };

      if (enforceLimit && deltaBytes > 0 && currentUsed + deltaBytes > limitBytes) {
        throw new ApiError(
          413,
          `School storage limit exceeded (${formatBytes(currentUsed)} of ${formatBytes(limitBytes)} used). Contact the platform owner or upgrade your plan.`,
          'STORAGE_LIMIT_EXCEEDED'
        );
      }

      const nextUsed = Math.max(0, currentUsed + deltaBytes);
      const nextCount = Math.max(0, currentCount + deltaCount);
      byCat[cat] = Math.max(0, Number(byCat[cat] || 0) + deltaBytes);

      const warnings = { warn80: false, warn95: false, ...(schoolData.storageWarningsSent || {}) };
      const pct = limitBytes > 0 ? (nextUsed / limitBytes) * 100 : 0;
      let notifyPct = null;

      if (deltaBytes > 0) {
        if (pct >= 95 && !warnings.warn95) {
          warnings.warn95 = true;
          warnings.warn80 = true;
          notifyPct = pct;
        } else if (pct >= 80 && !warnings.warn80) {
          warnings.warn80 = true;
          notifyPct = pct;
        }
      } else {
        if (pct < 80) {
          warnings.warn80 = false;
          warnings.warn95 = false;
        } else if (pct < 95) {
          warnings.warn95 = false;
        }
      }

      tx.update(schoolRef, {
        storageLimitBytes: limitBytes,
        storageUsedBytes: nextUsed,
        fileCount: nextCount,
        storageUsageByCategory: byCat,
        storageWarningsSent: warnings,
        updatedAt: new Date().toISOString(),
      });

      return { school: { _id: schoolId, ...schoolData }, nextUsed, limitBytes, notifyPct };
    });

    if (result.notifyPct !== null) {
      notifySchoolAdminsThreshold(result.school, result.notifyPct, result.nextUsed, result.limitBytes);
    }
    return result;
  }

  // Local mode with per-school async lock
  return withSchoolLock(schoolId, async () => {
    const school = await runWithoutTenant(() => School.findById(schoolId).populate('planId'));
    if (!school) {
      throw new ApiError(404, 'School not found', 'NOT_FOUND');
    }

    const limitBytes = resolveSchoolStorageLimitBytes(school);
    const currentUsed = Number(school.storageUsedBytes || 0);
    const currentCount = Number(school.fileCount || 0);
    const byCat = { ...emptyCategoryUsage(), ...(school.storageUsageByCategory || {}) };

    if (enforceLimit && deltaBytes > 0 && currentUsed + deltaBytes > limitBytes) {
      throw new ApiError(
        413,
        `School storage limit exceeded (${formatBytes(currentUsed)} of ${formatBytes(limitBytes)} used). Contact the platform owner or upgrade your plan.`,
        'STORAGE_LIMIT_EXCEEDED'
      );
    }

    const nextUsed = Math.max(0, currentUsed + deltaBytes);
    const nextCount = Math.max(0, currentCount + deltaCount);
    byCat[cat] = Math.max(0, Number(byCat[cat] || 0) + deltaBytes);

    const warnings = { warn80: false, warn95: false, ...(school.storageWarningsSent || {}) };
    const pct = limitBytes > 0 ? (nextUsed / limitBytes) * 100 : 0;
    let notifyPct = null;

    if (deltaBytes > 0) {
      if (pct >= 95 && !warnings.warn95) {
        warnings.warn95 = true;
        warnings.warn80 = true;
        notifyPct = pct;
      } else if (pct >= 80 && !warnings.warn80) {
        warnings.warn80 = true;
        notifyPct = pct;
      }
    } else {
      if (pct < 80) {
        warnings.warn80 = false;
        warnings.warn95 = false;
      } else if (pct < 95) {
        warnings.warn95 = false;
      }
    }

    school.storageLimitBytes = limitBytes;
    school.storageUsedBytes = nextUsed;
    school.fileCount = nextCount;
    school.storageUsageByCategory = byCat;
    school.storageWarningsSent = warnings;
    await runWithoutTenant(() => school.save());

    if (notifyPct !== null) {
      notifySchoolAdminsThreshold(school, notifyPct, nextUsed, limitBytes);
    }

    return { school, nextUsed, limitBytes, notifyPct };
  });
}

/**
 * Central upload function. All uploads in the app must go through this.
 * Supports either uploadFile(file, optionsObj) or legacy uploadFile(file, categoryString).
 */
export async function uploadFile(file, options = {}) {
  if (!file) return null;

  const opts = typeof options === 'string' ? { category: options } : options || {};
  const schoolId = opts.schoolId || getCurrentSchoolId();
  if (!schoolId) {
    throw new ApiError(400, 'Tenant schoolId is required for file upload', 'SCHOOL_REQUIRED');
  }

  const sizeBytes = Number(file.size ?? file.buffer?.length ?? 0);
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new ApiError(
      400,
      `File exceeds maximum allowed size of ${formatBytes(MAX_FILE_SIZE_BYTES)}`,
      'FILE_TOO_LARGE'
    );
  }
  if (file.mimetype && !ALLOWED_MIMES.has(file.mimetype)) {
    throw new ApiError(
      400,
      `Unsupported file type: ${file.mimetype}. Allowed types: PDF, JPG, PNG, DOCX, PPTX, XLSX.`,
      'INVALID_FILE_TYPE'
    );
  }

  const category = normalizeCategory(opts.category || 'other');
  const safeOriginal = (file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeOriginal}`;
  const storagePath = `schools/${schoolId}/${category}/${uniqueName}`;

  // Pre-check & atomically reserve quota BEFORE writing object, rolling back if write fails
  await applySchoolStorageDelta(schoolId, sizeBytes, 1, category, { enforceLimit: true });

  try {
    const bucket = getStorageBucket();
    if (bucket) {
      const gcsFile = bucket.file(storagePath);
      await gcsFile.save(file.buffer, {
        metadata: {
          contentType: file.mimetype || 'application/octet-stream',
          metadata: {
            schoolId: String(schoolId),
            category,
            uploadedById: opts.uploadedById ? String(opts.uploadedById) : '',
            originalName: file.originalname || safeOriginal,
          },
        },
      });
    } else {
      const fullPath = path.join(LOCAL_UPLOADS_ROOT, storagePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, file.buffer);
    }

    const fileDoc = await runWithTenant(schoolId, () =>
      StorageFile.create({
        schoolId: String(schoolId),
        category,
        storagePath,
        fileName: uniqueName,
        originalName: file.originalname || safeOriginal,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes,
        uploadedById: opts.uploadedById ? String(opts.uploadedById) : null,
        uploaderName: opts.uploaderName || 'System',
        entityType: opts.entityType || '',
        entityId: opts.entityId ? String(opts.entityId) : '',
      })
    );

    const url = `/api/v1/storage/files/${fileDoc._id}/download`;

    return {
      fileId: fileDoc._id,
      storagePath,
      url,
      publicId: fileDoc._id,
      sizeBytes,
      category,
      fileName: uniqueName,
      originalName: fileDoc.originalName,
      mimeType: fileDoc.mimeType,
    };
  } catch (err) {
    // Roll back reserved quota on upload failure
    await applySchoolStorageDelta(schoolId, -sizeBytes, -1, category, { enforceLimit: false }).catch(() => {});
    throw err;
  }
}

/**
 * Central delete function. Deletes from Firebase Storage (or local disk),
 * removes StorageFile metadata, and atomically decrements school usage counters.
 */
export async function deleteFile(storagePathOrFileId, { schoolId = null, bypassTenant = false } = {}) {
  if (!storagePathOrFileId) return null;

  const targetSchoolId = schoolId || getCurrentSchoolId();
  const findFn = async () => {
    let doc = await StorageFile.findById(storagePathOrFileId).lean();
    if (!doc) {
      doc = await StorageFile.findOne({ storagePath: storagePathOrFileId }).lean();
    }
    return doc;
  };

  const fileDoc = bypassTenant
    ? await runWithoutTenant(findFn)
    : targetSchoolId
      ? await runWithTenant(targetSchoolId, findFn)
      : await findFn();

  if (!fileDoc) {
    // Fallback: if a raw storagePath was passed without a StorageFile doc, still try deleting the physical file
    if (String(storagePathOrFileId).startsWith('schools/')) {
      const bucket = getStorageBucket();
      if (bucket) {
        await bucket.file(storagePathOrFileId).delete({ ignoreNotFound: true }).catch(() => {});
      } else {
        const localPath = path.join(LOCAL_UPLOADS_ROOT, storagePathOrFileId);
        await fs.unlink(localPath).catch(() => {});
      }
    }
    return null;
  }

  if (!bypassTenant && targetSchoolId && String(fileDoc.schoolId) !== String(targetSchoolId)) {
    throw new ApiError(403, 'Access denied to this school file', 'FORBIDDEN');
  }

  const bucket = getStorageBucket();
  if (bucket) {
    await bucket.file(fileDoc.storagePath).delete({ ignoreNotFound: true }).catch(() => {});
  } else {
    const localPath = path.join(LOCAL_UPLOADS_ROOT, fileDoc.storagePath);
    await fs.unlink(localPath).catch(() => {});
  }

  await runWithoutTenant(() => StorageFile.findByIdAndDelete(fileDoc._id));
  await applySchoolStorageDelta(fileDoc.schoolId, -Number(fileDoc.sizeBytes || 0), -1, fileDoc.category, {
    enforceLimit: false,
  });

  return fileDoc;
}

/**
 * Generates a signed URL (Cloud) or authenticated download URL (Local)
 * after verifying the caller's role and school ownership.
 */
export async function getSignedUrl(storagePathOrFileId, { schoolId = null, role = '', expiresInMinutes = 15 } = {}) {
  const fileDoc = await runWithoutTenant(async () => {
    let doc = await StorageFile.findById(storagePathOrFileId).lean();
    if (!doc) {
      doc = await StorageFile.findOne({ storagePath: storagePathOrFileId }).lean();
    }
    return doc;
  });

  if (!fileDoc) {
    throw new ApiError(404, 'File not found', 'NOT_FOUND');
  }

  if (role !== 'super_admin' && String(fileDoc.schoolId) !== String(schoolId)) {
    throw new ApiError(403, 'Access denied to this school file', 'FORBIDDEN');
  }

  const bucket = getStorageBucket();
  if (bucket) {
    const [signedUrl] = await bucket.file(fileDoc.storagePath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    });
    return { url: signedUrl, file: fileDoc, mode: 'signed' };
  }

  return {
    url: `/api/v1/storage/files/${fileDoc._id}/download`,
    file: fileDoc,
    mode: 'local',
  };
}

export async function getLocalFileForDownload(fileId, { schoolId = null, role = '' } = {}) {
  const fileDoc = await runWithoutTenant(() => StorageFile.findById(fileId).lean());
  if (!fileDoc) {
    throw new ApiError(404, 'File not found', 'NOT_FOUND');
  }
  if (role !== 'super_admin' && String(fileDoc.schoolId) !== String(schoolId)) {
    throw new ApiError(403, 'Access denied to this school file', 'FORBIDDEN');
  }

  const bucket = getStorageBucket();
  if (bucket) {
    const [signedUrl] = await bucket.file(fileDoc.storagePath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000,
    });
    return { redirectUrl: signedUrl, file: fileDoc };
  }

  const fullPath = path.join(LOCAL_UPLOADS_ROOT, fileDoc.storagePath);
  if (!fsSync.existsSync(fullPath)) {
    throw new ApiError(404, 'File missing from storage', 'FILE_MISSING');
  }
  return { fullPath, file: fileDoc };
}

async function walkLocalDir(dirPath) {
  const results = [];
  if (!fsSync.existsSync(dirPath)) return results;
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walkLocalDir(full)));
    } else if (entry.isFile()) {
      const stat = await fs.stat(full);
      results.push({ fullPath: full, sizeBytes: stat.size });
    }
  }
  return results;
}

/**
 * Lists all physical files under `schools/{schoolId}/` in Firebase Storage (or local disk),
 * sums their sizes by category, overwrites the School counters with true values, and logs any discrepancy.
 */
export async function recalculateSchoolUsage(schoolId) {
  const school = await runWithoutTenant(() => School.findById(schoolId).populate('planId'));
  if (!school) {
    throw new ApiError(404, 'School not found', 'NOT_FOUND');
  }

  const prefix = `schools/${school._id}/`;
  const byCat = emptyCategoryUsage();
  let trueBytes = 0;
  let trueCount = 0;

  const bucket = getStorageBucket();
  if (bucket) {
    const [files] = await bucket.getFiles({ prefix });
    for (const f of files) {
      if (f.name.endsWith('/')) continue;
      const [meta] = await f.getMetadata();
      const size = Number(meta.size || 0);
      const rel = f.name.slice(prefix.length);
      const cat = normalizeCategory(rel.split('/')[0]);
      byCat[cat] += size;
      trueBytes += size;
      trueCount += 1;
    }
  } else {
    const schoolDir = path.join(LOCAL_UPLOADS_ROOT, 'schools', String(school._id));
    const files = await walkLocalDir(schoolDir);
    for (const f of files) {
      const rel = path.relative(schoolDir, f.fullPath).replace(/\\/g, '/');
      const cat = normalizeCategory(rel.split('/')[0]);
      byCat[cat] += f.sizeBytes;
      trueBytes += f.sizeBytes;
      trueCount += 1;
    }
  }

  const prevBytes = Number(school.storageUsedBytes || 0);
  const prevCount = Number(school.fileCount || 0);
  const diffBytes = trueBytes - prevBytes;
  const diffCount = trueCount - prevCount;

  if (diffBytes !== 0 || diffCount !== 0) {
    console.log(
      `[Storage Reconciliation] School ${school.name} (${school._id}): corrected bytes ${prevBytes} -> ${trueBytes} (diff ${diffBytes}), files ${prevCount} -> ${trueCount}`
    );
  }

  const limitBytes = resolveSchoolStorageLimitBytes(school);
  school.storageLimitBytes = limitBytes;
  school.storageUsedBytes = trueBytes;
  school.fileCount = trueCount;
  school.storageUsageByCategory = byCat;
  school.lastStorageSyncAt = new Date().toISOString();
  await runWithoutTenant(() => school.save());

  return {
    schoolId: school._id,
    schoolName: school.name,
    previousBytes: prevBytes,
    previousCount: prevCount,
    storageUsedBytes: trueBytes,
    fileCount: trueCount,
    storageLimitBytes: limitBytes,
    storageUsageByCategory: byCat,
    diffBytes,
    diffCount,
    lastStorageSyncAt: school.lastStorageSyncAt,
  };
}

export async function recordDailyStorageSnapshots() {
  const schools = await runWithoutTenant(() => School.find({ softDeletedAt: null }).lean());
  const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  for (const school of schools) {
    await runWithTenant(school._id, async () => {
      await StorageSnapshot.findOneAndUpdate(
        { schoolId: String(school._id), date: dateKey },
        {
          schoolId: String(school._id),
          date: dateKey,
          storageUsedBytes: Number(school.storageUsedBytes || 0),
          storageLimitBytes: resolveSchoolStorageLimitBytes(school),
          fileCount: Number(school.fileCount || 0),
          storageUsageByCategory: { ...emptyCategoryUsage(), ...(school.storageUsageByCategory || {}) },
        },
        { upsert: true, new: true }
      );
    });
  }

  return { date: dateKey, schoolsSnapshotted: schools.length };
}
