import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { tenantMiddleware, subscriptionGuard } from '../middleware/tenant.js';
import {
  listStructures,
  createStructure,
  listPayments,
  createPayment,
  downloadReceipt,
} from '../controllers/fee.controller.js';

const router = Router();

router.use(requireAuth, tenantMiddleware, subscriptionGuard());

router.get('/structures', listStructures);
router.post('/structures', requireRole('school_admin'), createStructure);

router.get('/payments', listPayments);
router.post('/payments', requireRole('school_admin'), createPayment);
router.get('/payments/:id/receipt', downloadReceipt);

export default router;
