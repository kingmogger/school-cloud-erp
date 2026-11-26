import crypto from 'node:crypto';
import { School } from '../models/School.js';
import { SubscriptionPlan } from '../models/SubscriptionPlan.js';
import { PlatformPayment } from '../models/PlatformPayment.js';
import { PlatformAuditLog } from '../models/PlatformAuditLog.js';
import { PlatformSettings } from '../models/PlatformSettings.js';
import { User } from '../models/User.js';
import { Student } from '../models/Student.js';
import { Faculty } from '../models/Faculty.js';
import { AcademicYear } from '../models/AcademicYear.js';
import { SchoolSettings } from '../models/SchoolSettings.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { runWithTenant, runWithoutTenant } from '../utils/tenantContext.js';
import { signTokens } from './auth.controller.js';
import { paymentGateway } from '../services/paymentGateway.service.js';
import { generatePlatformInvoiceBuffer } from '../services/pdf.service.js';
import { computeEffectiveSchoolStatus } from '../services/subscription.service.js';

async function logPlatformAudit({ req, action, targetSchoolId = null, reason = '', metadata = null }) {
  await PlatformAuditLog.create({
    actorId: req.user.id,
    action,
    targetSchoolId,
    reason,
    metadata,
    ip: req.ip || '',
  });
}

