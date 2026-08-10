import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import {
  Users, CheckCircle, Clock, AlertCircle,
  Play, Square, RefreshCw, AlertTriangle, UserCheck, BookOpen,
  ChevronDown, ChevronUp, ChevronRight, ChevronLeft, Eye, EyeOff, Search, X, ShieldCheck, GraduationCap, User, Award, Filter,
  QrCode, CreditCard, ScanFace, MapPin, XCircle
} from 'lucide-react';
import attendanceService, { RosterStudent } from '../../services/attendance.service';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

export function FacultyAttendanceDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  const [activeSession, setActiveSession] = useState<any>(null);
  const [qrToken, setQrToken] = useState('');
  const [timeLeft, setTimeLeft] = useState(10);
  const [qrDuration, setQrDuration] = useState(10);
  const [flaggedRecords, setFlaggedRecords] = useState<any[]>([]);
  const [hideMismatchWarning, setHideMismatchWarning] = useState(false);
  const [isSavingRoom, setIsSavingRoom] = useState(false);

  // Toggleable list state for Present Students, Professor & TAs
  const [activeTab, setActiveTab] = useState<'QR' | 'MANUAL' | 'RFID' | 'FACE' | 'GPS'>('QR');
  const [showRosterList, setShowRosterList] = useState(false);
  const [roster, setRoster] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<{ doctor: any; teachingAssistant: any }>({ doctor: null, teachingAssistant: null });
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState<'PRESENT' | 'LATE' | 'FLAGGED' | 'ALL' | 'ABSENT'>('PRESENT');
  const [gracePeriods, setGracePeriods] = useState<Record<number, number>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<any>(null);
  const pollingRef = useRef<any>(null);
  const targetTimeRef = useRef<number>(0);

  // 1. Initial Load: Fetch Courses
  useEffect(() => {
    attendanceService.getMyCourses()
      .then(res => {
        const loadedCourses = res.data || [];
        setCourses(loadedCourses);
      })
      .catch((err: any) => {
        console.error('Failed to load my-courses:', err);
        setError(t('attendance.loadCoursesError', 'حدث خطأ أثناء تحميل المقررات'));
      });
  }, [t]);

  // 2. Load active session if course selected
  useEffect(() => {
    if (selectedCourseId) {
      checkActiveSession(selectedCourseId);
    } else {
      setActiveSession(null);
    }
  }, [selectedCourseId]);

  const checkActiveSession = async (courseId: number) => {
    try {
      setLoading(true);
      const res = await attendanceService.getActiveSession(courseId);
      if (res.data) {
        setActiveSession(res.data);
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRoomLocation = async () => {
    if (!activeSession?.roomId || !activeSession?.latitude || !activeSession?.longitude) return;
    try {
      setIsSavingRoom(true);
      await api.patch(`/rooms/${activeSession.roomId}/coordinates`, {
        latitude: activeSession.latitude,
        longitude: activeSession.longitude
      });
      alert(t('attendance.roomLocationSaved', 'تم حفظ الموقع الجغرافي للقاعة بنجاح'));
      if (selectedCourseId) {
        await checkActiveSession(selectedCourseId);
      }
    } catch (err) {
      console.error(err);
      alert(t('attendance.roomLocationSaveError', 'حدث خطأ أثناء حفظ الموقع'));
    } finally {
      setIsSavingRoom(false);
    }
  };

  // 3. QR Token and Polling
  useEffect(() => {
    if (activeSession?.sessionId) {
      const stepSeconds = activeSession.codeStepSeconds || 20;
      targetTimeRef.current = Date.now() + stepSeconds * 1000;
      updateToken();
      setTimeLeft(stepSeconds);

      // Clear any existing intervals
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollingRef.current) clearInterval(pollingRef.current);

      // Countdown timer — absolute time math to prevent browser throttling drift
      timerRef.current = setInterval(() => {
        const remaining = Math.ceil((targetTimeRef.current - Date.now()) / 1000);
        if (remaining <= 0) {
          targetTimeRef.current = Date.now() + stepSeconds * 1000;
          updateToken();
          setTimeLeft(stepSeconds);
        } else {
          setTimeLeft(remaining);
        }
      }, 500);

      let isMounted = true;
      let currentInterval = 3000;
      
      const poll = async () => {
        if (!isMounted) return;
        const success = await fetchSessionData();
        if (!isMounted) return;
        
        if (success) {
          currentInterval = 3000;
        } else {
          currentInterval = Math.min(currentInterval * 2, 30000);
        }
        pollingRef.current = setTimeout(poll, currentInterval);
      };

      // Immediate first sync of session data
      fetchSessionData();

      // Start polling
      pollingRef.current = setTimeout(poll, currentInterval);

      return () => {
        isMounted = false;
        if (timerRef.current) clearInterval(timerRef.current);
        if (pollingRef.current) clearTimeout(pollingRef.current);
      };
    }
    return undefined;
  }, [activeSession?.sessionId, qrDuration]);

  const updateToken = async () => {
    if (activeSession?.sessionId) {
      try {
        const stepSeconds = activeSession.codeStepSeconds || 20;
        const res = await attendanceService.getCurrentCode(activeSession.sessionId, stepSeconds);
        if (res.data?.token) {
          setQrToken(res.data.token);
        }
      } catch (err) {
        console.error('Failed to get token', err);
      }
    }
  };

  const fetchSessionData = async (): Promise<boolean> => {
    if (!activeSession?.sessionId) return false;
    try {
      // Fetch flagged
      const flaggedRes = await attendanceService.getFlaggedRecords(activeSession.sessionId);
      setFlaggedRecords(flaggedRes.data || []);

      // Fetch roster & instructors
      const rosterRes = await attendanceService.getSessionRoster(activeSession.sessionId);
      if (rosterRes.data) {
        setRoster(rosterRes.data);
      }
      if (rosterRes.instructors) {
        setInstructors(rosterRes.instructors);
      }
      return true;
    } catch (err) {
      console.error('Failed to sync session data', err);
      return false;
    }
  };

  const captureDoctorLocation = async (): Promise<{ lat?: number; lng?: number }> => {
    if (!navigator.geolocation) return {};

    // 1st Attempt: High Accuracy GPS (Mobile / Tablet)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 0
        });
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch (e) {
      console.warn('High accuracy location fallback:', e);
    }

    // 2nd Attempt: Standard Accuracy (Wi-Fi / IP Positioning for Desktop / Laptop)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 60000
        });
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch (e) {
      console.warn('Standard location also failed:', e);
    }

    return {};
  };

  const handleStartSession = async (courseId: number) => {
    try {
      setLoading(true);
      setError(null);

      const { lat, lng } = await captureDoctorLocation();

      const res = await attendanceService.startSession({
        courseId,
        latitude: lat,
        longitude: lng,
        radius: 100,
        gracePeriodMins: gracePeriods[courseId] ?? 15
      });
      setActiveSession(res.data);
      setSelectedCourseId(courseId);
    } catch (err: any) {
      let errorMessage = err.response?.data?.message || t('attendance.startSessionError', 'فشل بدء الجلسة');
      if (err.response?.status === 404 && typeof errorMessage === 'string' && errorMessage.includes('ScheduleSlot')) {
        errorMessage = t('attendance.noScheduleSlot', 'لم يتم العثور على موعد متطابق في الجدول الدراسي. يرجى التواصل مع الإدارة.');
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const syncLocationNow = async () => {
    if (!activeSession?.sessionId) return;
    try {
      setLoading(true);
      const { lat, lng } = await captureDoctorLocation();
      if (lat && lng) {
        const res = await attendanceService.updateSessionLocation(activeSession.sessionId, {
          latitude: lat,
          longitude: lng,
          radius: 100
        });
        if (res.data) {
          setActiveSession(res.data);
        }
      } else {
        alert(t('attendance.locationPermissionAlert', 'يرجى السماح بالوصول للموقع في متصفحك وتأكيد تشغيل خدمة GPS/الموقع الجغرافي.'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStopSession = async () => {
    if (!activeSession) return;
    try {
      setLoading(true);
      await attendanceService.stopSession(activeSession.sessionId);
      setActiveSession(null);
      setSelectedCourseId(null);
      setQrToken('');
      setFlaggedRecords([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const approveFlagged = async (id: number) => {
    try {
      await attendanceService.overrideFlaggedRecord(id, 'Approved manually by Doctor/TA');
      fetchSessionData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleManualToggle = async (studentId: number, status: 'PRESENT' | 'LATE' | 'ABSENT') => {
    if (!activeSession) return;
    console.log('[handleManualToggle] fire', { studentId, targetStatus: status, sessionId: activeSession.sessionId });
    try {
      await attendanceService.markStudentAttendance(activeSession.sessionId, studentId, status);
      fetchSessionData();
    } catch (err: any) {
      console.error('Failed to mark attendance manually:', err);
      setError(err.response?.data?.message || 'Failed to update attendance');
      fetchSessionData();
    }
  };

  const presentCount = roster.filter(s => s.existingStatus === 'PRESENT' || s.existingStatus === 'LATE').length;
  const lateCount = roster.filter(s => s.existingStatus === 'LATE').length;

  const filteredStudents = roster.filter(s => {
    const fullName = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
    const studentIdStr = (s.studentId || '').toString().toLowerCase();
    const matchesSearch =
      !rosterSearch ||
      fullName.includes(rosterSearch.toLowerCase()) ||
      studentIdStr.includes(rosterSearch.toLowerCase());

    if (!matchesSearch) return false;

    if (rosterFilter === 'PRESENT') {
      return s.existingStatus === 'PRESENT' || s.existingStatus === 'LATE';
    }
    if (rosterFilter === 'LATE') {
      return s.existingStatus === 'LATE';
    }
    if (rosterFilter === 'ABSENT') {
      return s.existingStatus === 'ABSENT';
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Roster & Academic Staff Slide-Over Modal Drawer (Appears & Disappears without shifting page) */}
      {showRosterList && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 md:p-6 overflow-y-auto animate-fade-in">
          <div className="max-w-3xl w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative flex flex-col max-h-[85vh]">
            
            {/* Drawer Header */}
            <div className="p-6 md:p-8 bg-gradient-to-r from-slate-900 via-brand-navy-900 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-primary-500/20 border border-brand-primary-400/30 flex items-center justify-center text-brand-primary-400">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-black">
                    {t('attendance.rosterStaffModalTitle', 'قائمة الحاضرين والكادر التدريسي')}
                  </h3>
                  <p className="text-slate-400 text-xs md:text-sm font-medium mt-0.5">
                    {courses.find(c => c.id === selectedCourseId)?.name || 'المقرر الدراسي'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRosterList(false)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto space-y-8 flex-1">
              
              {/* Academic Staff Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-5 h-5 text-brand-primary-500" />
                  <h4 className="text-lg font-bold text-slate-800 dark:text-white">
                    {t('attendance.academicStaff', 'الكادر التدريسي للمحاضرة')}
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Doctor / Professor Card */}
                  <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-brand-primary-100 dark:bg-brand-primary-900/40 text-brand-primary-700 dark:text-brand-primary-300 flex items-center justify-center font-black shrink-0">
                      <UserCheck className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-brand-primary-600 dark:text-brand-primary-400 uppercase tracking-wider">
                          {t('attendance.doctorRole', 'أستاذ المادة (دكتور)')}
                        </span>
                        <Badge className="bg-brand-primary-100 text-brand-primary-800 text-[10px]">Doctor</Badge>
                      </div>
                      <h5 className="text-base font-bold text-slate-800 dark:text-white truncate mt-0.5">
                        {instructors.doctor?.firstName 
                          ? `${instructors.doctor.firstName} ${instructors.doctor.lastName}` 
                          : (user?.role === 'DOCTOR' ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'د. يوسف أحمد' : 'دكتور المادة')}
                      </h5>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        {instructors.doctor?.doctorId || (user?.role === 'DOCTOR' ? user.email : 'DOC-FACULTY')}
                      </p>
                    </div>
                  </div>

                  {/* Teaching Assistant Card */}
                  <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-black shrink-0">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                          {t('attendance.taRole', 'مساعد التدريس (معيد)')}
                        </span>
                        <Badge className="bg-blue-100 text-blue-800 text-[10px]">TA</Badge>
                      </div>
                      <h5 className="text-base font-bold text-slate-800 dark:text-white truncate mt-0.5">
                        {instructors.teachingAssistant?.firstName 
                          ? `${instructors.teachingAssistant.firstName} ${instructors.teachingAssistant.lastName}` 
                          : (user?.role === 'TEACHING_ASSISTANT' ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'م. أحمد علي' : 'مساعد التدريس (معيد)')}
                      </h5>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        {instructors.teachingAssistant?.employeeId || (user?.role === 'TEACHING_ASSISTANT' ? user.email : 'TA-STAFF')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Present Students Section */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <UserCheck className="w-5 h-5 text-brand-primary-500" />
                    <h4 className="text-lg font-bold text-slate-800 dark:text-white me-2">
                      {t('attendance.roster', 'قائمة الطلاب')}
                    </h4>
                    <Badge className="bg-slate-100 text-slate-800 font-bold">
                      {t('attendance.total', 'الكل')}: {roster.length}
                    </Badge>
                    <Badge className="bg-emerald-100 text-emerald-800 font-bold">
                      {t('attendance.present', 'حاضر')}: {presentCount}
                    </Badge>
                    <Badge className="bg-amber-100 text-amber-800 font-bold">
                      {t('attendance.late', 'متأخر')}: {lateCount}
                    </Badge>
                    <Badge className="bg-rose-100 text-rose-800 font-bold">
                      {t('attendance.absent', 'غائب')}: {roster.length - presentCount - lateCount}
                    </Badge>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      onClick={() => setRosterFilter('PRESENT')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        rosterFilter === 'PRESENT'
                          ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      {t('attendance.present', 'الحاضرون')}
                    </button>
                    <button
                      onClick={() => setRosterFilter('LATE')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        rosterFilter === 'LATE'
                          ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      {t('attendance.late', 'المتأخرون')} ({lateCount})
                    </button>
                    <button
                      onClick={() => setRosterFilter('ABSENT')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        rosterFilter === 'ABSENT'
                          ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      {t('attendance.absent', 'الغائبون')} ({roster.length - presentCount - lateCount})
                    </button>
                    <button
                      onClick={() => setRosterFilter('FLAGGED')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        rosterFilter === 'FLAGGED'
                          ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{t('attendance.flaggedRecordsTitle', 'تحتاج لمراجعة')}</span>
                      <span className="bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                        {flaggedRecords.length}
                      </span>
                    </button>
                    <button
                      onClick={() => setRosterFilter('ALL')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        rosterFilter === 'ALL'
                          ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      الكل
                    </button>
                  </div>
                </div>

                {/* Search Box */}
                <div className="relative mb-4">
                  <Search className="w-4 h-4 text-slate-400 absolute ltr:left-3.5 rtl:right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder={t('attendance.searchStudentPlaceholder', 'ابحث باسم الطالب أو الرقم الجامعي...')}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl ltr:pl-10 rtl:pr-10 ltr:pr-4 rtl:pl-4 py-2.5 text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-primary-500"
                  />
                </div>

                {/* Students List or Flagged List */}
                {rosterFilter === 'FLAGGED' ? (
                  flaggedRecords.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                      <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
                      <p className="font-medium text-sm">
                        لا توجد حالات معلقة بانتظار المراجعة
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-800/50 max-h-[300px] overflow-y-auto">
                      {flaggedRecords.map((record: any) => (
                        <div key={record.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 flex items-center justify-center font-bold text-sm shrink-0">
                              <AlertCircle className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 dark:text-white text-sm truncate">
                                {record.student.firstName} {record.student.lastName}
                              </p>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">
                                {record.student.studentId}
                              </p>
                            </div>
                          </div>
                          <Button
                            onClick={() => approveFlagged(record.id)}
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-1.5 font-bold text-xs shadow-sm shrink-0"
                          >
                            {t('attendance.approve', 'اعتماد')}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )
                ) : filteredStudents.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                    <Users className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-medium text-sm">
                      {t('attendance.noStudentsPresent', 'لا يوجد طلاب مطابقون حالياً في هذه القائمة')}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-800/50 max-h-[300px] overflow-y-auto">
                    {filteredStudents.map((s: any) => {
                      const isPresent = s.existingStatus === 'PRESENT' || s.existingStatus === 'LATE';
                      return (
                        <div key={s.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                              isPresent 
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' 
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                            }`}>
                              {s.firstName?.[0] || 'S'}{s.lastName?.[0] || ''}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 dark:text-white text-sm truncate">
                                {s.firstName} {s.lastName}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                                <span>{s.studentId}</span>
                                <span>•</span>
                                <span className="font-sans text-slate-400">{s.group}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isPresent && (
                              <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] uppercase font-bold">
                                {s.method || 'QR'}
                              </Badge>
                            )}
                            <Badge className={
                              s.existingStatus === 'PRESENT' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold' :
                              s.existingStatus === 'LATE' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-bold' :
                              'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 font-bold'
                            }>
                              {s.existingStatus === 'PRESENT' ? 'حاضر' : s.existingStatus === 'LATE' ? 'متأخر' : 'غائب'}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
              <Button
                onClick={() => setShowRosterList(false)}
                className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl px-6 font-bold"
              >
                {t('common.close', 'إغلاق')}
              </Button>
            </div>

          </div>
        </div>
      )}

      {/* Main Active Session View (Centered, Stable, Non-Shifting Layout) */}
      {activeSession ? (
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Room Mismatch Warning */}
          {activeSession?.roomMismatchWarning && !hideMismatchWarning && (
            <div className="bg-amber-100 border border-amber-300 text-amber-800 p-4 rounded-xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <span className="font-bold text-sm">You appear to be far from this room's registered location — please confirm you're in the right classroom.</span>
              </div>
              <button onClick={() => setHideMismatchWarning(true)} className="text-amber-600 hover:text-amber-800 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Geo Verification Off Warning */}
          {activeSession?.geoVerificationActive === false && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3 shadow-sm">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <span className="font-bold text-sm">Geolocation verification is OFF for this session — no location on file for this room.</span>
            </div>
          )}

          {/* Save Room Location Banner/Button */}
          {activeSession?.roomNeedsCoordinates && (
            <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-indigo-500 shrink-0" />
                <span className="font-bold text-sm">Geofencing is active via your live location, but this room doesn't have permanent coordinates saved.</span>
              </div>
              <Button onClick={handleSaveRoomLocation} disabled={isSavingRoom} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 font-bold text-sm flex items-center gap-2 shrink-0">
                {isSavingRoom ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Save this location for this room
              </Button>
            </div>
          )}

          {/* Active Session Top Control Banner (Ultra-High Contrast, Premium Aesthetics) */}
          <div className="bg-slate-900 dark:bg-slate-950 rounded-3xl p-6 text-white shadow-2xl border border-slate-800 flex flex-col lg:flex-row items-center justify-between gap-6 relative overflow-hidden">
            {/* Ambient Background Blur Glows */}
            <div className="absolute -start-10 -top-10 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -end-10 -bottom-10 w-48 h-48 rounded-full bg-brand-primary-500/10 blur-3xl pointer-events-none" />

            {/* Right Side: Course Title & Live Badge */}
            <div className="flex items-center gap-4 w-full lg:w-auto">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0 text-white">
                <BookOpen className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                    {t('attendance.activeSession', 'جلسة حضور نشطة')}
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-black text-white drop-shadow-sm truncate">
                  {courses.find(c => c.id === selectedCourseId)?.name || 'المقرر الدراسي'}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {activeSession?.latitude && activeSession?.longitude ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      نطاق القاعة الجغرافي: مفعّل (100م)
                    </span>
                  ) : (
                    <button
                      onClick={syncLocationNow}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/30 text-amber-200 border border-amber-500/50 text-[11px] font-bold hover:bg-amber-500/40 transition-all cursor-pointer shadow-sm animate-pulse"
                      title="اضغط لتحديد موقع القاعة ودعم النطاق الجغرافي"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>نطاق القاعة: غ. محدد (اضغط لتحديده الآن 📍)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Center/Left Side: Stat Pills & Action Controls */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
              
              {/* Green Pill: Present Count (حاضر) */}
              <button 
                onClick={() => {
                  setRosterFilter('PRESENT');
                  setShowRosterList(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/80 transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95"
                title="عرض الطلاب الحاضرين"
              >
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-extrabold">{t('attendance.present', 'حاضر')}:</span>
                <span className="text-base font-black text-white">{presentCount}</span>
              </button>

              {/* Yellow Pill: Late Count (متأخر) */}
              <button 
                onClick={() => {
                  setRosterFilter('LATE');
                  setShowRosterList(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-950/80 text-amber-300 border border-amber-500/40 hover:bg-amber-900/80 transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95"
                title="عرض الطلاب المتأخرين"
              >
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-extrabold">{t('attendance.late', 'متأخر')}:</span>
                <span className="text-base font-black text-white">{lateCount}</span>
              </button>

              {/* Red Pill: Absent Count (غائب) */}
              <button 
                onClick={() => {
                  setRosterFilter('ABSENT');
                  setShowRosterList(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-950/80 text-rose-300 border border-rose-500/40 hover:bg-rose-900/80 transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95"
                title="عرض الطلاب الغائبين"
              >
                <XCircle className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-extrabold">{t('attendance.absent', 'غائب')}:</span>
                <span className="text-base font-black text-white">{roster.length - presentCount - lateCount}</span>
              </button>

              {/* Amber Pill: Cases That Need Review */}
              <button 
                onClick={() => {
                  setRosterFilter('FLAGGED');
                  setShowRosterList(true);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95 border ${
                  flaggedRecords.length > 0
                    ? 'bg-amber-950/90 text-amber-300 border-amber-500/60 animate-pulse'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700'
                }`}
                title="تحتاج لمراجعة"
              >
                <AlertCircle className={`w-4 h-4 ${flaggedRecords.length > 0 ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className="text-xs font-extrabold">{t('attendance.flaggedRecordsTitle', 'تحتاج لمراجعة')}:</span>
                <span className={`text-base font-black ${flaggedRecords.length > 0 ? 'text-amber-300' : 'text-slate-400'}`}>
                  {flaggedRecords.length}
                </span>
              </button>

              {/* Eye Button: View Roster & Staff */}
              <Button
                onClick={() => setShowRosterList(true)}
                className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-2xl py-2.5 px-4 text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
              >
                <Eye className="w-4 h-4 text-brand-primary-400" />
                <span>{t('attendance.viewRosterStaff', 'عرض قائمة الحاضرين والكادر')}</span>
              </Button>

              {/* Red Button: Stop Session */}
              <Button
                onClick={handleStopSession}
                disabled={loading}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-2xl py-2.5 px-5 text-xs font-bold transition-all shadow-md shadow-rose-600/20 active:scale-95 flex items-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : (
                  <>
                    <Square className="w-4 h-4" />
                    <span>{t('attendance.stopSession', 'إنهاء الجلسة')}</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* TABS NAVIGATION */}
          <div className="bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 overflow-hidden mb-6">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setActiveTab('QR')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'QR' ? 'bg-brand-primary-50 text-brand-primary-700 dark:bg-brand-primary-900/40 dark:text-brand-primary-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                <QrCode className="w-5 h-5" />رمز الاستجابة (QR)
              </button>
              <button onClick={() => setActiveTab('MANUAL')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'MANUAL' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                <Users className="w-5 h-5" />يدوي (Manual)
              </button>
            </div>
             
            <div className="flex flex-wrap items-center gap-2 border-slate-200 dark:border-slate-700 ltr:border-l rtl:border-r rtl:pr-4 ltr:pl-4">
              <button disabled className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-400 dark:text-slate-500 opacity-60 cursor-not-allowed">
                <CreditCard className="w-5 h-5" />البطاقة الذكية (RFID)
                <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-300 text-[9px] px-1.5 ml-1">قريباً</Badge>
              </button>
              <button disabled className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-400 dark:text-slate-500 opacity-60 cursor-not-allowed">
                <ScanFace className="w-5 h-5" />بصمة الوجه
                <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-300 text-[9px] px-1.5 ml-1">قريباً</Badge>
              </button>
              <button disabled className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-400 dark:text-slate-500 opacity-60 cursor-not-allowed">
                <MapPin className="w-5 h-5" />الموقع (GPS)
                <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-300 text-[9px] px-1.5 ml-1">قريباً</Badge>
              </button>
            </div>
          </div>

          {/* TAB CONTENT */}
          {activeTab === 'QR' && (
          <Card className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-brand-primary-400 to-brand-primary-600"></div>
            <CardContent className="p-8 md:p-10 flex flex-col items-center justify-center">
              
              <div className="text-center mb-6">
                <h3 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white mb-1">
                  {t('attendance.scanQrToAttend', 'امسح الرمز لتسجيل الحضور')}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                  وجه كاميرا الهاتف نحو الشاشة أو استخدم الرمز اليدوي
                </p>
              </div>

              {/* QR Code Container */}
              <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-700 relative transition-transform duration-300 hover:scale-[1.02]">
                {qrToken ? (
                  <div className="flex flex-col items-center">
                    <QRCodeSVG
                      value={JSON.stringify({ sessionId: activeSession.sessionId, token: qrToken, step: qrDuration })}
                      size={260}
                      level="H"
                      className="drop-shadow-sm mb-5"
                    />
                    <div className="bg-slate-50 dark:bg-slate-900/80 px-8 py-3 rounded-2xl border border-slate-150 dark:border-slate-700/80 text-center w-full">
                      <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest block mb-0.5">
                        الرمز اليدوي المؤقت
                      </span>
                      <span className="text-4xl font-black text-brand-primary-600 tracking-[0.25em] font-mono">
                        {qrToken}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-[260px] h-[260px] flex flex-col items-center justify-center bg-slate-50 rounded-2xl border border-slate-150">
                    <RefreshCw className="w-10 h-10 animate-spin text-brand-primary-400 mb-3" />
                    <span className="text-slate-500 font-bold text-sm">جاري إنشاء الرمز...</span>
                  </div>
                )}
              </div>

              {/* Settings & Timer Control Bar */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 w-full max-w-md">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-primary-500" />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {t('attendance.qrRefreshesIn', 'يتجدد الرمز بعد:')}
                  </span>
                  <span className={`font-black text-lg w-8 text-center ${timeLeft < 5 ? 'text-red-500 animate-bounce' : 'text-brand-primary-600 dark:text-brand-primary-400'}`}>
                    {timeLeft}s
                  </span>
                </div>

                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block"></div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">مدة التحديث:</span>
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 w-24 text-center cursor-not-allowed opacity-80">
                    {activeSession?.codeStepSeconds || 20} ثانية
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>

          )}

          {activeTab === 'MANUAL' && (
            <Card className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative">
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
              <CardContent className="p-8">
                <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6">تسجيل الحضور اليدوي</h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-800/50 max-h-[400px] overflow-y-auto">
                  {roster.map((s: any) => (
                    <div key={s.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
                          {s.firstName?.[0] || 'S'}{s.lastName?.[0] || ''}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-white">{s.firstName} {s.lastName}</p>
                          <p className="text-xs text-slate-500">{s.studentId} • {s.group}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.existingStatus === 'PRESENT' && s.method === 'RFID' && (
                          <Badge className="bg-indigo-100 text-indigo-800 text-[10px] uppercase font-bold">RFID</Badge>
                        )}
                        {s.existingStatus === 'LATE' && s.method === 'RFID' && (
                          <Badge className="bg-indigo-100 text-indigo-800 text-[10px] uppercase font-bold">RFID</Badge>
                        )}
                        {s.existingStatus === 'PRESENT' && s.method === 'QR' && (
                          <Badge className="bg-brand-primary-100 text-brand-primary-800 text-[10px] uppercase font-bold">QR</Badge>
                        )}
                        {s.existingStatus === 'LATE' && s.method === 'QR' && (
                          <Badge className="bg-brand-primary-100 text-brand-primary-800 text-[10px] uppercase font-bold">QR</Badge>
                        )}
                        <button
                          onClick={() => handleManualToggle(s.id, 'PRESENT')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${s.existingStatus === 'PRESENT' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200'}`}
                        >حاضر</button>
                        <button
                          onClick={() => handleManualToggle(s.id, 'LATE')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${s.existingStatus === 'LATE' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200'}`}
                        >متأخر</button>
                        <button
                          onClick={() => handleManualToggle(s.id, 'ABSENT')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${s.existingStatus === 'ABSENT' ? 'bg-rose-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200'}`}
                        >غائب</button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'RFID' && (
            <Card className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative">
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-indigo-400 to-indigo-600"></div>
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white">البطاقة الذكية (RFID)</h3>
                    <p className="text-sm text-slate-500">سجل التمريرات الحية من جهاز القاعة</p>
                  </div>
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/50 rounded-full flex items-center justify-center border border-indigo-100 dark:border-indigo-700">
                    <CreditCard className="w-6 h-6 text-indigo-600 animate-pulse" />
                  </div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-800/50 max-h-[400px] overflow-y-auto">
                  {roster.filter((s: any) => s.method === 'RFID').length === 0 ? (
                    <div className="p-8 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-700">
                        <CreditCard className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      </div>
                      <p className="font-bold text-slate-600 dark:text-slate-400">لا توجد تمريرات مسجلة بعد</p>
                      <p className="text-sm text-slate-400 mt-1">مرر البطاقة على الجهاز لتسجيل الحضور</p>
                    </div>
                  ) : (
                    roster
                      .filter((s: any) => s.method === 'RFID')
                      .sort((a: any, b: any) => new Date(b.recordedAt || 0).getTime() - new Date(a.recordedAt || 0).getTime())
                      .map((s: any) => (
                        <div key={s.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center font-bold text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                              {s.firstName?.[0] || 'S'}{s.lastName?.[0] || ''}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 dark:text-white">{s.firstName} {s.lastName}</p>
                              <p className="text-xs text-slate-500">{s.studentId} • {s.group}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <Badge className="bg-emerald-100 text-emerald-800 text-[10px] uppercase font-bold mb-1">تم التسجيل</Badge>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {s.recordedAt ? new Date(s.recordedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                            </span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Geolocation Review Card (if any flagged records exist) */}
          {flaggedRecords.length > 0 && (
            <Card className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <CardHeader className="border-b border-slate-100 dark:border-slate-700 p-5 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span>{t('attendance.flaggedRecords', 'حالات تحتاج لمراجعة (الموقع الجغرافي)')}</span>
                </CardTitle>
                <Badge className="bg-amber-100 text-amber-800 font-bold text-xs">{flaggedRecords.length}</Badge>
              </CardHeader>
              <CardContent className="p-0 max-h-[280px] overflow-y-auto">
                <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {flaggedRecords.map(record => (
                    <div key={record.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 dark:text-white text-xs truncate">{record.student.firstName} {record.student.lastName}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{record.student.studentId}</p>
                      </div>
                      <Button
                        onClick={() => approveFlagged(record.id)}
                        size="sm"
                        className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl px-3 font-bold text-xs h-7 shrink-0"
                      >
                        {t('attendance.approve', 'اعتماد')}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.length === 0 ? (
            <div className="col-span-full">
              <EmptyState icon={<BookOpen size={48} />} title={t('attendance.noCoursesDesc') || "لا توجد مقررات معينة لك"} subtitle={null} />
            </div>
          ) : (
            courses.map(course => (
              <Card key={course.id} className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-2xl bg-brand-primary-50 text-brand-primary-600 flex items-center justify-center mb-4">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white mb-1 line-clamp-1">
                    {course.name}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-6">
                    {course.courseCode}
                  </p>

                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        فترة السماح للمتأخرين (بالدقائق)
                      </label>
                      <span className="text-xs font-black text-brand-primary-600 dark:text-brand-primary-400 bg-brand-primary-50 dark:bg-brand-primary-900/30 px-2 py-0.5 rounded-md">
                        {gracePeriods[course.id] ?? 15} دقيقة
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="60" 
                      step="5"
                      value={gracePeriods[course.id] ?? 15}
                      onChange={(e) => setGracePeriods({ ...gracePeriods, [course.id]: parseInt(e.target.value) })}
                      className="w-full accent-brand-primary-600"
                    />
                  </div>

                  <Button
                    onClick={() => handleStartSession(course.id)}
                    disabled={loading}
                    className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-brand-primary-600 dark:hover:bg-brand-primary-700 text-white rounded-xl py-5 font-bold shadow-sm flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    {t('attendance.startSession', 'بدء جلسة الحضور')}
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
