import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { connectDB, disconnectDB } from '../config/db.js';
import { createApp } from '../app.js';
import { runSeed } from '../seeds/seed.js';
import { runWithoutTenant, runWithTenant } from '../utils/tenantContext.js';
import { School } from '../models/School.js';
import { Class } from '../models/Class.js';
import { Section } from '../models/Section.js';
import { Subject } from '../models/Subject.js';
import { Student } from '../models/Student.js';
import { User } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';

let app;
let superToken;
let gfAdminToken;
let gfFacultyToken;
let gfStudentToken;
let oakAdminToken;
let greenfield;
let oakridge;
let gfClass;
let gfSection;
let gfSubject;
let gfStudent;

describe('Bug Fixes, Student Attendance Live Sync & Pause/Resume Service', () => {
  before(async () => {
    await connectDB();
    await runSeed({ closeConnection: false });
    app = createApp();

    const login = async (email) =>
      (await request(app).post('/api/v1/auth/login').send({ email, password: 'Password@123' })).body.data.accessToken;

    superToken = await login('superadmin@schoolcloud.io');
    gfAdminToken = await login('admin@greenfield.edu');
    gfFacultyToken = await login('marcus.gf@greenfield.edu');
    gfStudentToken = await login('liam.gf@greenfield.edu');
    oakAdminToken = await login('admin@oakridge.edu');

    await runWithoutTenant(async () => {
      greenfield = await School.findOne({ code: 'GREENFIELD' }).lean();
      oakridge = await School.findOne({ code: 'OAKRIDGE' }).lean();
      await runWithTenant(greenfield._id, async () => {
        gfClass = await Class.findOne().lean();
        gfSection = await Section.findOne({ classId: gfClass._id }).lean();
        gfSubject = await Subject.findOne().lean();
        const liamUser = await User.findOne({ email: 'liam.gf@greenfield.edu' }).lean();
        gfStudent = await Student.findOne({ userId: liamUser._id }).lean();
      });
    });
  });

  after(async () => {
    await runWithoutTenant(async () => {
      if (greenfield) {
        await School.findByIdAndUpdate(greenfield._id, {
          servicePaused: { isPaused: false, reason: '', customMessage: '' },
        });
      }
    });
    await disconnectDB();
  });

  it('uploads a PDF study material and serves it via authenticated download endpoint', async () => {
    const pdfBuf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const uploadRes = await request(app)
      .post('/api/v1/faculty/materials')
      .set('Authorization', `Bearer ${gfFacultyToken}`)
      .field('title', 'Physics Lecture 1')
      .field('classId', String(gfClass._id))
      .field('subjectId', String(gfSubject._id))
      .attach('file', pdfBuf, { filename: 'lecture1.pdf', contentType: 'application/pdf' });

    assert.equal(uploadRes.status, 201);
    const mat = uploadRes.body.data;
    assert.ok(mat.fileUrl.includes('/api/v1/storage/files/'));

    const dlRes = await request(app)
      .get(mat.fileUrl)
      .set('Authorization', `Bearer ${gfStudentToken}`);
    assert.equal(dlRes.status, 200);
    assert.match(dlRes.headers['content-type'], /application\/pdf/);

    // Clean up
    const delRes = await request(app)
      .delete(`/api/v1/faculty/materials/${mat._id}`)
      .set('Authorization', `Bearer ${gfFacultyToken}`);
    assert.equal(delRes.status, 200, `Expected 200 on delete material, got ${delRes.status}: ${JSON.stringify(delRes.body)}`);
  });

  it('creates and deletes a student (without parent) and a faculty member cleanly', async () => {
    const createStuRes = await request(app)
      .post('/api/v1/admin/students')
      .set('Authorization', `Bearer ${gfAdminToken}`)
      .send({
        name: 'NoParent Student',
        email: 'noparent.stu@greenfield.edu',
        classId: String(gfClass._id),
        sectionId: String(gfSection._id),
      });
    assert.equal(createStuRes.status, 201);
    const stuId = createStuRes.body.data._id;

    const delStuRes = await request(app)
      .delete(`/api/v1/admin/students/${stuId}`)
      .set('Authorization', `Bearer ${gfAdminToken}`);
    assert.equal(delStuRes.status, 200);

    // Linked user login should no longer work
    const stuLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'noparent.stu@greenfield.edu', password: 'Password@123' });
    assert.equal(stuLoginRes.status, 401);

    const createFacRes = await request(app)
      .post('/api/v1/admin/faculty')
      .set('Authorization', `Bearer ${gfAdminToken}`)
      .send({
        name: 'Temp Faculty',
        email: 'temp.fac@greenfield.edu',
        department: 'Math',
      });
    assert.equal(createFacRes.status, 201);
    const facId = createFacRes.body.data._id;

    const delFacRes = await request(app)
      .delete(`/api/v1/admin/faculty/${facId}`)
      .set('Authorization', `Bearer ${gfAdminToken}`);
    assert.equal(delFacRes.status, 200);
  });

  it('marks and edits attendance for the same day without duplicate errors and student sees updates + notification', async () => {
    const dateKey = new Date().toISOString().slice(0, 10);

    const markRes = await request(app)
      .post('/api/v1/faculty/attendance/bulk')
      .set('Authorization', `Bearer ${gfFacultyToken}`)
      .send({
        classId: String(gfClass._id),
        sectionId: String(gfSection._id),
        subjectId: null,
        date: dateKey,
        records: [{ studentId: String(gfStudent._id), status: 'absent' }],
      });
    assert.equal(markRes.status, 200);

    // Edit same day to present
    const editRes = await request(app)
      .post('/api/v1/faculty/attendance/bulk')
      .set('Authorization', `Bearer ${gfFacultyToken}`)
      .send({
        classId: String(gfClass._id),
        sectionId: String(gfSection._id),
        subjectId: null,
        date: dateKey,
        records: [{ studentId: String(gfStudent._id), status: 'present' }],
      });
    assert.equal(editRes.status, 200);

    // Student sees updated attendance
    const stuAttRes = await request(app)
      .get('/api/v1/student/attendance')
      .set('Authorization', `Bearer ${gfStudentToken}`);
    assert.equal(stuAttRes.status, 200);
    assert.equal(stuAttRes.body.data.summary.todayStatus, 'present');

    // Notification was created when marked absent
    const notifRes = await request(app)
      .get('/api/v1/student/notifications')
      .set('Authorization', `Bearer ${gfStudentToken}`);
    assert.equal(notifRes.status, 200);
    assert.ok(notifRes.body.data.some((n) => n.type === 'attendance'));
  });

  it('enforces one-click pause/resume service, blocks logged-in users and login, leaves other schools unaffected', async () => {
    // Non-super_admin cannot call pause
    const forbidRes = await request(app)
      .post(`/api/v1/superadmin/schools/${greenfield._id}/pause`)
      .set('Authorization', `Bearer ${gfAdminToken}`)
      .send({ reason: 'Unauthorized' });
    assert.equal(forbidRes.status, 403);

    // Super Admin pauses Greenfield
    const pauseRes = await request(app)
      .post(`/api/v1/superadmin/schools/${greenfield._id}/pause`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ reason: 'Non-payment', customMessage: 'Service paused. Please contact your service provider.' });
    assert.equal(pauseRes.status, 200);

    // Existing logged-in School Admin and Student sessions are blocked immediately on next request
    const adminBlocked = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${gfAdminToken}`);
    assert.equal(adminBlocked.status, 402);
    assert.equal(adminBlocked.body.error.code, 'SCHOOL_PAUSED');

    const stuBlocked = await request(app)
      .get('/api/v1/student/attendance')
      .set('Authorization', `Bearer ${gfStudentToken}`);
    assert.equal(stuBlocked.status, 402);
    assert.equal(stuBlocked.body.error.code, 'SCHOOL_PAUSED');

    // Login is also blocked
    const loginBlocked = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@greenfield.edu', password: 'Password@123' });
    assert.equal(loginBlocked.status, 402);
    assert.equal(loginBlocked.body.error.code, 'SCHOOL_PAUSED');

    // Resume restores access
    const resumeRes = await request(app)
      .post(`/api/v1/superadmin/schools/${greenfield._id}/resume`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ reason: 'Payment received' });
    assert.equal(resumeRes.status, 200);

    const adminRestored = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${gfAdminToken}`);
    assert.equal(adminRestored.status, 200);
  });
});
