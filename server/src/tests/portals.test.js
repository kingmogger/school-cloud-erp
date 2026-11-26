import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { connectDB, disconnectDB } from '../config/db.js';
import { createApp } from '../app.js';
import { runSeed } from '../seeds/seed.js';
import { runWithTenant, runWithoutTenant } from '../utils/tenantContext.js';
import { School } from '../models/School.js';
import { Student } from '../models/Student.js';
import { Subject } from '../models/Subject.js';
import { Exam } from '../models/Exam.js';

let app;
let adminToken;
let facultyToken;
let studentToken;
let parentToken;
let liam;
let aarav;
let subject;
let exam;

describe('Phases 3-5: Faculty, Student, Parent Ownership, Fees & Reports', () => {
  before(async () => {
    await connectDB();
    await runSeed({ closeConnection: false });
    app = createApp();

    const login = async (email) =>
      (await request(app).post('/api/v1/auth/login').send({ email, password: 'Password@123' })).body.data.accessToken;

    adminToken = await login('admin@greenfield.edu');
    facultyToken = await login('marcus.gf@greenfield.edu');
    studentToken = await login('liam.gf@greenfield.edu');
    parentToken = await login('parent.gf@greenfield.edu');

    await runWithoutTenant(async () => {
      const gf = await School.findOne({ code: 'GREENFIELD' }).lean();
      await runWithTenant(gf._id, async () => {
        liam = await Student.findOne({ admissionNo: 'ADM-2026-0001' }).lean();
        aarav = await Student.findOne({ admissionNo: 'ADM-2026-0002' }).lean();
        subject = await Subject.findOne({ code: 'MATH10' }).lean();
        exam = await Exam.findOneAndUpdate(
          { name: 'Final 2026', classId: liam.classId },
          { schoolId: gf._id, academicYearId: liam.academicYearId, classId: liam.classId, name: 'Final 2026', term: 'Final' },
          { upsert: true, new: true }
        );
      });
    });
  });

  after(async () => {
    await disconnectDB();
  });

  it('Faculty can mark bulk attendance and save marks with maxMarks validation', async () => {
    const attRes = await request(app)
      .post('/api/v1/faculty/attendance/bulk')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        classId: liam.classId,
        sectionId: liam.sectionId,
        subjectId: subject._id,
        date: new Date().toISOString().slice(0, 10),
        records: [{ studentId: liam._id, status: 'present' }],
      });
    assert.equal(attRes.status, 200);

    const badMarks = await request(app)
      .post('/api/v1/faculty/marks/bulk')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        examId: exam._id,
        subjectId: subject._id,
        marks: [{ studentId: liam._id, marksObtained: 150, maxMarks: 100 }],
      });
    assert.equal(badMarks.status, 400);

    const goodMarks = await request(app)
      .post('/api/v1/faculty/marks/bulk')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        examId: exam._id,
        subjectId: subject._id,
        marks: [{ studentId: liam._id, marksObtained: 88, maxMarks: 100 }],
      });
    assert.equal(goodMarks.status, 200);
  });

  it('Student can view profile, results, and download PDF report card', async () => {
    const res = await request(app).get('/api/v1/student/results').set('Authorization', `Bearer ${studentToken}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 1);

    const pdfRes = await request(app)
      .get(`/api/v1/student/report-card/${exam._id}`)
      .set('Authorization', `Bearer ${studentToken}`);
    assert.equal(pdfRes.status, 200);
    assert.equal(pdfRes.headers['content-type'], 'application/pdf');
  });

  it('Parent can access linked child but gets 403 for unlinked child', async () => {
    const okRes = await request(app)
      .get(`/api/v1/parent/children/${liam._id}/overview`)
      .set('Authorization', `Bearer ${parentToken}`);
    assert.equal(okRes.status, 200);

    const forbiddenRes = await request(app)
      .get(`/api/v1/parent/children/${aarav._id}/overview`)
      .set('Authorization', `Bearer ${parentToken}`);
    assert.equal(forbiddenRes.status, 403);
  });

  it('Admin can create fee structure, record payment, download PDF receipt, and export CSV report', async () => {
    const fsRes = await request(app)
      .post('/api/v1/fees/structures')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        academicYearId: liam.academicYearId,
        classId: liam.classId,
        name: 'Term 1 Tuition',
        components: [{ name: 'Tuition', amount: 1200 }, { name: 'Lab', amount: 150 }],
        dueDate: '2026-12-31',
      });
    assert.equal(fsRes.status, 201);

    const payRes = await request(app)
      .post('/api/v1/fees/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        studentId: liam._id,
        feeStructureId: fsRes.body.data._id,
        amountPaid: 1350,
        paymentMethod: 'card',
      });
    assert.equal(payRes.status, 201);

    const receiptRes = await request(app)
      .get(`/api/v1/fees/payments/${payRes.body.data._id}/receipt`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(receiptRes.status, 200);
    assert.equal(receiptRes.headers['content-type'], 'application/pdf');

    const csvRes = await request(app)
      .get('/api/v1/reports/fees?format=csv')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(csvRes.status, 200);
    assert.match(csvRes.headers['content-type'], /text\/csv/);
  });
});
