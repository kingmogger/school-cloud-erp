import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDB, disconnectDB } from '../config/db.js';
import { runWithoutTenant, runWithTenant } from '../utils/tenantContext.js';
import { migrateToMultiTenant } from '../scripts/migrateToMultiTenant.js';
import { School } from '../models/School.js';
import { SubscriptionPlan } from '../models/SubscriptionPlan.js';
import { PlatformSettings } from '../models/PlatformSettings.js';
import { PlatformPayment } from '../models/PlatformPayment.js';
import { User } from '../models/User.js';
import { AcademicYear } from '../models/AcademicYear.js';
import { SchoolSettings } from '../models/SchoolSettings.js';
import { Class } from '../models/Class.js';
import { Section } from '../models/Section.js';
import { Subject } from '../models/Subject.js';
import { Faculty } from '../models/Faculty.js';
import { Student } from '../models/Student.js';
import { Parent } from '../models/Parent.js';

async function seedSchoolData({ school, adminEmail, adminName, prefix, passHash }) {
  return runWithTenant(school._id, async () => {
    let academicYear = await AcademicYear.findOne({ name: '2026-2027' });
    if (!academicYear) {
      academicYear = await AcademicYear.create({
        schoolId: school._id,
        name: '2026-2027',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2027-03-31'),
        isCurrent: true,
      });
    }

    const existingSettings = await SchoolSettings.findOne();
    if (!existingSettings) {
      await SchoolSettings.create({
        schoolId: school._id,
        schoolName: school.name,
        email: school.email,
        currentAcademicYearId: academicYear._id,
      });
    }

    await User.findOneAndUpdate(
      { email: adminEmail },
      {
        name: adminName,
        email: adminEmail,
        passwordHash: passHash,
        role: 'school_admin',
        schoolId: school._id,
        phone: '+1-555-0101',
        isActive: true,
      },
      { upsert: true, new: true }
    );

    const domain = school.code === 'GREENFIELD' ? 'greenfield.edu' : 'oakridge.edu';
    const facultySpecs = [
      { name: `Prof. Marcus Reed (${prefix})`, email: `marcus.${prefix}@${domain}`, employeeId: `FAC-1001`, department: 'Mathematics', qualification: 'M.Sc. Mathematics' },
      { name: `Ms. Priya Nair (${prefix})`, email: `priya.${prefix}@${domain}`, employeeId: `FAC-1002`, department: 'Science', qualification: 'M.Sc. Physics' },
    ];

    const facultyDocs = [];
    for (const spec of facultySpecs) {
      const user = await User.findOneAndUpdate(
        { email: spec.email },
        { name: spec.name, email: spec.email, passwordHash: passHash, role: 'faculty', schoolId: school._id, isActive: true },
        { upsert: true, new: true }
      );
      const faculty = await Faculty.findOneAndUpdate(
        { employeeId: spec.employeeId, schoolId: school._id },
        {
          schoolId: school._id,
          userId: user._id,
          employeeId: spec.employeeId,
          department: spec.department,
          qualification: spec.qualification,
          designation: 'Senior Lecturer',
        },
        { upsert: true, new: true }
      );
      facultyDocs.push(faculty);
    }

    const class10 = await Class.findOneAndUpdate(
      { name: 'Grade 10', academicYearId: academicYear._id },
      { schoolId: school._id, name: 'Grade 10', numericLevel: 10, academicYearId: academicYear._id },
      { upsert: true, new: true }
    );

    const sec10A = await Section.findOneAndUpdate(
      { classId: class10._id, name: 'A' },
      { schoolId: school._id, classId: class10._id, name: 'A', classTeacherId: facultyDocs[0]._id, capacity: 35 },
      { upsert: true, new: true }
    );

    await Subject.findOneAndUpdate(
      { code: 'MATH10', classId: class10._id },
      { schoolId: school._id, name: 'Mathematics', code: 'MATH10', classId: class10._id, facultyId: facultyDocs[0]._id },
      { upsert: true, new: true }
    );
    await Subject.findOneAndUpdate(
      { code: 'PHY10', classId: class10._id },
      { schoolId: school._id, name: 'Physics', code: 'PHY10', classId: class10._id, facultyId: facultyDocs[1]._id },
      { upsert: true, new: true }
    );

    const parentUser = await User.findOneAndUpdate(
      { email: `parent.${prefix}@${domain}` },
      { name: `Sarah Johnson (${prefix})`, email: `parent.${prefix}@${domain}`, passwordHash: passHash, role: 'parent', schoolId: school._id, isActive: true },
      { upsert: true, new: true }
    );
    const parent = await Parent.findOneAndUpdate(
      { userId: parentUser._id },
      { schoolId: school._id, userId: parentUser._id, occupation: 'Architect', address: '42 Oakwood Ave' },
      { upsert: true, new: true }
    );

    const parentUser2 = await User.findOneAndUpdate(
      { email: `parent2.${prefix}@${domain}` },
      { name: `Robert Patel (${prefix})`, email: `parent2.${prefix}@${domain}`, passwordHash: passHash, role: 'parent', schoolId: school._id, isActive: true },
      { upsert: true, new: true }
    );
    const parent2 = await Parent.findOneAndUpdate(
      { userId: parentUser2._id },
      { schoolId: school._id, userId: parentUser2._id, occupation: 'Engineer', address: '88 Maple St' },
      { upsert: true, new: true }
    );

    const stuSpecs = [
      { name: `Liam Johnson (${prefix})`, email: `liam.${prefix}@${domain}`, admissionNo: 'ADM-2026-0001', rollNo: '10A-01', gender: 'male', parent },
      { name: `Aarav Patel (${prefix})`, email: `aarav.${prefix}@${domain}`, admissionNo: 'ADM-2026-0002', rollNo: '10A-02', gender: 'male', parent: parent2 },
    ];

    for (const st of stuSpecs) {
      const stuUser = await User.findOneAndUpdate(
        { email: st.email },
        { name: st.name, email: st.email, passwordHash: passHash, role: 'student', schoolId: school._id, isActive: true },
        { upsert: true, new: true }
      );
      const student = await Student.findOneAndUpdate(
        { admissionNo: st.admissionNo, schoolId: school._id },
        {
          schoolId: school._id,
          userId: stuUser._id,
          admissionNo: st.admissionNo,
          rollNo: st.rollNo,
          classId: class10._id,
          sectionId: sec10A._id,
          academicYearId: academicYear._id,
          gender: st.gender,
          parentIds: [st.parent._id],
          status: 'active',
        },
        { upsert: true, new: true }
      );
      await Parent.findByIdAndUpdate(st.parent._id, { $addToSet: { children: student._id } });
      if (st.parent._id.toString() !== parent._id.toString()) {
        await Parent.findByIdAndUpdate(parent._id, { $pull: { children: student._id } });
      }
    }
  });
}