// ---------------- DASHBOARD ----------------
export const getDashboard = asyncHandler(async (_req, res) => {
  const now = new Date();
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [schools, totalStudents, totalUsers, recentLogs] = await Promise.all([
    School.find({ softDeletedAt: null }).populate('planId').lean(),
    runWithoutTenant(() => Student.countDocuments({ status: 'active' })),
    runWithoutTenant(() => User.countDocuments({ role: { $ne: 'super_admin' } })),
    PlatformAuditLog.find()
      .populate('actorId', 'name email')
      .populate('targetSchoolId', 'name code')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  let active = 0;
  let suspended = 0;
  let expired = 0;
  let trial = 0;
  let mrr = 0;
  let overdueCount = 0;
  const upcomingRenewals = [];

  for (const s of schools) {
    if (s.status === 'active') active += 1;
    else if (s.status === 'suspended') suspended += 1;
    else if (s.status === 'expired') expired += 1;
    else if (s.status === 'trial') trial += 1;

    if (s.status === 'active' && s.planId?.price) {
      mrr += s.planId.billingCycle === 'yearly' ? Math.round(s.planId.price / 12) : s.planId.price;
    }

    if (s.endDate && new Date(s.endDate) < now && s.status !== 'trial') {
      overdueCount += 1;
    } else if (s.endDate && new Date(s.endDate) >= now && new Date(s.endDate) <= in30Days) {
      upcomingRenewals.push({ _id: s._id, name: s.name, code: s.code, endDate: s.endDate, plan: s.planId?.name });
    }
  }

  return sendSuccess(res, {
    totalSchools: schools.length,
    counts: { active, suspended, expired, trial },
    totalStudents,
    totalUsers,
    mrr,
    overdueCount,
    upcomingRenewals,
    recentLogs,
  });
});

// ---------------- SCHOOLS CRUD ----------------
export const listSchools = asyncHandler(async (req, res) => {
  const { page, limit, skip, search } = parsePagination(req.query);
  const filter = { softDeletedAt: null };
  if (req.query.status) filter.status = req.query.status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    School.find(filter).populate('planId', 'name price billingCycle maxStudents maxFaculty').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    School.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildPaginationMeta(total, page, limit));
});

export const createSchool = asyncHandler(async (req, res) => {
  const { name, code, email, phone, address, contactPerson, planId, adminName, adminEmail, adminPassword, trialDays } = req.body;
  const upperCode = code.trim().toUpperCase();

  if (await School.exists({ code: upperCode })) {
    throw new ApiError(409, `School code ${upperCode} already exists`, 'SCHOOL_CODE_EXISTS');
  }
  if (await runWithoutTenant(() => User.exists({ email: adminEmail.toLowerCase() }))) {
    throw new ApiError(409, 'Admin email already exists', 'EMAIL_EXISTS');
  }

  const settings = await PlatformSettings.findOne().lean();
  const days = Number(trialDays || settings?.defaultTrialDays || 14);
  const trialEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const school = await School.create({
    name,
    code: upperCode,
    email,
    phone: phone || '',
    address: address || '',
    contactPerson: contactPerson || adminName,
    planId: planId || null,
    status: planId ? 'active' : 'trial',
    subscriptionStatus: planId ? 'active' : 'trial',
    startDate: new Date(),
    endDate: trialEnd,
    trialEndsAt: trialEnd,
    gracePeriodDays: settings?.gracePeriodDays ?? 7,
  });

  const rawPassword = adminPassword || `Sch@${crypto.randomBytes(4).toString('hex')}`;
  const passHash = await User.hashPassword(rawPassword);

  const adminUser = await runWithTenant(school._id, async () => {
    const user = await User.create({
      name: adminName,
      email: adminEmail.toLowerCase(),
      passwordHash: passHash,
      role: 'school_admin',
      schoolId: school._id,
      phone: phone || '',
    });

    const ay = await AcademicYear.create({
      schoolId: school._id,
      name: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      startDate: new Date(`${new Date().getFullYear()}-04-01`),
      endDate: new Date(`${new Date().getFullYear() + 1}-03-31`),
      isCurrent: true,
    });

    await SchoolSettings.create({
      schoolId: school._id,
      schoolName: school.name,
      email: school.email,
      phone: school.phone,
      address: school.address,
      currentAcademicYearId: ay._id,
    });

    return user;
  });

  await logPlatformAudit({ req, action: 'CREATE_SCHOOL', targetSchoolId: school._id, metadata: { code: upperCode } });

  return sendSuccess(
    res,
    {
      school,
      adminCredentials: {
        name: adminUser.name,
        email: adminUser.email,
        temporaryPassword: rawPassword,
      },
    },
    201
  );
});

export const getSchoolDetails = asyncHandler(async (req, res) => {
  const school = await School.findById(req.params.id).populate('planId').lean();
  if (!school) throw new ApiError(404, 'School not found', 'NOT_FOUND');

  const [studentsCount, facultyCount, usersCount, payments, statusInfo] = await Promise.all([
    runWithTenant(school._id, () => Student.countDocuments({ status: 'active' })),
    runWithTenant(school._id, () => Faculty.countDocuments({ status: 'active' })),
    runWithTenant(school._id, () => User.countDocuments()),
    PlatformPayment.find({ schoolId: school._id }).populate('planId', 'name').sort({ paidAt: -1 }).lean(),
    computeEffectiveSchoolStatus(school),
  ]);

  return sendSuccess(res, {
    school,
    statusInfo,
    usage: { studentsCount, facultyCount, usersCount },
    payments,
  });
});

export const updateSchool = asyncHandler(async (req, res) => {
  const school = await School.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('planId');
  if (!school) throw new ApiError(404, 'School not found', 'NOT_FOUND');
  await logPlatformAudit({ req, action: 'UPDATE_SCHOOL', targetSchoolId: school._id });
  return sendSuccess(res, school);
});

export const softDeleteSchool = asyncHandler(async (req, res) => {
  const school = await School.findByIdAndUpdate(
    req.params.id,
    { softDeletedAt: new Date(), status: 'suspended', subscriptionStatus: 'suspended' },
    { new: true }
  );
  if (!school) throw new ApiError(404, 'School not found', 'NOT_FOUND');
  await logPlatformAudit({ req, action: 'SOFT_DELETE_SCHOOL', targetSchoolId: school._id, reason: req.body?.reason || '' });
  return sendSuccess(res, { deleted: true });
});

// ---------------- ONE-CLICK SCHOOL ACTIONS ----------------
export const suspendSchool = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    throw new ApiError(400, 'Suspension reason is required', 'REASON_REQUIRED');
  }

  const school = await School.findByIdAndUpdate(
    req.params.id,
    {
      status: 'suspended',
      subscriptionStatus: 'suspended',
      manualSuspension: {
        isSuspended: true,
        reason: reason.trim(),
        suspendedAt: new Date(),
        suspendedBy: req.user.id,
      },
    },
    { new: true }
  );
  if (!school) throw new ApiError(404, 'School not found', 'NOT_FOUND');

  await logPlatformAudit({ req, action: 'SUSPEND_SCHOOL', targetSchoolId: school._id, reason: reason.trim() });
  return sendSuccess(res, school);
});

