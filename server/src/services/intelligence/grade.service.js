import { Mark } from '../../models/Mark.js';
import { SchoolSettings } from '../../models/SchoolSettings.js';

export function resolveGrade(percentage, gradingScale) {
  const scale = gradingScale || [
    { grade: 'A+', minPercentage: 90, maxPercentage: 100, gpa: 4.0, remark: 'Outstanding' },
    { grade: 'A', minPercentage: 80, maxPercentage: 89.99, gpa: 3.7, remark: 'Excellent' },
    { grade: 'B+', minPercentage: 70, maxPercentage: 79.99, gpa: 3.3, remark: 'Very Good' },
    { grade: 'B', minPercentage: 60, maxPercentage: 69.99, gpa: 3.0, remark: 'Good' },
    { grade: 'C', minPercentage: 50, maxPercentage: 59.99, gpa: 2.3, remark: 'Satisfactory' },
    { grade: 'D', minPercentage: 40, maxPercentage: 49.99, gpa: 1.5, remark: 'Pass' },
    { grade: 'F', minPercentage: 0, maxPercentage: 39.99, gpa: 0.0, remark: 'Needs Improvement' },
  ];

  for (const band of scale) {
    if (percentage >= band.minPercentage && percentage <= band.maxPercentage) {
      return band;
    }
  }

  if (percentage >= 90) return scale[0];
  return scale[scale.length - 1];
}

export async function calculateStudentGrades({ studentId, examId = null }) {
  const filter = { studentId };
  if (examId) filter.examId = examId;

  const marks = await Mark.find(filter).populate('subjectId', 'name code credits passMarks maxMarks').lean();
  if (marks.length === 0) {
    return {
      subjectsCount: 0,
      totalObtained: 0,
      totalMax: 0,
      percentage: 0,
      gpa: 0,
      overallGrade: 'N/A',
      marksList: [],
    };
  }

  const settings = await SchoolSettings.findOne().lean();
  const gradingScale = settings?.gradingScale;

  let totalObtained = 0;
  let totalMax = 0;
  let weightedGpaSum = 0;
  let totalCredits = 0;

  const marksList = marks.map((m) => {
    const pct = m.maxMarks > 0 ? (m.marksObtained / m.maxMarks) * 100 : 0;
    const gradeBand = resolveGrade(pct, gradingScale);
    const credits = m.subjectId?.credits || 1;
    totalObtained += m.marksObtained;
    totalMax += m.maxMarks;
    weightedGpaSum += gradeBand.gpa * credits;
    totalCredits += credits;

    return {
      subjectId: m.subjectId?._id,
      subjectName: m.subjectId?.name || 'Subject',
      subjectCode: m.subjectId?.code || '',
      marksObtained: m.marksObtained,
      maxMarks: m.maxMarks,
      percentage: Math.round(pct * 10) / 10,
      grade: gradeBand.grade,
      gpa: gradeBand.gpa,
      isPass: m.marksObtained >= (m.subjectId?.passMarks ?? 40),
      remarks: m.remarks,
    };
  });

  const percentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100 * 10) / 10 : 0;
  const overallBand = resolveGrade(percentage, gradingScale);
  const gpa = totalCredits > 0 ? Math.round((weightedGpaSum / totalCredits) * 100) / 100 : 0;

  return {
    subjectsCount: marks.length,
    totalObtained,
    totalMax,
    percentage,
    gpa,
    overallGrade: overallBand.grade,
    marksList,
  };
}

export async function calculateClassRanks({ examId, classId }) {
  // Aggregate all marks per student for this exam
  const marks = await Mark.find({ examId })
    .populate({ path: 'studentId', match: { classId } })
    .lean();

  const studentAgg = {};
  for (const m of marks) {
    if (!m.studentId) continue;
    const sId = m.studentId._id.toString();
    if (!studentAgg[sId]) {
      studentAgg[sId] = { studentId: sId, totalObtained: 0, totalMax: 0 };
    }
    studentAgg[sId].totalObtained += m.marksObtained;
    studentAgg[sId].totalMax += m.maxMarks;
  }

  const list = Object.values(studentAgg).map((item) => ({
    ...item,
    percentage: item.totalMax > 0 ? Math.round((item.totalObtained / item.totalMax) * 100 * 10) / 10 : 0,
  }));

  list.sort((a, b) => b.percentage - a.percentage);

  const ranks = {};
  list.forEach((item, index) => {
    ranks[item.studentId] = index + 1;
  });

  return ranks;
}
