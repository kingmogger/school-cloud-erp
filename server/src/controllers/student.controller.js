import { Student } from '../models/Student.js';
import { Attendance } from '../models/Attendance.js';
import { Mark } from '../models/Mark.js';
import { Exam } from '../models/Exam.js';
import { Assignment } from '../models/Assignment.js';
import { Submission } from '../models/Submission.js';
import { Timetable } from '../models/Timetable.js';
import { StudyMaterial } from '../models/StudyMaterial.js';
import { SchoolSettings } from '../models/SchoolSettings.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { uploadFile } from '../services/storage.service.js';
import { generateReportCardBuffer } from '../services/pdf.service.js';
import {
  calculateStudentAttendance,
  calculateStudentGrades,
  calculateExamTrends,
  calculateSubjectStrengthsWeaknesses,
  evaluateStudentRisk,
} from '../services/intelligence/index.js';

async function getStudentDoc(userId) {
  const student = await Student.findOne({ userId })
    .populate('userId', 'name email phone avatarUrl')
    .populate('classId', 'name numericLevel')
    .populate('sectionId', 'name')
    .populate('academicYearId', 'name isCurrent');
  if (!student) throw new ApiError(403, 'Student profile not found', 'FORBIDDEN');
  return student;
}

export const getProfile = asyncHandler(async (req, res) => {
  const student = await getStudentDoc(req.user.id);
  const attendance = await calculateStudentAttendance({ studentId: student._id });
  const grades = await calculateStudentGrades({ studentId: student._id });
  const trends = await calculateExamTrends({ studentId: student._id });
  const strengthsWeaknesses = await calculateSubjectStrengthsWeaknesses({ studentId: student._id });

  return sendSuccess(res, {
    student,
    attendance,
    grades,
    trends,
    strengthsWeaknesses,
  });
});

export const getAttendance = asyncHandler(async (req, res) => {
  const student = await getStudentDoc(req.user.id);
  const summary = await calculateStudentAttendance({ studentId: student._id });
  const records = await Attendance.find({ studentId: student._id })
    .populate('subjectId', 'name code')
    .sort({ date: -1 })
    .limit(100)
    .lean();

  return sendSuccess(res, { summary, records });
});

export const getResults = asyncHandler(async (req, res) => {
  const student = await getStudentDoc(req.user.id);
  const exams = await Exam.find().sort({ startDate: -1 }).lean();

  const resultsByExam = [];
  const scheduledExams = [];
  const studentClassId = student.classId?._id ? String(student.classId._id) : String(student.classId || '');

  for (const exam of exams) {
    const examClassId = exam.classId ? String(exam.classId) : null;
    if (examClassId && studentClassId && examClassId !== studentClassId) {
      continue;
    }

    const gradeData = await calculateStudentGrades({ studentId: student._id, examId: exam._id });
    if (gradeData.subjectsCount > 0) {
      resultsByExam.push({
        exam,
        ...gradeData,
      });
    } else {
      scheduledExams.push(exam);
    }
  }

  return sendSuccess(res, {
    results: resultsByExam,
    publishedResults: resultsByExam,
    scheduledExams,
  });
});

export const downloadReportCard = asyncHandler(async (req, res) => {
  const student = await getStudentDoc(req.user.id);
  const { examId } = req.params;
  const exam = await Exam.findById(examId).lean();
  if (!exam) throw new ApiError(404, 'Exam not found', 'NOT_FOUND');

  const gradeSummary = await calculateStudentGrades({ studentId: student._id, examId: exam._id });
  const schoolSettings = await SchoolSettings.findOne().lean();

  const buffer = await generateReportCardBuffer(student, exam, gradeSummary.marksList, gradeSummary, schoolSettings);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=ReportCard_${student.admissionNo}_${exam.name.replace(/\s+/g, '_')}.pdf`);
  return res.send(buffer);
});

export const getAssignments = asyncHandler(async (req, res) => {
  const student = await getStudentDoc(req.user.id);
  const assignments = await Assignment.find({ classId: student.classId._id })
    .populate('subjectId', 'name code')
    .populate({ path: 'facultyId', populate: { path: 'userId', select: 'name' } })
    .sort({ dueDate: -1 })
    .lean();

  const submissions = await Submission.find({ studentId: student._id }).lean();
  const subMap = {};
  for (const s of submissions) {
    subMap[s.assignmentId.toString()] = s;
  }

  const list = assignments.map((a) => ({
    ...a,
    submission: subMap[a._id.toString()] || null,
  }));

  return sendSuccess(res, list);
});

export const submitAssignment = asyncHandler(async (req, res) => {
  const student = await getStudentDoc(req.user.id);
  const { id } = req.params;

  const assignment = await Assignment.findById(id).lean();
  if (!assignment) throw new ApiError(404, 'Assignment not found', 'NOT_FOUND');

  if (!req.file) throw new ApiError(400, 'Submission file is required', 'FILE_REQUIRED');
  const uploaded = await uploadFile(req.file, 'submissions');

  const isLate = new Date() > new Date(assignment.dueDate);
  const submission = await Submission.findOneAndUpdate(
    { assignmentId: id, studentId: student._id },
    {
      assignmentId: id,
      studentId: student._id,
      fileUrl: uploaded.url,
      submittedAt: new Date(),
      status: isLate ? 'late' : 'submitted',
    },
    { upsert: true, new: true }
  );

  evaluateStudentRisk(student._id).catch(() => {});
  return sendSuccess(res, submission, 201);
});

export const getTimetable = asyncHandler(async (req, res) => {
  const student = await getStudentDoc(req.user.id);
  const timetable = await Timetable.find({
    classId: student.classId._id,
    sectionId: student.sectionId._id,
  })
    .populate({ path: 'slots.subjectId', select: 'name code' })
    .populate({ path: 'slots.facultyId', populate: { path: 'userId', select: 'name' } })
    .lean();

  return sendSuccess(res, timetable);
});

export const getStudyMaterials = asyncHandler(async (req, res) => {
  const student = await getStudentDoc(req.user.id);
  const materials = await StudyMaterial.find({ classId: student.classId._id })
    .populate('subjectId', 'name code')
    .populate({ path: 'facultyId', populate: { path: 'userId', select: 'name' } })
    .sort({ createdAt: -1 })
    .lean();

  return sendSuccess(res, materials);
});
