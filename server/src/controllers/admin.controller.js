import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Student } from '../models/Student.js';
import { Faculty } from '../models/Faculty.js';
import { Parent } from '../models/Parent.js';
import { Class } from '../models/Class.js';
import { Section } from '../models/Section.js';
import { Subject } from '../models/Subject.js';
import { AcademicYear } from '../models/AcademicYear.js';
import { SchoolSettings } from '../models/SchoolSettings.js';
import { School } from '../models/School.js';
import { PlatformPayment } from '../models/PlatformPayment.js';
import { PlatformSettings } from '../models/PlatformSettings.js';
import { AuditLog } from '../models/AuditLog.js';
import { Attendance } from '../models/Attendance.js';
import { FeePayment } from '../models/FeePayment.js';
import { computeEffectiveSchoolStatus } from '../services/subscription.service.js';
import { generatePlatformInvoiceBuffer } from '../services/pdf.service.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { recordAudit } from '../middleware/audit.js';
import { uploadFile } from '../services/storage.service.js';

async function generateAdmissionNo() {
  const year = new Date().getFullYear();
  const count = await Student.countDocuments();
  let seq = count + 1;
  while (true) {
    const candidate = `ADM-${year}-${String(seq).padStart(4, '0')}`;
    const exists = await Student.exists({ admissionNo: candidate });
    if (!exists) return candidate;
    seq += 1;
  }
}

async function generateEmployeeId() {
  const count = await Faculty.countDocuments();
  let seq = 1001 + count;
  while (true) {
    const candidate = `FAC-${seq}`;
    const exists = await Faculty.exists({ employeeId: candidate });
    if (!exists) return candidate;
    seq += 1;
  }
}

async function resolveAcademicYearId(providedId) {
  if (providedId) return providedId;
  const current = await AcademicYear.findOne({ isCurrent: true }).lean();
  if (current) return current._id;
  const latest = await AcademicYear.findOne().sort({ createdAt: -1 }).lean();
  if (!latest) throw new ApiError(400, 'No academic year configured', 'NO_ACADEMIC_YEAR');
  return latest._id;
}

