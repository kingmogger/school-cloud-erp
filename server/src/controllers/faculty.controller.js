import { Attendance } from '../models/Attendance.js';
import { ClassSchedule } from '../models/ClassSchedule.js';
import { Exam } from '../models/Exam.js';
import { Mark } from '../models/Mark.js';
import { Assignment } from '../models/Assignment.js';
import { Submission } from '../models/Submission.js';
import { StudyMaterial } from '../models/StudyMaterial.js';
import { Remark } from '../models/Remark.js';
import { Faculty } from '../models/Faculty.js';
import { Student } from '../models/Student.js';
import { Subject } from '../models/Subject.js';
import { Class } from '../models/Class.js';
import { Section } from '../models/Section.js';
import { SchoolSettings } from '../models/SchoolSettings.js';
import { Notification } from '../models/Notification.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { recordAudit } from '../middleware/audit.js';
import { uploadFile, deleteFile } from '../services/storage.service.js';
import {
  calculateStudentAttendance,
  calculateStudentGrades,
  evaluateStudentRisk,
  calculateClassAttendance,
} from '../services/intelligence/index.js';

async function getFacultyDoc(userId) {
  const fac = await Faculty.findOne({ userId });
  if (!fac) throw new ApiError(403, 'Faculty profile not found', 'FORBIDDEN');
  return fac;
}

function normalizeDateKey(input) {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }
  const d = input ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getDayOfWeekFromDateKey(dateKey) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? 'Monday' : DAY_NAMES[d.getUTCDay()];
}

function getWeekBounds(weekStartInput) {
  const baseKey = normalizeDateKey(weekStartInput);
  const d = new Date(`${baseKey}T00:00:00Z`);
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getTime() + diffToMonday * 86400000);
  const saturday = new Date(monday.getTime() + 5 * 86400000);
  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: saturday.toISOString().slice(0, 10),
  };
}

// ---------------- CLASS SCHEDULES ----------------
export const listSchedules = asyncHandler(async (req, res) => {
  const { date, upcoming, weekStart, classId, sectionId, subjectId } = req.query;
  const filter = {};
  if (req.user.role === 'faculty') {
    const fac = await getFacultyDoc(req.user.id);
    filter.facultyId = String(fac._id);
  } else if (req.query.facultyId) {
    filter.facultyId = req.query.facultyId;
  }
  if (classId) filter.classId = classId;
  if (sectionId) filter.sectionId = sectionId;
  if (subjectId) filter.subjectId = subjectId;
  if (date) filter.dateKey = normalizeDateKey(date);

  let schedules = await ClassSchedule.find(filter)
    .populate('subjectId', 'name code')
    .populate('classId', 'name')
    .populate('sectionId', 'name')
    .populate({ path: 'facultyId', populate: { path: 'userId', select: 'name' } })
    .lean();

  if (upcoming === 'true') {
    const todayKey = normalizeDateKey();
    schedules = schedules.filter((s) => s.dateKey >= todayKey);
  }
  if (weekStart) {
    const bounds = getWeekBounds(weekStart);
    schedules = schedules.filter((s) => s.dateKey >= bounds.weekStart && s.dateKey <= bounds.weekEnd);
  }

  schedules.sort((a, b) => {
    const dateCmp = String(a.dateKey || '').localeCompare(String(b.dateKey || ''));
    if (dateCmp !== 0) return dateCmp;
    return String(a.startTime || '').localeCompare(String(b.startTime || ''));
  });

  const scheduleIds = schedules.map((s) => String(s._id));
  const attRecords = scheduleIds.length > 0
    ? await Attendance.find({ scheduledClassId: { $in: scheduleIds } }).lean()
    : [];
  const countBySchedule = new Map();
  for (const r of attRecords) {
    const sid = String(r.scheduledClassId);
    countBySchedule.set(sid, (countBySchedule.get(sid) || 0) + 1);
  }

  const enriched = schedules.map((s) => {
    const markedCount = countBySchedule.get(String(s._id)) || 0;
    return {
      ...s,
      markedCount,
      attendanceMarked: markedCount > 0 || Boolean(s.attendanceMarked),
    };
  });

  return sendSuccess(res, enriched);
});

