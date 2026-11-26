import { RiskAlert } from '../../models/RiskAlert.js';
import { Student } from '../../models/Student.js';
import { Assignment } from '../../models/Assignment.js';
import { Submission } from '../../models/Submission.js';
import { Notification } from '../../models/Notification.js';
import { calculateStudentAttendance } from './attendance.service.js';
import { calculateStudentGrades } from './grade.service.js';

export async function evaluateStudentRisk(studentId, academicYearId = null) {
  const student = await Student.findById(studentId).populate('userId classId sectionId parentIds').lean();
  if (!student) return null;

  const yearId = academicYearId || student.academicYearId;

  // 1. Attendance Metrics
  const attData = await calculateStudentAttendance({ studentId });

  // 2. Academic Grades Metrics
  const gradeData = await calculateStudentGrades({ studentId });

  // 3. Assignment Metrics
  const classAssignments = await Assignment.find({ classId: student.classId }).lean();
  const studentSubmissions = await Submission.find({ studentId }).lean();
  const submittedAssignmentIds = new Set(studentSubmissions.map((s) => s.assignmentId.toString()));
  const now = new Date();
  let missedAssignments = 0;
  for (const a of classAssignments) {
    if (new Date(a.dueDate) < now && !submittedAssignmentIds.has(a._id.toString())) {
      missedAssignments += 1;
    }
  }

  // 4. Calculate failed subjects
  const failedSubjects = gradeData.marksList.filter((m) => !m.isPass);

  // Scoring engine (0 - 100 risk score, higher = more danger)
  let riskScore = 0;
  const reasons = [];

  // Attendance penalty
  if (attData.percentage < 65) {
    riskScore += 40;
    reasons.push(`Critically low attendance (${attData.percentage}%) below 65% minimum`);
  } else if (attData.percentage < attData.threshold) {
    riskScore += 25;
    reasons.push(`Attendance (${attData.percentage}%) below required threshold (${attData.threshold}%)`);
  }

  // Failing subjects penalty
  if (failedSubjects.length > 0) {
    riskScore += failedSubjects.length * 20;
    reasons.push(`Failing in ${failedSubjects.length} subject(s): ${failedSubjects.map((s) => s.subjectName).join(', ')}`);
  }

  // Overall grade percentage
  if (gradeData.subjectsCount > 0 && gradeData.percentage < 50) {
    riskScore += 20;
    reasons.push(`Low academic overall average (${gradeData.percentage}%)`);
  }

  // Missed assignments
  if (missedAssignments > 0) {
    riskScore += Math.min(25, missedAssignments * 8);
    reasons.push(`${missedAssignments} overdue/unsubmitted assignment(s)`);
  }

  riskScore = Math.min(100, riskScore);

  let level = 'low';
  if (riskScore >= 65) level = 'high';
  else if (riskScore >= 35) level = 'medium';

  // Upsert risk alert
  const alert = await RiskAlert.findOneAndUpdate(
    { studentId, academicYearId: yearId },
    {
      studentId,
      academicYearId: yearId,
      level,
      score: riskScore,
      reasons,
      metrics: {
        attendancePct: attData.percentage,
        failedSubjectsCount: failedSubjects.length,
        averageMarksPct: gradeData.percentage,
        missedAssignmentsCount: missedAssignments,
      },
      resolved: level === 'low',
    },
    { upsert: true, new: true }
  );

  // Notify parents and faculty if Medium or High risk
  if (level === 'high' || level === 'medium') {
    // Notify student user
    if (student.userId) {
      await Notification.create({
        userId: student.userId._id,
        type: 'risk',
        title: `Academic Performance Alert (${level.toUpperCase()})`,
        message: `Your current risk score is ${riskScore}%. Review your attendance and marks.`,
        link: '/student/profile',
      });
    }

    // Notify parents
    if (student.parentIds && student.parentIds.length > 0) {
      for (const p of student.parentIds) {
        if (p.userId) {
          await Notification.create({
            userId: p.userId,
            type: 'risk',
            title: `Student Academic Alert: ${student.userId?.name} (${level.toUpperCase()})`,
            message: reasons.join('; '),
            link: '/parent/results',
          });
        }
      }
    }
  }

  return alert;
}

export async function evaluateAllStudentsRisk(academicYearId = null) {
  const students = await Student.find({ status: 'active' }).select('_id academicYearId').lean();
  const results = [];
  for (const s of students) {
    const alert = await evaluateStudentRisk(s._id, academicYearId || s.academicYearId);
    if (alert) results.push(alert);
  }
  return results;
}
