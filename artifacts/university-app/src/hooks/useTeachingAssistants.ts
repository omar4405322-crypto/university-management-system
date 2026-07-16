import { useState, useEffect, useCallback } from 'react';
import teachingAssistantsService from '../services/teachingAssistants.service';
import { useDebounce } from './useDebounce';

interface UseTeachingAssistantsOptions {
  initialPage?: number;
  limit?: number;
  initialSearch?: string;
  departmentId?: string;
  status?: string;
}

export function useTeachingAssistants({
  initialPage = 1,
  limit = 10,
  initialSearch = '',
  departmentId,
  status,
}: UseTeachingAssistantsOptions = {}) {
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
    const params: any = { page, limit, search: debouncedSearch, ...extraParams };
    if (departmentId) params.departmentId = departmentId;
    if (status) params.status = status;
    
    try {
      const res = await teachingAssistantsService.getTeachingAssistants(params);
      if (res.success) {
        const arr = Array.isArray(res.data) 
          ? res.data 
          : (res.data?.data || res.data?.teachingAssistants || []);
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
  }, [page, limit, debouncedSearch, departmentId, status]);

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
