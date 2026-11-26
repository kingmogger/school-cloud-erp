import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { connectDB, disconnectDB } from '../config/db.js';
import { createApp } from '../app.js';
import { runSeed } from '../seeds/seed.js';
import { runWithoutTenant, runWithTenant } from '../utils/tenantContext.js';
import { School } from '../models/School.js';
import { Student } from '../models/Student.js';
import { SubscriptionPlan } from '../models/SubscriptionPlan.js';

let app;
let superToken;
let gfAdminToken;
let gfFacultyToken;
let greenfield;
let oakridge;
let oakStudentId;

describe('SaaS Multi-Tenancy, Kill Switch, Plans & Role Isolation', () => {
  before(async () => {
    await connectDB();
    await runSeed({ closeConnection: false });
    app = createApp();

    const login = async (email) =>
      (await request(app).post('/api/v1/auth/login').send({ email, password: 'Password@123' })).body.data.accessToken;

    superToken = await login('superadmin@schoolcloud.io');
    gfAdminToken = await login('admin@greenfield.edu');
    gfFacultyToken = await login('marcus.gf@greenfield.edu');

    await runWithoutTenant(async () => {
      greenfield = await School.findOne({ code: 'GREENFIELD' }).lean();
      oakridge = await School.findOne({ code: 'OAKRIDGE' }).lean();
      const oakStu = await runWithTenant(oakridge._id, async () => Student.findOne().lean());
      oakStudentId = oakStu._id.toString();
    });
  });

  after(async () => {
    // Ensure GREENFIELD is restored active after tests
    await runWithoutTenant(async () => {
      if (greenfield) {
        await School.findByIdAndUpdate(greenfield._id, {
          status: 'active',
          subscriptionStatus: 'active',
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          manualSuspension: { isSuspended: false, reason: '' },
        });
      }
    });
    await disconnectDB();
  });

  it('blocks non-super_admin from /api/v1/superadmin routes', async () => {
    const res = await request(app)
      .get('/api/v1/superadmin/dashboard')
      .set('Authorization', `Bearer ${gfAdminToken}`);
    assert.equal(res.status, 403);
  });

  it('enforces tenant isolation: Greenfield admin cannot delete Oakridge student', async () => {
    const res = await request(app)
      .delete(`/api/v1/admin/students/${oakStudentId}`)
      .set('Authorization', `Bearer ${gfAdminToken}`);
    assert.equal(res.status, 404);
  });

  it('kill switch: suspending Greenfield blocks already-logged-in users immediately, and reactivating restores access', async () => {
    // 1. Suspend Greenfield
    const susp = await request(app)
      .post(`/api/v1/superadmin/schools/${greenfield._id}/suspend`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ reason: 'Non-payment test' });
    assert.equal(susp.status, 200);

    // 2. Existing faculty token is immediately blocked with 402 SCHOOL_SUSPENDED
    const blockedFac = await request(app)
      .get('/api/v1/faculty/analytics')
      .set('Authorization', `Bearer ${gfFacultyToken}`);
    assert.equal(blockedFac.status, 402);
    assert.equal(blockedFac.body.error.code, 'SCHOOL_SUSPENDED');

    // 3. Faculty login is also blocked
    const facLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'marcus.gf@greenfield.edu', password: 'Password@123' });
    assert.equal(facLogin.status, 402);

    // 4. School Admin is blocked on regular endpoints, but can read /admin/subscription
    const blockedAdmin = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${gfAdminToken}`);
    assert.equal(blockedAdmin.status, 402);

    const subPage = await request(app)
      .get('/api/v1/admin/subscription')
      .set('Authorization', `Bearer ${gfAdminToken}`);
    assert.equal(subPage.status, 200);
    assert.equal(subPage.body.data.statusInfo.isBlocked, true);

    // 5. Reactivate restores access immediately without losing data
    const react = await request(app)
      .post(`/api/v1/superadmin/schools/${greenfield._id}/reactivate`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ reason: 'Payment received' });
    assert.equal(react.status, 200);

    const restoredFac = await request(app)
      .get('/api/v1/faculty/analytics')
      .set('Authorization', `Bearer ${gfFacultyToken}`);
    assert.equal(restoredFac.status, 200);
  });

  it('grace period allows access with X-Subscription-Status: grace header', async () => {
    await runWithoutTenant(() =>
      School.findByIdAndUpdate(greenfield._id, {
        status: 'active',
        endDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days past endDate, within 7-day grace
        gracePeriodDays: 7,
      })
    );

    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${gfAdminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers['x-subscription-status'], 'grace');

    // Restore
    await runWithoutTenant(() =>
      School.findByIdAndUpdate(greenfield._id, {
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      })
    );
  });

  it('enforces plan student limit with 403 PLAN_LIMIT_REACHED', async () => {
    const tinyPlan = await SubscriptionPlan.findOneAndUpdate(
      { code: 'TINY-TEST' },
      { name: 'Tiny Test Plan', code: 'TINY-TEST', price: 10, maxStudents: 1, maxFaculty: 5 },
      { upsert: true, new: true }
    );

    await request(app)
      .post(`/api/v1/superadmin/schools/${greenfield._id}/change-plan`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ planId: tinyPlan._id });

    const clsRes = await request(app).get('/api/v1/admin/classes').set('Authorization', `Bearer ${gfAdminToken}`);
    const secRes = await request(app).get('/api/v1/admin/sections').set('Authorization', `Bearer ${gfAdminToken}`);

    const limitRes = await request(app)
      .post('/api/v1/admin/students')
      .set('Authorization', `Bearer ${gfAdminToken}`)
      .send({
        name: 'Blocked Student',
        email: `blocked.${Date.now()}@greenfield.edu`,
        classId: clsRes.body.data[0]._id,
        sectionId: secRes.body.data[0]._id,
      });
    assert.equal(limitRes.status, 403);
    assert.equal(limitRes.body.error.code, 'PLAN_LIMIT_REACHED');

    // Restore Pro plan
    const proPlan = await SubscriptionPlan.findOne({ code: 'PRO-MONTHLY' }).lean();
    await request(app)
      .post(`/api/v1/superadmin/schools/${greenfield._id}/change-plan`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ planId: proPlan._id });
  });

  it('supports Super Admin impersonation of School Admin and records PlatformAuditLog', async () => {
    const impRes = await request(app)
      .post(`/api/v1/superadmin/schools/${greenfield._id}/impersonate`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ reason: 'Support debugging' });
    assert.equal(impRes.status, 200);
    assert.ok(impRes.body.data.accessToken);
    assert.equal(impRes.body.data.user.role, 'school_admin');

    const logsRes = await request(app)
      .get('/api/v1/superadmin/audit-logs')
      .set('Authorization', `Bearer ${superToken}`);
    assert.equal(logsRes.status, 200);
    assert.ok(logsRes.body.data.some((l) => l.action === 'IMPERSONATE_SCHOOL_ADMIN'));
  });
});
