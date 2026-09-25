import { Prisma } from '@prisma/client';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import catchAsync from '../utils/catchAsync';
import { NotFoundError, AuthenticationError, AuthorizationError, AppError, ValidationError } from '../utils/appError';
import { Request, Response, NextFunction } from 'express';
import { generateTOTPSecret, generateQRCodeURL, verifyTOTP } from '../utils/twoFactor.utils';
import { isMandatory2FARole } from '../utils/twoFactorConfig';
import { getScopeWhere } from '../utils/scope.utils';
import {
  deactivateUserAndRevokeSessions,
  setUserAndRoleActiveState,
} from '../services/studentStatus.service';
import { replacePasswordAndRevokeAllUserSessions } from '../services/session.service';
import { assertPasswordStrength } from '../utils/passwordPolicy';
import { encrypt, decrypt } from '../utils/encryption.utils';

// 1. setup2FA — Generates secret and returns QR code for scanning:
export const setup2FA = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { currentPassword } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return next(new NotFoundError('User not found'));
  if (user!.twoFactorEnabled) return next(new AppError('2FA is already enabled', 400));
  const passwordMatches = await bcrypt.compare(currentPassword, user.password);
  if (!passwordMatches) return next(new AuthenticationError('Incorrect current password'));

  const secret = generateTOTPSecret(user!.email);
  // Store secret temporarily (not enabling yet until verified)
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: req.user!.id },
      data: { twoFactorSecret: encrypt(secret.base32) },
    });
    await auditLog(
      'SETUP_2FA',
      'User',
      req.user!.id,
      req,
      { twoFactorSetupChanged: true },
      tx
    );
  });

  const qrCodeUrl = await generateQRCodeURL(secret.otpauth_url!);
  return res.json({ success: true, data: { qrCodeUrl, manualEntryKey: secret.base32 } });
});

// 2. enable2FA — Verifies the first TOTP code and enables 2FA:
export const enable2FA = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { token, currentPassword } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });

  if (!user) return next(new NotFoundError('User not found'));
  if (!user!.twoFactorSecret) return next(new AppError('Run 2FA setup first', 400));
  if (user!.twoFactorEnabled) return next(new AppError('2FA is already enabled', 400));
  if (!token) return next(new AppError('Verification code is required', 400));
  const passwordMatches = await bcrypt.compare(currentPassword, user.password);
  if (!passwordMatches) return next(new AuthenticationError('Incorrect current password'));

  const isValid = await verifyTOTP(decrypt(user!.twoFactorSecret), token, user.id);
  if (!isValid) return next(new AppError('Invalid verification code', 400));

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: req.user!.id },
      data: { twoFactorEnabled: true },
    });
    await auditLog(
      'ENABLE_2FA',
      'User',
      req.user!.id,
      req,
      { twoFactorEnabled: { from: false, to: true } },
      tx
    );
  });
  return res.json({ success: true, message: '2FA enabled successfully' });
});

// 3. disable2FA — Verifies password + TOTP before disabling:
export const disable2FA = catchAsync(async (req: Request, res: Response, next: NextFunction) => {

  const require2FA = process.env.REQUIRE_2FA !== 'false';
  if (require2FA && isMandatory2FARole(req.user?.role)) {
    return next(
      new AuthorizationError(
        'Two-factor authentication is mandatory for your role and cannot be disabled.'
      )
    );
  }

  const { token, password } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return next(new NotFoundError('User not found'));
  if (require2FA && isMandatory2FARole(user.role)) {
    return next(
      new AuthorizationError(
        'Two-factor authentication is mandatory for your role and cannot be disabled.'
      )
    );
  }

  if (!user!.twoFactorEnabled) return next(new AppError('2FA is not enabled', 400));

  const passwordMatch = await bcrypt.compare(password, user!.password);
  if (!passwordMatch) return next(new AppError('Incorrect password', 401));

  const isValid = await verifyTOTP(decrypt(user!.twoFactorSecret!), token, user!.id);
  if (!isValid) return next(new AppError('Invalid verification code', 400));
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: req.user!.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    await auditLog(
      'DISABLE_2FA',
      'User',
      req.user!.id,
      req,
      { twoFactorEnabled: { from: true, to: false } },
      tx
    );
  });
  return res.json({ success: true, message: '2FA disabled successfully' });
});

