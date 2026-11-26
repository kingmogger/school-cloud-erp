import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDB, disconnectDB } from '../config/db.js';
import { runSeed } from '../seeds/seed.js';
import { runWithTenant, runWithoutTenant } from '../utils/tenantContext.js';
import { School } from '../models/School.js';
import { Student } from '../models/Student.js';
import { Subject } from '../models/Subject.js';
import { Exam } from '../models/Exam.js';
import { Mark } from '../models/Mark.js';
import { Attendance } from '../models/Attendance.js';
import { User } from '../models/User.js';
import {
  resolveGrade,
  calculateStudentAttendance,
  calculateStudentGrades,
  evaluateStudentRisk,
} from '../services/intelligence/index.js';

describe('Phase 6: Academic Intelligence Engine', () => {
  let student;
  let adminUser;
  let subject;
  let exam;

  let schoolId;

  before(async () => {
    await connectDB();
    await runSeed({ closeConnection: false });
    await runWithoutTenant(async () => {
      const gf = await School.findOne({ code: 'GREENFIELD' }).lean();
      schoolId = gf._id;
      await runWithTenant(schoolId, async () => {
        adminUser = await User.findOne({ role: 'school_admin' }).lean();
        student = await Student.findOne({ admissionNo: 'ADM-2026-0001' }).lean();
        subject = await Subject.findOne({ code: 'MATH10' }).lean();
        exam = await Exam.findOneAndUpdate(
          { name: 'Mid-Term 2026', classId: student.classId },
          { schoolId, academicYearId: student.academicYearId, classId: student.classId, name: 'Mid-Term 2026', term: 'Mid-Term' },
          { upsert: true, new: true }
        );
      });
    });
  });

  after(async () => {
    await disconnectDB();
  });

  it('resolveGrade maps percentages to correct grade bands and GPA', () => {
    assert.equal(resolveGrade(95).grade, 'A+');
    assert.equal(resolveGrade(95).gpa, 4.0);
    assert.equal(resolveGrade(75).grade, 'B+');
    assert.equal(resolveGrade(32).grade, 'F');
    assert.equal(resolveGrade(32).gpa, 0.0);
  });

  it('detects attendance shortage below 75% and computes exact percentage', async () => {
    await runWithTenant(schoolId, async () => {
      await Attendance.deleteMany({ studentId: student._id });
      const base = new Date('2026-10-01');
      const docs = [];
      for (let i = 0; i < 10; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        docs.push({
          schoolId,
          studentId: student._id,
          classId: student.classId,
          sectionId: student.sectionId,
          subjectId: subject._id,
          date: d,
          status: i < 6 ? 'present' : 'absent', // 60%
          markedById: adminUser._id,
        });
      }
      await Attendance.insertMany(docs);

      const att = await calculateStudentAttendance({ studentId: student._id });
      assert.equal(att.total, 10);
      assert.equal(att.percentage, 60);
      assert.equal(att.isShortage, true);
    });
  });

  it('evaluates high risk alert when attendance is <65% and marks fail', async () => {
    await runWithTenant(schoolId, async () => {
      await Mark.deleteMany({ studentId: student._id });
      await Mark.findOneAndUpdate(
        { examId: exam._id, studentId: student._id, subjectId: subject._id },
        {
          schoolId,
          examId: exam._id,
          studentId: student._id,
          subjectId: subject._id,
          marksObtained: 28,
          maxMarks: 100,
          enteredById: adminUser._id,
        },
        { upsert: true, new: true }
      );

      const grades = await calculateStudentGrades({ studentId: student._id, examId: exam._id });
      assert.equal(grades.overallGrade, 'F');

      const alert = await evaluateStudentRisk(student._id);
      assert.equal(alert.level, 'high');
      assert.ok(alert.score >= 65);
      assert.ok(alert.reasons.length >= 2);
    });
  });
});
