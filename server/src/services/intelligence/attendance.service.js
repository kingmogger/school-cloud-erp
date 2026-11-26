import { Attendance } from '../../models/Attendance.js';
import { SchoolSettings } from '../../models/SchoolSettings.js';

export async function calculateStudentAttendance({ studentId, subjectId = null, startDate = null, endDate = null }) {
  const filter = { studentId };
  if (subjectId) filter.subjectId = subjectId;
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) filter.date.$lte = new Date(endDate);
  }

  const records = await Attendance.find(filter).lean();
  const total = records.length;
  if (total === 0) {
    return {
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      percentage: 100, // default if no classes held
      isShortage: false,
      threshold: 75,
    };
  }

  let present = 0;
  let absent = 0;
  let late = 0;
  let excused = 0;

  for (const r of records) {
    if (r.status === 'present') present += 1;
    else if (r.status === 'absent') absent += 1;
    else if (r.status === 'late') {
      late += 1;
      present += 0.5; // late counts as half present
    } else if (r.status === 'excused') {
      excused += 1;
      present += 1; // excused counts as attended
    }
  }

  const percentage = Math.round((present / total) * 100 * 10) / 10;
  const settings = await SchoolSettings.findOne().lean();
  const threshold = settings?.attendanceThreshold || 75;

  return {
    total,
    present: Math.floor(present),
    absent,
    late,
    excused,
    percentage,
    isShortage: percentage < threshold,
    threshold,
  };
}

export async function calculateClassAttendance({ classId, sectionId = null, date = null }) {
  const filter = { classId };
  if (sectionId) filter.sectionId = sectionId;
  if (date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    filter.date = { $gte: d, $lte: end };
  }

  const records = await Attendance.find(filter).lean();
  const total = records.length;
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const r of records) {
    if (counts[r.status] !== undefined) counts[r.status] += 1;
  }

  const attended = counts.present + counts.late * 0.5 + counts.excused;
  const percentage = total > 0 ? Math.round((attended / total) * 100 * 10) / 10 : 100;
  return { total, counts, percentage };
}