// @desc    Get current user profile
// @route   GET /api/users/profile
// @access  Private
export const getProfile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const role = req.user!.role;

  let profileData: any;

  if (role === 'STUDENT') {
    profileData = await prisma.student.findUnique({
      where: { userId },
      include: {
        department: {
          include: {
            college: true,
          },
        },
        enrollments: { include: { course: true } },
        group: true,
        payments: true,
      },
    });

    if (profileData && profileData.group) {
      let currentGroup = profileData.group as any;
      while (currentGroup.parentGroupId) {
        const parent = await prisma.studentGroup.findUnique({
          where: { id: currentGroup.parentGroupId },
        });
        if (!parent) break;
        currentGroup.parentGroup = parent;
        currentGroup = parent;
      }
    }
  } else if (role === 'DOCTOR') {
    profileData = await prisma.doctor.findUnique({
      where: { userId },
      include: {
        department: {
          include: {
            college: true,
          },
        },
      },
    });
  } else {
    // Admin roles
    profileData = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        adminRole: true,
        createdAt: true,
      },
    });
  }

  if (!profileData) {
    return next(new NotFoundError('Profile not found'));
  }

  return res.json({
    success: true,
    data: {
      ...profileData,
      email: req.user!.email, // Ensure email is included
      profilePicture: req.user!.profilePicture, // Include profile picture from user model
    },
  });
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const role = req.user!.role;
  const { firstName, lastName, phone, address, bio, gender, birthDate } = req.body;

  let updatedProfile: any;

  const updateData = {
    firstName,
    lastName,
    phone,
    address,
    bio,
    gender,
    birthDate: birthDate ? new Date(birthDate) : undefined,
  };

  if (role === 'STUDENT' || ['DOCTOR', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(role)) {
    updatedProfile = await prisma.$transaction(async (tx) => {
      const before = role === 'STUDENT'
        ? await tx.student.findUnique({ where: { userId } })
        : await tx.doctor.findUnique({ where: { userId } });
      const updated = role === 'STUDENT'
        ? await tx.student.update({ where: { userId }, data: updateData })
        : await tx.doctor.update({ where: { userId }, data: updateData });
      await auditLog(
        'UPDATE_PROFILE',
        role === 'STUDENT' ? 'Student' : 'Doctor',
        updated.id,
        req,
        { before, after: updated },
        tx
      );
      return updated;
    });
  } else {
    // Admin roles — update directly on User model (limited fields)
    updatedProfile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        adminRole: true,
        createdAt: true,
        profilePicture: true,
      },
    });
    // Return current data with a helpful message
    return res.json({
      success: true,
      data: updatedProfile,
      message:
        'Admin profile data shown. To update name details, use the doctor profile associated with this account if applicable.',
    });
  }

  return res.json({
    success: true,
    data: updatedProfile,
  });
});

// @desc    Update password
// @route   PUT /api/users/profile/password
// @access  Private
export const updatePassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;
    assertPasswordStrength(newPassword);

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return next(new NotFoundError('User not found'));
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return next(new AuthenticationError('Incorrect current password'));
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await replacePasswordAndRevokeAllUserSessions(userId, hashedPassword, async (tx) => {
      await auditLog(
        'UPDATE_PASSWORD',
        'User',
        userId,
        req,
        { passwordChanged: true, sessionsRevoked: true },
        tx
      );
    });

    return res.json({
      success: true,
      message: 'Password updated successfully',
    });
  }
);

