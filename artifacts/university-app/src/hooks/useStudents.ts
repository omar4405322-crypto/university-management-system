import { useState, useEffect, useCallback } from 'react';
import studentsService from '../services/students.service';
import { useDebounce } from './useDebounce';

interface UseStudentsOptions {
  initialPage?: number;
  limit?: number;
  initialSearch?: string;
  filters?: Record<string, any>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useStudents({
  initialPage = 1,
  limit = 10,
  initialSearch = '',
  filters = {},
  sortBy = 'enrolledAt',
  sortOrder = 'desc',
}: UseStudentsOptions = {}) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const filtersKey = JSON.stringify(filters);

  const fetchData = useCallback(async (extraParams: Record<string, unknown> = {}) => {
    setLoading(true);
    setError(null);
    const params = {
      page,
      limit,
      search: debouncedSearch,
      sortBy,
      sortOrder,
      ...filters,
      ...extraParams,
    };
    try {
      const res = await studentsService.getStudents(params);
      if (res.success) {
        const arr = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.students || res.data?.courses || res.data?.departments || res.data?.doctors || []);
        setData(arr);
        setTotal(res.pagination?.total ?? res.data?.pagination?.total ?? res.data?.total ?? 0);
      } else {
        setError(res.message ?? 'Failed to load data');
      }
    } catch (_err: any) {
      setError('Error fetching data');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, sortBy, sortOrder, filtersKey]);

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
