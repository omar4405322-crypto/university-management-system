import { useState, useEffect, useCallback } from 'react';
import teachingAssistantsService from '../services/teachingAssistants.service';
import { useDebounce } from './useDebounce';
import type { TeachingAssistantRow } from '../types/domain';

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
  const [data, setData] = useState<TeachingAssistantRow[]>([]);
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
      const params: Record<string, unknown> = {
        page,
        limit,
        search: debouncedSearch,
        ...extraParams,
      };
      if (departmentId) params.departmentId = departmentId;
      if (status) params.status = status;

      try {
        const res = await teachingAssistantsService.getTeachingAssistants(params);
        if (res.success) {
          const raw = res.data as unknown;
          const arr: TeachingAssistantRow[] = Array.isArray(raw)
            ? (raw as TeachingAssistantRow[])
            : ((raw as { teachingAssistants?: TeachingAssistantRow[] })?.teachingAssistants ??
              (raw as { data?: TeachingAssistantRow[] })?.data ??
              []);
          setData(arr);
          const pagination = res.pagination ?? (res.data as { pagination?: { total?: number }; total?: number } | null);
          setTotal(pagination?.total ?? 0);
        } else {
          setError(res.message ?? 'Failed to load data');
        }
      } catch (_err: unknown) {
        setError('Error fetching data');
      } finally {
        setLoading(false);
      }
    },
    [page, limit, debouncedSearch, departmentId, status]
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
