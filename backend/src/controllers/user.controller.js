const prisma = require('../utils/prismaClient');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// FIXED: Two-factor enable/disable for super admins - Phase 3
exports.updateTwoFactor = async (req, res) => {
  try {
    const { enabled } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { twoFactorEnabled: Boolean(enabled) },
      select: {
        id: true,
        email: true,
        role: true,
        twoFactorEnabled: true,
        profilePicture: true,
      },
    });

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Update 2FA error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get current user profile
// @route   GET /api/users/profile
// @access  Private
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let profileData;

    if (role === 'STUDENT') {
      profileData = await prisma.student.findUnique({
        where: { userId },
        include: {
          department: {
            include: {
              college: true,
            },
          },
          courses: true,
          payments: true,
        },
      });
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
              students: true,
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

      // Add common fields for admin if they exist in a different structure or just return user
    }

    if (!profileData) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found',
      });
    }

    res.json({
      success: true,
      data: {
        ...profileData,
        email: req.user.email, // Ensure email is included
        profilePicture: req.user.profilePicture, // Include profile picture from user model
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const { firstName, lastName, phone, address, bio, gender, birthDate } = req.body;

    let updatedProfile;

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
      // SUPER_ADMIN or other roles without a specific profile record
      return res.status(400).json({
        success: false,
        message: 'Admin profile update not fully implemented yet',
      });
    }

    res.json({
      success: true,
      data: updatedProfile,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Update password
// @route   PUT /api/users/profile/password
// @access  Private
exports.updatePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect current password',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
      },
    });

    res.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Update profile picture
// @route   PUT /api/users/profile/picture
// @access  Private
exports.updateProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a profile picture',
      });
    }

    // Get the path relative to the root for storage
    const profilePictureUrl = `/uploads/profiles/${req.file.filename}`;

    // Get old profile picture to delete it later
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { profilePicture: true }
    });

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        profilePicture: profilePictureUrl,
      },
    });

    // Delete old profile picture file if it's a local file
    if (user && user.profilePicture && user.profilePicture.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '../../', user.profilePicture);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    res.json({
      success: true,
      data: {
        profilePicture: updatedUser.profilePicture,
      },
    });
  } catch (error) {
    console.error('Update profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Get all users (Admins only)
// @route   GET /api/users
// @access  Private/Admin
// FIXED: Parse role query (comma-separated or array) so /admins only returns admin roles - Phase 2
const parseRoleFilter = (roleParam) => {
  if (!roleParam) return null;
  if (Array.isArray(roleParam)) return roleParam.map((r) => String(r).trim()).filter(Boolean);
  const str = String(roleParam).trim();
  if (!str) return null;
  return str.split(',').map((r) => r.trim()).filter(Boolean);
};

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'];

exports.getAllUsers = async (req, res) => {
  try {
    const { role, collegeId, departmentId } = req.query;
    
    // Authorization check
    if (req.user.role === 'COLLEGE_ADMIN' && collegeId && parseInt(collegeId) !== req.user.collegeId) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to this college' });
    }
    if (req.user.role === 'DEPARTMENT_ADMIN' && departmentId && parseInt(departmentId) !== req.user.departmentId) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to this department' });
    }

    const where = {};
    const roles = parseRoleFilter(role);
    if (roles?.length) {
      where.role = { in: roles };
    }
    if (collegeId) where.collegeId = parseInt(collegeId);
    if (departmentId) where.departmentId = parseInt(departmentId);

    // If College Admin, restrict to their college OR Super Admins
    if (req.user.role === 'COLLEGE_ADMIN') {
      where.OR = [
        { collegeId: req.user.collegeId },
        { role: 'SUPER_ADMIN' }
      ];
    }
    // If Dept Admin, restrict to their department OR Super Admins
    if (req.user.role === 'DEPARTMENT_ADMIN') {
      where.OR = [
        { departmentId: req.user.departmentId },
        { role: 'SUPER_ADMIN' }
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        role: true,
        adminRole: true,
        collegeId: true,
        departmentId: true,
        college: { select: { name: true } },
        department: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    const data = roles?.length
      ? users.filter((u) => ADMIN_ROLES.includes(u.role))
      : users;

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create an admin user
// @route   POST /api/users/admins
// @access  Private/SuperAdmin
exports.createAdmin = async (req, res) => {
  try {
    const { email, password, role, collegeId, departmentId } = req.body;

    // Only Super Admin can create other admins
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Only Super Admin can create admin accounts' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
        adminRole: role, // Sync adminRole enum with role
        collegeId: collegeId ? parseInt(collegeId) : null,
        departmentId: departmentId ? parseInt(departmentId) : null,
      }
    });

    res.status(201).json({ 
      success: true, 
      data: { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        collegeId: user.collegeId,
        departmentId: user.departmentId
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private/SuperAdmin
exports.deleteUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Prevent self-deletion
    if (userId === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    // Only Super Admin can delete other users
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await prisma.user.delete({ where: { id: userId } });
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
