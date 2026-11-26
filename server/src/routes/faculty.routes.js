import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { tenantMiddleware, subscriptionGuard } from '../middleware/tenant.js';
import { upload } from '../middleware/upload.js';
import {
  getAttendance,
  markBulkAttendance,
  listExams,
  createExam,
  getMarks,
  saveBulkMarks,
  listAssignments,
  createAssignment,
  getSubmissions,
  gradeSubmission,
  listStudyMaterials,
  uploadStudyMaterial,
  deleteStudyMaterial,
  listRemarks,
  createRemark,
  getRoster,
  getFacultyAnalytics,
} from '../controllers/faculty.controller.js';

const router = Router();

router.use(requireAuth, tenantMiddleware, subscriptionGuard(), requireRole('faculty', 'school_admin'));

// Attendance
router.get('/attendance', getAttendance);
router.post('/attendance/bulk', markBulkAttendance);

// Exams & Marks
router.get('/exams', listExams);
router.post('/exams', createExam);
router.get('/marks', getMarks);
router.post('/marks/bulk', saveBulkMarks);

// Assignments & Grading
router.get('/assignments', listAssignments);
router.post('/assignments', upload.single('attachment'), createAssignment);
router.get('/assignments/:assignmentId/submissions', getSubmissions);
router.patch('/submissions/:id/grade', gradeSubmission);

// Study Materials
router.get('/materials', listStudyMaterials);
router.post('/materials', upload.single('file'), uploadStudyMaterial);
router.delete('/materials/:id', deleteStudyMaterial);

// Remarks
router.get('/remarks', listRemarks);
router.post('/remarks', createRemark);

// Roster & Analytics
router.get('/roster', getRoster);
router.get('/analytics', getFacultyAnalytics);

export default router;
