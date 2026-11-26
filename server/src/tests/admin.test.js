import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { connectDB, disconnectDB } from '../config/db.js';
import { createApp } from '../app.js';
import { runSeed } from '../seeds/seed.js';

let app;
let adminToken;
let facultyToken;
let classId;
let sectionId;
let createdStudentId;

describe('Phase 2: Admin Module', () => {
  before(async () => {
    await connectDB();
    await runSeed({ closeConnection: false });
    app = createApp();

    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@greenfield.edu', password: 'Password@123' });
    adminToken = adminRes.body.data.accessToken;

    const facRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'marcus.gf@greenfield.edu', password: 'Password@123' });
    facultyToken = facRes.body.data.accessToken;
  });

  after(async () => {
    await disconnectDB();
  });

  it('blocks non-admin from /api/v1/admin/dashboard', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${facultyToken}`);
    assert.equal(res.status, 403);
  });

  it('returns admin dashboard stats', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.data.totalStudents >= 2);
    assert.ok(res.body.data.totalFaculty >= 2);
  });

  it('lists classes & sections and creates a student with auto admissionNo and parent link', async () => {
    const clsRes = await request(app).get('/api/v1/admin/classes').set('Authorization', `Bearer ${adminToken}`);
    classId = clsRes.body.data[0]._id;

    const secRes = await request(app).get(`/api/v1/admin/sections?classId=${classId}`).set('Authorization', `Bearer ${adminToken}`);
    sectionId = secRes.body.data[0]._id;

    const uniqueEmail = `test.stu.${Date.now()}@student.edu`;
    const parentEmail = `test.parent.${Date.now()}@parent.edu`;
    const createRes = await request(app)
      .post('/api/v1/admin/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Student',
        email: uniqueEmail,
        classId,
        sectionId,
        parentEmail,
        parentName: 'Test Parent',
      });

    assert.equal(createRes.status, 201);
    assert.match(createRes.body.data.admissionNo, /^ADM-\d{4}-\d{4}$/);
    createdStudentId = createRes.body.data._id;

    const delRes = await request(app)
      .delete(`/api/v1/admin/students/${createdStudentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(delRes.status, 200);
  });
});
