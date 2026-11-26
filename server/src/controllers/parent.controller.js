import { Parent } from '../models/Parent.js';
import { Student } from '../models/Student.js';
import { Attendance } from '../models/Attendance.js';
import { Remark } from '../models/Remark.js';
import { FeePayment } from '../models/FeePayment.js';
import { FeeStructure } from '../models/FeeStructure.js';
import { Notification } from '../models/Notification.js';
import { Exam } from '../models/Exam.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { assertParentOwnsStudent } from '../middleware/rbac.js';
import {
  calculateStudentAttendance,
  calculateStudentGrades,
  calculateExamTrends,
  calculateSubjectStrengthsWeaknesses,
} from '../services/intelligence/index.js';

async function getParentDoc(userId) {
  const parent = await Parent.findOne({ userId })
    .populate({
      path: 'children',
      populate: [
        { path: 'userId', select: 'name email phone avatarUrl' },
        { path: 'classId', select: 'name numericLevel' },
        { path: 'sectionId', select: 'name' },
      ],
    })
    .lean();
  if (!parent) throw new ApiError(403, 'Parent profile not found', 'FORBIDDEN');
  return parent;
}

export const getChildren = asyncHandler(async (req, res) => {
  const parent = await getParentDoc(req.user.id);
  return sendSuccess(res, parent.children);
});

export const getChildOverview = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  await assertParentOwnsStudent(req.user.id, studentId);

  const student = await Student.findById(studentId)
    .populate('userId', 'name email phone avatarUrl')
    .populate('classId', 'name')
    .populate('sectionId', 'name')
    .lean();

  const attendance = await calculateStudentAttendance({ studentId });
  const grades = await calculateStudentGrades({ studentId });
  const trends = await calculateExamTrends({ studentId });
  const strengthsWeaknesses = await calculateSubjectStrengthsWeaknesses({ studentId });

  // Recent remarks
  const remarks = await Remark.find({ studentId })
    .populate({ path: 'facultyId', populate: { path: 'userId', select: 'name' } })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  return sendSuccess(res, {
    student,
    attendance,
    grades,
    trends,
    strengthsWeaknesses,
    remarks,
  });
});

export const getChildAttendance = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  await assertParentOwnsStudent(req.user.id, studentId);

  const summary = await calculateStudentAttendance({ studentId });
  const records = await Attendance.find({ studentId })
    .populate('subjectId', 'name code')
    .sort({ date: -1 })
    .limit(100)
    .lean();

  return sendSuccess(res, { summary, records });
});

export const getChildResults = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  await assertParentOwnsStudent(req.user.id, studentId);

  const exams = await Exam.find().sort({ startDate: -1 }).lean();
  const resultsByExam = [];
  for (const exam of exams) {
    const gradeData = await calculateStudentGrades({ studentId, examId: exam._id });
    if (gradeData.subjectsCount > 0) {
      resultsByExam.push({
        exam,
        ...gradeData,
      });
    }
  }

  return sendSuccess(res, resultsByExam);
});

export const getChildFees = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  await assertParentOwnsStudent(req.user.id, studentId);

  const student = await Student.findById(studentId).lean();
  const structures = await FeeStructure.find({ classId: student.classId }).lean();
  const payments = await FeePayment.find({ studentId }).sort({ paidAt: -1 }).lean();

  const paidStructureIds = new Set(payments.filter((p) => p.status === 'paid').map((p) => p.feeStructureId.toString()));
  const feeStatus = structures.map((st) => ({
    structure: st,
    isPaid: paidStructureIds.has(st._id.toString()),
  }));

  return sendSuccess(res, { feeStatus, payments });
});

export const getChildRemarks = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  await assertParentOwnsStudent(req.user.id, studentId);

  const remarks = await Remark.find({ studentId })
    .populate({ path: 'facultyId', populate: { path: 'userId', select: 'name' } })
    .sort({ createdAt: -1 })
    .lean();

  return sendSuccess(res, remarks);
});

export const getNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50).lean();
  return sendSuccess(res, notifications);
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notif = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { readAt: new Date() },
    { new: true }
  );
  if (!notif) throw new ApiError(404, 'Notification not found', 'NOT_FOUND');
  return sendSuccess(res, notif);
});

export const payChildFee = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { feeStructureId, amountPaid, paymentMethod, transactionReference } = req.body;
  await assertParentOwnsStudent(req.user.id, studentId);

  const structure = await FeeStructure.findById(feeStructureId).lean();
  if (!structure) throw new ApiError(404, 'Fee structure not found', 'NOT_FOUND');

  const count = await FeePayment.countDocuments();
  const receiptNo = `REC-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

  const payment = await FeePayment.create({
    studentId,
    feeStructureId,
    receiptNo,
    amountPaid: Number(amountPaid || structure.totalAmount),
    paymentMethod: paymentMethod || 'card',
    status: 'paid',
    transactionId: transactionReference || `GATEWAY-${Date.now()}`,
    remarks: `Online Payment via Payment Gateway (${paymentMethod || 'card'})`,
  });

  return sendSuccess(res, payment, 201);
});