export const reactivateSchool = asyncHandler(async (req, res) => {
  const school = await School.findById(req.params.id);
  if (!school) throw new ApiError(404, 'School not found', 'NOT_FOUND');

  school.manualSuspension = { isSuspended: false, reason: '', suspendedAt: null, suspendedBy: null };
  school.status = 'active';
  school.subscriptionStatus = 'active';
  if (!school.endDate || new Date(school.endDate) < new Date()) {
    school.endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  await school.save();

  await logPlatformAudit({ req, action: 'REACTIVATE_SCHOOL', targetSchoolId: school._id, reason: req.body?.reason || 'Reactivated' });
  return sendSuccess(res, school);
});

export const extendSubscription = asyncHandler(async (req, res) => {
  const days = Number(req.body.days || 30);
  const school = await School.findById(req.params.id);
  if (!school) throw new ApiError(404, 'School not found', 'NOT_FOUND');

  const base = school.endDate && new Date(school.endDate) > new Date() ? new Date(school.endDate) : new Date();
  school.endDate = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  school.status = 'active';
  school.subscriptionStatus = 'active';
  await school.save();

  await logPlatformAudit({ req, action: 'EXTEND_SUBSCRIPTION', targetSchoolId: school._id, metadata: { days } });
  return sendSuccess(res, school);
});

export const changeSchoolPlan = asyncHandler(async (req, res) => {
  const { planId } = req.body;
  const plan = await SubscriptionPlan.findById(planId).lean();
  if (!plan) throw new ApiError(404, 'Plan not found', 'NOT_FOUND');

  const school = await School.findByIdAndUpdate(req.params.id, { planId }, { new: true }).populate('planId');
  if (!school) throw new ApiError(404, 'School not found', 'NOT_FOUND');

  await logPlatformAudit({ req, action: 'CHANGE_PLAN', targetSchoolId: school._id, metadata: { planName: plan.name } });
  return sendSuccess(res, school);
});

export const resetSchoolAdminPassword = asyncHandler(async (req, res) => {
  const school = await School.findById(req.params.id).lean();
  if (!school) throw new ApiError(404, 'School not found', 'NOT_FOUND');

  const adminUser = await runWithTenant(school._id, () => User.findOne({ role: 'school_admin' }));
  if (!adminUser) throw new ApiError(404, 'School Admin account not found', 'NOT_FOUND');

  const newPass = req.body?.newPassword || `Reset@${crypto.randomBytes(4).toString('hex')}`;
  adminUser.passwordHash = await User.hashPassword(newPass);
  adminUser.refreshTokenHash = null;
  await runWithoutTenant(() => adminUser.save());

  await logPlatformAudit({ req, action: 'RESET_ADMIN_PASSWORD', targetSchoolId: school._id, metadata: { adminEmail: adminUser.email } });
  return sendSuccess(res, { email: adminUser.email, temporaryPassword: newPass });
});

export const impersonateSchoolAdmin = asyncHandler(async (req, res) => {
  const school = await School.findById(req.params.id).populate('planId').lean();
  if (!school) throw new ApiError(404, 'School not found', 'NOT_FOUND');

  const adminUser = await runWithTenant(school._id, () => User.findOne({ role: 'school_admin' }).lean());
  if (!adminUser) throw new ApiError(404, 'School Admin account not found', 'NOT_FOUND');

  const { accessToken } = signTokens(adminUser, { impersonatedBy: req.user.id });
  await logPlatformAudit({
    req,
    action: 'IMPERSONATE_SCHOOL_ADMIN',
    targetSchoolId: school._id,
    reason: req.body?.reason || 'Support session',
    metadata: { adminEmail: adminUser.email },
  });

  const subscription = await computeEffectiveSchoolStatus(school);

  return sendSuccess(res, {
    accessToken,
    user: {
      id: adminUser._id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
      schoolId: adminUser.schoolId,
      impersonatedBy: req.user.id,
    },
    school: {
      id: school._id,
      name: school.name,
      code: school.code,
      planName: school.planId?.name || 'Trial',
      subscription,
    },
  });
});

// ---------------- PLANS ----------------
export const listPlans = asyncHandler(async (_req, res) => {
  const plans = await SubscriptionPlan.find().sort({ price: 1 }).lean();
  return sendSuccess(res, plans);
});

export const createPlan = asyncHandler(async (req, res) => {
  const plan = await SubscriptionPlan.create(req.body);
  return sendSuccess(res, plan, 201);
});

export const updatePlan = asyncHandler(async (req, res) => {
  const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!plan) throw new ApiError(404, 'Plan not found', 'NOT_FOUND');
  return sendSuccess(res, plan);
});

