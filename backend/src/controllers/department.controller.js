// FIXED: Enriched getDepartmentById with students, courses, doctors for detail page - Phase 1
const prisma = require('../utils/prismaClient');
const { auditLog } = require('../utils/audit.utils');
const { getScopeWhere } = require('../utils/scope.utils');

exports.getAllDepartments = async (req, res) => {
  try {
    const { collegeId } = req.query;
    
    // For COLLEGE_ADMIN, explicitly check if they're trying to access another college
    if (req.user && req.user.role === 'COLLEGE_ADMIN' && req.user.managedCollegeId && collegeId) {
      if (parseInt(collegeId) !== req.user.managedCollegeId) {
        return res.status(403).json({ success: false, message: 'Access denied: Cannot access departments of another college' });
      }
    }

    // Scope support via helper
    const scopeWhere = getScopeWhere(req.user, 'department');

    let where = { ...scopeWhere };
    // For non-COLLEGE_ADMIN or when no collegeId provided, apply query filter
    if (!(req.user && req.user.role === 'COLLEGE_ADMIN' && req.user.managedCollegeId)) {
      if (collegeId) where.collegeId = parseInt(collegeId);
    }

    const departments = await prisma.department.findMany({
      where,
      include: { 
        college: true,
        _count: {
          select: { students: true, doctors: true, courses: true }
        }
      }
    });
    res.json({ success: true, data: departments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDepartmentById = async (req, res) => {
  try {
    const department = await prisma.department.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        college: true,
        students: {
          select: { id: true, firstName: true, lastName: true, studentId: true, year: true },
          orderBy: { lastName: 'asc' },
        },
        courses: {
          select: { id: true, name: true, courseCode: true, credits: true, year: true, semester: true },
          orderBy: { name: 'asc' },
        },
        doctors: {
          select: { id: true, firstName: true, lastName: true, doctorId: true, specialty: true },
          orderBy: { lastName: 'asc' },
        },
        _count: { select: { students: true, courses: true, doctors: true } },
      },
    });
    if (!department) return res.status(404).json({ success: false, message: 'Department not found' });

    // Enforce scope: COLLEGE_ADMIN/DEPARTMENT_ADMIN
    if (req.user && req.user.role === 'COLLEGE_ADMIN' && department.collegeId !== req.user.managedCollegeId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (req.user && req.user.role === 'DEPARTMENT_ADMIN' && department.id !== req.user.managedDepartmentId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: department });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createDepartment = async (req, res) => {
  try {
    let { name, nameAr, collegeId } = req.body;

    // If user is COLLEGE_ADMIN, enforce managedCollegeId or set automatically
    if (req.user && req.user.role === 'COLLEGE_ADMIN' && req.user.managedCollegeId) {
      if (collegeId && parseInt(collegeId) !== req.user.managedCollegeId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      collegeId = req.user.managedCollegeId;
    }

    if (!collegeId) {
      return res.status(400).json({ success: false, message: 'collegeId is required' });
    }

    const cid = parseInt(collegeId);
    if (isNaN(cid)) return res.status(400).json({ success: false, message: 'Invalid collegeId' });

    const department = await prisma.department.create({
      data: { name, nameAr, collegeId: cid }
    });
    res.status(201).json({ success: true, data: department });
  } catch (error) {
    try { console.error('createDepartment error:', error?.message, error?.stack, JSON.stringify(req.body)); } catch(e) { console.error('createDepartment logging failure', e); }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const { name, nameAr, collegeId } = req.body;
    const deptId = parseInt(req.params.id);

    // Fetch existing for scope check
    const existing = await prisma.department.findUnique({ where: { id: deptId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Department not found' });

    if (req.user && req.user.role === 'COLLEGE_ADMIN' && req.user.managedCollegeId) {
      if (existing.collegeId !== req.user.managedCollegeId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      if (collegeId && parseInt(collegeId) !== req.user.managedCollegeId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const department = await prisma.department.update({
      where: { id: deptId },
      data: { name, nameAr, collegeId: collegeId ? parseInt(collegeId) : undefined }
    });
    res.json({ success: true, data: department });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const departmentId = parseInt(req.params.id);

    // Fetch and scope check
    const existing = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Department not found' });
    if (req.user && req.user.role === 'COLLEGE_ADMIN' && req.user.managedCollegeId) {
      if (existing.collegeId !== req.user.managedCollegeId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    await prisma.$transaction(async (tx) => {
      // 1. Nullify references in related models
      await tx.student.updateMany({ where: { departmentId }, data: { departmentId: null } });
      await tx.doctor.updateMany({ where: { departmentId }, data: { departmentId: null } });
      await tx.course.updateMany({ where: { departmentId }, data: { departmentId: null } });
      await tx.user.updateMany({ where: { departmentId }, data: { departmentId: null } });

      // 2. Delete dependent records that can't exist without a department
      await tx.registrationRequest.deleteMany({ where: { departmentId } });

      // 3. Delete the department
      await tx.department.delete({
        where: { id: departmentId }
      });
    });

    auditLog('DELETE_DEPARTMENT', 'Department', req.params.id, req);
    res.json({ success: true, message: 'Department deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