export const createSchedule = asyncHandler(async (req, res) => {
  const { subjectId, sectionId, date, startTime, endTime, room, scheduleType = 'class', title = '', description = '' } = req.body;
  const isEvent = scheduleType === 'event';

  if (isEvent && !String(title || '').trim()) {
    throw new ApiError(400, 'Event title is required for custom events', 'VALIDATION_ERROR');
  }
  if ((!isEvent && !subjectId) || !sectionId || !date || !startTime || !endTime || !String(room || '').trim()) {
    throw new ApiError(400, 'Section, date, start time, end time, classroom, and subject (or event title) are required', 'VALIDATION_ERROR');
  }
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || endTime <= startTime) {
    throw new ApiError(400, 'End time must be after start time (HH:MM)', 'INVALID_TIME_RANGE');
  }

  const [section, subject] = await Promise.all([
    Section.findById(sectionId).lean(),
    subjectId ? Subject.findById(subjectId).lean() : Promise.resolve(null),
  ]);
  if (!section) throw new ApiError(404, 'Section not found', 'NOT_FOUND');
  if (subjectId && !subject) throw new ApiError(404, 'Subject not found', 'NOT_FOUND');

  const classId = String(section.classId?._id || section.classId || req.body.classId || '');
  const subjectClassId = String(subject?.classId?._id || subject?.classId || '');
  if (subject && subjectClassId && classId && subjectClassId !== classId) {
    throw new ApiError(400, 'Selected section does not belong to the selected subject class', 'CLASS_MISMATCH');
  }

  let facultyId = req.body.facultyId || String(subject?.facultyId?._id || subject?.facultyId || '');
  if (req.user.role === 'faculty') {
    const fac = await getFacultyDoc(req.user.id);
    facultyId = String(fac._id);
  }
  if (!facultyId) {
    throw new ApiError(400, 'Faculty profile is required to schedule a class', 'FACULTY_REQUIRED');
  }

  const dateKey = normalizeDateKey(date);
  const dayOfWeek = getDayOfWeekFromDateKey(dateKey);
  const normalizedRoom = String(room).trim();
  const roomLower = normalizedRoom.toLowerCase();

  // Prevent duplicate / overlapping schedules
  const sameDaySchedules = await ClassSchedule.find({ dateKey }).lean();
  for (const existing of sameDaySchedules) {
    const overlaps = existing.startTime < endTime && existing.endTime > startTime;
    if (!overlaps) continue;

    if (String(existing.facultyId) === String(facultyId)) {
      throw new ApiError(409, `You already have a class scheduled on ${dateKey} (${existing.startTime}–${existing.endTime})`, 'DUPLICATE_FACULTY_SCHEDULE');
    }
    if (String(existing.classId) === String(classId) && String(existing.sectionId) === String(sectionId)) {
      throw new ApiError(409, `This section already has a class scheduled on ${dateKey} (${existing.startTime}–${existing.endTime})`, 'DUPLICATE_SECTION_SCHEDULE');
    }
    if (String(existing.room || '').trim().toLowerCase() === roomLower) {
      throw new ApiError(409, `Classroom ${normalizedRoom} is already booked on ${dateKey} (${existing.startTime}–${existing.endTime})`, 'DUPLICATE_ROOM_SCHEDULE');
    }
  }

  const created = await ClassSchedule.create({
    schoolId: req.user.schoolId,
    facultyId: String(facultyId),
    classId: String(classId),
    sectionId: String(sectionId),
    subjectId: subjectId ? String(subjectId) : null,
    scheduleType: isEvent ? 'event' : 'class',
    title: String(title || '').trim(),
    description: String(description || '').trim(),
    dateKey,
    date: `${dateKey}T00:00:00.000Z`,
    dayOfWeek,
    startTime,
    endTime,
    room: normalizedRoom,
    status: 'scheduled',
    attendanceMarked: false,
  });

  const populated = await ClassSchedule.findById(created._id)
    .populate('subjectId', 'name code')
    .populate('classId', 'name')
    .populate('sectionId', 'name')
    .populate({ path: 'facultyId', populate: { path: 'userId', select: 'name' } })
    .lean();

  await recordAudit({
    req,
    action: 'CREATE_CLASS_SCHEDULE',
    entity: 'ClassSchedule',
    entityId: created._id,
    after: { dateKey, startTime, endTime, room: normalizedRoom, subjectId, sectionId },
  });

  return sendSuccess(res, populated || created, 201);
});

