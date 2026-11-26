import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { connectDB, disconnectDB } from '../config/db.js';
import { createApp } from '../app.js';
import { runSeed } from '../seeds/seed.js';

let app;
let accessToken;
let refreshToken;

describe('Phase 1: Health, Auth & RBAC', () => {
  before(async () => {
    await connectDB();
    await runSeed({ closeConnection: false });
    app = createApp();
  });

  after(async () => {
    await disconnectDB();
  });

  it('GET /api/health returns 200 ok envelope', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'ok');
  });

  it('POST /api/v1/auth/login rejects invalid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@greenfield.edu', password: 'WrongPassword!' });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  });

  it('POST /api/v1/auth/login succeeds for seeded admin', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@greenfield.edu', password: 'Password@123' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.role, 'school_admin');
    assert.ok(res.body.data.accessToken);
    assert.ok(res.body.data.refreshToken);
    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('GET /api/v1/auth/me requires valid bearer token', async () => {
    const unauth = await request(app).get('/api/v1/auth/me');
    assert.equal(unauth.status, 401);

    const auth = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(auth.status, 200);
    assert.equal(auth.body.data.user.email, 'admin@greenfield.edu');
  });

  it('POST /api/v1/auth/refresh rotates tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.accessToken);
    assert.ok(res.body.data.refreshToken);
  });
});
