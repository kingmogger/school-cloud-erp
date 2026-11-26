import { FeeStructure } from '../models/FeeStructure.js';
import { FeePayment } from '../models/FeePayment.js';
import { Student } from '../models/Student.js';
import { SchoolSettings } from '../models/SchoolSettings.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { recordAudit } from '../middleware/audit.js';
import { generateFeeReceiptBuffer } from '../services/pdf.service.js';

export const listStructures = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.classId) filter.classId = req.query.classId;
  const items = await FeeStructure.find(filter).populate('classId', 'name').sort({ createdAt: -1 }).lean();
  return sendSuccess(res, items);
});

export const createStructure = asyncHandler(async (req, res) => {
  const { academicYearId, classId, name, components, dueDate } = req.body;
  const totalAmount = components.reduce((acc, c) => acc + Number(c.amount || 0), 0);

  const structure = await FeeStructure.create({
    academicYearId,
    classId,
    name,
    components,
    totalAmount,
    dueDate: new Date(dueDate),
  });

  await recordAudit({ req, action: 'CREATE_FEE_STRUCTURE', entity: 'FeeStructure', entityId: structure._id });
  return sendSuccess(res, structure, 201);
});

export const listPayments = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.studentId) filter.studentId = req.query.studentId;
  if (req.query.feeStructureId) filter.feeStructureId = req.query.feeStructureId;

  // Student can only view their own payments
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user.id }).lean();
    if (student) filter.studentId = student._id;
  }

  const payments = await FeePayment.find(filter)
    .populate({ path: 'studentId', populate: { path: 'userId', select: 'name email' } })
    .populate('feeStructureId', 'name totalAmount')
    .sort({ paidAt: -1 })
    .lean();

  return sendSuccess(res, payments);
});

export const createPayment = asyncHandler(async (req, res) => {
  const { studentId, feeStructureId, amountPaid, paymentMethod, transactionId, remarks } = req.body;

  const count = await FeePayment.countDocuments();
  const receiptNo = `REC-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

  const payment = await FeePayment.create({
    studentId,
    feeStructureId,
    receiptNo,
    amountPaid,
    paymentMethod: paymentMethod || 'online',
    status: 'paid',
    transactionId: transactionId || `TXN-${Date.now()}`,
    remarks: remarks || '',
  });

  await recordAudit({ req, action: 'CREATE_FEE_PAYMENT', entity: 'FeePayment', entityId: payment._id, after: { amountPaid, receiptNo } });
  return sendSuccess(res, payment, 201);
});

export const downloadReceipt = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const payment = await FeePayment.findById(id).lean();
  if (!payment) throw new ApiError(404, 'Payment record not found', 'NOT_FOUND');

  const student = await Student.findById(payment.studentId)
    .populate('userId', 'name email')
    .populate('classId', 'name')
    .populate('sectionId', 'name')
    .lean();

  const structure = await FeeStructure.findById(payment.feeStructureId).lean();
  const settings = await SchoolSettings.findOne().lean();

  const buffer = await generateFeeReceiptBuffer(payment, student, structure, settings);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Receipt_${payment.receiptNo}.pdf`);
  return res.send(buffer);
});
