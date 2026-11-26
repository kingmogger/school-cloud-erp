import { Attendance } from '../models/Attendance.js';
import { Mark } from '../models/Mark.js';
import { FeePayment } from '../models/FeePayment.js';
import { Student } from '../models/Student.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const generateReport = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { format = 'json', classId, startDate, endDate } = req.query;

  let records = [];

  if (type === 'attendance') {
    const filter = {};
    if (classId) filter.classId = classId;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    const data = await Attendance.find(filter)
      .populate({ path: 'studentId', populate: { path: 'userId', select: 'name' } })
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .sort({ date: -1 })
      .limit(500)
      .lean();

    records = data.map((d) => ({
      student: d.studentId?.userId?.name || 'N/A',
      admissionNo: d.studentId?.admissionNo || 'N/A',
      class: d.classId?.name || 'N/A',
      section: d.sectionId?.name || 'N/A',
      date: new Date(d.date).toISOString().slice(0, 10),
      status: d.status,
    }));
  } else if (type === 'results') {
    const filter = {};
    const data = await Mark.find(filter)
      .populate({ path: 'studentId', populate: { path: 'userId', select: 'name' } })
      .populate('subjectId', 'name code')
      .populate('examId', 'name')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    records = data.map((d) => ({
      student: d.studentId?.userId?.name || 'N/A',
      exam: d.examId?.name || 'N/A',
      subject: d.subjectId?.name || 'N/A',
      marksObtained: d.marksObtained,
      maxMarks: d.maxMarks,
      percentage: d.maxMarks > 0 ? Math.round((d.marksObtained / d.maxMarks) * 100) : 0,
    }));
  } else if (type === 'fees') {
    const filter = {};
    const data = await FeePayment.find(filter)
      .populate({ path: 'studentId', populate: { path: 'userId', select: 'name' } })
      .populate('feeStructureId', 'name')
      .sort({ paidAt: -1 })
      .limit(500)
      .lean();

    records = data.map((d) => ({
      receiptNo: d.receiptNo,
      student: d.studentId?.userId?.name || 'N/A',
      feeStructure: d.feeStructureId?.name || 'N/A',
      amountPaid: d.amountPaid,
      paymentMethod: d.paymentMethod,
      paidAt: new Date(d.paidAt).toISOString().slice(0, 10),
      status: d.status,
    }));
  }

  if (format === 'csv') {
    if (records.length === 0) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${type}_report.csv`);
      return res.send('');
    }
    const headers = Object.keys(records[0]).join(',');
    const rows = records.map((r) => Object.values(r).map((v) => `"${v}"`).join(','));
    const csvContent = [headers, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}_report.csv`);
    return res.send(csvContent);
  }

  return sendSuccess(res, records);
});
