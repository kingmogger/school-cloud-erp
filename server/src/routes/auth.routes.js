import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { login, refresh, logout, me, changePassword } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, refreshSchema, changePasswordSchema } from '../validators/auth.validator.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 50 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: null, error: { code: 'RATE_LIMITED', message: 'Too many auth attempts, try again later' } },
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate user and return access & refresh tokens
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Authenticated }
 */
router.post('/login', authLimiter, validate({ body: loginSchema }), login);
router.post('/refresh', validate({ body: refreshSchema }), refresh);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, me);
router.patch('/change-password', requireAuth, validate({ body: changePasswordSchema }), changePassword);

export default router;