export const deleteSchedule = asyncHandler(async (req, res) => {
  const schedule = await ClassSchedule.findById(req.params.id);
  if (!schedule) throw new ApiError(404, 'Scheduled class not found', 'NOT_FOUND');

  if (req.user.role === 'faculty') {
    const fac = await getFacultyDoc(req.user.id);
    if (String(schedule.facultyId) !== String(fac._id)) {
      throw new ApiError(403, 'You can only delete your own scheduled classes', 'FORBIDDEN');
    }
  }

  await Attendance.deleteMany({ scheduledClassId: String(schedule._id) });
  await ClassSchedule.findByIdAndDelete(schedule._id);
  await recordAudit({ req, action: 'DELETE_CLASS_SCHEDULE', entity: 'ClassSchedule', entityId: schedule._id });
  return sendSuccess(res, { deleted: true });
});

// ---------------- ATTENDANCE ----------------
export const getAttendance = asyncHandler(async (req, res) => {
  const { scheduledClassId, classId, sectionId, subjectId, date } = req.query;
  const filter = {};
  if (scheduledClassId) filter.scheduledClassId = String(scheduledClassId);
  if (classId) filter.classId = classId;
  if (sectionId) filter.sectionId = sectionId;
  if (subjectId) filter.subjectId = subjectId;
  if (date) {
    filter.dateKey = normalizeDateKey(date);
  }

  const records = await Attendance.find(filter)
    .populate({ path: 'studentId', populate: { path: 'userId', select: 'name email' } })
    .lean();

  return sendSuccess(res, records);
});