// @desc    Update profile picture
// @route   PUT /api/users/profile/picture
// @access  Private
export const updateProfilePicture = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user!.id;

    if (res.locals.profilePictureFallback) {
      const retainedProfilePicture = req.user!.profilePicture || null;
      return res.json({
        success: true,
        data: {
          profilePicture: retainedProfilePicture,
          fallback: retainedProfilePicture ? 'existing-avatar' : 'default-avatar',
        },
        message: retainedProfilePicture
          ? 'Profile image uploads are unavailable; your existing avatar was retained.'
          : 'Profile image uploads are unavailable; the default avatar is being used.',
      });
    }

    if (!req.file) {
      return next(new AppError('Please upload a profile picture', 400));
    }

    // Handle both Cloudinary URL and local disk storage
    let profilePictureUrl: string;
    if (req.file.path.startsWith('http')) {
      // Cloudinary
      profilePictureUrl = req.file.path;
    } else {
      // Disk storage - store relative path
      profilePictureUrl = `/uploads/profiles/${req.file.filename}`;
    }

    // Get old profile picture to delete it if it's local
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { profilePicture: true },
    });

    // Update user in DB
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          profilePicture: profilePictureUrl,
        },
      });
      await auditLog(
        'UPDATE_PROFILE_PICTURE',
        'User',
        userId,
        req,
        {
          profilePicture: {
            from: user?.profilePicture || null,
            to: profilePictureUrl,
          },
        },
        tx
      );
    });

    // Delete old local profile picture if it exists
    if (user && user.profilePicture && user.profilePicture.startsWith('/uploads/')) {
      const oldPath = path.join(process.cwd(), user.profilePicture);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (err: any) {
          console.error('Failed to delete old profile picture:', err.message);
        }
      }
    }

    return res.json({
      success: true,
      data: {
        profilePicture: profilePictureUrl,
      },
    });
  }
);

export const getAllUsers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const scopeWhere = getScopeWhere(req.user, 'user');
  const requestedPage = Number(req.query.page);
  const requestedLimit = Number(req.query.limit);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 100)
    : 20;
  const rawRoles = Array.isArray(req.query.role)
    ? req.query.role
    : String(req.query.role || '').split(',');
  const allowedRoles = new Set([
    'SUPER_ADMIN',
    'ADMIN',
    'COLLEGE_ADMIN',
    'DEPARTMENT_ADMIN',
    'DOCTOR',
    'TEACHING_ASSISTANT',
    'STUDENT',
  ]);
  const roles = rawRoles
    .map((role) => String(role).trim())
    .filter((role) => allowedRoles.has(role));
  const search = String(req.query.search || '').trim();
  const normalizedRoleSearch = search.toUpperCase().replace(/[\s-]+/g, '_');
  const matchingSearchRoles = [...allowedRoles].filter((role) =>
    role.includes(normalizedRoleSearch)
  );
  const status = String(req.query.status || '').toLowerCase();
  const includeInactive = req.query.includeInactive === 'true';

  const baseWhere: Prisma.UserWhereInput = {
    AND: [
      scopeWhere,
      ...(search
        ? [{
            OR: [
              { email: { contains: search, mode: 'insensitive' as const } },
              { managedCollege: { name: { contains: search, mode: 'insensitive' as const } } },
              { managedDepartment: { name: { contains: search, mode: 'insensitive' as const } } },
              { department: { name: { contains: search, mode: 'insensitive' as const } } },
              ...(matchingSearchRoles.length > 0
                ? [{ role: { in: matchingSearchRoles as any } }]
                : []),
            ],
          }]
        : []),
    ],
    ...(req.query.role !== undefined && { role: { in: roles as any } }),
  };
  const where: Prisma.UserWhereInput = {
    ...baseWhere,
    ...(status === 'active'
      ? { isActive: true }
      : status === 'inactive'
        ? { isActive: false }
        : !includeInactive && status !== 'all'
          ? { isActive: true }
          : {}),
  };

  const [users, total, summaryGroups] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        role: true,
        adminRole: true,
        managedCollegeId: true,
        createdAt: true,
        profilePicture: true,
        isActive: true,
        deactivatedAt: true,
        managedCollege: { select: { id: true, name: true } },
        managedDepartment: { select: { id: true, name: true } },
        college: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
    prisma.user.groupBy({
      by: ['role', 'isActive'],
      where: baseWhere,
      _count: { _all: true },
    }),
  ]);

  const summary = summaryGroups.reduce(
    (acc, group) => {
      const count = group._count._all;
      acc.total += count;
      group.isActive ? (acc.active += count) : (acc.inactive += count);
      acc.byRole[group.role] = (acc.byRole[group.role] || 0) + count;
      return acc;
    },
    { total: 0, active: 0, inactive: 0, byRole: {} as Record<string, number> }
  );

  return res.json({
    success: true,
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    summary,
  });
});

