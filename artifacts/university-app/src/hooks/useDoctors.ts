import { useState, useEffect, useCallback, useMemo } from 'react';
import doctorsService from '../services/doctors.service';
import { useDebounce } from './useDebounce';
import type { DoctorRow } from '../types/domain';

interface UseDoctorsOptions {
  initialPage?: number;
  limit?: number;
  initialSearch?: string;
  filters?: Record<string, unknown>;
}

export function useDoctors({
  initialPage = 1,
  limit = 10,
  initialSearch = '',
  filters = {},
}: UseDoctorsOptions = {}) {
  const [data, setData] = useState<DoctorRow[]>([]);
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
        ...parsedFilters,
        ...extraParams,
      };
      try {
        const res = await doctorsService.getDoctors(params);
        if (res.success) {
          const raw = res.data as unknown;
          const arr: DoctorRow[] = Array.isArray(raw)
            ? (raw as DoctorRow[])
            : ((raw as { doctors?: DoctorRow[] })?.doctors ??
              (raw as { data?: DoctorRow[] })?.data ??
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
    [page, limit, debouncedSearch, parsedFilters]
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