export async function runSeed({ closeConnection = true } = {}) {
  const db = await connectDB();
  if (!db) {
    throw new Error('Database initialization failed. Ensure Firebase is configured.');
  }
  // First run idempotent migration so any legacy records are cleanly assigned
  await migrateToMultiTenant({ closeConnection: false });

  await runWithoutTenant(async () => {
    const passHash = await User.hashPassword('Password@123');

    await PlatformSettings.findOneAndUpdate(
      {},
      { platformName: 'SchoolCloud SaaS', defaultTrialDays: 14, gracePeriodDays: 7 },
      { upsert: true, new: true }
    );

    const starterPlan = await SubscriptionPlan.findOneAndUpdate(
      { code: 'STARTER-MONTHLY' },
      { name: 'Starter Plan', code: 'STARTER-MONTHLY', price: 99, billingCycle: 'monthly', maxStudents: 150, maxFaculty: 20, storageLimitMb: 2048 },
      { upsert: true, new: true }
    );
    const proPlan = await SubscriptionPlan.findOneAndUpdate(
      { code: 'PRO-MONTHLY' },
      { name: 'Pro Plan', code: 'PRO-MONTHLY', price: 199, billingCycle: 'monthly', maxStudents: 1000, maxFaculty: 100, storageLimitMb: 10240 },
      { upsert: true, new: true }
    );

    // 1. Super Admin (Platform Owner, no schoolId)
    await User.findOneAndUpdate(
      { email: 'superadmin@schoolcloud.io' },
      {
        name: 'Platform Owner',
        email: 'superadmin@schoolcloud.io',
        passwordHash: passHash,
        role: 'super_admin',
        schoolId: null,
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // 2. Active School: GREENFIELD
    const greenfield = await School.findOneAndUpdate(
      { code: 'GREENFIELD' },
      {
        name: 'Greenfield International School',
        code: 'GREENFIELD',
        email: 'office@greenfield.edu',
        contactPerson: 'Dr. Elena Vance',
        phone: '+1-555-0100',
        status: 'active',
        subscriptionStatus: 'active',
        planId: proPlan._id,
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        manualSuspension: { isSuspended: false, reason: '' },
      },
      { upsert: true, new: true }
    );

    // 3. Suspended School: OAKRIDGE
    const oakridge = await School.findOneAndUpdate(
      { code: 'OAKRIDGE' },
      {
        name: 'Oakridge Academy',
        code: 'OAKRIDGE',
        email: 'office@oakridge.edu',
        contactPerson: 'Mr. Arthur Pendelton',
        phone: '+1-555-0200',
        status: 'suspended',
        subscriptionStatus: 'suspended',
        planId: starterPlan._id,
        endDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        manualSuspension: {
          isSuspended: true,
          reason: 'Overdue monthly subscription invoice',
          suspendedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    // Sample platform payment for Greenfield
    await PlatformPayment.findOneAndUpdate(
      { invoiceNo: 'INV-2026-0001' },
      {
        schoolId: greenfield._id,
        planId: proPlan._id,
        invoiceNo: 'INV-2026-0001',
        amount: 199,
        method: 'bank_transfer',
        reference: 'TXN-GF-001',
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        status: 'paid',
      },
      { upsert: true, new: true }
    );

    await seedSchoolData({
      school: greenfield,
      adminEmail: 'admin@greenfield.edu',
      adminName: 'Dr. Elena Vance',
      prefix: 'gf',
      passHash,
    });

    await seedSchoolData({
      school: oakridge,
      adminEmail: 'admin@oakridge.edu',
      adminName: 'Mr. Arthur Pendelton',
      prefix: 'oak',
      passHash,
    });

    console.log('Multi-tenant SaaS seed completed (Password@123).');
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
  runSeed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
