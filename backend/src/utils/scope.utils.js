const getScopeWhere = (user, entity) => {
  // Returns a Prisma where filter appropriate for the entity based on user scope
  if (!user) return {};

  // SUPER_ADMIN: no filter
  if (user.role === 'SUPER_ADMIN') return {};

  // COLLEGE_ADMIN: scoped to managedCollegeId
  if (user.role === 'COLLEGE_ADMIN' && user.managedCollegeId) {
    // Most entities are related via department.collegeId; for department entity itself we filter by collegeId
    if (entity === 'department') return { collegeId: user.managedCollegeId };
    return { department: { collegeId: user.managedCollegeId } };
  }

  // DEPARTMENT_ADMIN: scoped to managedDepartmentId
  if (user.role === 'DEPARTMENT_ADMIN' && user.managedDepartmentId) {
    // For department entity, match id; for others, departmentId
    if (entity === 'department') return { id: user.managedDepartmentId };
    return { departmentId: user.managedDepartmentId };
  }

  // Backwards-compat: support legacy ADMIN with managedCollegeId (temporary)
  if (user.role === 'ADMIN' && user.managedCollegeId) {
    if (entity === 'department') return { collegeId: user.managedCollegeId };
    return { department: { collegeId: user.managedCollegeId } };
  }

  return {};
};

module.exports = { getScopeWhere };
