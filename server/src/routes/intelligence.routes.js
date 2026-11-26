import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { tenantMiddleware, subscriptionGuard } from '../middleware/tenant.js';
import {
  listRiskAlerts,
  resolveRiskAlert,
  evaluateAll,
  getStudentIntelligenceSummary,
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsRead,
} from '../controllers/intelligence.controller.js';

const router = Router();

router.use(requireAuth, tenantMiddleware, subscriptionGuard());

router.get('/risk-alerts', requireRole('school_admin', 'faculty'), listRiskAlerts);
router.patch('/risk-alerts/:id/resolve', requireRole('school_admin', 'faculty'), resolveRiskAlert);
router.post('/evaluate-all', requireRole('school_admin'), evaluateAll);
router.get('/student/:studentId', getStudentIntelligenceSummary);

router.get('/notifications', listNotifications);
router.patch('/notifications/read-all', markAllNotificationsRead);
router.patch('/notifications/:id/read', markNotificationAsRead);

export default router;
