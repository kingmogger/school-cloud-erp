import { Timetable } from '../models/Timetable.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { recordAudit } from '../middleware/audit.js';

export const getTimetable = asyncHandler(async (req, res) => {
  const { classId, sectionId, dayOfWeek } = req.query;
  const filter = {};
  if (classId) filter.classId = classId;
  if (sectionId) filter.sectionId = sectionId;
  if (dayOfWeek) filter.dayOfWeek = dayOfWeek;

  const timetable = await Timetable.find(filter)
    .populate('classId', 'name')
    .populate('sectionId', 'name')
    .populate({ path: 'slots.subjectId', select: 'name code' })
    .populate({ path: 'slots.facultyId', populate: { path: 'userId', select: 'name' } })
    .lean();

  return sendSuccess(res, timetable);
});

export const saveTimetable = asyncHandler(async (req, res) => {
  const { academicYearId, classId, sectionId, dayOfWeek, slots } = req.body;

  const doc = await Timetable.findOneAndUpdate(
    { classId, sectionId, dayOfWeek },
    { academicYearId, classId, sectionId, dayOfWeek, slots },
    { upsert: true, new: true }
  );

  await recordAudit({ req, action: 'SAVE_TIMETABLE', entity: 'Timetable', entityId: doc._id });
  return sendSuccess(res, doc);
});
