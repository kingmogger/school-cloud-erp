import { RiskAlert } from '../models/RiskAlert.js';
import { Notification } from '../models/Notification.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  calculateStudentAttendance,
  calculateStudentGrades,
  calculateExamTrends,
  calculateSubjectStrengthsWeaknesses,
  compareWithClassAverage,
  evaluateStudentRisk,
  evaluateAllStudentsRisk,
} from '../services/intelligence/index.js';

export const listRiskAlerts = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.level) filter.level = req.query.level;
  if (req.query.resolved !== undefined) filter.resolved = req.query.resolved === 'true';

  const alerts = await RiskAlert.find(filter)
    .populate({
      path: 'studentId',
      populate: [
        { path: 'userId', select: 'name email avatarUrl' },
        { path: 'classId', select: 'name' },
        { path: 'sectionId', select: 'name' },
      ],
    })
    .sort({ score: -1 })
    .lean();

  return sendSuccess(res, alerts);
});

export const resolveRiskAlert = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const alert = await RiskAlert.findByIdAndUpdate(
    id,
    {
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy: req.user.id,
    },
    { new: true }
  );

  if (!alert) throw new ApiError(404, 'Risk alert not found', 'NOT_FOUND');
  return sendSuccess(res, alert);
});

export const evaluateAll = asyncHandler(async (_req, res) => {
  const results = await evaluateAllStudentsRisk();
  return sendSuccess(res, { evaluatedCount: results.length });
});

export const getStudentIntelligenceSummary = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const attendance = await calculateStudentAttendance({ studentId });
  const grades = await calculateStudentGrades({ studentId });
  const trends = await calculateExamTrends({ studentId });
  const strengthsWeaknesses = await calculateSubjectStrengthsWeaknesses({ studentId });
  const alert = await RiskAlert.findOne({ studentId }).lean();

  return sendSuccess(res, {
    attendance,
    grades,
    trends,
    strengthsWeaknesses,
    alert,
  });
});

export const listNotifications = asyncHandler(async (req, res) => {
  const items = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50).lean();
  return sendSuccess(res, items);
});

export const markNotificationAsRead = asyncHandler(async (req, res) => {
  const notif = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { readAt: new Date() },
    { new: true }
  );
  if (!notif) throw new ApiError(404, 'Notification not found', 'NOT_FOUND');
  return sendSuccess(res, notif);
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user.id, readAt: null }, { readAt: new Date() });
  return sendSuccess(res, { success: true });
});
