import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from './asyncHandler.js';
import { runWithoutTenant } from '../utils/tenantContext.js';

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');
  }

  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  const user = await runWithoutTenant(() => User.findById(decoded.sub).lean());
  if (!user || !user.isActive) {
    throw new ApiError(401, 'User account is inactive or not found', 'UNAUTHORIZED');
  }

  req.user = {
    id: user._id.toString(),
    role: user.role,
    schoolId: user.schoolId ? user.schoolId.toString() : null,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    impersonatedBy: decoded.impersonatedBy || null,
  };
  next();
});
