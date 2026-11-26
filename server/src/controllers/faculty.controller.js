import { Attendance } from '../models/Attendance.js';
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

// ---------------- ATTENDANCE ----------------
export const getAttendance = asyncHandler(async (req, res) => {
  const { classId, sectionId, subjectId, date } = req.query;
  const filter = {};
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
  const { classId, sectionId, subjectId, date, records } = req.body;
  // records: [ { studentId, status, remarks } ]

  const dateKey = normalizeDateKey(date);
  const targetDateIso = `${dateKey}T00:00:00.000Z`;
  const normalizedSubjectId = subjectId || null;

  // Check edit window if records already exist
  const existing = await Attendance.findOne({
    classId,
    sectionId,
    subjectId: normalizedSubjectId,
    dateKey,
  });

  const settings = await SchoolSettings.findOne().lean();
  const windowHours = settings?.attendanceEditWindowHours || 24;

  if (existing) {
    const hoursSinceCreation = (Date.now() - new Date(existing.createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > windowHours && req.user.role !== 'school_admin') {
      throw new ApiError(403, `Attendance edit window of ${windowHours} hours has expired`, 'WINDOW_EXPIRED');
    }
  }

  const operations = records.map((r) => ({
    updateOne: {
      filter: {
        studentId: String(r.studentId),
        dateKey,
        subjectId: normalizedSubjectId,
      },
      update: {
        $set: {
          classId: String(classId),
          sectionId: String(sectionId),
          subjectId: normalizedSubjectId,
          dateKey,
          date: targetDateIso,
          status: r.status,
          remarks: r.remarks || '',
          markedById: req.user.id,
        },
      },
      upsert: true,
    },
  }));

  if (operations.length > 0) {
    await Attendance.bulkWrite(operations);
  }

  // Trigger intelligence evaluation & notify students marked absent or late
  for (const r of records) {
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
              message: `Your attendance for ${dateKey} was marked as ${r.status}.`,
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
    entityId: `${classId}-${sectionId}-${dateKey}`,
    after: { count: records.length, dateKey },
  });

  return sendSuccess(res, { markedCount: records.length, date: dateKey, dateKey });
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
  const fac = await getFacultyDoc(req.user.id);
  if (!req.file) throw new ApiError(400, 'Material file is required', 'FILE_REQUIRED');

  const uploaded = await uploadFile(req.file, {
    schoolId: req.user.schoolId,
    category: 'study-materials',
    uploadedById: req.user.id,
    uploaderName: req.user.name || 'Faculty',
    entityType: 'studyMaterial',
  });
  const material = await StudyMaterial.create({
    schoolId: req.user.schoolId,
    title: req.body.title,
    description: req.body.description || '',
    classId: req.body.classId,
    subjectId: req.body.subjectId,
    facultyId: fac._id,
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
    Student.find({ status: 'active' }).populate('userId', 'name email').populate('classId', 'name').populate('sectionId', 'name').lean(),
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
