import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { swaggerSpec } from './config/swagger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { sendSuccess, sendError } from './utils/ApiResponse.js';
import authRoutes from './routes/auth.routes.js';
import superadminRoutes from './routes/superadmin.routes.js';
import adminRoutes from './routes/admin.routes.js';
import facultyRoutes from './routes/faculty.routes.js';
import studentRoutes from './routes/student.routes.js';
import parentRoutes from './routes/parent.routes.js';
import feeRoutes from './routes/fee.routes.js';
import timetableRoutes from './routes/timetable.routes.js';
import intelligenceRoutes from './routes/intelligence.routes.js';
import reportRoutes from './routes/report.routes.js';
import databaseRoutes from './routes/database.routes.js';
import storageRoutes from './routes/storage.routes.js';

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests from local network, tunnels, and configured origins
        if (!origin || env.NODE_ENV === 'development') {
          return callback(null, true);
        }
        const allowed = env.CLIENT_ORIGIN.split(',').map((s) => s.trim());
        if (allowed.includes(origin) || allowed.includes('*')) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(mongoSanitize());

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/v1', apiLimiter);

  // Local upload fallback static serving
  const uploadsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads');
  app.use('/uploads', express.static(uploadsDir));
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

  app.get('/api/health', (_req, res) => {
    return sendSuccess(res, { status: 'ok', env: env.NODE_ENV, timestamp: new Date().toISOString() });
  });

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Versioned API routes
  app.use('/api/v1/database', databaseRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/superadmin', superadminRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/faculty', facultyRoutes);
  app.use('/api/v1/student', studentRoutes);
  app.use('/api/v1/parent', parentRoutes);
  app.use('/api/v1/fees', feeRoutes);
  app.use('/api/v1/timetable', timetableRoutes);
  app.use('/api/v1/intelligence', intelligenceRoutes);
  app.use('/api/v1/reports', reportRoutes);
  app.use('/api/v1/storage', storageRoutes);

  app.use((req, res) => {
    return sendError(res, 404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`);
  });

  app.use(errorHandler);

  return app;
}
