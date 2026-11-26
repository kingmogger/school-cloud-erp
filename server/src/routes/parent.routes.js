import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { tenantMiddleware, subscriptionGuard } from '../middleware/tenant.js';
import {
  getChildren,
  getChildOverview,
  getChildAttendance,
  getChildResults,
  getChildFees,
  getChildRemarks,
  getNotifications,
  markNotificationRead,
} from '../controllers/parent.controller.js';

const router = Router();

router.use(requireAuth, tenantMiddleware, subscriptionGuard(), requireRole('parent'));

router.get('/children', getChildren);
router.get('/children/:studentId/overview', getChildOverview);
router.get('/children/:studentId/attendance', getChildAttendance);
router.get('/children/:studentId/results', getChildResults);
router.get('/children/:studentId/fees', getChildFees);
router.get('/children/:studentId/remarks', getChildRemarks);

router.get('/notifications', getNotifications);
router.patch('/notifications/:id/read', markNotificationRead);

export default router;
