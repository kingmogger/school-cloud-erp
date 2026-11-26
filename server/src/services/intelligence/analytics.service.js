import { Mark } from '../../models/Mark.js';
import { Exam } from '../../models/Exam.js';
import { calculateStudentGrades } from './grade.service.js';

export async function calculateExamTrends({ studentId }) {
  const exams = await Exam.find().sort({ startDate: 1 }).lean();
  const trends = [];

  for (const exam of exams) {
    const grades = await calculateStudentGrades({ studentId, examId: exam._id });
    if (grades.subjectsCount > 0) {
      trends.push({
        examId: exam._id,
        examName: exam.name,
        term: exam.term,
        percentage: grades.percentage,
        gpa: grades.gpa,
        overallGrade: grades.overallGrade,
      });
    }
  }

  return trends;
}

export async function calculateSubjectStrengthsWeaknesses({ studentId }) {
  const marks = await Mark.find({ studentId }).populate('subjectId', 'name code').lean();
  if (marks.length === 0) return { strengths: [], weaknesses: [] };

  const subjectMap = {};
  for (const m of marks) {
    const subName = m.subjectId?.name || 'General';
    if (!subjectMap[subName]) subjectMap[subName] = { totalObtained: 0, totalMax: 0 };
    subjectMap[subName].totalObtained += m.marksObtained;
    subjectMap[subName].totalMax += m.maxMarks;
  }

  const subjectAverages = Object.entries(subjectMap).map(([name, data]) => ({
    name,
    percentage: data.totalMax > 0 ? Math.round((data.totalObtained / data.totalMax) * 100) : 0,
  }));

  subjectAverages.sort((a, b) => b.percentage - a.percentage);

  const strengths = subjectAverages.filter((s) => s.percentage >= 75);
  const weaknesses = subjectAverages.filter((s) => s.percentage < 60);

  return { subjectAverages, strengths, weaknesses };
}

export async function compareWithClassAverage({ studentId, classId }) {
  const studentMarks = await Mark.find({ studentId }).populate('subjectId', 'name code').lean();
  const classMarks = await Mark.find()
    .populate({
      path: 'studentId',
      match: { classId },
      select: 'classId',
    })
    .populate('subjectId', 'name code')
    .lean();

  const classSubjectMap = {};
  for (const cm of classMarks) {
    if (!cm.studentId) continue;
    const code = cm.subjectId?.code || 'GEN';
    if (!classSubjectMap[code]) classSubjectMap[code] = { total: 0, count: 0, name: cm.subjectId?.name || code };
    const pct = cm.maxMarks > 0 ? (cm.marksObtained / cm.maxMarks) * 100 : 0;
    classSubjectMap[code].total += pct;
    classSubjectMap[code].count += 1;
  }

  const comparison = studentMarks.map((sm) => {
    const code = sm.subjectId?.code || 'GEN';
    const studentPct = sm.maxMarks > 0 ? Math.round((sm.marksObtained / sm.maxMarks) * 100) : 0;
    const classData = classSubjectMap[code];
    const classAvg = classData && classData.count > 0 ? Math.round(classData.total / classData.count) : studentPct;

    return {
      subject: sm.subjectId?.name || code,
      studentScore: studentPct,
      classAverage: classAvg,
      difference: studentPct - classAvg,
    };
  });

  return comparison;
}
