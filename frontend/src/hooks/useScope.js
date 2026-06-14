import { useAuth } from '../context/AuthContext';

export default function useScope() {
  const { user } = useAuth();
  const isCollegeAdmin = user?.role === 'COLLEGE_ADMIN';
  const isDeptAdmin = user?.role === 'DEPARTMENT_ADMIN';

  const effectiveCollegeId = isCollegeAdmin ? (user?.managedCollegeId || user?.collegeId) : undefined;
  const effectiveDepartmentId = isDeptAdmin ? (user?.managedDepartmentId || user?.departmentId) : undefined;

  const scopeParams = {};
  if (effectiveCollegeId) scopeParams.collegeId = effectiveCollegeId;
  if (effectiveDepartmentId) scopeParams.departmentId = effectiveDepartmentId;

  return {
	user,
	isCollegeAdmin,
	isDeptAdmin,
	effectiveCollegeId,
	effectiveDepartmentId,
	scopeParams,
	hideCollegeSelector: Boolean(isCollegeAdmin || isDeptAdmin),
	hideDepartmentSelector: Boolean(isDeptAdmin),
  };
}
