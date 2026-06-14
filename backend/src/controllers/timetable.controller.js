const prisma = require('../utils/prismaClient');
const { getScopeWhere } = require('../utils/scope.utils');

/**
 * @desc    Get all timetables (Admin) or matching timetable (Student)
 * @route   GET /api/timetables
 * @access  Private
 */
exports.getTimetables = async (req, res) => {
  try {
    const { user } = req;
    const { collegeId, departmentId, academicYear, semester, status } = req.query;

    let where = {};

    if (user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
        select: { 
          departmentId: true, 
          year: true,
          department: {
            select: { collegeId: true }
          }
        }
      });

      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found' });
      }

      // Automatically match student profile
      where = {
        departmentId: student.departmentId,
        collegeId: student.department.collegeId,
        academicYear: student.year,
        status: 'PUBLISHED'
      };

    } else {
      // Admins/Doctors
      if (collegeId) where.collegeId = parseInt(collegeId);
      if (departmentId) where.departmentId = parseInt(departmentId);
      if (academicYear) where.academicYear = parseInt(academicYear);
      if (semester) where.semester = parseInt(semester);
      if (status) where.status = status;

      // Apply scope (COLLEGE_ADMIN/DEPARTMENT_ADMIN)
      const deptScope = getScopeWhere(user, 'department');
      if (deptScope && Object.keys(deptScope).length) {
        if (deptScope.collegeId) where.collegeId = deptScope.collegeId;
        if (deptScope.id) where.departmentId = deptScope.id;
      }
    }

    const timetables = await prisma.timetable.findMany({
      where,
      include: {
        college: { select: { name: true } },
        department: { select: { name: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({ success: true, data: timetables });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get a single timetable by ID
 * @route   GET /api/timetables/:id
 * @access  Private
 */
exports.getTimetableById = async (req, res) => {
  try {
    const timetable = await prisma.timetable.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        college: true,
        department: true
      }
    });

    if (!timetable) {
      return res.status(404).json({ success: false, message: 'Timetable not found' });
    }

    // Enforce scope on read
    const deptScope = getScopeWhere(req.user, 'department');
    if (deptScope && Object.keys(deptScope).length) {
      if (deptScope.collegeId && timetable.collegeId !== deptScope.collegeId) return res.status(403).json({ success: false, message: 'Access denied' });
      if (deptScope.id && timetable.departmentId !== deptScope.id) return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: timetable });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Create a new timetable
 * @route   POST /api/timetables
 * @access  Private (Admin)
 */
exports.createTimetable = async (req, res) => {
  try {
    const { collegeId, departmentId, academicYear, semester, title, description, scheduleData, fileUrl, status } = req.body;

    // Validation
    if (!collegeId || !departmentId || !academicYear || !semester || !title) {
      return res.status(400).json({ 
        success: false, 
        message: 'Faculty, Department, Academic Year, Semester, and Title are required' 
      });
    }

    // Enforce scope for creation
    const deptScope = getScopeWhere(req.user, 'department');
    if (deptScope && Object.keys(deptScope).length) {
      if (deptScope.collegeId && parseInt(collegeId) !== deptScope.collegeId) return res.status(403).json({ success: false, message: 'Access denied' });
      if (deptScope.id && parseInt(departmentId) !== deptScope.id) return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Check for duplicates (handled by unique constraint in DB, but better to check)
    const existing = await prisma.timetable.findUnique({
      where: {
        collegeId_departmentId_academicYear_semester: {
          collegeId: parseInt(collegeId),
          departmentId: parseInt(departmentId),
          academicYear: parseInt(academicYear),
          semester: parseInt(semester)
        }
      }
    });

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'A timetable for this Faculty, Department, Year, and Semester combination already exists.' 
      });
    }

    const timetable = await prisma.timetable.create({
      data: {
        collegeId: parseInt(collegeId),
        departmentId: parseInt(departmentId),
        academicYear: parseInt(academicYear),
        semester: parseInt(semester),
        title,
        description,
        scheduleData: scheduleData || {},
        fileUrl,
        status: status || 'DRAFT'
      }
    });

    res.status(201).json({ success: true, data: timetable });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update a timetable
 * @route   PUT /api/timetables/:id
 * @access  Private (Admin)
 */
exports.updateTimetable = async (req, res) => {
  try {
    const { title, description, scheduleData, fileUrl, status, academicYear, semester } = req.body;
    const id = parseInt(req.params.id);

    // Enforce scope on update
    const deptScope = getScopeWhere(req.user, 'department');
    const existing = await prisma.timetable.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Timetable not found' });
    if (deptScope && Object.keys(deptScope).length) {
      if (deptScope.collegeId && existing.collegeId !== deptScope.collegeId) return res.status(403).json({ success: false, message: 'Access denied' });
      if (deptScope.id && existing.departmentId !== deptScope.id) return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const timetable = await prisma.timetable.update({
      where: { id },
      data: {
        title,
        description,
        scheduleData,
        fileUrl,
        status,
        academicYear: academicYear ? parseInt(academicYear) : undefined,
        semester: semester ? parseInt(semester) : undefined
      }
    });

    res.json({ success: true, data: timetable });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete a timetable
 * @route   DELETE /api/timetables/:id
 * @access  Private (Admin)
 */
exports.deleteTimetable = async (req, res) => {
  try {
    const existing = await prisma.timetable.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Timetable not found' });
    const deptScope = getScopeWhere(req.user, 'department');
    if (deptScope && Object.keys(deptScope).length) {
      if (deptScope.collegeId && existing.collegeId !== deptScope.collegeId) return res.status(403).json({ success: false, message: 'Access denied' });
      if (deptScope.id && existing.departmentId !== deptScope.id) return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await prisma.timetable.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ success: true, message: 'Timetable deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