export const getDashboard = asyncHandler(async (_req, res) => {
  const [totalStudents, totalFaculty, totalClasses, totalSubjects] = await Promise.all([
    Student.countDocuments({ status: 'active' }),
    Faculty.countDocuments({ status: 'active' }),
    Class.countDocuments(),
    Subject.countDocuments(),
  ]);

  let todayAttendance = { present: 0, absent: 0, late: 0, total: 0 };
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const attAgg = await Attendance.aggregate([
    { $match: { date: { $gte: start, $lte: end } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  for (const row of attAgg) {
    todayAttendance[row._id] = row.count;
    todayAttendance.total += row.count;
  }

  let fees = { collected: 0, pending: 0 };
  const feeAgg = await FeePayment.aggregate([
    { $group: { _id: '$status', total: { $sum: '$amountPaid' } } },
  ]);
  for (const row of feeAgg) {
    if (row._id === 'paid') fees.collected = row.total;
    if (row._id === 'pending' || row._id === 'partial') fees.pending += row.total;
  }

  return sendSuccess(res, {
    totalStudents,
    totalFaculty,
    totalClasses,
    totalSubjects,
    todayAttendance,
    fees,
  });
});

// ---------------- STUDENTS ----------------
export const listStudents = asyncHandler(async (req, res) => {
  const { page, limit, skip, search } = parsePagination(req.query);
  const filter = {};
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.sectionId) filter.sectionId = req.query.sectionId;
  if (req.query.status) filter.status = req.query.status;

  if (search) {
    const matchingUsers = await User.find({
      role: 'student',
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ],
    })
      .select('_id')
      .lean();
    const userIds = matchingUsers.map((u) => u._id);
    filter.$or = [
      { admissionNo: { $regex: search, $options: 'i' } },
      { rollNo: { $regex: search, $options: 'i' } },
      { userId: { $in: userIds } },
    ];
  }

  const [items, total] = await Promise.all([
    Student.find(filter)
      .populate('userId', 'name email phone avatarUrl isActive')
      .populate('classId', 'name numericLevel')
      .populate('sectionId', 'name')
      .populate({ path: 'parentIds', populate: { path: 'userId', select: 'name email phone' } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Student.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildPaginationMeta(total, page, limit));
});

export const createStudent = asyncHandler(async (req, res) => {
  const data = req.body;

  // Enforce plan student limit
  const school = await School.findById(req.user.schoolId).populate('planId').lean();
  if (school?.planId?.maxStudents) {
    const activeCount = await Student.countDocuments({ status: 'active' });
    if (activeCount >= school.planId.maxStudents) {
      throw new ApiError(
        403,
        `Plan limit reached (${school.planId.maxStudents} students on ${school.planId.name}). Please upgrade your subscription.`,
        'PLAN_LIMIT_REACHED'
      );
    }
  }

  const exists = await User.exists({ email: data.email.toLowerCase() });
  if (exists) {
    throw new ApiError(409, 'A user with this email already exists', 'EMAIL_EXISTS');
  }

  const academicYearId = await resolveAcademicYearId(data.academicYearId);
  const passwordHash = await User.hashPassword(data.password || 'Password@123');
  const admissionNo = await generateAdmissionNo();

  const stuUser = await User.create({
    name: data.name,
    email: data.email.toLowerCase(),
    passwordHash,
    role: 'student',
    phone: data.phone || '',
  });

  const parentIds = [];
  if (data.parentEmail) {
    let parentUser = await User.findOne({ email: data.parentEmail.toLowerCase() });
    if (!parentUser) {
      parentUser = await User.create({
        name: data.parentName || `${data.name}'s Parent`,
        email: data.parentEmail.toLowerCase(),
        passwordHash: await User.hashPassword('Password@123'),
        role: 'parent',
        phone: data.parentPhone || data.guardianPhone || '',
      });
    }
    let parentDoc = await Parent.findOne({ userId: parentUser._id });
    if (!parentDoc) {
      parentDoc = await Parent.create({ userId: parentUser._id, address: data.address || '' });
    }
    parentIds.push(parentDoc._id);
  }

  const student = await Student.create({
    userId: stuUser._id,
    admissionNo,
    rollNo: data.rollNo || '',
    classId: data.classId,
    sectionId: data.sectionId,
    academicYearId,
    dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
    gender: data.gender || 'other',
    bloodGroup: data.bloodGroup || '',
    address: data.address || '',
    guardianName: data.guardianName || data.parentName || '',
    guardianPhone: data.guardianPhone || data.parentPhone || '',
    parentIds,
  });

  if (parentIds.length > 0) {
    await Parent.updateMany({ _id: { $in: parentIds } }, { $addToSet: { children: student._id } });
  }

  const populated = await Student.findById(student._id)
    .populate('userId', 'name email phone')
    .populate('classId', 'name')
    .populate('sectionId', 'name')
    .lean();

  await recordAudit({ req, action: 'CREATE_STUDENT', entity: 'Student', entityId: student._id, after: { admissionNo } });
  return sendSuccess(res, populated, 201);
});

export const updateStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw new ApiError(404, 'Student not found', 'NOT_FOUND');

  const before = student.toObject();
  const { name, phone, ...studentFields } = req.body;
  if (name || phone !== undefined) {
    await User.findByIdAndUpdate(student.userId, { ...(name ? { name } : {}), ...(phone !== undefined ? { phone } : {}) });
  }
  Object.assign(student, studentFields);
  await student.save();

  const populated = await Student.findById(student._id)
    .populate('userId', 'name email phone')
    .populate('classId', 'name')
    .populate('sectionId', 'name')
    .lean();

  await recordAudit({ req, action: 'UPDATE_STUDENT', entity: 'Student', entityId: student._id, before, after: student.toObject() });
  return sendSuccess(res, populated);
});

export const deleteStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw new ApiError(404, 'Student not found', 'NOT_FOUND');

  await Parent.updateMany({ children: student._id }, { $pull: { children: student._id } });
  await User.findByIdAndDelete(student.userId);
  await student.deleteOne();

  await recordAudit({ req, action: 'DELETE_STUDENT', entity: 'Student', entityId: req.params.id, before: student.toObject() });
  return sendSuccess(res, { deleted: true });
});

// ---------------- FACULTY ----------------
export const listFaculty = asyncHandler(async (req, res) => {
  const { page, limit, skip, search } = parsePagination(req.query);
  const filter = {};
  if (req.query.department) filter.department = req.query.department;
  if (req.query.status) filter.status = req.query.status;

  if (search) {
    const users = await User.find({
      role: 'faculty',
      $or: [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }],
    })
      .select('_id')
      .lean();
    filter.$or = [
      { employeeId: { $regex: search, $options: 'i' } },
      { department: { $regex: search, $options: 'i' } },
      { userId: { $in: users.map((u) => u._id) } },
    ];
  }

  const [items, total] = await Promise.all([
    Faculty.find(filter)
      .populate('userId', 'name email phone avatarUrl isActive')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Faculty.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildPaginationMeta(total, page, limit));
});

export const createFaculty = asyncHandler(async (req, res) => {
  const data = req.body;

  // Enforce plan faculty limit
  const school = await School.findById(req.user.schoolId).populate('planId').lean();
  if (school?.planId?.maxFaculty) {
    const activeCount = await Faculty.countDocuments({ status: 'active' });
    if (activeCount >= school.planId.maxFaculty) {
      throw new ApiError(
        403,
        `Plan limit reached (${school.planId.maxFaculty} faculty on ${school.planId.name}). Please upgrade your subscription.`,
        'PLAN_LIMIT_REACHED'
      );
    }
  }

  const exists = await User.exists({ email: data.email.toLowerCase() });
  if (exists) throw new ApiError(409, 'Email already registered', 'EMAIL_EXISTS');

  const passwordHash = await User.hashPassword(data.password || 'Password@123');
  const employeeId = data.employeeId || (await generateEmployeeId());

  const user = await User.create({
    name: data.name,
    email: data.email.toLowerCase(),
    passwordHash,
    role: 'faculty',
    phone: data.phone || '',
  });

  const faculty = await Faculty.create({
    userId: user._id,
    employeeId,
    department: data.department,
    qualification: data.qualification,
    designation: data.designation,
  });

  const populated = await Faculty.findById(faculty._id).populate('userId', 'name email phone').lean();
  await recordAudit({ req, action: 'CREATE_FACULTY', entity: 'Faculty', entityId: faculty._id, after: { employeeId } });
  return sendSuccess(res, populated, 201);
});

export const updateFaculty = asyncHandler(async (req, res) => {
  const faculty = await Faculty.findById(req.params.id);
  if (!faculty) throw new ApiError(404, 'Faculty not found', 'NOT_FOUND');

  const { name, phone, ...fields } = req.body;
  if (name || phone !== undefined) {
    await User.findByIdAndUpdate(faculty.userId, { ...(name ? { name } : {}), ...(phone !== undefined ? { phone } : {}) });
  }
  Object.assign(faculty, fields);
  await faculty.save();

  const populated = await Faculty.findById(faculty._id).populate('userId', 'name email phone').lean();
  return sendSuccess(res, populated);
});

export const deleteFaculty = asyncHandler(async (req, res) => {
  const faculty = await Faculty.findById(req.params.id);
  if (!faculty) throw new ApiError(404, 'Faculty not found', 'NOT_FOUND');

  await Subject.updateMany({ facultyId: faculty._id }, { $set: { facultyId: null } });
  await Section.updateMany({ classTeacherId: faculty._id }, { $set: { classTeacherId: null } });
  await User.findByIdAndDelete(faculty.userId);
  await faculty.deleteOne();

  await recordAudit({ req, action: 'DELETE_FACULTY', entity: 'Faculty', entityId: req.params.id });
  return sendSuccess(res, { deleted: true });
});

// ---------------- CLASSES, SECTIONS, SUBJECTS, YEARS ----------------
export const listClasses = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.academicYearId) filter.academicYearId = req.query.academicYearId;
  const classes = await Class.find(filter).populate('academicYearId', 'name isCurrent').sort({ numericLevel: 1 }).lean();
  return sendSuccess(res, classes);
});

