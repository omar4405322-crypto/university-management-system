import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Scanner } from '@yudiel/react-qr-scanner';
import { 
  Camera, MapPin, CheckCircle2, AlertTriangle, ShieldCheck, 
  ScanLine, X, ArrowRight, Keyboard, Image as ImageIcon,
  Clock, AlertCircle, RefreshCw, Sparkles
} from 'lucide-react';
import jsQR from 'jsqr';
import fpPromise from '@fingerprintjs/fingerprintjs';
import attendanceService from '../../services/attendance.service';

export function StudentAttendanceScanner({ onCancel }: { onCancel?: () => void }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [mode, setMode] = useState<'camera' | 'keypad' | 'upload'>('camera');
  const [loading, setLoading] = useState(false);
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [result, setResult] = useState<{ 
    success: boolean; 
    status?: 'PRESENT' | 'LATE' | 'ALREADY_MARKED' | 'FLAGGED' | 'ERROR';
    message: string; 
    flagged?: boolean 
  } | null>(null);
  
  const [manualCode, setManualCode] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalize digits from Arabic/Eastern to English
  const normalizeToken = (str: string) => {
    if (!str) return '';
    return str
      .replace(/[٠۰]/g, '0')
      .replace(/[١۱]/g, '1')
      .replace(/[٢۲]/g, '2')
      .replace(/[٣۳]/g, '3')
      .replace(/[٤۴]/g, '4')
      .replace(/[٥۵]/g, '5')
      .replace(/[٦۶]/g, '6')
      .replace(/[٧۷]/g, '7')
      .replace(/[٨۸]/g, '8')
      .replace(/[٩۹]/g, '9')
      .trim();
  };

  // Humanize and sanitize raw server/database error messages
  const sanitizeErrorMessage = (rawMsg?: string): string => {
    if (!rawMsg) return isRTL ? 'تعذر التعرف على الرمز أو انتهت صلاحيته.' : 'Could not recognize QR code or it expired.';
    
    if (/Unique constraint failed|prisma|database|SQL|foreign key/i.test(rawMsg)) {
      return isRTL 
        ? 'حضورك مسجل بالفعل لهذه الجلسة أو تم تحديث البيانات بنجاح.' 
        : 'Attendance has already been recorded for this session.';
    }
    if (/expired|انتهت/i.test(rawMsg)) {
      return isRTL ? 'انتهت صلاحية رمز الـ QR. يرجى مسح الرمز الجديد المتجدد على شاشة المحاضر.' : 'QR code expired. Please scan the newly refreshed code.';
    }
    if (/already|سابقاً|بالفعل/i.test(rawMsg)) {
      return isRTL ? 'تم تسجيل حضورك لهذه المحاضرة بالفعل.' : 'Your attendance is already recorded for this lecture.';
    }
    return rawMsg;
  };

  const processQrPayload = async (dataString: string) => {
    try {
      setLoading(true);
      
      let token = '';
      let sessionId: number | undefined = undefined;
      let step: number | undefined = undefined;

      const raw = (dataString || '').trim();

      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          token = parsed.token || raw;
          sessionId = parsed.sessionId ? Number(parsed.sessionId) : undefined;
          step = parsed.step ? Number(parsed.step) : undefined;
        } else {
          token = String(parsed);
        }
      } catch {
        token = raw;
      }

      token = normalizeToken(token);

      if (!token) {
        throw new Error(isRTL ? 'الرمز غير صالح أو فارغ' : 'Invalid or empty code');
      }

      // Geolocation capture
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve, 
            reject, 
            { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 }
          );
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (e) {
        console.warn('Geolocation denied or failed', e);
      }
      
      // Device ID Hardening
      let deviceId = localStorage.getItem('attendance_device_id');
      if (!deviceId) {
        try {
          const fp = await fpPromise.load();
          const fpRes = await fp.get();
          deviceId = fpRes.visitorId;
        } catch (e) {
          if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            deviceId = crypto.randomUUID();
          } else {
            deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
              const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
              return v.toString(16);
            });
          }
        }
        localStorage.setItem('attendance_device_id', deviceId!);
      }

      const res = await attendanceService.scanQr({
        sessionId,
        token,
        step,
        latitude: lat,
        longitude: lng,
        deviceId
      });

      if (res.success) {
        const isFlagged = res.flagged || res.data?.locationFlagged;
        const isExisting = res.existingStatus || (res.message && res.message.includes('سابقاً'));
        const isLate = res.data?.status === 'LATE' || res.existingStatus === 'LATE';

        let statusType: 'PRESENT' | 'LATE' | 'ALREADY_MARKED' | 'FLAGGED' = 'PRESENT';
        if (isFlagged) {
          statusType = 'FLAGGED';
        } else if (isExisting) {
          statusType = 'ALREADY_MARKED';
        } else if (isLate) {
          statusType = 'LATE';
        }

        setResult({ 
          success: true, 
          status: statusType,
          message: res.message || (isRTL ? 'تم تسجيل حضورك بنجاح.' : 'Attendance recorded successfully.'),
          flagged: isFlagged
        });
      } else {
        const sanitized = sanitizeErrorMessage(res.message);
        const isDuplicate = /already|سابقاً|بالفعل/i.test(res.message || '');
        setResult({
          success: isDuplicate,
          status: isDuplicate ? 'ALREADY_MARKED' : 'ERROR',
          message: sanitized
        });
      }
    } catch (err: any) {
      const rawMsg = err?.response?.data?.message || err?.message;
      const sanitized = sanitizeErrorMessage(rawMsg);
      const isDuplicate = /already|سابقاً|بالفعل/i.test(rawMsg || '');
      setResult({ 
        success: isDuplicate, 
        status: isDuplicate ? 'ALREADY_MARKED' : 'ERROR',
        message: sanitized
      });
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async (scannedData: any) => {
    if (!scannedData || !scannedData.length || loading || result) return;
    const dataString = scannedData[0].rawValue;
    await processQrPayload(dataString);
  };

  const handleFile = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    
    reader.onerror = () => {
      setLoading(false);
      setResult({
        success: false,
        status: 'ERROR',
        message: isRTL ? 'حدث خطأ أثناء قراءة الملف.' : 'Error reading file.'
      });
    };

    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => {
        setLoading(false);
        setResult({
          success: false,
          status: 'ERROR',
          message: isRTL ? 'الملف المحدد ليس صورة صالحة.' : 'Invalid image file.'
        });
      };

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) {
            setLoading(false);
            return;
          }

          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          context.drawImage(img, 0, 0, width, height);
          
          const imageData = context.getImageData(0, 0, width, height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code && code.data) {
            processQrPayload(code.data);
          } else {
            setLoading(false);
            setResult({
              success: false,
              status: 'ERROR',
              message: isRTL ? 'الصورة لا تحتوي على رمز QR واضح. حاول التقاط صورة أخرى خالية من الانعكاسات.' : 'Image does not contain a clear QR code.'
            });
          }
        } catch (e) {
          setLoading(false);
          setResult({
            success: false,
            status: 'ERROR',
            message: isRTL ? 'حدث خطأ أثناء معالجة الصورة.' : 'Error processing image.'
          });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleKeypadDigit = (digit: string) => {
    if (manualCode.length < 6) {
      const nextCode = manualCode + digit;
      setManualCode(nextCode);
      if (nextCode.length === 6) {
        processQrPayload(nextCode);
      }
    }
  };

  const handleKeypadBackspace = () => {
    setManualCode(prev => prev.slice(0, -1));
  };

  return (
    <div className="bg-brand-navy-700 text-white rounded-2xl shadow-2xl border border-brand-navy-600 overflow-hidden relative flex flex-col min-h-[520px] max-w-lg mx-auto w-full">
      
      {/* Hidden Image File Input */}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        accept="image/*"
        className="hidden"
      />

      {/* Top Modal Header */}
      {!loading && !result && (
        <div className="flex justify-between items-center p-5 bg-brand-navy-900/80 backdrop-blur-md border-b border-brand-navy-600 z-20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-primary-500/20 text-brand-primary-400 border border-brand-primary-500/30 flex items-center justify-center">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-wide text-white">
                {isRTL ? 'ماسح الحضور الذكي' : 'Smart Attendance Scanner'}
              </h3>
              <p className="text-xs text-slate-300 font-medium">
                {mode === 'camera' ? (isRTL ? 'امسح الرمز المباشر' : 'Scan live QR') : (isRTL ? 'إدخال الرمز المكون من 6 أرقام' : 'Enter 6-digit code')}
              </p>
            </div>
          </div>
          {onCancel && (
            <button 
              onClick={onCancel} 
              className="w-9 h-9 rounded-xl bg-brand-navy-800 hover:bg-brand-navy-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors border border-brand-navy-600"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Main Viewport Content */}
      <div className="flex-1 flex flex-col relative bg-brand-navy-900">
        
        {/* Loading Overlay */}
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-brand-navy-900/95 backdrop-blur-xl z-30 p-6 text-center animate-fade-in">
            <div className="w-20 h-20 mb-6 relative">
              <div className="absolute inset-0 border-4 border-brand-primary-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-brand-primary-500 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-brand-primary-400 animate-pulse" />
              </div>
            </div>
            <h3 className="text-xl font-black text-white mb-2">
              {isRTL ? 'جاري توثيق حضورك...' : 'Authenticating attendance...'}
            </h3>
            <p className="text-sm text-slate-300 font-medium max-w-xs leading-relaxed">
              {isRTL ? 'نتحقق من الرمز والموقع الجغرافي بشكل آمن وسريع.' : 'Verifying lecture code and location securely.'}
            </p>
          </div>
        ) : result ? (
          /* Result Outcome Screen Cards */
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-30 animate-fade-in bg-brand-navy-900 overflow-y-auto">
            
            {/* Outcome 1: PRESENT (Success) */}
            {result.status === 'PRESENT' && (
              <div className="w-full flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-brand-primary-500/20 text-brand-primary-400 border-2 border-brand-primary-500/40 flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(132,189,58,0.3)]">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-brand-primary-400 mb-2">
                  {isRTL ? 'تم تأكيد حضورك بنجاح!' : 'Attendance Confirmed!'}
                </h3>
                <p className="text-sm text-slate-300 font-medium max-w-sm mb-6 leading-relaxed bg-brand-navy-800 border border-brand-navy-600 p-4 rounded-xl">
                  {result.message}
                </p>
              </div>
            )}

            {/* Outcome 2: LATE (Recorded as Late) */}
            {result.status === 'LATE' && (
              <div className="w-full flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-amber-500/20 text-amber-400 border-2 border-amber-500/40 flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                  <Clock className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-amber-400 mb-2">
                  {isRTL ? 'تم تسجيل الحضور (متأخر)' : 'Attendance Recorded (Late)'}
                </h3>
                <p className="text-sm text-slate-300 font-medium max-w-sm mb-6 leading-relaxed bg-brand-navy-800 border border-brand-navy-600 p-4 rounded-xl">
                  {result.message || (isRTL ? 'تم تسجيل حضورك بنجاح ولكن بعد انقضاء وقت المحاضرة المحدد.' : 'Attendance recorded after the grace period.')}
                </p>
              </div>
            )}

            {/* Outcome 3: ALREADY_MARKED (Duplicate Scan Reassurance) */}
            {result.status === 'ALREADY_MARKED' && (
              <div className="w-full flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-sky-500/20 text-sky-400 border-2 border-sky-500/40 flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(14,165,233,0.3)]">
                  <ShieldCheck className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-sky-400 mb-2">
                  {isRTL ? 'حضورك مسجل بالفعل' : 'Already Registered'}
                </h3>
                <p className="text-sm text-slate-300 font-medium max-w-sm mb-6 leading-relaxed bg-brand-navy-800 border border-brand-navy-600 p-4 rounded-xl">
                  {result.message || (isRTL ? 'لقد قمت بتسجيل حضورك لهذه المحاضرة مسبقاً.' : 'Your attendance was already submitted for this lecture.')}
                </p>
              </div>
            )}

            {/* Outcome 4: FLAGGED (Geofence Outside Radius) */}
            {result.status === 'FLAGGED' && (
              <div className="w-full flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-amber-500/20 text-amber-400 border-2 border-amber-500/40 flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                  <MapPin className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-amber-400 mb-2">
                  {isRTL ? 'بانتظار اعتماد المحاضر' : 'Pending Professor Review'}
                </h3>
                <div className="bg-amber-950/40 border border-amber-800/60 p-4 rounded-xl max-w-sm mb-6 text-start">
                  <p className="text-xs text-amber-300 font-bold mb-1 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {isRTL ? 'ملاحظة الموقع الجغرافي' : 'Location Note'}
                  </p>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    {isRTL 
                      ? 'موقعك الحالي يقع خارج النطاق الجغرافي للقاعة. تم إرسال طلب حضورك للمحاضر للاعتماد اليدوي.' 
                      : 'Your location is outside the classroom radius. Attendance sent for manual approval.'}
                  </p>
                </div>
              </div>
            )}

            {/* Outcome 5: ERROR (Sanitized Technical Failure) */}
            {result.status === 'ERROR' && (
              <div className="w-full flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-rose-500/20 text-rose-400 border-2 border-rose-500/40 flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(244,63,94,0.3)]">
                  <AlertTriangle className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-rose-400 mb-2">
                  {isRTL ? 'تعذر تسجيل الحضور' : 'Could Not Record Attendance'}
                </h3>
                <p className="text-sm text-slate-300 font-medium max-w-sm mb-6 leading-relaxed bg-brand-navy-800 border border-brand-navy-600 p-4 rounded-xl">
                  {result.message}
                </p>
              </div>
            )}

            {/* Outcome Actions */}
            <div className="flex gap-3 w-full max-w-xs">
              <button 
                onClick={() => {
                  setResult(null);
                  setMode('camera');
                  setManualCode('');
                }}
                className="flex-1 bg-brand-primary-600 hover:bg-brand-primary-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{isRTL ? 'مسح مرة أخرى' : 'Try Again'}</span>
              </button>
              {onCancel && (
                <button 
                  onClick={onCancel}
                  className="bg-brand-navy-800 hover:bg-brand-navy-600 text-slate-300 font-bold py-3.5 px-5 rounded-xl border border-brand-navy-600 transition-colors text-sm"
                >
                  {isRTL ? 'إغلاق' : 'Close'}
                </button>
              )}
            </div>

          </div>
        ) : mode === 'camera' && !cameraBlocked ? (
          /* Live Camera Feed Mode */
          <div className="flex-1 relative flex flex-col items-center justify-center min-h-[380px]">
            <Scanner 
              onScan={handleScan}
              onError={(err) => {
                console.warn('Scanner error:', err);
                setCameraBlocked(true);
                setMode('keypad');
              }}
              components={{ onOff: true, torch: true }}
            />
            
            {/* Viewfinder Overlay with Animated Laser */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-64 border-2 border-brand-primary-500/40 rounded-2xl relative shadow-[0_0_0_9999px_rgba(3,8,12,0.8)]">
                {/* Animated scanning laser */}
                <div className="absolute top-0 inset-x-0 h-0.5 bg-brand-primary-400 shadow-[0_0_12px_rgba(132,189,58,0.9)] animate-scan-laser"></div>
                
                {/* Corner Brackets */}
                <div className="absolute -top-0.5 -left-0.5 w-8 h-8 border-t-4 border-l-4 border-brand-primary-500 rounded-tl-xl"></div>
                <div className="absolute -top-0.5 -right-0.5 w-8 h-8 border-t-4 border-r-4 border-brand-primary-500 rounded-tr-xl"></div>
                <div className="absolute -bottom-0.5 -left-0.5 w-8 h-8 border-b-4 border-l-4 border-brand-primary-500 rounded-bl-xl"></div>
                <div className="absolute -bottom-0.5 -right-0.5 w-8 h-8 border-b-4 border-r-4 border-brand-primary-500 rounded-br-xl"></div>
              </div>
            </div>

            {/* On-Screen Guidance */}
            <div className="absolute bottom-4 inset-x-0 text-center pointer-events-none px-4">
              <p className="text-xs font-semibold text-white/90 bg-brand-navy-900/90 backdrop-blur-md inline-block px-4 py-2 rounded-full border border-brand-navy-600 shadow-md">
                {isRTL ? 'وجّه الكاميرا نحو الرمز الموجود على شاشة الدكتور' : 'Point camera at the Doctor\'s screen'}
              </p>
            </div>
          </div>
        ) : (
          /* Native Keypad Manual Code Entry Mode */
          <div className="flex-1 flex flex-col p-6 items-center justify-between bg-brand-navy-900">
            <div className="w-full text-center mt-2">
              <h4 className="text-lg font-bold text-white mb-1">
                {isRTL ? 'إدخال الرمز المكون من 6 أرقام' : 'Enter 6-Digit Code'}
              </h4>
              <p className="text-xs text-slate-300 font-medium">
                {isRTL ? 'أدخل الرمز الظاهر أسفل مربع الـ QR في قاعة المحاضرة' : 'Enter the numbers displayed under the QR code'}
              </p>

              {/* 6 Digit Box Displays */}
              <div className="flex justify-center gap-2 dir-ltr my-6">
                {[0, 1, 2, 3, 4, 5].map(idx => (
                  <div 
                    key={idx}
                    className={`w-11 h-13 rounded-xl border-2 flex items-center justify-center text-xl font-mono font-black transition-all ${
                      manualCode[idx] 
                        ? 'border-brand-primary-500 bg-brand-primary-950/40 text-brand-primary-400 shadow-sm' 
                        : idx === manualCode.length 
                          ? 'border-brand-primary-400 bg-brand-navy-800 text-white animate-pulse' 
                          : 'border-brand-navy-600 bg-brand-navy-800/60 text-slate-500'
                    }`}
                  >
                    {manualCode[idx] || ''}
                  </div>
                ))}
              </div>
            </div>

            {/* Custom On-Screen Keypad */}
            <div className="w-full max-w-xs grid grid-cols-3 gap-2 mb-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  key={num}
                  onClick={() => handleKeypadDigit(num)}
                  className="bg-brand-navy-800 hover:bg-brand-navy-600 active:bg-brand-navy-500 text-white font-bold py-3 rounded-xl border border-brand-navy-600 text-lg transition-transform active:scale-95"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={handleKeypadBackspace}
                className="bg-brand-navy-800 hover:bg-brand-navy-600 text-slate-300 font-bold py-3 rounded-xl border border-brand-navy-600 text-xs transition-colors flex items-center justify-center"
              >
                {isRTL ? 'مسح' : 'Clear'}
              </button>
              <button
                onClick={() => handleKeypadDigit('0')}
                className="bg-brand-navy-800 hover:bg-brand-navy-600 active:bg-brand-navy-500 text-white font-bold py-3 rounded-xl border border-brand-navy-600 text-lg transition-transform active:scale-95"
              >
                0
              </button>
              <button
                disabled={manualCode.length !== 6}
                onClick={() => manualCode.length === 6 && processQrPayload(manualCode)}
                className="bg-brand-primary-600 hover:bg-brand-primary-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95"
              >
                <ArrowRight className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        )}

        {/* Bottom Mode Switcher Bar */}
        {!loading && !result && (
          <div className="p-4 bg-brand-navy-900 border-t border-brand-navy-600 flex items-center justify-around gap-2 z-20">
            <button
              onClick={() => setMode('camera')}
              disabled={cameraBlocked}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                mode === 'camera' 
                  ? 'bg-brand-primary-600 text-white shadow-sm' 
                  : 'bg-brand-navy-800 text-slate-300 hover:text-white border border-brand-navy-600'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>{isRTL ? 'الكاميرا' : 'Camera'}</span>
            </button>

            <button
              onClick={() => setMode('keypad')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                mode === 'keypad' 
                  ? 'bg-brand-primary-600 text-white shadow-sm' 
                  : 'bg-brand-navy-800 text-slate-300 hover:text-white border border-brand-navy-600'
              }`}
            >
              <Keyboard className="w-4 h-4" />
              <span>{isRTL ? 'رمز يدوي' : 'Keypad'}</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="py-2.5 px-3 rounded-xl text-xs font-bold bg-brand-navy-800 hover:bg-brand-navy-600 text-slate-300 hover:text-white border border-brand-navy-600 flex items-center justify-center gap-2 transition-colors"
            >
              <ImageIcon className="w-4 h-4 text-brand-primary-400" />
              <span className="hidden sm:inline">{isRTL ? 'صورة' : 'Upload'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Laser Keyframe Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan-laser {
          0%, 100% { top: 0; opacity: 0; }
          15%, 85% { opacity: 1; }
          50% { top: 100%; opacity: 1; }
        }
        .animate-scan-laser {
          animation: scan-laser 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}} />
    </div>
  );
}
