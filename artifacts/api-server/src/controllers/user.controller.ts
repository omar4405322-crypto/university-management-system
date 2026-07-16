// @ts-nocheck
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import catchAsync from '../utils/catchAsync';
import { NotFoundError, AuthenticationError, AppError } from '../utils/appError';
import { Request, Response, NextFunction } from 'express';
import { generateTOTPSecret, generateQRCodeURL, verifyTOTP } from '../utils/twoFactor.utils';

// 1. setup2FA — Generates secret and returns QR code for scanning:
export const setup2FA = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (user!.twoFactorEnabled) return next(new AppError('2FA is already enabled', 400));

  const secret = generateTOTPSecret(user!.email);
  // Store secret temporarily (not enabling yet until verified)
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { twoFactorSecret: secret.base32 },
  });

  const qrCodeUrl = await generateQRCodeURL(secret.otpauth_url!);
  auditLog('SETUP_2FA', 'User', req.user!.id.toString(), req);
  return res.json({ success: true, data: { qrCodeUrl, manualEntryKey: secret.base32 } });
});

// 2. enable2FA — Verifies the first TOTP code and enables 2FA:
export const enable2FA = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  
  const { token } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });

  if (!user!.twoFactorSecret) return next(new AppError('Run 2FA setup first', 400));
  if (user!.twoFactorEnabled) return next(new AppError('2FA is already enabled', 400));
  if (!token) return next(new AppError('Verification code is required', 400));

  const isValid = verifyTOTP(user!.twoFactorSecret, token);
  if (!isValid) return next(new AppError('Invalid verification code', 400));

  await prisma.user.update({
    where: { id: req.user!.id },
    data: { twoFactorEnabled: true },
  });
  return res.json({ success: true, message: '2FA enabled successfully' });
});

// 3. disable2FA — Verifies password + TOTP before disabling:
export const disable2FA = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  
  const { token, password } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });

  if (!user!.twoFactorEnabled) return next(new AppError('2FA is not enabled', 400));

  const passwordMatch = await bcrypt.compare(password, user!.password);
  if (!passwordMatch) return next(new AppError('Incorrect password', 401));

  const isValid = verifyTOTP(user!.twoFactorSecret!, token);
  if (!isValid) return next(new AppError('Invalid verification code', 400));
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });
  auditLog('DISABLE_2FA', 'User', req.user!.id.toString(), req);
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
        courses: {
          include: {
            enrollments: { include: { student: true } },
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

  if (role === 'STUDENT') {
    updatedProfile = await prisma.student.update({
      where: { userId },
      data: updateData,
    });
  } else if (['DOCTOR', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(role)) {
    updatedProfile = await prisma.doctor.update({
      where: { userId },
      data: updateData,
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

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 },
      },
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
    await prisma.user.update({
      where: { id: userId },
      data: {
        profilePicture: profilePictureUrl,
      },
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
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      adminRole: true,
      managedCollegeId: true,
      createdAt: true,
      profilePicture: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Fetch college info for COLLEGE_ADMIN users
  const usersWithColleges = await Promise.all(
    users.map(async (user: any) => {
      if (user.managedCollegeId) {
        const college = await prisma.college.findUnique({
          where: { id: user.managedCollegeId },
          select: { id: true, name: true },
        });
        return { ...user, managedCollege: college };
      }
      return { ...user, managedCollege: null };
    })
  );

  return res.json({ success: true, data: usersWithColleges });
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
  return res.status().json({ success: true, data: admin });
});

export const deleteUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  if (parseInt(id as string) === req.user!.id) {
    return next(new AppError('You cannot deactivate your own account', 400));
  }

  await prisma.user.update({
    where: { id: parseInt(id as string) },
    data: { isActive: false, deactivatedAt: new Date() }
  });

  auditLog('DEACTIVATE_USER', 'User', req.params.id as string, req);
  return res.json({ success: true, message: 'User deactivated successfully' });
});

export const hardDeleteUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  if (req.user!.role !== 'SUPER_ADMIN') {
    return next(new AppError('Only SUPER_ADMIN can hard-delete users', 403));
  }

  if (parseInt(id as string) === req.user!.id) {
    return next(new AppError('You cannot delete your own account', 400));
  }

  await prisma.user.delete({ where: { id: parseInt(id as string) } });

  auditLog('HARD_DELETE_USER', 'User', req.params.id as string, req);
  return res.json({ success: true, message: 'User hard-deleted successfully' });
});