// ---------------- BILLING & PAYMENTS ----------------
export const listPlatformPayments = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.schoolId) filter.schoolId = req.query.schoolId;

  const payments = await PlatformPayment.find(filter)
    .populate('schoolId', 'name code')
    .populate('planId', 'name billingCycle')
    .sort({ paidAt: -1 })
    .lean();

  return sendSuccess(res, payments);
});

export const recordPlatformPayment = asyncHandler(async (req, res) => {
  const { schoolId, planId, amount, paidAt, method, reference, periodStart, periodEnd, note } = req.body;
  const school = await School.findById(schoolId);
  if (!school) throw new ApiError(404, 'School not found', 'NOT_FOUND');

  await paymentGateway.verifyPayment({ reference });
  const count = await PlatformPayment.countDocuments();
  const invoiceNo = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

  const payment = await PlatformPayment.create({
    schoolId,
    planId: planId || school.planId || null,
    invoiceNo,
    amount: Number(amount),
    paidAt: paidAt ? new Date(paidAt) : new Date(),
    method: method || 'bank_transfer',
    reference: reference || '',
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodEnd),
    note: note || '',
    status: 'paid',
    recordedById: req.user.id,
  });

  // Update school paid-until & restore active state
  school.lastPaymentDate = payment.paidAt;
  school.endDate = payment.periodEnd;
  if (planId) school.planId = planId;
  school.status = 'active';
  school.subscriptionStatus = 'active';
  school.manualSuspension = { isSuspended: false, reason: '', suspendedAt: null, suspendedBy: null };
  await school.save();

  await logPlatformAudit({
    req,
    action: 'RECORD_PAYMENT',
    targetSchoolId: school._id,
    metadata: { invoiceNo, amount },
  });

  return sendSuccess(res, payment, 201);
});

export const downloadPlatformInvoice = asyncHandler(async (req, res) => {
  const payment = await PlatformPayment.findById(req.params.id).populate('planId', 'name billingCycle').lean();
  if (!payment) throw new ApiError(404, 'Invoice not found', 'NOT_FOUND');
  const school = await School.findById(payment.schoolId).lean();
  const buffer = await generatePlatformInvoiceBuffer(payment, school);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Invoice_${payment.invoiceNo}.pdf`);
  return res.send(buffer);
});

export const listOverdueSchools = asyncHandler(async (_req, res) => {
  const now = new Date();
  const schools = await School.find({
    softDeletedAt: null,
    endDate: { $lt: now },
  })
    .populate('planId', 'name price')
    .sort({ endDate: 1 })
    .lean();
  return sendSuccess(res, schools);
});

// ---------------- AUDIT & SETTINGS ----------------
export const listPlatformAuditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const [items, total] = await Promise.all([
    PlatformAuditLog.find()
      .populate('actorId', 'name email')
      .populate('targetSchoolId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PlatformAuditLog.countDocuments(),
  ]);
  return sendSuccess(res, items, 200, buildPaginationMeta(total, page, limit));
});

export const getPlatformSettings = asyncHandler(async (_req, res) => {
  let settings = await PlatformSettings.findOne().lean();
  if (!settings) settings = await PlatformSettings.create({});
  return sendSuccess(res, settings);
});

export const updatePlatformSettings = asyncHandler(async (req, res) => {
  let settings = await PlatformSettings.findOne();
  if (!settings) settings = new PlatformSettings();
  Object.assign(settings, req.body);
  await settings.save();
  await logPlatformAudit({ req, action: 'UPDATE_PLATFORM_SETTINGS' });
  return sendSuccess(res, settings);
});