export const createClass = asyncHandler(async (req, res) => {
  const academicYearId = await resolveAcademicYearId(req.body.academicYearId);
  const cls = await Class.create({ ...req.body, academicYearId });
  return sendSuccess(res, cls, 201);
});

export const deleteClass = asyncHandler(async (req, res) => {
  const cls = await Class.findByIdAndDelete(req.params.id);
  if (!cls) throw new ApiError(404, 'Class not found', 'NOT_FOUND');
  await Section.deleteMany({ classId: cls._id });
  await Subject.deleteMany({ classId: cls._id });
  await recordAudit({ req, action: 'DELETE_CLASS', entity: 'Class', entityId: req.params.id });
  return sendSuccess(res, { deleted: true });
});

export const listSections = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.classId) filter.classId = req.query.classId;
  const sections = await Section.find(filter)
    .populate('classId', 'name numericLevel')
    .populate({ path: 'classTeacherId', populate: { path: 'userId', select: 'name email' } })
    .sort({ name: 1 })
    .lean();
  return sendSuccess(res, sections);
});

export const createSection = asyncHandler(async (req, res) => {
  const sec = await Section.create(req.body);
  return sendSuccess(res, sec, 201);
});

export const updateSection = asyncHandler(async (req, res) => {
  const sec = await Section.findByIdAndUpdate(req.params.id, req.body, { new: true })
    .populate('classId', 'name')
    .populate({ path: 'classTeacherId', populate: { path: 'userId', select: 'name' } });
  if (!sec) throw new ApiError(404, 'Section not found', 'NOT_FOUND');
  return sendSuccess(res, sec);
});

export const deleteSection = asyncHandler(async (req, res) => {
  const sec = await Section.findByIdAndDelete(req.params.id);
  if (!sec) throw new ApiError(404, 'Section not found', 'NOT_FOUND');
  return sendSuccess(res, { deleted: true });
});

