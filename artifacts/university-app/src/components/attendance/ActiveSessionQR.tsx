import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw, Play, Square, MapPin, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import attendanceService from '../../services/attendance.service';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';

export function ActiveSessionQR({ courseId, scheduleSlotId, canRecord, qrStep = 10 }: { courseId?: number, scheduleSlotId?: number, canRecord: boolean, qrStep?: number }) {
  const { t } = useTranslation();
  const [activeSession, setActiveSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [qrToken, setQrToken] = useState('');
  const [timeLeft, setTimeLeft] = useState(10);
  const [flaggedRecords, setFlaggedRecords] = useState<any[]>([]);
  const timerRef = useRef<any>(null);
  const targetTimeRef = useRef<number>(0);

  useEffect(() => {
    if (canRecord && (courseId || scheduleSlotId)) {
      checkActiveSession();
    }
    return () => clearInterval(timerRef.current);
  }, [courseId, scheduleSlotId, canRecord]);

  useEffect(() => {
    if (activeSession?.sessionId) {
      targetTimeRef.current = Date.now() + qrStep * 1000;
      updateToken();
      setTimeLeft(qrStep);
      
      timerRef.current = setInterval(() => {
        const remaining = Math.ceil((targetTimeRef.current - Date.now()) / 1000);
        if (remaining <= 0) {
          targetTimeRef.current = Date.now() + qrStep * 1000;
          updateToken();
          setTimeLeft(qrStep);
        } else {
          setTimeLeft(remaining);
        }
      }, 500);
      
      const flaggedTimer = setInterval(fetchFlaggedRecords, 10000);
      
      return () => {
        clearInterval(timerRef.current);
        clearInterval(flaggedTimer);
      };
    }
    return undefined;
  }, [activeSession?.sessionId, qrStep]);

  const checkActiveSession = async () => {
    try {
      setLoading(true);
      const res = await attendanceService.getActiveSession(courseId, scheduleSlotId);
      if (res.data) {
        setActiveSession(res.data);
        fetchFlaggedRecords(res.data.sessionId);
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateToken = async () => {
    if (activeSession?.sessionId) {
      try {
        const res = await attendanceService.getCurrentCode(activeSession.sessionId, qrStep);
        if (res.data?.token) {
          setQrToken(res.data.token);
        }
      } catch (err) {
        console.error('Failed to get token', err);
      }
    }
  };

  const fetchFlaggedRecords = async (sessionId = activeSession?.sessionId) => {
    if (!sessionId) return;
    try {
      const res = await attendanceService.getFlaggedRecords(sessionId);
      setFlaggedRecords(res.data || []);
    } catch (err) {}
  };

  const handleStartSession = async () => {
    try {
      setLoading(true);
      // Try to get geolocation
      let lat, lng;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (e) {
        console.warn('Geolocation denied or failed');
      }

      const res = await attendanceService.startSession({
        scheduleSlotId: scheduleSlotId!,
        latitude: lat,
        longitude: lng,
        radius: 120
      });
      setActiveSession(res.data);
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
      setQrToken('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const approveFlagged = async (id: number) => {
    try {
      await attendanceService.overrideFlaggedRecord(id, 'Approved manually by Doctor/TA');
      fetchFlaggedRecords();
    } catch (err) {
      console.error(err);
    }
  };

  if (!canRecord) return null;

  return (
    <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
      <CardHeader className="border-b border-slate-100 dark:border-slate-700 px-6 py-4 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <MapPin className="w-5 h-5 text-brand-primary-500" />
          {t('', '')}
        </CardTitle>
        <div>
          {!activeSession ? (
            <button
              onClick={handleStartSession}
              disabled={loading || (!courseId && !scheduleSlotId)}
              className="flex items-center gap-2 bg-brand-primary-500 hover:bg-brand-primary-600 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {t('', '')}
            </button>
          ) : (
            <button
              onClick={handleStopSession}
              disabled={loading}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
              {t('', '')}
            </button>
          )}
        </div>
      </CardHeader>
      
      {activeSession && (
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-150 dark:border-slate-700 w-full md:w-auto">
              <h3 className="text-md font-semibold text-slate-700 dark:text-slate-300 mb-4 text-center">
                {t('', '')}
              </h3>
              
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                {qrToken ? (
                  <QRCodeSVG 
                    value={JSON.stringify({ sessionId: activeSession.sessionId, token: qrToken, step: qrStep })} 
                    size={200}
                    level="H"
                  />
                ) : (
                  <div className="w-[200px] h-[200px] flex items-center justify-center bg-slate-100">
                    <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                <Clock className="w-4 h-4" />
                <span>{t('', '')}</span>
                <span className={`font-bold w-6 text-center ${timeLeft < 5 ? 'text-red-500' : 'text-brand-primary-500'}`}>
                  {timeLeft}s
                </span>
              </div>
            </div>

            <div className="flex-1 w-full flex flex-col gap-4">
              <h3 className="text-md font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                {t('', '')}
                <Badge className="ms-auto bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">{flaggedRecords.length}</Badge>
              </h3>
              
              {flaggedRecords.length === 0 ? (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                  {t('', '')}
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {flaggedRecords.map(record => (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/50 rounded-xl shadow-sm">
                      <div>
                        <p className="font-semibold text-sm">{record.student.firstName} {record.student.lastName}</p>
                        <p className="text-xs text-slate-500 font-mono">{record.student.studentId}</p>
                      </div>
                      <button 
                        onClick={() => approveFlagged(record.id)}
                        className="flex items-center gap-1 text-xs bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 px-3 py-1.5 rounded-lg font-medium transition-all"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {t('', '')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
