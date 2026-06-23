import { useState, useEffect, useCallback } from 'react';
import departmentService from '../services/department.service';
import { useDebounce } from './useDebounce';

interface UseDepartmentsOptions {
  initialPage?: number;
  limit?: number;
  initialSearch?: string;
}

export function useDepartments({ initialPage = 1, limit = 10, initialSearch = '' }: UseDepartmentsOptions = {}) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchData = useCallback(async (extraParams: Record<string, unknown> = {}) => {
    setLoading(true);
    setError(null);
    const params = { page, limit, search: debouncedSearch, ...extraParams };
    try {
      const res = await departmentService.getDepartments(params);
      if (res.success) {
        const arr = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.students || res.data?.courses || res.data?.departments || res.data?.doctors || []);
        setData(arr);
        setTotal(res.pagination?.total ?? res.data?.pagination?.total ?? res.data?.total ?? 0);
      } else {
        setError(res.message ?? 'Failed to load data');
      }
    } catch (err: any) {
      setError('Error fetching data');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch]);

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
