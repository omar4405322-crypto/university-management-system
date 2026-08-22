import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, Timer, Hourglass } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface SessionCountdownProps {
  expiresAt: string | Date;
  createdAt?: string | Date;
  gracePeriodMins?: number;
  variant?: 'badge' | 'banner' | 'card' | 'inline';
  showGracePeriodStatus?: boolean;
  onExpire?: () => void;
  className?: string;
}

export const SessionCountdown: React.FC<SessionCountdownProps> = ({
  expiresAt,
  createdAt,
  gracePeriodMins,
  variant = 'badge',
  showGracePeriodStatus = false,
  onExpire,
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
    isUrgent: boolean; // < 5 minutes
    isInGracePeriod?: boolean;
  }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
    isUrgent: false,
  });

  useEffect(() => {
    if (!expiresAt) return;

    const targetTime = new Date(expiresAt).getTime();
    let hasTriggeredExpire = false;

    const updateTimer = () => {
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft({
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
          isUrgent: false,
          isInGracePeriod: false,
        });
        if (!hasTriggeredExpire) {
          hasTriggeredExpire = true;
          onExpire?.();
        }
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      const isUrgent = diff < 5 * 60 * 1000; // Under 5 minutes remaining

      let isInGracePeriod: boolean | undefined = undefined;
      if (createdAt && gracePeriodMins !== undefined) {
        const graceTarget = new Date(createdAt).getTime() + gracePeriodMins * 60 * 1000;
        isInGracePeriod = now <= graceTarget;
      }

      setTimeLeft({
        hours,
        minutes,
        seconds,
        isExpired: false,
        isUrgent,
        isInGracePeriod,
      });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, createdAt, gracePeriodMins, onExpire]);

  const formattedHours = String(timeLeft.hours).padStart(2, '0');
  const formattedMinutes = String(timeLeft.minutes).padStart(2, '0');
  const formattedSeconds = String(timeLeft.seconds).padStart(2, '0');
  const formattedTime = `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;

  // 1. INLINE VARIANT
  if (variant === 'inline') {
    if (timeLeft.isExpired) {
      return (
        <span className={`text-rose-500 font-bold text-xs flex items-center gap-1 ${className}`}>
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{isRTL ? 'انتهت الجلسة' : 'Session Expired'}</span>
        </span>
      );
    }
    return (
      <span
        className={`font-mono font-bold tracking-wider ${
          timeLeft.isUrgent ? 'text-amber-500 animate-pulse' : 'text-emerald-400'
        } ${className}`}
        dir="ltr"
      >
        {formattedTime}
      </span>
    );
  }

  // 2. BADGE VARIANT (Sleek pill for headers and banners)
  if (variant === 'badge') {
    if (timeLeft.isExpired) {
      return (
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold shadow-sm ${className}`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>{isRTL ? 'انتهت الجلسة' : 'Session Expired'}</span>
        </div>
      );
    }

    return (
      <div
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all shadow-sm ${
          timeLeft.isUrgent
            ? 'bg-amber-950/80 text-amber-300 border border-amber-500/50 animate-pulse'
            : 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
        } ${className}`}
      >
        <Clock
          className={`w-3.5 h-3.5 shrink-0 ${
            timeLeft.isUrgent ? 'text-amber-400 animate-spin-slow' : 'text-emerald-400'
          }`}
        />
        <span className="text-[11px] font-medium text-slate-300">
          {isRTL ? 'متبقي:' : 'Closes in:'}
        </span>
        <span className="font-mono text-sm font-black text-white tracking-widest" dir="ltr">
          {formattedTime}
        </span>
      </div>
    );
  }

  // 3. CARD / BANNER VARIANT (Prominent display for scanner or faculty dashboard)
  return (
    <div
      className={`rounded-2xl p-4 border transition-all ${
        timeLeft.isExpired
          ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
          : timeLeft.isUrgent
          ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
          : 'bg-slate-900/80 border-slate-700/80 text-slate-200'
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              timeLeft.isExpired
                ? 'bg-rose-500/20 text-rose-400'
                : timeLeft.isUrgent
                ? 'bg-amber-500/20 text-amber-400 animate-pulse'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            {timeLeft.isExpired ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <Timer className="w-5 h-5" />
            )}
          </div>
          <div>
            <h5 className="font-bold text-sm text-white">
              {timeLeft.isExpired
                ? isRTL
                  ? 'أغلقت جلسة تسجيل الحضور'
                  : 'Attendance Check-in Closed'
                : isRTL
                ? 'الوقت المتبقي لإغلاق الحضور'
                : 'Time Remaining for Check-in'}
            </h5>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {timeLeft.isExpired
                ? isRTL
                  ? 'انتهى الوقت المحدد للجلسة ولم يعد بالإمكان تسجيل الحضور.'
                  : 'Session time has elapsed. No further check-ins accepted.'
                : showGracePeriodStatus && timeLeft.isInGracePeriod !== undefined
                ? timeLeft.isInGracePeriod
                  ? isRTL
                    ? 'فترة السماح (حاضر) جارية حالياً'
                    : 'On-time grace period active'
                  : isRTL
                  ? 'انتهت فترة السماح — التسجيل الآن يُحسب (متأخر)'
                  : 'Grace period ended — will be recorded as Late'
                : isRTL
                ? 'يغلق التسجيل تلقائياً عند انتهاء العداد.'
                : 'Check-in closes automatically when timer reaches zero.'}
            </p>
          </div>
        </div>

        {/* Digital Countdown Timer Display */}
        <div className="text-end shrink-0">
          <div
            className={`font-mono text-2xl md:text-3xl font-black tracking-widest px-3 py-1.5 rounded-xl border ${
              timeLeft.isExpired
                ? 'bg-rose-950/60 text-rose-400 border-rose-800'
                : timeLeft.isUrgent
                ? 'bg-amber-950/60 text-amber-400 border-amber-700 animate-pulse'
                : 'bg-slate-950/80 text-emerald-400 border-slate-700'
            }`}
            dir="ltr"
          >
            {formattedTime}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionCountdown;