export const markBulkAttendance = asyncHandler(async (req, res) => {
  const { scheduledClassId, classId: bodyClassId, sectionId: bodySectionId, subjectId: bodySubjectId, date, records = [] } = req.body;
  // records: [ { studentId, status, remarks } ]

  if (!Array.isArray(records) || records.length === 0) {
    throw new ApiError(400, 'Attendance records are required', 'VALIDATION_ERROR');
  }

  let schedule = null;
  if (scheduledClassId) {
    schedule = await ClassSchedule.findById(scheduledClassId);
    if (!schedule) throw new ApiError(404, 'Scheduled class not found', 'NOT_FOUND');

    if (req.user.role === 'faculty') {
      const fac = await getFacultyDoc(req.user.id);
      if (String(schedule.facultyId) !== String(fac._id)) {
        throw new ApiError(403, 'You can only mark attendance for your own scheduled classes', 'FORBIDDEN');
      }
    }
  } else if (req.user.role === 'faculty') {
    throw new ApiError(400, 'Please select one of your scheduled classes to mark attendance', 'SCHEDULE_REQUIRED');
  }

  const classId = schedule ? String(schedule.classId) : String(bodyClassId);
  const sectionId = schedule ? String(schedule.sectionId) : String(bodySectionId);
  const normalizedSubjectId = schedule ? (schedule.subjectId ? String(schedule.subjectId) : null) : (bodySubjectId || null);
  const dateKey = schedule ? schedule.dateKey : normalizeDateKey(date);
  const targetDateIso = `${dateKey}T00:00:00.000Z`;

  // Deduplicate student records in payload to prevent duplicate writes
  const uniqueMap = new Map();
  for (const r of records) {
    if (r?.studentId) {
      uniqueMap.set(String(r.studentId), r);
    }
  }
  const uniqueRecords = Array.from(uniqueMap.values());

  // Check edit window if records already exist
  const existingFilter = scheduledClassId
    ? { scheduledClassId: String(scheduledClassId) }
    : { classId, sectionId, subjectId: normalizedSubjectId, dateKey };
  const existing = await Attendance.findOne(existingFilter);

  const settings = await SchoolSettings.findOne().lean();
  const windowHours = settings?.attendanceEditWindowHours || 24;

  if (existing) {
    const hoursSinceCreation = (Date.now() - new Date(existing.createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > windowHours && req.user.role !== 'school_admin') {
      throw new ApiError(403, `Attendance edit window of ${windowHours} hours has expired`, 'WINDOW_EXPIRED');
    }
  }

  const operations = uniqueRecords.map((r) => {
    const filter = scheduledClassId
      ? { studentId: String(r.studentId), scheduledClassId: String(scheduledClassId) }
      : { studentId: String(r.studentId), dateKey, subjectId: normalizedSubjectId };

    return {
      updateOne: {
        filter,
        update: {
          $set: {
            schoolId: String(req.user.schoolId),
            scheduledClassId: scheduledClassId ? String(scheduledClassId) : null,
            facultyId: schedule ? String(schedule.facultyId) : null,
            classId,
            sectionId,
            subjectId: normalizedSubjectId,
            dateKey,
            date: targetDateIso,
            startTime: schedule?.startTime || null,
            endTime: schedule?.endTime || null,
            room: schedule?.room || null,
            status: r.status,
            remarks: r.remarks || '',
            markedById: req.user.id,
          },
        },
        upsert: true,
      },
    };
  });

  if (operations.length > 0) {
    await Attendance.bulkWrite(operations);
  }

  if (schedule) {
    schedule.attendanceMarked = true;
    schedule.attendanceMarkedAt = new Date().toISOString();
    await schedule.save();
  }

  // Trigger intelligence evaluation & notify students marked absent or late
  for (const r of uniqueRecords) {
    evaluateStudentRisk(r.studentId).catch(() => {});
    if (r.status === 'absent' || r.status === 'late') {
      Student.findById(r.studentId)
        .lean()
        .then((stu) => {
          if (stu?.userId) {
            return Notification.create({
              schoolId: req.user.schoolId,
              userId: stu.userId,
              type: 'attendance',
              title: `Attendance Marked: ${r.status === 'absent' ? 'Absent' : 'Late'}`,
              message: `Your attendance for ${dateKey}${schedule?.startTime ? ` (${schedule.startTime}–${schedule.endTime})` : ''} was marked as ${r.status}.`,
              link: '/student/attendance',
            });
          }
        })
        .catch(() => {});
    }
  }

  await recordAudit({
    req,
    action: 'MARK_ATTENDANCE',
    entity: 'Attendance',
    entityId: scheduledClassId ? String(scheduledClassId) : `${classId}-${sectionId}-${dateKey}`,
    after: { count: uniqueRecords.length, dateKey, scheduledClassId: scheduledClassId || null },
  });

  return sendSuccess(res, {
    markedCount: uniqueRecords.length,
    date: dateKey,
    dateKey,
    scheduledClassId: scheduledClassId || null,
  });
});

// ---------------- MARKS ----------------
export const listExams = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.classId) filter.classId = req.query.classId;
  const exams = await Exam.find(filter).sort({ startDate: -1 }).lean();
  return sendSuccess(res, exams);
});

export const createExam = asyncHandler(async (req, res) => {
  const exam = await Exam.create(req.body);
  return sendSuccess(res, exam, 201);
});

export const getMarks = asyncHandler(async (req, res) => {
  const { examId, subjectId, studentId } = req.query;
  const filter = {};
  if (examId) filter.examId = examId;
  if (subjectId) filter.subjectId = subjectId;
  if (studentId) filter.studentId = studentId;

  const marks = await Mark.find(filter)
    .populate({ path: 'studentId', populate: { path: 'userId', select: 'name email' } })
    .populate('subjectId', 'name code maxMarks')
    .lean();

  return sendSuccess(res, marks);
});

