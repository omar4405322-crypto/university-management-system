import { useState, useEffect } from 'react';

export interface PublicCollegeItem {
  id: number;
  name: string;
  nameAr: string;
  description: string;
  departmentsCount: number;
  studentsCount: number;
}

export interface PublicSampleSlot {
  id: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  sessionType: 'LECTURE' | 'SECTION' | 'LAB';
  room: string;
  course: string;
  instructor: string;
}

export interface UniversityStats {
  totalStudents: number;
  totalColleges: number;
  totalFaculty: number;
  totalSpecializations: number;
  totalCourses: number;
}

interface UseUniversityStatsReturn {
  stats: UniversityStats | null;
  colleges: PublicCollegeItem[];
  sampleSlots: PublicSampleSlot[];
  isLoading: boolean;
  error: string | null;
}

export const useUniversityStats = (): UseUniversityStatsReturn => {
  const [stats, setStats] = useState<UniversityStats | null>(null);
  const [colleges, setColleges] = useState<PublicCollegeItem[]>([]);
  const [sampleSlots, setSampleSlots] = useState<PublicSampleSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/dashboard/public-stats');

        if (!response.ok) {
          throw new Error('Failed to fetch public stats');
        }

        const resData = await response.json();
        const s = resData?.data ?? resData;

        setStats({
          totalStudents: s.totalStudents > 0 ? s.totalStudents : 605,
          totalColleges: s.totalColleges > 0 ? s.totalColleges : 2,
          totalFaculty: s.totalFaculty > 0 ? s.totalFaculty : 12,
          totalSpecializations: s.totalSpecializations > 0 ? s.totalSpecializations : 9,
          totalCourses: s.totalCourses > 0 ? s.totalCourses : 61,
        });
        setColleges(s.colleges || []);
        setSampleSlots(s.sampleSlots || []);
      } catch (err: any) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStats({
          totalStudents: 605,
          totalColleges: 2,
          totalFaculty: 12,
          totalSpecializations: 9,
          totalCourses: 61,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, colleges, sampleSlots, isLoading, error };
};
