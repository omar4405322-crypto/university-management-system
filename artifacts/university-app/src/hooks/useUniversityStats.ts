import { useState, useEffect } from 'react';

interface UniversityStats {
  totalStudents: number;
  totalColleges: number;
  totalFaculty: number;
  totalSpecializations: number;
}

interface UseUniversityStatsReturn {
  stats: UniversityStats | null;
  isLoading: boolean;
  error: string | null;
}

export const useUniversityStats = (): UseUniversityStatsReturn => {
  const [stats, setStats] = useState<UniversityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/dashboard/stats');

        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }

        const data = await response.json();
        // Map the dashboard stats shape to what the landing page expects
        const s = data?.data ?? data;
        setStats({
          totalStudents: s.totalStudents ?? s.students ?? 0,
          totalColleges: s.totalColleges ?? s.colleges ?? 0,
          totalFaculty: s.totalDoctors ?? s.faculty ?? s.doctors ?? 0,
          totalSpecializations: s.totalDepartments ?? s.departments ?? s.specializations ?? 0,
        });
      } catch (err: any) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Fallback to null — cards will show skeleton
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, isLoading, error };
};