export const saveBulkMarks = asyncHandler(async (req, res) => {
  const { examId, subjectId, marks } = req.body;
  // marks: [ { studentId, marksObtained, maxMarks, remarks } ]

  const subject = await Subject.findById(subjectId).lean();
  const maxAllowed = subject?.maxMarks || 100;

  const ops = [];
  for (const m of marks) {
    if (m.marksObtained > (m.maxMarks || maxAllowed)) {
      throw new ApiError(400, `Marks obtained (${m.marksObtained}) cannot exceed max marks (${m.maxMarks || maxAllowed})`, 'INVALID_MARKS');
    }

    ops.push({
      updateOne: {
        filter: { examId, subjectId, studentId: m.studentId },
        update: {
          $set: {
            marksObtained: m.marksObtained,
            maxMarks: m.maxMarks || maxAllowed,
            remarks: m.remarks || '',
            enteredById: req.user.id,
          },
        },
        upsert: true,
      },
    });
  }

  if (ops.length > 0) {
    await Mark.bulkWrite(ops);
  }

  // Trigger intelligence evaluation
  for (const m of marks) {
    evaluateStudentRisk(m.studentId).catch(() => {});
  }

  await recordAudit({
    req,
    action: 'SAVE_MARKS',
    entity: 'Mark',
    entityId: `${examId}-${subjectId}`,
    after: { count: marks.length },
  });

  return sendSuccess(res, { savedCount: marks.length });
});

// ---------------- ASSIGNMENTS & SUBMISSIONS ----------------
export const listAssignments = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.sectionId) filter.sectionId = req.query.sectionId;
  if (req.query.subjectId) filter.subjectId = req.query.subjectId;

  const items = await Assignment.find(filter)
    .populate('classId', 'name')
    .populate('sectionId', 'name')
    .populate('subjectId', 'name code')
    .populate({ path: 'facultyId', populate: { path: 'userId', select: 'name' } })
    .sort({ dueDate: -1 })
    .lean();

  return sendSuccess(res, items);
});

export const createAssignment = asyncHandler(async (req, res) => {
  const fac = await getFacultyDoc(req.user.id);
  let attachmentUrl = '';
  let attachmentStoragePath = '';
  let attachmentFileId = '';
  if (req.file) {
    const uploaded = await uploadFile(req.file, {
      schoolId: req.user.schoolId,
      category: 'assignments',
      uploadedById: req.user.id,
      uploaderName: req.user.name || 'Faculty',
      entityType: 'assignment',
    });
    if (uploaded) {
      attachmentUrl = uploaded.url;
      attachmentStoragePath = uploaded.storagePath;
      attachmentFileId = uploaded.fileId;
    }
  }

  const assignment = await Assignment.create({
    ...req.body,
    schoolId: req.user.schoolId,
    facultyId: fac._id,
    attachmentUrl,
    attachmentStoragePath,
    attachmentFileId,
  });

  return sendSuccess(res, assignment, 201);
});

export const getSubmissions = asyncHandler(async (req, res) => {
  const { assignmentId } = req.params;
  const submissions = await Submission.find({ assignmentId })
    .populate({
      path: 'studentId',
      populate: { path: 'userId', select: 'name email' },
    })
    .lean();

  return sendSuccess(res, submissions);
});

export const gradeSubmission = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { points, feedback } = req.body;

  const submission = await Submission.findByIdAndUpdate(
    id,
    {
      points,
      feedback,
      status: 'graded',
      gradedById: req.user.id,
    },
    { new: true }
  );

  if (!submission) throw new ApiError(404, 'Submission not found', 'NOT_FOUND');
  return sendSuccess(res, submission);
});

// ---------------- STUDY MATERIALS ----------------
export const listStudyMaterials = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.subjectId) filter.subjectId = req.query.subjectId;

  const materials = await StudyMaterial.find(filter)
    .populate('classId', 'name')
    .populate('subjectId', 'name code')
    .populate({ path: 'facultyId', populate: { path: 'userId', select: 'name' } })
    .sort({ createdAt: -1 })
    .lean();

  return sendSuccess(res, materials);
});

