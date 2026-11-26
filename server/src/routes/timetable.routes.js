import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { tenantMiddleware, subscriptionGuard } from '../middleware/tenant.js';
import { getTimetable, saveTimetable } from '../controllers/timetable.controller.js';

const router = Router();

router.use(requireAuth, tenantMiddleware, subscriptionGuard());

router.get('/', getTimetable);
router.put('/', requireRole('school_admin'), saveTimetable);

export default router;
