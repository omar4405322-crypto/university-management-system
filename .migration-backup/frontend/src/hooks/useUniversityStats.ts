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
        // Replace this URL with your actual backend endpoint
        const response = await fetch('/api/university/stats');
        
        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }
        
        const data = await response.json();
        setStats(data);
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
