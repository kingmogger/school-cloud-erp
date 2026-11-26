import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDB, disconnectDB } from '../config/db.js';
import { runWithoutTenant } from '../utils/tenantContext.js';
import { School } from '../models/School.js';
import { SubscriptionPlan } from '../models/SubscriptionPlan.js';
import { PlatformSettings } from '../models/PlatformSettings.js';
import { User } from '../models/User.js';
import { Student } from '../models/Student.js';
import { Faculty } from '../models/Faculty.js';
import { Parent } from '../models/Parent.js';
import { Class } from '../models/Class.js';
import { Section } from '../models/Section.js';
import { Subject } from '../models/Subject.js';
import { AcademicYear } from '../models/AcademicYear.js';
import { SchoolSettings } from '../models/SchoolSettings.js';
import { AuditLog } from '../models/AuditLog.js';
import { Attendance } from '../models/Attendance.js';
import { Exam } from '../models/Exam.js';
import { Mark } from '../models/Mark.js';
import { Assignment } from '../models/Assignment.js';
import { Submission } from '../models/Submission.js';
import { StudyMaterial } from '../models/StudyMaterial.js';
import { Remark } from '../models/Remark.js';
import { Timetable } from '../models/Timetable.js';
import { FeeStructure } from '../models/FeeStructure.js';
import { FeePayment } from '../models/FeePayment.js';
import { Notification } from '../models/Notification.js';
import { RiskAlert } from '../models/RiskAlert.js';

const TENANT_MODELS = [
  Student,
  Faculty,
  Parent,
  Class,
  Section,
  Subject,
  AcademicYear,
  SchoolSettings,
  AuditLog,
  Attendance,
  Exam,
  Mark,
  Assignment,
  Submission,
  StudyMaterial,
  Remark,
  Timetable,
  FeeStructure,
  FeePayment,
  Notification,
  RiskAlert,
];

export async function migrateToMultiTenant({ closeConnection = true } = {}) {
  const db = await connectDB();
  if (!db) {
    throw new Error('Database initialization failed. Ensure Firebase is configured.');
  }

  await runWithoutTenant(async () => {
    let settings = await PlatformSettings.findOne();
    if (!settings) {
      settings = await PlatformSettings.create({});
    }

    let plan = await SubscriptionPlan.findOne({ code: 'PRO-MONTHLY' });
    if (!plan) {
      plan = await SubscriptionPlan.create({
        name: 'Pro Plan',
        code: 'PRO-MONTHLY',
        price: 199,
        billingCycle: 'monthly',
        maxStudents: 1000,
        maxFaculty: 100,
        storageLimitMb: 10240,
      });
    }

    let defaultSchool = await School.findOne({ code: 'GREENFIELD' });
    if (!defaultSchool) {
      defaultSchool = await School.create({
        name: 'Greenfield International School',
        code: 'GREENFIELD',
        email: 'office@greenfield.edu',
        contactPerson: 'Dr. Elena Vance',
        phone: '+1-555-0100',
        address: '123 Academic Way, Knowledge City',
        status: 'active',
        subscriptionStatus: 'active',
        planId: plan._id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
    }

    // Migrate legacy 'admin' role to 'school_admin' and assign defaultSchool
    await User.updateMany(
      { role: 'admin' },
      { $set: { role: 'school_admin', schoolId: defaultSchool._id } }
    );

    await User.updateMany(
      { role: { $ne: 'super_admin' }, $or: [{ schoolId: { $exists: false } }, { schoolId: null }] },
      { $set: { schoolId: defaultSchool._id } }
    );

    for (const Model of TENANT_MODELS) {
      await Model.updateMany(
        { $or: [{ schoolId: { $exists: false } }, { schoolId: null }] },
        { $set: { schoolId: defaultSchool._id } }
      );
    }

    // Drop legacy global unique indexes that are now school-scoped
    const legacyDrops = [
      [Student, 'admissionNo_1'],
      [Faculty, 'employeeId_1'],
      [AcademicYear, 'name_1'],
      [Class, 'name_1_academicYearId_1'],
      [Section, 'classId_1_name_1'],
      [Subject, 'code_1_classId_1'],
      [Attendance, 'studentId_1_date_1_subjectId_1'],
      [Mark, 'examId_1_studentId_1_subjectId_1'],
      [Submission, 'assignmentId_1_studentId_1'],
      [Timetable, 'classId_1_sectionId_1_dayOfWeek_1'],
      [FeePayment, 'receiptNo_1'],
    ];

    for (const [Model, indexName] of legacyDrops) {
      try {
        await Model.collection.dropIndex(indexName);
      } catch {
        // Index doesn't exist — safe to ignore
      }
      await Model.syncIndexes();
    }

    console.log(`Migration complete. Default School ID: ${defaultSchool._id}`);
  });

  if (closeConnection) {
    await disconnectDB();
  }
}

const isEntrypoint = () => {
  if (!process.argv[1]) return false;
  try {
    return path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
  } catch {
    return false;
  }
};

if (isEntrypoint()) {
  migrateToMultiTenant().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
