import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { tenantMiddleware, subscriptionGuard } from '../middleware/tenant.js';
import { generateReport } from '../controllers/report.controller.js';

const router = Router();

router.use(requireAuth, tenantMiddleware, subscriptionGuard(), requireRole('school_admin'));

router.get('/:type', generateReport);

export default router;
