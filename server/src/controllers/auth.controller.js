import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { School } from '../models/School.js';
import { PlatformSettings } from '../models/PlatformSettings.js';
import { Student } from '../models/Student.js';
import { Faculty } from '../models/Faculty.js';
import { Parent } from '../models/Parent.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { runWithTenant, runWithoutTenant } from '../utils/tenantContext.js';
import { computeEffectiveSchoolStatus } from '../services/subscription.service.js';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signTokens(user, extraClaims = {}) {
  const accessToken = jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      schoolId: user.schoolId ? user.schoolId.toString() : null,
      ...extraClaims,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );
  const refreshToken = jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      schoolId: user.schoolId ? user.schoolId.toString() : null,
      type: 'refresh',
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );
  return { accessToken, refreshToken };
}

function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  });
}

async function loadRoleProfile(user) {
  if (!user.schoolId || user.role === 'super_admin' || user.role === 'school_admin') {
    return null;
  }
  return runWithTenant(user.schoolId, async () => {
    if (user.role === 'student') {
      return Student.findOne({ userId: user._id }).populate('classId sectionId academicYearId').lean();
    }
    if (user.role === 'faculty') {
      return Faculty.findOne({ userId: user._id }).lean();
    }
    if (user.role === 'parent') {
      return Parent.findOne({ userId: user._id })
        .populate({
          path: 'children',
          populate: [
            { path: 'userId', select: 'name email avatarUrl' },
            { path: 'classId', select: 'name' },
            { path: 'sectionId', select: 'name' },
          ],
        })
        .lean();
    }
    return null;
  });
}

export const login = asyncHandler(async (req, res) => {
  const { email, password, schoolCode } = req.body;
  const cleanEmail = email ? email.trim().toLowerCase() : '';
  const cleanPassword = password ? password.trim() : '';

  const user = await runWithoutTenant(() =>
    User.findOne({ email: cleanEmail }).select('+passwordHash')
  );
  if (!user || user.isActive === false) {
    throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const valid = await user.comparePassword(cleanPassword);
  if (!valid) {
    throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  let school = null;
  let subscription = null;

  if (user.role !== 'super_admin') {
    school = await School.findById(user.schoolId).populate('planId').lean();
    if (!school) {
      throw new ApiError(403, 'Associated school not found', 'SCHOOL_NOT_FOUND');
    }
    if (schoolCode && school.code !== schoolCode.trim().toUpperCase()) {
      throw new ApiError(401, `Invalid school code for this account. Expected code: ${school.code}`, 'INVALID_SCHOOL_CODE');
    }

    subscription = await computeEffectiveSchoolStatus(school);
    if (subscription.isBlocked && (subscription.code === 'SCHOOL_PAUSED' || user.role !== 'school_admin')) {
      const platformSettings = await PlatformSettings.findOne().lean();
      const supportEmail = platformSettings?.supportEmail || 'billing@schoolcloud.io';
      const supportPhone = platformSettings?.supportPhone || '+1-800-555-0199';
      const msg =
        subscription.code === 'SCHOOL_PAUSED'
          ? `${subscription.reason} (Contact: ${supportEmail} · ${supportPhone})`
          : subscription.reason;
      throw new ApiError(402, msg, subscription.code, {
        schoolName: school.name,
        supportEmail,
        supportPhone,
      });
    }
  }

  const { accessToken, refreshToken } = signTokens(user);
  user.refreshTokenHash = hashToken(refreshToken);
  user.lastLoginAt = new Date();
  await runWithoutTenant(() => user.save());

  setRefreshCookie(res, refreshToken);
  const profile = await loadRoleProfile(user);

  return sendSuccess(res, {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
    },
    school: school
      ? {
          id: school._id,
          name: school.name,
          code: school.code,
          logoUrl: school.logoUrl,
          planName: school.planId?.name || 'Trial',
          subscription,
        }
      : null,
    profile,
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) {
    throw new ApiError(401, 'Refresh token missing', 'UNAUTHORIZED');
  }

  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  const user = await runWithoutTenant(() => User.findById(decoded.sub).select('+refreshTokenHash'));
  if (!user || !user.isActive || !user.refreshTokenHash) {
    throw new ApiError(401, 'Invalid refresh session', 'UNAUTHORIZED');
  }

  if (user.refreshTokenHash !== hashToken(token)) {
    throw new ApiError(401, 'Refresh token revoked or rotated', 'UNAUTHORIZED');
  }

  const tokens = signTokens(user);
  user.refreshTokenHash = hashToken(tokens.refreshToken);
  await runWithoutTenant(() => user.save());

  setRefreshCookie(res, tokens.refreshToken);
  return sendSuccess(res, tokens);
});

export const logout = asyncHandler(async (req, res) => {
  if (req.user?.id) {
    await runWithoutTenant(() => User.findByIdAndUpdate(req.user.id, { refreshTokenHash: null }));
  }
  res.clearCookie('refreshToken', { path: '/api/v1/auth' });
  return sendSuccess(res, { loggedOut: true });
});

export const me = asyncHandler(async (req, res) => {
  const user = await runWithoutTenant(() => User.findById(req.user.id).lean());
  if (!user) {
    throw new ApiError(404, 'User not found', 'NOT_FOUND');
  }
  const profile = await loadRoleProfile(user);
  let school = null;
  if (user.schoolId) {
    const s = await School.findById(user.schoolId).populate('planId').lean();
    if (s) {
      const subscription = await computeEffectiveSchoolStatus(s);
      school = {
        id: s._id,
        name: s.name,
        code: s.code,
        logoUrl: s.logoUrl,
        planName: s.planId?.name || 'Trial',
        subscription,
      };
    }
  }
  return sendSuccess(res, {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      lastLoginAt: user.lastLoginAt,
      impersonatedBy: req.user.impersonatedBy || null,
    },
    school,
    profile,
  });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await runWithoutTenant(() => User.findById(req.user.id).select('+passwordHash'));
  if (!user) {
    throw new ApiError(404, 'User not found', 'NOT_FOUND');
  }
  const ok = await user.comparePassword(currentPassword);
  if (!ok) {
    throw new ApiError(400, 'Current password is incorrect', 'INVALID_PASSWORD');
  }
  user.passwordHash = await User.hashPassword(newPassword);
  user.refreshTokenHash = null;
  await runWithoutTenant(() => user.save());
  res.clearCookie('refreshToken', { path: '/api/v1/auth' });
  return sendSuccess(res, { passwordChanged: true });
});
