import React, { useState, useEffect } from 'react';
import { PlayCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface ElapsedSessionTimerProps {
  createdAt: string | Date;
  className?: string;
}

export const ElapsedSessionTimer: React.FC<ElapsedSessionTimerProps> = ({
  createdAt,
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [elapsed, setElapsed] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    if (!createdAt) return;

    const startTime = new Date(createdAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, now - startTime); // Ensure non-negative

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setElapsed({
        hours,
        minutes,
        seconds,
      });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [createdAt]);

  const formattedHours = String(elapsed.hours).padStart(2, '0');
  const formattedMinutes = String(elapsed.minutes).padStart(2, '0');
  const formattedSeconds = String(elapsed.seconds).padStart(2, '0');
  
  // Format as mm:ss or hh:mm:ss if over an hour
  const formattedTime = elapsed.hours > 0 
    ? `${formattedHours}:${formattedMinutes}:${formattedSeconds}`
    : `${formattedMinutes}:${formattedSeconds}`;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all shadow-sm bg-indigo-950/80 text-indigo-300 border border-indigo-500/40 ${className}`}
    >
      <PlayCircle className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
      <span className="text-[11px] font-medium text-slate-300">
        {isRTL ? 'زمن الجلسة:' : 'Elapsed:'}
      </span>
      <span className="font-mono text-sm font-black text-white tracking-widest" dir="ltr">
        {formattedTime}
      </span>
    </div>
  );
};

export default ElapsedSessionTimer;