export const createAdmin = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const {
    email,
    password,
    role,
    collegeId,
    departmentId,
    managedCollegeId,
    managedDepartmentId,
    firstName,
    lastName,
  } = req.body;
  assertPasswordStrength(password);

  if (role === 'ADMIN') {
    const hasCollege =
      (managedCollegeId && !isNaN(parseInt(managedCollegeId as string, 10)) && parseInt(managedCollegeId as string, 10) > 0) ||
      (collegeId && !isNaN(parseInt(collegeId as string, 10)) && parseInt(collegeId as string, 10) > 0);
    const hasDept =
      (managedDepartmentId && !isNaN(parseInt(managedDepartmentId as string, 10)) && parseInt(managedDepartmentId as string, 10) > 0) ||
      (departmentId && !isNaN(parseInt(departmentId as string, 10)) && parseInt(departmentId as string, 10) > 0);

    if (!hasCollege && !hasDept) {
      return next(new ValidationError('ADMIN-role accounts must have an assigned college or department'));
    }
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return next(new AppError('Email already registered', 400));
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // For COLLEGE_ADMIN, create a Doctor profile for name
  const userData: any = {
    email,
    password: hashedPassword,
    role,
    collegeId: collegeId ? parseInt(collegeId as string) : null,
    departmentId: departmentId ? parseInt(departmentId as string) : null,
    managedCollegeId:
      (role === 'COLLEGE_ADMIN' || role === 'ADMIN') && managedCollegeId
        ? parseInt(managedCollegeId as string)
        : null,
    managedDepartmentId:
      role === 'DEPARTMENT_ADMIN' && managedDepartmentId
        ? parseInt(managedDepartmentId as string)
        : null,
  };

  // If COLLEGE_ADMIN or DEPARTMENT_ADMIN, also create Doctor profile
  if ((role === 'COLLEGE_ADMIN' || role === 'DEPARTMENT_ADMIN') && firstName && lastName) {
    userData.doctor = {
      create: {
        firstName,
        lastName,
        departmentId:
          role === 'DEPARTMENT_ADMIN' && managedDepartmentId
            ? parseInt(managedDepartmentId as string)
            : null,
      },
    };
  }

  const admin = await prisma.user.create({
    data: userData,
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      managedCollegeId: true,
      managedDepartmentId: true,
      doctor: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  auditLog('CREATE_ADMIN', 'User', admin ? admin.id.toString() : 'null', req);
  return res.status(201).json({ success: true, data: admin });
});

export const deleteUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const targetId = parseInt(id as string, 10);

  // Defense-in-depth: only SUPER_ADMIN may deactivate accounts (route also enforces this)
  if (req.user!.role !== 'SUPER_ADMIN') {
    return next(new AppError('Only SUPER_ADMIN can deactivate accounts', 403));
  }

  if (targetId === req.user!.id) {
    return next(new AppError('You cannot deactivate your own account', 400));
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, isActive: true },
  });

  if (!targetUser) {
    return next(new NotFoundError('User not found'));
  }

  if (targetUser.isActive === false) {
    return next(new AppError('This account is already deactivated', 400));
  }

  await deactivateUserAndRevokeSessions(targetId, new Date());

  auditLog('DEACTIVATE_USER', 'User', targetId.toString(), req);
  return res.json({ success: true, message: 'Account deactivated successfully' });
});

export const reactivateUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const targetId = parseInt(id as string, 10);

  const user = await prisma.user.findUnique({
    where: { id: targetId },
  });

  if (!user) {
    return next(new NotFoundError('User not found'));
  }

  if (user.isActive) {
    return next(new AppError('User is already active', 400));
  }

  await setUserAndRoleActiveState(targetId, true);

  auditLog('REACTIVATE_USER', 'User', targetId.toString(), req);
  return res.json({ success: true, message: 'User reactivated successfully' });
});

