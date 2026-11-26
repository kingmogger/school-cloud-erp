import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { connectDB, disconnectDB } from '../config/db.js';
import { createApp } from '../app.js';
import { runSeed } from '../seeds/seed.js';
import { runWithoutTenant } from '../utils/tenantContext.js';
import { School } from '../models/School.js';
import { uploadFile, deleteFile, LOCAL_UPLOADS_ROOT } from '../services/storage.service.js';

let app;
let superToken;
let gfAdminToken;
let oakAdminToken;
let greenfield;
let oakridge;

function makeMockFile(name = 'notes.pdf', sizeBytes = 1024, mimetype = 'application/pdf') {
  return {
    originalname: name,
    mimetype,
    size: sizeBytes,
    buffer: Buffer.alloc(sizeBytes, 'a'),
  };
}

describe('Per-School Storage Tracking, Limits, Reconciliation & Isolation', () => {
  before(async () => {
    await connectDB();
    await runSeed({ closeConnection: false });
    app = createApp();

    const login = async (email) =>
      (await request(app).post('/api/v1/auth/login').send({ email, password: 'Password@123' })).body.data.accessToken;

    superToken = await login('superadmin@schoolcloud.io');
    gfAdminToken = await login('admin@greenfield.edu');
    oakAdminToken = await login('admin@oakridge.edu');

    await runWithoutTenant(async () => {
      greenfield = await School.findOne({ code: 'GREENFIELD' }).lean();
      oakridge = await School.findOne({ code: 'OAKRIDGE' }).lean();
      await fs.rm(path.join(LOCAL_UPLOADS_ROOT, 'schools', String(greenfield._id)), { recursive: true, force: true });
      // Reset storage counters cleanly for test
      await School.findByIdAndUpdate(greenfield._id, {
        storageLimitBytes: 1024 * 1024, // 1 MB
        storageUsedBytes: 0,
        fileCount: 0,
        storageUsageByCategory: {},
      });
    });
  });

  after(async () => {
    await disconnectDB();
  });

  it('increments counters on upload and decrements on delete', async () => {
    const file = makeMockFile('syllabus.pdf', 4096);
    const uploaded = await uploadFile(file, {
      schoolId: greenfield._id,
      category: 'study-materials',
      uploaderName: 'Test Faculty',
    });

    assert.ok(uploaded.storagePath.startsWith(`schools/${greenfield._id}/study-materials/`));

    const afterUpload = await runWithoutTenant(() => School.findById(greenfield._id).lean());
    assert.equal(afterUpload.storageUsedBytes, 4096);
    assert.equal(afterUpload.fileCount, 1);
    assert.equal(afterUpload.storageUsageByCategory['study-materials'], 4096);

    await deleteFile(uploaded.fileId, { schoolId: greenfield._id });
    const afterDelete = await runWithoutTenant(() => School.findById(greenfield._id).lean());
    assert.equal(afterDelete.storageUsedBytes, 0);
    assert.equal(afterDelete.fileCount, 0);
    assert.equal(afterDelete.storageUsageByCategory['study-materials'], 0);
  });

  it('blocks upload with HTTP 413 STORAGE_LIMIT_EXCEEDED when limit would be exceeded', async () => {
    await runWithoutTenant(() =>
      School.findByIdAndUpdate(greenfield._id, {
        storageLimitBytes: 2048,
        storageUsedBytes: 1500,
      })
    );

    const oversized = makeMockFile('big.pdf', 1024);
    await assert.rejects(
      () =>
        uploadFile(oversized, {
          schoolId: greenfield._id,
          category: 'assignments',
        }),
      (err) => err.statusCode === 413 && err.code === 'STORAGE_LIMIT_EXCEEDED'
    );

    // Restore 1 MB limit
    await runWithoutTenant(() =>
      School.findByIdAndUpdate(greenfield._id, {
        storageLimitBytes: 1024 * 1024,
        storageUsedBytes: 0,
      })
    );
  });

  it('recalculation fixes a corrupted counter to match physical files', async () => {
    const uploaded = await uploadFile(makeMockFile('chapter1.pdf', 2048), {
      schoolId: greenfield._id,
      category: 'study-materials',
    });

    // Corrupt counter
    await runWithoutTenant(() =>
      School.findByIdAndUpdate(greenfield._id, {
        storageUsedBytes: 999999,
        fileCount: 42,
      })
    );

    const res = await request(app)
      .post(`/api/v1/superadmin/storage/schools/${greenfield._id}/recalculate`)
      .set('Authorization', `Bearer ${superToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.storageUsedBytes, 2048);
    assert.equal(res.body.data.fileCount, 1);

    await deleteFile(uploaded.fileId, { schoolId: greenfield._id });
  });

  it('enforces tenant isolation: School A cannot see School B files or Super Admin storage routes', async () => {
    const gfFile = await uploadFile(makeMockFile('gf-secret.pdf', 1024), {
      schoolId: greenfield._id,
      category: 'assignments',
    });

    // School Admin cannot access Super Admin storage endpoint
    const superRes = await request(app)
      .get('/api/v1/superadmin/storage')
      .set('Authorization', `Bearer ${gfAdminToken}`);
    assert.equal(superRes.status, 403);

    // Oakridge Admin cannot get signed URL for Greenfield file
    const urlRes = await request(app)
      .get(`/api/v1/storage/files/${gfFile.fileId}/url`)
      .set('Authorization', `Bearer ${oakAdminToken}`);
    assert.equal(urlRes.status, 403);

    // Greenfield Admin can access their own storage meter
    const meterRes = await request(app)
      .get('/api/v1/admin/storage')
      .set('Authorization', `Bearer ${gfAdminToken}`);
    assert.equal(meterRes.status, 200);
    assert.equal(meterRes.body.data.schoolId, String(greenfield._id));

    await deleteFile(gfFile.fileId, { schoolId: greenfield._id });
  });
});
