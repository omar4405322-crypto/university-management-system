// FIXED: Enriched getDepartmentById with students, courses, doctors for detail page - Phase 1
const prisma = require('../utils/prismaClient');

exports.getAllDepartments = async (req, res) => {
  try {
    const { collegeId } = req.query;
    let where = {};
    if (collegeId) where.collegeId = parseInt(collegeId);

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
    res.json({ success: true, data: department });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const { name, nameAr, collegeId } = req.body;
    const department = await prisma.department.create({
      data: { name, nameAr, collegeId: parseInt(collegeId) }
    });
    res.status(201).json({ success: true, data: department });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const { name, nameAr, collegeId } = req.body;
    const department = await prisma.department.update({
      where: { id: parseInt(req.params.id) },
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

    res.json({ success: true, message: 'Department deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
