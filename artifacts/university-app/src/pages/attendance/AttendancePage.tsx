import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { 
  Users, CheckCircle, XCircle, Clock, AlertCircle, Save, 
  Calendar, RefreshCw, CheckSquare, XSquare, BookOpen, AlertTriangle, Loader2,
  UserCheck, UserX, CheckCircle2
} from 'lucide-react';
import attendanceService, { RosterStudent, MyAttendanceCourse } from '../../services/attendance.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import studentGroupsService from '../../services/studentGroups.service';
import useScope from '../../hooks/useScope';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import FilterBar from '../../components/ui/FilterBar';
import { EmptyState } from '../../components/ui/EmptyState';

export default function AttendancePage() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'ar' ? ar : enUS;
  const isRTL = i18n.language === 'ar';
  const { user } = useAuth();
  
  // Scopes & Roles
  const { scopeParams } = useScope();
  const isStudent = user?.role === 'STUDENT';
  const isDoctorOrTA = ['DOCTOR', 'TEACHING_ASSISTANT'].includes(user?.role || '');
  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role || '');
  const canRecord = isDoctorOrTA || isAdmin;

  // Inject Page Background
  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.classList.add('bg-slate-50', 'dark:bg-slate-900');
    }
    return () => {
      if (mainEl) {
        mainEl.classList.remove('bg-slate-50', 'dark:bg-slate-900');
      }
    };
  }, []);

  // Filter States
  const [selectedCollegeId, setSelectedCollegeId] = useState<number | null>(null);
  const [selectedDeptId, setSelectedDeptId]       = useState<number | null>(null);
  const [selectedCourseId, setSelectedCourseId]   = useState<number | null>(null);
  const [groups, setGroups]                       = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId]     = useState<number | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [colleges, setColleges]       = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [courses, setCourses]         = useState<any[]>([]);

  // Roster States
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [records, setRecords] = useState<Record<number, { status: string; remarks: string }>>({});
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);

  // My Attendance State (Student View)
  const [myAttendance, setMyAttendance] = useState<any[]>([]);

  // 1. Load colleges on mount (admin only)
  useEffect(() => {
    if (!isAdmin) return;
    collegeService.getColleges({ limit: 100 })
      .then(res => setColleges(res.data || []))
      .catch(() => {});
  }, [isAdmin]);

  // 2. Load departments when college selected
  useEffect(() => {
    setSelectedDeptId(null);
    setSelectedCourseId(null);
    setDepartments([]);
    setCourses([]);
    setGroups([]);
    if (!isAdmin || !selectedCollegeId) return;
    departmentService.getDepartments({ collegeId: selectedCollegeId, limit: 100 })
      .then(res => setDepartments(res.data || []))
      .catch(() => {});
  }, [isAdmin, selectedCollegeId]);

  // 3. Load courses when dept selected (admin) OR on mount (doctor/TA/Student)
  useEffect(() => {
    setSelectedCourseId(null);
    setCourses([]);
    setGroups([]);
    
    if (isStudent) {
      attendanceService.getMyCourses()
        .then(res => setCourses(res.data || []))
        .catch(() => setError(t('attendance.coursesLoadError') || 'Failed to load courses'));
      return;
    }

    if (isAdmin && !selectedDeptId) return;
    
    const params = isAdmin ? { departmentId: selectedDeptId } : {};
    attendanceService.getMyCourses(params)
      .then(res => {
        setCourses(res.data || []);
        // Automatically select the first course if only one exists and we are not admin
        if (!isAdmin && res.data?.length === 1) {
          setSelectedCourseId(res.data[0].id);
        } else if (!isAdmin && res.data?.length > 0 && !selectedCourseId) {
          setSelectedCourseId(res.data[0].id);
        }
      })
      .catch(() => setError(t('attendance.coursesLoadError') || 'Failed to load courses'));
  }, [isAdmin, selectedDeptId, isStudent]);

  // 4. Load groups when course selected
  useEffect(() => {
    setSelectedGroupId(null);
    setGroups([]);
    if (!selectedCourseId) return;
    
    const course = courses.find(c => c.id === selectedCourseId);
    const departmentId = course?.departmentId || course?.department?.id || selectedDeptId;
    
    if (departmentId) {
      studentGroupsService.getDepartmentGroups(departmentId)
        .then(res => {
          const grps = res.data?.groups || res.data || [];
          setGroups(grps);
          if (grps.length === 1) {
            setSelectedGroupId(grps[0].id);
          }
        })
        .catch(() => {});
    }
  }, [selectedCourseId, courses, selectedDeptId]);

  // 5. Load roster when section selected + date (or course selected for student)
  useEffect(() => {
    if (isStudent) {
      if (selectedCourseId) {
        fetchMyAttendance(selectedCourseId);
        fetchSummary(selectedCourseId);
      } else {
        setMyAttendance([]);
        setSummary(null);
      }
      return;
    }

    if (!selectedCourseId || !date || (groups.length > 0 && !selectedGroupId)) {
      setRoster([]);
      setRecords({});
      return;
    }

    if (isAdmin) {
      fetchRecords(selectedCourseId, date, selectedGroupId);
    } else {
      fetchRoster(selectedCourseId, date, selectedGroupId);
    }
  }, [selectedCourseId, selectedGroupId, date, isAdmin, isStudent]);

  const fetchRoster = async (courseId: number, selectedDate: string, groupId?: number | null) => {
    try {
      setLoading(true);
      setError(null);
      const res = await attendanceService.getCourseRoster(courseId, selectedDate, groupId || undefined);
      setRoster(res.data || []);
      const newRecords: Record<number, { status: string; remarks: string }> = {};
      res.data?.forEach((student: RosterStudent) => {
        newRecords[student.id] = {
          status: student.existingStatus || 'PRESENT',
          remarks: student.existingRemarks || ''
        };
      });
      setRecords(newRecords);
      fetchSummary(courseId);
    } catch (err) {
      setError(t('attendance.rosterLoadError') || 'Failed to load roster');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async (courseId: number, selectedDate: string, groupId?: number | null) => {
    try {
      setLoading(true);
      setError(null);
      // Admin uses the new records endpoint
      const params = { courseId, date: selectedDate, groupId };
      const res = await attendanceService.getAttendanceRecords(params);
      
      // Transform response to match roster format
      const recordsData = res.data || [];
      const transformedRoster: any[] = [];
      const newRecords: Record<number, { status: string; remarks: string }> = {};
      
      recordsData.forEach((rec: any) => {
        const student = rec.student;
        transformedRoster.push({
          id: student.id,
          studentId: student.studentId,
          firstName: student.firstName,
          lastName: student.lastName,
          group: rec.group?.name || '-',
          recordedBy: rec.recordedBy,
          recordedAt: rec.recordedAt,
        });
        
        newRecords[student.id] = {
          status: rec.status,
          remarks: rec.remarks || ''
        };
      });
      
      setRoster(transformedRoster);
      setRecords(newRecords);
      fetchSummary(courseId);
    } catch (err) {
      // Fallback to fetchRoster if records endpoint isn't fully ready or returning error
      fetchRoster(courseId, selectedDate, groupId);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyAttendance = async (courseId: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await attendanceService.getMyAttendance(courseId);
      setMyAttendance(res.data || []);
    } catch (err) {
      setError(t('attendance.coursesLoadError') || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async (courseId: number) => {
    try {
      const res = await attendanceService.getAttendanceSummary(courseId);
      setSummary(res.data || null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = (studentId: number, status: string) => {
    setRecords(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], status }
    }));
  };

  const handleRemarksChange = (studentId: number, remarks: string) => {
    setRecords(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], remarks }
    }));
  };

  const markAll = (status: string) => {
    const newRecords = { ...records };
    Object.keys(newRecords).forEach(key => {
      newRecords[parseInt(key)].status = status;
    });
    setRecords(newRecords);
  };

  const handleSave = async () => {
    if (!selectedCourseId) return;
    try {
      setSaving(true);
      setError(null);
      const bulkData = Object.keys(records).map(id => ({
        studentId: parseInt(id),
        status: records[parseInt(id)].status,
        remarks: records[parseInt(id)].remarks
      }));
      await attendanceService.bulkSave(selectedCourseId, date, bulkData);
      setSuccess(t('attendance.saveSuccess') || 'Saved successfully');
      setTimeout(() => setSuccess(null), 3000);
      fetchSummary(selectedCourseId);
      
      if (isAdmin) {
        fetchRecords(selectedCourseId, date, selectedGroupId);
      }
    } catch (err) {
      setError(t('attendance.saveError') || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT': return <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900"><CheckCircle className="w-3 h-3 mr-1"/>{t('attendance.present')}</Badge>;
      case 'ABSENT': return <Badge className="bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900"><XCircle className="w-3 h-3 mr-1"/>{t('attendance.absent')}</Badge>;
      case 'LATE': return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-450 dark:border-yellow-900"><Clock className="w-3 h-3 mr-1"/>{t('attendance.late')}</Badge>;
      case 'EXCUSED': return <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-450 dark:border-blue-900"><AlertCircle className="w-3 h-3 mr-1"/>{t('attendance.excused')}</Badge>;
      default: return null;
    }
  };

  const currentStats = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  Object.values(records).forEach(rec => {
    if (rec.status === 'PRESENT') currentStats.PRESENT++;
    if (rec.status === 'ABSENT') currentStats.ABSENT++;
    if (rec.status === 'LATE') currentStats.LATE++;
    if (rec.status === 'EXCUSED') currentStats.EXCUSED++;
  });

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <PageHeader
        title={t('attendance.dashboardTitle') || t('attendance.title') || 'إدارة الحضور والغياب'}
        subtitle={t('attendance.subtitle') || 'سجل وتابع حضور الطلاب'}
        action={canRecord && selectedCourseId && roster.length > 0 ? {
          label: saving ? '...' : t('attendance.save') as string,
          onClick: handleSave,
          disabled: saving || !selectedCourseId,
          icon: saving ? Loader2 : Save,
        } : undefined}
        extraActions={
          canRecord && roster.length > 0 ? (
            <div className="flex items-center gap-2">
              <button onClick={() => markAll('PRESENT')}
                className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold
                           bg-green-50 text-green-700 hover:bg-green-100
                           dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30
                           border border-green-200 dark:border-green-800 transition-all">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t('attendance.markAllPresent') as string}
              </button>
              <button onClick={() => markAll('ABSENT')}
                className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold
                           bg-red-50 text-red-700 hover:bg-red-100
                           dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30
                           border border-red-200 dark:border-red-800 transition-all">
                <XCircle className="w-3.5 h-3.5" />
                {t('attendance.markAllAbsent') as string}
              </button>
            </div>
          ) : undefined
        }
      />

      {error && <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-750 dark:text-red-400 rounded-2xl border border-red-255 dark:border-red-900 flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-red-500"/><span className="text-sm font-semibold">{error}</span></div>}
      {success && <div className="p-4 bg-green-50 dark:bg-green-950/20 text-green-755 dark:text-green-400 rounded-2xl border border-green-250 dark:border-green-900 flex items-center gap-3"><CheckCircle className="w-5 h-5 text-green-500"/><span className="text-sm font-semibold">{success}</span></div>}

      {/* FILTERS BAR CARD - Full Width */}
      {!isStudent && (
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200
                         dark:border-slate-700 shadow-sm overflow-hidden p-0 mb-6">
          <FilterBar
            search=""
            onSearchChange={() => {}}
            searchPlaceholder=""
            hideSearch={true}
          >
            {/* College — Admin only */}
            {isAdmin && (
              <select
                value={selectedCollegeId ?? ''}
                onChange={e => {
                  setSelectedCollegeId(Number(e.target.value) || null);
                  setSelectedDeptId(null);
                  setSelectedCourseId(null);
                  setSelectedGroupId(null);
                }}
                className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200
                           dark:border-slate-700 rounded-xl text-xs font-semibold
                           text-brand-text-primary dark:text-brand-text-main focus:outline-none
                           focus:ring-2 focus:ring-brand-primary-500/20 transition-all
                           cursor-pointer flex-shrink-0">
                <option value="">{t('colleges.allColleges') || 'كل الكليات'}</option>
                {colleges.map(c => (
                  <option key={c.id} value={c.id}>{isRTL ? c.nameAr || c.name : c.name}</option>
                ))}
              </select>
            )}

            {/* Department — Admin only */}
            {isAdmin && (
              <select
                value={selectedDeptId ?? ''}
                onChange={e => {
                  setSelectedDeptId(Number(e.target.value) || null);
                  setSelectedCourseId(null);
                  setSelectedGroupId(null);
                }}
                disabled={isAdmin && !selectedCollegeId}
                className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200
                           dark:border-slate-700 rounded-xl text-xs font-semibold
                           text-brand-text-primary dark:text-brand-text-main focus:outline-none
                           focus:ring-2 focus:ring-brand-primary-500/20 transition-all
                           cursor-pointer flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
                <option value="">{t('departments.allDepartments') || 'كل الأقسام'}</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{isRTL ? d.nameAr || d.name : d.name}</option>
                ))}
              </select>
            )}

            {/* Course */}
            <select
              value={selectedCourseId ?? ''}
              onChange={e => {
                setSelectedCourseId(Number(e.target.value) || null);
                setSelectedGroupId(null);
              }}
              disabled={isAdmin && !selectedDeptId}
              className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200
                         dark:border-slate-700 rounded-xl text-xs font-semibold
                         text-brand-text-primary dark:text-brand-text-main focus:outline-none
                         focus:ring-2 focus:ring-brand-primary-500/20 transition-all
                         cursor-pointer flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
              <option value="">{t('attendance.chooseCourse') || 'اختر المقرر'}</option>
              {courses.map(c => {
                const id = c.id ?? (c as any).courseId ?? (c as any).course?.id;
                const code = c.courseCode ?? c.code ?? (c as any).course?.code ?? (c as any).course?.courseCode;
                const name = c.name ?? (c as any).course?.name;
                return (
                  <option key={id} value={id}>
                    {code} — {name}
                  </option>
                );
              })}
            </select>

            {/* Group — appears after course selected */}
            {selectedCourseId && groups.length > 0 && (
              <select
                value={selectedGroupId ?? ''}
                onChange={e => setSelectedGroupId(Number(e.target.value) || null)}
                className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200
                           dark:border-slate-700 rounded-xl text-xs font-semibold
                           text-brand-text-primary dark:text-brand-text-main focus:outline-none
                           focus:ring-2 focus:ring-brand-primary-500/20 transition-all
                           cursor-pointer flex-shrink-0">
                <option value="">كل المجموعات</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}

            {/* Date picker — always shown */}
            <input
              type="date"
              value={date}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setDate(e.target.value)}
              className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200
                         dark:border-slate-700 rounded-xl text-xs font-semibold
                         text-brand-text-primary dark:text-brand-text-main focus:outline-none
                         focus:ring-2 focus:ring-brand-primary-500/20 transition-all flex-shrink-0" />
          </FilterBar>
        </Card>
      )}

      {/* Main Content */}
      <div className="min-w-0">
        {isStudent ? (
          // STUDENT VIEW
          <div className="space-y-6">
            {loading ? (
              <div className="flex justify-center py-20"><RefreshCw className="w-10 h-10 animate-spin text-gray-400" /></div>
            ) : selectedCourseId ? (
              <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <CardHeader className="border-b border-slate-100 dark:border-slate-700 px-6 py-4">
                  <CardTitle className="text-lg font-bold">{t('attendance.myRecords')}</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {myAttendance.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                      <p>{t('attendance.noStudentsDesc') || 'لا يوجد سجلات حضور'}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {myAttendance.map((record, idx) => (
                        <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-150 dark:border-slate-700 rounded-xl hover:shadow-sm transition-all duration-150">
                          <div className="flex items-center space-x-3">
                            <div className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg text-slate-500 dark:text-slate-400">
                              <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">{format(new Date(record.date), 'dd MMMM yyyy', { locale: dateLocale })}</p>
                              {record.remarks && <p className="text-xs text-slate-400 mt-0.5">{record.remarks}</p>}
                            </div>
                          </div>
                          {renderStatusBadge(record.status)}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="py-16">
                <EmptyState
                  icon={<BookOpen size={40} />}
                  title={t('attendance.chooseCourse') as string || 'اختر المقرر لعرض سجل الحضور'}
                  subtitle={t('attendance.chooseCourseDesc') as string || 'قم باختيار المقرر من القائمة أعلاه للبدء في عرض الحضور والغياب الخاص بك.'}
                />
              </div>
            )}
          </div>
        ) : (
          // FACULTY & ADMIN VIEW
          <div className="space-y-6">
            {/* KPI Cards Row (Full Width) */}
            {selectedCourseId && (loading || roster.length > 0) && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {loading ? (
                  // Skeleton cards
                  [1,2,3,4].map(i => (
                    <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200
                                            dark:border-slate-700 shadow-sm p-4 h-20 animate-pulse" />
                  ))
                ) : (
                  [
                    {
                      label: t('attendance.totalStudents') as string || 'إجمالي الطلاب',
                      value: roster.length,
                      icon: Users,
                      bgClass: 'bg-brand-primary-500/10',
                      iconClass: 'text-brand-primary-500',
                    },
                    {
                      label: t('attendance.present') as string,
                      value: currentStats.PRESENT,
                      icon: UserCheck,
                      bgClass: 'bg-blue-500/10',
                      iconClass: 'text-blue-500',
                    },
                    {
                      label: t('attendance.late') as string,
                      value: currentStats.LATE,
                      icon: Clock,
                      bgClass: 'bg-amber-500/10',
                      iconClass: 'text-amber-500',
                    },
                    {
                      label: t('attendance.absent') as string,
                      value: currentStats.ABSENT,
                      icon: UserX,
                      bgClass: 'bg-red-500/10',
                      iconClass: 'text-red-500',
                    },
                  ].map(stat => (
                    <Card
                      key={stat.label}
                      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200
                                 dark:border-slate-700 shadow-sm p-4 flex items-center gap-4
                                 group hover:-translate-y-0.5 hover:shadow-md transition-all text-start">
                      <div className={`rounded-xl p-2.5 ${stat.bgClass}`}>
                        <stat.icon size={24} className={stat.iconClass} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-2xl font-black text-brand-text-primary dark:text-white">
                          {stat.value}
                        </span>
                        <span className="text-sm text-brand-text-secondary dark:text-slate-400 font-bold">
                          {stat.label}
                        </span>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* ROSTER TABLE CARD */}
            <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200
                             dark:border-slate-700 shadow-sm overflow-hidden p-0">
              <div className="flex items-center justify-between px-6 py-4 border-b
                              border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-primary-500/10 rounded-xl p-2">
                    <Users className="w-5 h-5 text-brand-primary-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-brand-text-primary dark:text-white">
                      {t('attendance.title') as string || 'سجل الحضور'}
                    </h2>
                    {roster.length > 0 && (
                      <p className="text-xs text-brand-text-secondary dark:text-slate-400">
                        {roster.length} {t('attendance.studentsInClass') as string || 'طالب في هذه الشعبة'}
                      </p>
                    )}
                  </div>
                </div>
                {/* Progress indicator when roster is loaded */}
                {roster.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-brand-primary-500">{currentStats.PRESENT + currentStats.LATE}</span>
                    <span>/</span>
                    <span>{roster.length}</span>
                    <span>{t('attendance.recordedCount') as string || 'تم تسجيلهم'}</span>
                  </div>
                )}
              </div>

              {!selectedCourseId && (
                <div className="py-16">
                  <EmptyState
                    icon={<BookOpen size={40} />}
                    title={t('attendance.chooseCourse') as string || 'اختر المقرر لعرض سجل الحضور'}
                    subtitle={t('attendance.chooseCourseDesc') as string || (isAdmin ? 'يرجى اختيار الكلية ثم القسم للوصول إلى قائمة المقررات الدراسية وعرض السجل الخاص بها.' : 'قم باختيار المقرر من القائمة أعلاه للبدء في تسجيل الحضور والغياب للطلاب.')}
                  />
                </div>
              )}
              
              {selectedCourseId && !loading && roster.length === 0 && (
                <div className="py-16">
                  <EmptyState
                    icon={<Users size={40} />}
                    title={t('attendance.noStudents') as string || 'لا يوجد طلاب'}
                    subtitle={
                      groups.length === 0
                        ? 'هذا المقرر لا يحتوي على مجموعات طلاب مضافة بعد.'
                        : (t('attendance.noStudentsDesc') as string || 'لا يوجد طلاب مسجلين في هذه المجموعة حالياً.')
                    }
                  />
                </div>
              )}

              {selectedCourseId && loading && (
                <div className="p-6 space-y-3">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="h-14 bg-slate-100 dark:bg-slate-700/50 rounded-xl animate-pulse" />
                  ))}
                </div>
              )}

              {selectedCourseId && !loading && roster.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
                        <th className="text-start ps-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide w-10 hidden sm:table-cell">#</th>
                        <th className="text-start py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('attendance.student') as string || 'الطالب'}</th>
                        <th className="text-center py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">{t('attendance.group') as string || 'المجموعة'}</th>
                        <th className="text-center py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('attendance.status') as string || 'حالة الحضور'}</th>
                        {isAdmin ? (
                          <>
                            <th className="text-center py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide pe-4 hidden lg:table-cell">{t('attendance.recordedBy') as string || 'سجّل بواسطة'}</th>
                            <th className="text-center py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide pe-6 hidden md:table-cell">{t('attendance.recordedAt') as string || 'وقت التسجيل'}</th>
                          </>
                        ) : (
                          <th className="text-center py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide pe-6 hidden md:table-cell">{t('attendance.remarks') as string || 'ملاحظة'}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                      {roster.map((student, idx) => {
                        const currentStatus = records[student.id]?.status ?? '';
                        const accentClass = currentStatus === 'PRESENT' ? 'border-s-green-400'
                                          : currentStatus === 'LATE'    ? 'border-s-amber-400'
                                          : currentStatus === 'ABSENT'  ? 'border-s-red-400'
                                          : 'border-s-transparent';
                        return (
                          <tr key={student.id}
                            className={`border-s-4 ${accentClass} hover:bg-slate-50 dark:hover:bg-slate-800/60
                                        transition-all duration-150`}>
                            {/* # */}
                            <td className="ps-4 py-4 text-sm text-slate-400 font-medium w-10 text-start hidden sm:table-cell">{idx + 1}</td>

                            {/* Student */}
                            <td className="py-4 pe-4 text-start">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-brand-primary-500/10 flex items-center
                                                justify-center flex-shrink-0 font-bold text-sm text-brand-primary-600">
                                  {student.firstName?.[0]}{student.lastName?.[0]}
                                </div>
                                <div>
                                  <p className="font-bold text-brand-text-primary dark:text-white text-sm">
                                    {student.firstName} {student.lastName}
                                  </p>
                                  <p className="text-xs text-brand-text-secondary dark:text-slate-400 font-mono">
                                    {student.studentId}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Group */}
                            <td className="py-4 px-4 text-center hidden md:table-cell">
                              <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600
                                               dark:text-slate-300 rounded-full px-3 py-1 font-medium">
                                {student.group || '—'}
                              </span>
                            </td>

                            {/* Status pills / Select */}
                            <td className="py-4 px-4">
                              {/* Desktop View: Pills */}
                              <div className="hidden md:flex items-center justify-center gap-1.5 flex-wrap">
                                {(['PRESENT', 'LATE', 'ABSENT'] as const).map(s => (
                                  <button key={s}
                                    onClick={() => handleStatusChange(student.id, s)}
                                    className={[
                                      'px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 border',
                                      currentStatus === s
                                        ? s === 'PRESENT' ? 'bg-green-500 text-white border-green-500 shadow-sm'
                                        : s === 'LATE'    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                        :                   'bg-red-500 text-white border-red-500 shadow-sm'
                                        : 'bg-transparent text-slate-400 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                                    ].join(' ')}>
                                    {s === 'PRESENT' ? t('attendance.present') as string || 'حاضر'
                                     : s === 'LATE'  ? t('attendance.late') as string || 'متأخر'
                                     :                 t('attendance.absent') as string || 'غائب'}
                                  </button>
                                ))}
                              </div>

                              {/* Mobile View: Compact Dropdown */}
                              <div className="md:hidden flex justify-center">
                                <select
                                  value={currentStatus}
                                  onChange={(e) => handleStatusChange(student.id, e.target.value as any)}
                                  className={`h-9 px-3 border border-brand-border rounded-xl text-xs font-bold bg-brand-bg-page/30 focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all appearance-none cursor-pointer w-28 ${
                                    currentStatus === 'PRESENT' ? 'text-green-600 dark:text-green-400' :
                                    currentStatus === 'LATE' ? 'text-amber-600 dark:text-amber-400' :
                                    currentStatus === 'ABSENT' ? 'text-red-600 dark:text-red-400' : 'text-brand-text-main'
                                  }`}
                                  style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: isRTL ? 'left 0.75rem center' : 'right 0.75rem center',
                                    paddingRight: isRTL ? '0.75rem' : '1.75rem',
                                    paddingLeft: isRTL ? '1.75rem' : '0.75rem',
                                  }}
                                >
                                  <option value="PRESENT" className="text-green-600 dark:text-green-400">{t('attendance.present') || 'Present'}</option>
                                  <option value="LATE" className="text-amber-600 dark:text-amber-400">{t('attendance.late') || 'Late'}</option>
                                  <option value="ABSENT" className="text-red-600 dark:text-red-400">{t('attendance.absent') || 'Absent'}</option>
                                </select>
                              </div>
                            </td>

                            {/* Recorded by — Admin only / Remarks */}
                            {isAdmin ? (
                              <>
                                <td className="text-center py-3 px-4 hidden lg:table-cell">
                                  {(student as any).recordedBy ? (
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="text-xs font-semibold text-brand-text-primary dark:text-white">
                                        {(student as any).recordedBy.firstName} {(student as any).recordedBy.lastName}
                                      </span>
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                        (student as any).recordedBy.role === 'DOCTOR'
                                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                          : (student as any).recordedBy.role === 'TEACHING_ASSISTANT'
                                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                      }`}>
                                        {(student as any).recordedBy.role === 'DOCTOR' ? 'دكتور' : (student as any).recordedBy.role === 'TEACHING_ASSISTANT' ? 'معيد' : 'إدارة'}
                                      </span>
                                    </div>
                                  ) : <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>}
                                </td>
                                <td className="text-center py-3 px-4 text-xs text-slate-500 pe-6 hidden md:table-cell">
                                  {(student as any).recordedAt
                                    ? new Date((student as any).recordedAt).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })
                                    : '—'}
                                </td>
                              </>
                            ) : (
                              <td className="px-4 py-4 pe-6 text-center hidden md:table-cell">
                                <input 
                                  type="text" 
                                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl h-9 px-3 text-xs w-full max-w-[200px] focus:outline-none focus:ring-2 focus:ring-brand-primary-500/50"
                                  placeholder={t('attendance.remarks') as string || 'ملاحظة...'}
                                  value={records[student.id]?.remarks || ''}
                                  onChange={(e) => handleRemarksChange(student.id, e.target.value)}
                                />
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {canRecord && selectedCourseId && !loading && roster.length > 0 && (
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700/50 flex justify-start">
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 bg-brand-primary-500 hover:bg-brand-primary-600
                               text-white rounded-xl px-5 py-2.5 text-sm font-semibold
                               active:scale-95 transition-all disabled:opacity-50 shadow-sm">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {t('attendance.save') as string}
                  </button>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
