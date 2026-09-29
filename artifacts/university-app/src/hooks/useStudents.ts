import { useState, useEffect, useCallback, useMemo } from 'react';
import studentsService from '../services/students.service';
import { useDebounce } from './useDebounce';
import type { StudentRow } from '../types/domain';

interface UseStudentsOptions {
  initialPage?: number;
  limit?: number;
  initialSearch?: string;
  filters?: Record<string, unknown>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeStats?: boolean;
}

export function useStudents({
  initialPage = 1,
  limit = 10,
  initialSearch = '',
  filters = {},
  sortBy = 'enrolledAt',
  sortOrder = 'desc',
  includeStats = false,
}: UseStudentsOptions = {}) {
  const [data, setData] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const filtersKey = JSON.stringify(filters);
  const parsedFilters = useMemo(() => JSON.parse(filtersKey) as Record<string, unknown>, [filtersKey]);

  const fetchData = useCallback(
    async (extraParams: Record<string, unknown> = {}) => {
      setLoading(true);
      setError(null);
      const params = {
        page,
        limit,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        ...(includeStats ? { includeStats: 'true' } : {}),
        ...parsedFilters,
        ...extraParams,
      };
      try {
        const res = await studentsService.getStudents(params);
        if (res.success) {
          const raw = res.data as any;
          const arr: StudentRow[] = Array.isArray(raw)
            ? (raw as StudentRow[])
            : ((raw as { students?: StudentRow[] })?.students ??
              (raw as { data?: StudentRow[] })?.data ??
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
    [page, limit, debouncedSearch, sortBy, sortOrder, includeStats, parsedFilters]
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
