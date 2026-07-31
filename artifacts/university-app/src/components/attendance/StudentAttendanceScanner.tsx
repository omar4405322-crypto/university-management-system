import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Scanner } from '@yudiel/react-qr-scanner';
import { 
  Camera, MapPin, CheckCircle, AlertCircle, Upload, ShieldAlert, Image as ImageIcon, 
  ScanLine, X, Loader2, ArrowRight, Keyboard
} from 'lucide-react';
import jsQR from 'jsqr';
import fpPromise from '@fingerprintjs/fingerprintjs';
import attendanceService from '../../services/attendance.service';

export function StudentAttendanceScanner({ onCancel }: { onCancel?: () => void }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  
  const [loading, setLoading] = useState(false);
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; flagged?: boolean } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [manualCode, setManualCode] = useState('');

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

      // Try getting geolocation with high accuracy
      let lat, lng;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve, 
            reject, 
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (e) {
        console.warn('Geolocation denied or failed', e);
      }
      
      // Device ID Hardening using FingerprintJS
      let deviceId = localStorage.getItem('attendance_device_id');
      if (!deviceId) {
        try {
          const fp = await fpPromise.load();
          const result = await fp.get();
          deviceId = result.visitorId;
        } catch (e) {
          console.warn('FingerprintJS failed, falling back to UUID', e);
          if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            deviceId = crypto.randomUUID();
          } else {
            deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
              var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
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
        setResult({ 
          success: true, 
          message: res.message || (isRTL ? 'تم تسجيل حضورك بنجاح وبسرعة فائقة.' : 'Attendance recorded successfully.'),
          flagged: res.flagged 
        });
      } else {
        setResult({
          success: false,
          message: res.message || (isRTL ? 'تعذر التعرف على الرمز أو انتهت صلاحيته.' : 'Could not recognize QR code or it expired.')
        });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || (isRTL ? 'تعذر التعرف على الرمز أو انتهت صلاحيته.' : 'Could not recognize QR code or it expired.');
      setResult({ 
        success: false, 
        message: msg
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
        message: isRTL ? 'حدث خطأ أثناء قراءة الملف.' : 'Error reading file.'
      });
    };

    reader.onload = (event) => {
      const img = new Image();
      
      img.onerror = () => {
        setLoading(false);
        setResult({
          success: false,
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

          // Scale down huge phone images to prevent jsQR from freezing/crashing
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
            inversionAttempts: "dontInvert", // Speed up parsing
          });

          if (code && code.data) {
            processQrPayload(code.data);
          } else {
            setLoading(false);
            setResult({
              success: false,
              message: isRTL ? 'الصورة لا تحتوي على رمز QR واضح. حاول التقاط صورة أخرى خالية من الانعكاسات.' : 'Image does not contain a clear QR code.'
            });
          }
        } catch (e) {
          setLoading(false);
          setResult({
            success: false,
            message: isRTL ? 'حدث خطأ أثناء معالجة الصورة.' : 'Error processing image.'
          });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative flex flex-col min-h-[500px]">
      
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Header */}
      {!loading && !result && (
        <div className="absolute top-0 inset-x-0 z-20 flex justify-between items-center p-6 bg-gradient-to-b from-black/60 to-transparent pointer-events-none text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
              <ScanLine size={20} />
            </div>
            <span className="font-bold text-lg tracking-wide">{isRTL ? 'ماسح الحضور الذكي' : 'Smart Scanner'}</span>
          </div>
          {onCancel && (
            <button onClick={onCancel} className="pointer-events-auto w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center transition-colors">
              <X size={20} />
            </button>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative bg-slate-50 dark:bg-slate-900">
        
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl z-30 animate-fade-in p-8 text-center">
            <div className="w-24 h-24 mb-8 relative">
              <div className="absolute inset-0 border-4 border-brand-primary-100 dark:border-brand-primary-900/50 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-brand-primary-500 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <ScanLine className="w-8 h-8 text-brand-primary-500 animate-pulse" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">
              {isRTL ? 'جاري توثيق حضورك' : 'Authenticating...'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium max-w-xs">
              {isRTL ? 'نحن نقوم بالتحقق من الرمز وموقعك الجغرافي بشكل آمن.' : 'Verifying code and geolocation securely.'}
            </p>
          </div>
        ) : result ? (
          <div className={`absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-30 animate-fade-in ${
            result.success ? (result.flagged ? 'bg-gradient-to-b from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-900' : 'bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-900') 
            : 'bg-gradient-to-b from-rose-50 to-white dark:from-rose-900/20 dark:to-slate-900'
          }`}>
            <div className={`w-28 h-28 rounded-full flex items-center justify-center mb-8 shadow-2xl relative ${
              result.success ? (result.flagged ? 'bg-amber-500 shadow-amber-500/40 text-white' : 'bg-emerald-500 shadow-emerald-500/40 text-white') 
              : 'bg-rose-500 shadow-rose-500/40 text-white'
            }`}>
              <div className="absolute inset-0 rounded-full border-4 border-white/20 animate-ping opacity-20"></div>
              {result.success ? (
                result.flagged ? <AlertCircle className="w-14 h-14" /> : <CheckCircle className="w-14 h-14" />
              ) : (
                <X className="w-14 h-14" />
              )}
            </div>
            
            <h3 className={`font-black text-3xl mb-4 tracking-tight ${
              result.success ? (result.flagged ? 'text-amber-700 dark:text-amber-500' : 'text-emerald-700 dark:text-emerald-500') : 'text-rose-700 dark:text-rose-500'
            }`}>
              {result.success ? (result.flagged ? (isRTL ? 'تم التسجيل، بانتظار الاعتماد' : 'Recorded, Pending Approval') : (isRTL ? 'تم تأكيد حضورك بنجاح!' : 'Attendance Confirmed!')) : (isRTL ? 'نعتذر، حدث خطأ' : 'Sorry, an error occurred')}
            </h3>
            
            <p className="text-lg font-medium text-slate-600 dark:text-slate-300 max-w-sm mx-auto mb-8 leading-relaxed">
              {result.message}
            </p>
            
            {result.flagged && (
              <div className="mb-8 flex items-center justify-center gap-3 bg-amber-100/50 dark:bg-amber-900/30 px-5 py-3 rounded-2xl text-amber-800 dark:text-amber-400 font-bold border border-amber-200 dark:border-amber-800/50 shadow-sm">
                <MapPin className="w-5 h-5" />
                <span>{isRTL ? 'أنت متواجد خارج نطاق القاعة الجغرافي. تم إرسال طلبك للدكتور للاعتماد اليدوي.' : 'You are outside the classroom radius. Doctor approval required.'}</span>
              </div>
            )}
            
            <button 
              onClick={() => setResult(null)}
              className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 px-8 py-4 rounded-2xl font-bold shadow-xl flex items-center gap-3 transition-transform active:scale-95"
            >
              <Camera size={20} />
              <span>{isRTL ? 'مسح رمز آخر' : 'Scan Another Code'}</span>
            </button>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col bg-black overflow-hidden">
            
            {/* Live Camera Feed */}
            {!cameraBlocked ? (
              <div className="absolute inset-0">
                <Scanner 
                  onScan={handleScan}
                  onError={(err) => {
                    console.warn('Scanner error:', err);
                    setCameraBlocked(true);
                  }}
                  components={{ onOff: true, torch: true }}
                />
                
                {/* Premium Viewfinder Overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Darkened outer area */}
                  <div className="absolute inset-0 border-[60px] md:border-[100px] border-black/60 backdrop-blur-[2px]"></div>
                  
                  {/* Clear center hole with corners */}
                  <div className="absolute inset-0 m-[60px] md:m-[100px] border-2 border-white/20 rounded-3xl relative overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                    
                    {/* Animated scanning laser */}
                    <div className="absolute top-0 inset-x-0 h-1 bg-brand-primary-500 shadow-[0_0_15px_rgba(var(--brand-primary-500),1)] animate-scan-laser"></div>
                    
                    {/* Corner brackets */}
                    <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-brand-primary-500 rounded-tl-3xl"></div>
                    <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-brand-primary-500 rounded-tr-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-brand-primary-500 rounded-bl-3xl"></div>
                    <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-brand-primary-500 rounded-br-3xl"></div>
                  </div>
                </div>

                <div className="absolute bottom-24 inset-x-0 text-center pointer-events-none px-6">
                  <p className="text-white font-bold text-lg drop-shadow-md">
                    {isRTL ? 'وجّه الكاميرا نحو الرمز الموجود على شاشة الدكتور' : 'Point camera at the Doctor\'s screen'}
                  </p>
                </div>
              </div>
            ) : (
              /* Manual Entry Fallback */
            <div className="absolute inset-0 bg-white dark:bg-slate-900 flex flex-col p-8 z-40 transition-colors">
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-24 h-24 bg-amber-100 dark:bg-amber-900/30 rounded-[2rem] flex items-center justify-center mb-8 rotate-3 shadow-sm border border-amber-200 dark:border-amber-800/50">
                  <ShieldAlert className="w-12 h-12 text-amber-600 dark:text-amber-500" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-4 tracking-tight">
                  {isRTL ? 'إذن الكاميرا مطلوب' : 'Camera Permission Required'}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium mb-10 max-w-md mx-auto leading-relaxed">
                  {isRTL 
                    ? 'لأسباب أمنية، لا يمكن فتح الكاميرا المباشرة. يمكنك إدخال الرمز المكون من 6 أرقام الموجود تحت الرمز.' 
                    : 'Browser security requires HTTPS for live camera. Please enter the 6-digit code shown below the QR code.'}
                </p>
                
                <div className="w-full max-w-sm flex gap-3">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    className="flex-1 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-4 text-center text-3xl font-mono font-black tracking-widest text-slate-800 dark:text-white outline-none focus:border-brand-primary-500 transition-colors"
                    value={manualCode}
                    onChange={(e) => {
                      const val = e.target.value;
                      setManualCode(val);
                      if (val.length === 6) {
                        processQrPayload(val);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && manualCode) {
                        processQrPayload(manualCode);
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (manualCode) {
                        processQrPayload(manualCode);
                      }
                    }}
                    className="bg-brand-primary-600 hover:bg-brand-primary-700 text-white px-6 rounded-2xl font-bold flex items-center justify-center transition-all shadow-lg active:scale-95"
                  >
                    <ArrowRight className={`w-6 h-6 ${isRTL ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
            )}
          {/* Bottom Actions Bar (only visible when camera works) */}
          {!cameraBlocked && (
            <div className="absolute bottom-0 inset-x-0 h-24 bg-black/80 backdrop-blur-xl flex items-center justify-center gap-4 border-t border-white/10 px-6 z-30">
              <button 
                onClick={() => {
                  const token = prompt(isRTL ? 'أدخل الرمز المكون من 6 أرقام:' : 'Enter 6-digit code:');
                  if (token) {
                    processQrPayload(token);
                  }
                }}
                className="bg-brand-primary-600 hover:bg-brand-primary-700 active:bg-brand-primary-800 text-white font-bold px-6 py-3 rounded-2xl flex items-center gap-3 transition-colors shadow-lg w-full sm:w-auto justify-center"
              >
                <Keyboard size={20} />
                <span>{isRTL ? 'إدخال يدوي' : 'Manual Entry'}</span>
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-bold px-6 py-3 rounded-2xl flex items-center gap-3 transition-colors border border-white/10 w-full sm:w-auto justify-center"
              >
                <ImageIcon size={20} className="text-brand-primary-400" />
              </button>
            </div>
          )}
        </div>
        )}
      </div>
      
      {/* Required for laser animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan-laser {
          0%, 100% { top: 0; opacity: 0; }
          10%, 90% { opacity: 1; }
          50% { top: 100%; opacity: 1; }
        }
        .animate-scan-laser {
          animation: scan-laser 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}} />
    </div>
  );
}
