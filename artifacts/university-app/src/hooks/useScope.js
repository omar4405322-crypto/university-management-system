import { useAuth } from '../context/AuthContext';
import { useMemo } from 'react';

export default function useScope() {
  const { user } = useAuth();
  const isCollegeAdmin = user?.role === 'COLLEGE_ADMIN';
  const isDeptAdmin = user?.role === 'DEPARTMENT_ADMIN';

  const effectiveCollegeId = isCollegeAdmin ? (user?.managedCollegeId || user?.collegeId) : undefined;
  const effectiveDepartmentId = isDeptAdmin ? (user?.managedDepartmentId || user?.departmentId) : undefined;

  const scopeParams = useMemo(() => {
    const params = {};
    if (effectiveCollegeId) params.collegeId = effectiveCollegeId;
    if (effectiveDepartmentId) params.departmentId = effectiveDepartmentId;
    return params;
  }, [effectiveCollegeId, effectiveDepartmentId]);

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