export const uploadStudyMaterial = asyncHandler(async (req, res) => {
  const fac = req.user.role === 'faculty' ? await getFacultyDoc(req.user.id) : await Faculty.findOne({ userId: req.user.id });
  if (!req.file) throw new ApiError(400, 'Material file is required', 'FILE_REQUIRED');
  if (!String(req.body.title || '').trim() || !req.body.classId || !req.body.subjectId) {
    throw new ApiError(400, 'Title, class, and subject are required', 'VALIDATION_ERROR');
  }

  const uploaded = await uploadFile(req.file, {
    schoolId: req.user.schoolId,
    category: 'study-materials',
    uploadedById: req.user.id,
    uploaderName: req.user.name || 'Faculty',
    entityType: 'studyMaterial',
  });
  const material = await StudyMaterial.create({
    schoolId: req.user.schoolId,
    title: String(req.body.title).trim(),
    description: String(req.body.description || '').trim(),
    classId: req.body.classId,
    subjectId: req.body.subjectId,
    facultyId: fac?._id || null,
    fileUrl: uploaded.url,
    storagePath: uploaded.storagePath,
    storageFileId: uploaded.fileId,
    fileSizeBytes: uploaded.sizeBytes,
    fileType: req.file.mimetype,
  });

  return sendSuccess(res, material, 201);
});

export const deleteStudyMaterial = asyncHandler(async (req, res) => {
  const mat = await StudyMaterial.findByIdAndDelete(req.params.id);
  if (!mat) throw new ApiError(404, 'Material not found', 'NOT_FOUND');
  if (mat.storageFileId || mat.storagePath) {
    await deleteFile(mat.storageFileId || mat.storagePath, { schoolId: req.user.schoolId }).catch(() => {});
  }
  return sendSuccess(res, { deleted: true });
});

// ---------------- REMARKS ----------------
export const listRemarks = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.studentId) filter.studentId = req.query.studentId;

  const remarks = await Remark.find(filter)
    .populate({ path: 'studentId', populate: { path: 'userId', select: 'name' } })
    .populate({ path: 'facultyId', populate: { path: 'userId', select: 'name' } })
    .sort({ createdAt: -1 })
    .lean();

  return sendSuccess(res, remarks);
});

export const createRemark = asyncHandler(async (req, res) => {
  const fac = await getFacultyDoc(req.user.id);
  const remark = await Remark.create({
    ...req.body,
    facultyId: fac._id,
  });

  return sendSuccess(res, remark, 201);
});

// ---------------- ROSTER & ANALYTICS ----------------
export const getRoster = asyncHandler(async (_req, res) => {
  const [classes, sections, subjects, students] = await Promise.all([
    Class.find().sort({ numericLevel: 1 }).lean(),
    Section.find().populate('classId', 'name').lean(),
    Subject.find().populate('classId', 'name').lean(),
    Student.find({ status: 'active', isDeleted: { $ne: true } })
      .populate('userId', 'name email phone')
      .populate('classId', 'name numericLevel')
      .populate('sectionId', 'name')
      .populate('academicYearId', 'name')
      .lean(),
  ]);
  return sendSuccess(res, { classes, sections, subjects, students });
});

export const getFacultyAnalytics = asyncHandler(async (req, res) => {
  const fac = await getFacultyDoc(req.user.id);
  const assignedSubjects = await Subject.find({ facultyId: fac._id }).populate('classId', 'name').lean();
  const classIds = [...new Set(assignedSubjects.map((s) => s.classId?._id?.toString()).filter(Boolean))];

  const students = await Student.find({ classId: { $in: classIds } })
    .populate('userId', 'name email')
    .populate('classId', 'name')
    .lean();

  return sendSuccess(res, {
    subjects: assignedSubjects,
    totalStudents: students.length,
    classesCount: classIds.length,
  });
});