export const hardDeleteUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const targetId = parseInt(id as string, 10);

  // Defense-in-depth: only SUPER_ADMIN may permanently delete accounts
  if (req.user!.role !== 'SUPER_ADMIN') {
    return next(new AppError('Only SUPER_ADMIN can permanently delete accounts', 403));
  }

  if (targetId === req.user!.id) {
    return next(new AppError('You cannot permanently delete your own account', 400));
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      email: true,
      role: true,
      student: { select: { id: true } },
    },
  });

  if (!targetUser) {
    return next(new NotFoundError('User not found'));
  }

  if (targetUser.student && req.body?.confirmPurge !== true) {
    return next(
      new AppError(
        'Deleting a user with a student profile requires confirmPurge to be exactly true',
        400
      )
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Step 1: Nullify userId on all related audit logs.
      // AuditLog.userId is nullable (Int?) in the schema, so this preserves the
      // full audit trail while releasing the FK constraint that would otherwise
      // block the user delete.
      await tx.auditLog.updateMany({
        where: { userId: targetId },
        data: { userId: null },
      });

      // Step 2: Delete the user record
      await tx.user.delete({ where: { id: targetId } });

      // Step 3: Write a final audit entry for the deletion itself
      await auditLog(
        'HARD_DELETE_USER',
        'User',
        targetId.toString(),
        req,
        { deletedUserEmail: targetUser.email, deletedUserId: targetId },
        tx
      );
    });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      return next(
        new AppError(
          'Cannot permanently delete: this account has linked records (e.g. students, doctors). Deactivate the account instead.',
          409
        )
      );
    }
    throw err;
  }

  return res.json({ success: true, message: 'Account permanently deleted successfully' });
});

export const updateAdmin = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { email, role, managedCollegeId, managedDepartmentId } = req.body;

  const adminId = parseInt(id as string);
  const existingUser = await prisma.user.findUnique({
    where: { id: adminId },
    select: { role: true, managedCollegeId: true, managedDepartmentId: true, collegeId: true, departmentId: true },
  });

  if (!existingUser) {
    return next(new NotFoundError('User not found'));
  }

  const effectiveRole = role !== undefined ? role : existingUser.role;
  if (effectiveRole === 'ADMIN') {
    const targetManagedCollege =
      managedCollegeId !== undefined
        ? managedCollegeId ? parseInt(managedCollegeId as string, 10) : null
        : existingUser.managedCollegeId;
    const targetManagedDept =
      managedDepartmentId !== undefined
        ? managedDepartmentId ? parseInt(managedDepartmentId as string, 10) : null
        : existingUser.managedDepartmentId;
    const hasCollege = Boolean(targetManagedCollege || existingUser.collegeId);
    const hasDept = Boolean(targetManagedDept || existingUser.departmentId);

    if (!hasCollege && !hasDept) {
      return next(new ValidationError('ADMIN-role accounts must have an assigned college or department'));
    }
  }

  const data: any = {};
  if (email) data.email = email;

  if (role !== undefined) {
    data.role = role;

    data.managedCollegeId =
      (role === 'COLLEGE_ADMIN' || role === 'ADMIN') && managedCollegeId
        ? parseInt(managedCollegeId as string)
        : null;
    data.managedDepartmentId =
      role === 'DEPARTMENT_ADMIN' && managedDepartmentId
        ? parseInt(managedDepartmentId as string)
        : null;
  }

  const updatedAdmin = await prisma.user.update({
    where: { id: adminId },
    data,
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      managedCollegeId: true,
      managedDepartmentId: true,
    },
  });

  auditLog('UPDATE_ADMIN', 'User', id as string, req);
  return res.json({ success: true, data: updatedAdmin });
});

export const resetUserPassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  assertPasswordStrength(newPassword);

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await replacePasswordAndRevokeAllUserSessions(parseInt(id as string), hashedPassword);

  auditLog('RESET_USER_PASSWORD', 'User', id as string, req);
  return res.json({ success: true, message: 'Password reset successfully' });
});
