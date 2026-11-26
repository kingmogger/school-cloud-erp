import { FirestoreModel } from './FirestoreModel.js';

export const User = new FirestoreModel('users', {}, { hasTenant: true });
User.hashPassword = FirestoreModel.hashPassword;

export const School = new FirestoreModel('schools', {}, { hasTenant: false });
export const AcademicYear = new FirestoreModel('academicYears', {}, { hasTenant: true });
export const SchoolSettings = new FirestoreModel('schoolSettings', {}, { hasTenant: true });
export const Class = new FirestoreModel('classes', {}, { hasTenant: true });
export const Section = new FirestoreModel('sections', {}, { hasTenant: true });
export const Subject = new FirestoreModel('subjects', {}, { hasTenant: true });
export const Faculty = new FirestoreModel('faculties', {}, { hasTenant: true });
export const Student = new FirestoreModel('students', {}, { hasTenant: true });
export const Parent = new FirestoreModel('parents', {}, { hasTenant: true });
export const Attendance = new FirestoreModel('attendances', {}, { hasTenant: true });
export const Exam = new FirestoreModel('exams', {}, { hasTenant: true });
export const Mark = new FirestoreModel('marks', {}, { hasTenant: true });
export const Assignment = new FirestoreModel('assignments', {}, { hasTenant: true });
export const Submission = new FirestoreModel('submissions', {}, { hasTenant: true });
export const StudyMaterial = new FirestoreModel('studyMaterials', {}, { hasTenant: true });
export const Remark = new FirestoreModel('remarks', {}, { hasTenant: true });
export const Timetable = new FirestoreModel('timetables', {}, { hasTenant: true });
export const FeeStructure = new FirestoreModel('feeStructures', {}, { hasTenant: true });
export const FeePayment = new FirestoreModel('feePayments', {}, { hasTenant: true });
export const Notification = new FirestoreModel('notifications', {}, { hasTenant: true });
export const RiskAlert = new FirestoreModel('riskAlerts', {}, { hasTenant: true });
export const AuditLog = new FirestoreModel('auditLogs', {}, { hasTenant: true });
export const PlatformSettings = new FirestoreModel('platformSettings', {}, { hasTenant: false });
export const SubscriptionPlan = new FirestoreModel('subscriptionPlans', {}, { hasTenant: false });
export const PlatformPayment = new FirestoreModel('platformPayments', {}, { hasTenant: false });
export const PlatformAuditLog = new FirestoreModel('platformAuditLogs', {}, { hasTenant: false });
export const StorageFile = new FirestoreModel('storageFiles', {}, { hasTenant: true });
export const StorageSnapshot = new FirestoreModel('storageSnapshots', {}, { hasTenant: true });

export const ALL_MODELS = {
  users: User,
  schools: School,
  academicYears: AcademicYear,
  schoolSettings: SchoolSettings,
  classes: Class,
  sections: Section,
  subjects: Subject,
  faculties: Faculty,
  students: Student,
  parents: Parent,
  attendances: Attendance,
  exams: Exam,
  marks: Mark,
  assignments: Assignment,
  submissions: Submission,
  studyMaterials: StudyMaterial,
  remarks: Remark,
  timetables: Timetable,
  feeStructures: FeeStructure,
  feePayments: FeePayment,
  notifications: Notification,
  riskAlerts: RiskAlert,
  auditLogs: AuditLog,
  platformSettings: PlatformSettings,
  subscriptionPlans: SubscriptionPlan,
  platformPayments: PlatformPayment,
  platformAuditLogs: PlatformAuditLog,
  storageFiles: StorageFile,
  storageSnapshots: StorageSnapshot,
};