export const listSubjects = asyncHandler(async (req, res) => {
  const { page, limit, skip, search } = parsePagination(req.query);
  const filter = {};
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.facultyId) filter.facultyId = req.query.facultyId;
  if (search) {
    filter.$or = [{ name: { $regex: search, $options: 'i' } }, { code: { $regex: search, $options: 'i' } }];
  }

  const [items, total] = await Promise.all([
    Subject.find(filter)
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .populate({ path: 'facultyId', populate: { path: 'userId', select: 'name email' } })
      .sort({ code: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Subject.countDocuments(filter),
  ]);
  return sendSuccess(res, items, 200, buildPaginationMeta(total, page, limit));
});

export const createSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.create(req.body);
  return sendSuccess(res, subject, 201);
});

export const updateSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!subject) throw new ApiError(404, 'Subject not found', 'NOT_FOUND');
  return sendSuccess(res, subject);
});

export const deleteSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findByIdAndDelete(req.params.id);
  if (!subject) throw new ApiError(404, 'Subject not found', 'NOT_FOUND');
  return sendSuccess(res, { deleted: true });
});

export const listAcademicYears = asyncHandler(async (_req, res) => {
  const years = await AcademicYear.find().sort({ startDate: -1 }).lean();
  return sendSuccess(res, years);
});

export const createAcademicYear = asyncHandler(async (req, res) => {
  if (req.body.isCurrent) {
    await AcademicYear.updateMany({}, { isCurrent: false });
  }
  const year = await AcademicYear.create(req.body);
  return sendSuccess(res, year, 201);
});

// ---------------- SETTINGS & AUDIT ----------------
export const getSettings = asyncHandler(async (_req, res) => {
  let settings = await SchoolSettings.findOne().populate('currentAcademicYearId', 'name').lean();
  if (!settings) {
    settings = await SchoolSettings.create({});
  }
  return sendSuccess(res, settings);
});

export const updateSettings = asyncHandler(async (req, res) => {
  let settings = await SchoolSettings.findOne();
  if (!settings) settings = new SchoolSettings();

  if (req.file) {
    const uploaded = await uploadFile(req.file, 'logos');
    if (uploaded) settings.logoUrl = uploaded.url;
  }

  Object.assign(settings, req.body);
  await settings.save();
  await recordAudit({ req, action: 'UPDATE_SETTINGS', entity: 'SchoolSettings', entityId: settings._id });
  return sendSuccess(res, settings);
});

export const listAuditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const [items, total] = await Promise.all([
    AuditLog.find().populate('actorId', 'name email role').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(),
  ]);
  return sendSuccess(res, items, 200, buildPaginationMeta(total, page, limit));
});

// ---------------- SUBSCRIPTION (READ-ONLY FOR SCHOOL ADMIN) ----------------
export const getMySubscription = asyncHandler(async (req, res) => {
  const school = await School.findById(req.user.schoolId).populate('planId').lean();
  if (!school) throw new ApiError(404, 'School not found', 'NOT_FOUND');

  const [statusInfo, studentCount, facultyCount, payments, platformSettings] = await Promise.all([
    computeEffectiveSchoolStatus(school),
    Student.countDocuments({ status: 'active' }),
    Faculty.countDocuments({ status: 'active' }),
    PlatformPayment.find({ schoolId: school._id }).populate('planId', 'name').sort({ paidAt: -1 }).lean(),
    PlatformSettings.findOne().lean(),
  ]);

  return sendSuccess(res, {
    school: {
      id: school._id,
      name: school.name,
      code: school.code,
      status: school.status,
      startDate: school.startDate,
      endDate: school.endDate,
      trialEndsAt: school.trialEndsAt,
      gracePeriodDays: school.gracePeriodDays,
      lastPaymentDate: school.lastPaymentDate,
    },
    plan: school.planId || null,
    statusInfo,
    usage: {
      students: studentCount,
      maxStudents: school.planId?.maxStudents || 0,
      faculty: facultyCount,
      maxFaculty: school.planId?.maxFaculty || 0,
    },
    payments,
    support: {
      email: platformSettings?.supportEmail || 'billing@schoolcloud.io',
      phone: platformSettings?.supportPhone || '+1-800-555-0199',
      message: platformSettings?.supportMessage || '',
      paymentInstructions: platformSettings?.paymentInstructions || '',
    },
  });
});

export const downloadMySubscriptionReceipt = asyncHandler(async (req, res) => {
  const payment = await PlatformPayment.findOne({
    _id: req.params.paymentId,
    schoolId: req.user.schoolId,
  })
    .populate('planId', 'name billingCycle')
    .lean();
  if (!payment) throw new ApiError(404, 'Payment receipt not found', 'NOT_FOUND');

  const school = await School.findById(req.user.schoolId).lean();
  const buffer = await generatePlatformInvoiceBuffer(payment, school);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Invoice_${payment.invoiceNo}.pdf`);
  return res.send(buffer);
});
