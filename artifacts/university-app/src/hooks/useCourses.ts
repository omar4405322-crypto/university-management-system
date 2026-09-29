import { useState, useEffect, useCallback } from 'react';
import coursesService from '../services/courses.service';
import { useDebounce } from './useDebounce';
import type { CourseRow } from '../types/domain';

interface UseCoursesOptions {
  initialPage?: number;
  limit?: number;
  initialSearch?: string;
  collegeId?: string;
  departmentId?: string;
  year?: string | number;
  semester?: string | number;
}

export function useCourses({
  initialPage = 1,
  limit = 10,
  initialSearch = '',
  collegeId,
  departmentId,
  year,
  semester,
}: UseCoursesOptions = {}) {
  const [data, setData] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchData = useCallback(
    async (extraParams: Record<string, unknown> = {}) => {
      setLoading(true);
      setError(null);
      const params = {
        page,
        limit,
        search: debouncedSearch,
        collegeId,
        departmentId,
        year,
        semester,
        ...extraParams,
      };
      try {
        const res = await coursesService.getCourses(params);
        if (res.success) {
          const raw = res.data as any;
          const arr: CourseRow[] = Array.isArray(raw)
            ? (raw as CourseRow[])
            : ((raw as { courses?: CourseRow[] })?.courses ??
              (raw as { data?: CourseRow[] })?.data ??
              []);
          setData(arr);
          const totalVal = res.pagination?.total ?? raw?.pagination?.total ?? raw?.total ?? arr.length;
          setTotal(typeof totalVal === 'number' ? totalVal : 0);
        } else {
          setError(res.message ?? 'Failed to load data');
        }
      } catch (_err: unknown) {
        setError('Error fetching data');
      } finally {
        setLoading(false);
      }
    },
    [page, limit, debouncedSearch, collegeId, departmentId, year, semester]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    search,
    setSearch,
    page,
    setPage,
    total,
    refetch: fetchData,
  };
}
