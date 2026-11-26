import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { tenantMiddleware, subscriptionGuard } from '../middleware/tenant.js';
import { upload } from '../middleware/upload.js';
import {
  getProfile,
  getAttendance,
  getResults,
  downloadReportCard,
  getAssignments,
  submitAssignment,
  getTimetable,
  getStudyMaterials,
  getStudentNotifications,
  markStudentNotificationRead,
} from '../controllers/student.controller.js';

const router = Router();

router.use(requireAuth, tenantMiddleware, subscriptionGuard(), requireRole('student'));

router.get('/profile', getProfile);
router.get('/attendance', getAttendance);
router.get('/results', getResults);
router.get('/report-card/:examId', downloadReportCard);
router.get('/assignments', getAssignments);
router.post('/assignments/:id/submit', upload.single('file'), submitAssignment);
router.get('/timetable', getTimetable);
router.get('/materials', getStudyMaterials);
router.get('/notifications', getStudentNotifications);
router.patch('/notifications/:id/read', markStudentNotificationRead);

export default router;
