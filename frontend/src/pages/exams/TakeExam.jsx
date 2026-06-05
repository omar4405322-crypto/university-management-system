import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import examsService from '../../services/exams.service';
import { useAuth } from '../../context/AuthContext';
import { 
  ChevronLeft, 
  Timer, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2,
  Lock,
  Camera,
  Monitor,
  ShieldCheck,
  Play
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import { useTranslation } from 'react-i18next';

const TakeExam = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('PREPARING'); // PREPARING, READY, IN_PROGRESS, COMPLETED
  const [showEmergencyExitConfirm, setShowEmergencyExitConfirm] = useState(false);
  const [answers, setAnswers] = useState(() => {
    const saved = localStorage.getItem(`exam_answers_${id}`);
    return saved ? JSON.parse(saved) : {};
  });
  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = localStorage.getItem(`exam_timer_${id}`);
    return saved ? parseInt(saved) : 0;
  });

  // Save answers to localStorage
  useEffect(() => {
    if (status === 'IN_PROGRESS') {
      localStorage.setItem(`exam_answers_${id}`, JSON.stringify(answers));
    }
  }, [answers, id, status]);

  // Save timer to localStorage
  useEffect(() => {
    if (status === 'IN_PROGRESS' && timeLeft > 0) {
      localStorage.setItem(`exam_timer_${id}`, timeLeft.toString());
    }
  }, [timeLeft, id, status]);

  // Countdown timer logic
  useEffect(() => {
    if (status !== 'IN_PROGRESS' || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // auto-submit would go here
          setStatus('COMPLETED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status, timeLeft]);

  // Clear storage on completion
  useEffect(() => {
    if (status === 'COMPLETED') {
      localStorage.removeItem(`exam_answers_${id}`);
      localStorage.removeItem(`exam_timer_${id}`);
    }
  }, [status, id]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isTimeCritical = timeLeft > 0 && timeLeft <= 300; // 5 minutes

  // 1. Add a beforeunload event listener
  useEffect(() => { 
    if (status !== 'IN_PROGRESS') return; 
    const handleBeforeUnload = (e) => { 
      e.preventDefault(); 
      e.returnValue = ''; 
    }; 
    window.addEventListener('beforeunload', handleBeforeUnload); 
    return () => window.removeEventListener('beforeunload', handleBeforeUnload); 
  }, [status]);

  // 2. Add a React Router navigation blocker
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      status === 'IN_PROGRESS' && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    fetchExam();
  }, [id]);

  const fetchExam = async () => {
    try {
      setLoading(true);
      const result = await examsService.getExamById(id);
      if (result.success) {
        setExam(result.data);
      }
    } catch (err) {
      setError('Failed to load exam details.');
    } finally {
      setLoading(false);
    }
  };

  const startExam = () => {
    const duration = exam?.durationMinutes || exam?.duration || 120;
    if (!localStorage.getItem(`exam_timer_${id}`)) {
      setTimeLeft(duration * 60);
      localStorage.setItem(`exam_timer_${id}`, (duration * 60).toString());
    }
    setStatus('IN_PROGRESS');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] gap-4">
        <Loader2 className="animate-spin text-brand-green" size={48} />
        <p className="text-brand-text-sub font-black uppercase tracking-widest text-sm">Initializing Secure Exam Environment...</p>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center p-8 bg-brand-bg-card rounded-[2rem] border border-brand-border shadow-soft">
        <div className="h-20 w-20 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={40} className="text-rose-500" />
        </div>
        <h2 className="text-2xl font-black text-brand-text-main">Access Denied</h2>
        <p className="text-brand-text-sub font-bold mt-2">{error || 'This exam is not available or you do not have access.'}</p>
        <Button variant="outline" className="mt-8 w-full border-brand-border" onClick={() => navigate('/exams')}>
          Back to Schedule
        </Button>
      </div>
    );
  }

  return (
    <div className="section-gap animate-in fade-in duration-700">
      {status === 'PREPARING' && (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate(`/exams/${id}`)}
                className="p-3 text-brand-text-sub hover:text-brand-green hover:bg-brand-green/10 rounded-2xl transition-all duration-300"
              >
                <ChevronLeft size={24} />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-black text-brand-text-main">{exam.course?.name}</h1>
                  <Badge variant={exam.type === 'FINAL' ? 'danger' : 'info'} className="font-bold">{exam.type}</Badge>
                </div>
                <p className="text-brand-text-sub font-bold mt-1 uppercase tracking-wider">{exam.course?.courseCode} — Digital Exam Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-brand-navy text-white rounded-2xl">
              <Timer size={24} className="text-brand-green" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-gray/60">Duration</p>
                <p className="text-sm font-black">120 Minutes</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card title="Secure Exam Guidelines" borderLeft={false}>
                <div className="space-y-6 pt-2">
                  <div className="p-6 rounded-2xl bg-brand-bg-page border border-brand-border space-y-4">
                    <div className="flex gap-4">
                      <div className="p-3 bg-brand-navy/5 text-brand-navy rounded-xl h-fit">
                        <Monitor size={20} />
                      </div>
                      <div>
                        <h4 className="font-black text-brand-text-main">Fullscreen Mode</h4>
                        <p className="text-sm text-brand-text-sub font-bold mt-1">The exam will open in fullscreen. Exiting fullscreen or switching tabs will be flagged as a violation.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="p-3 bg-brand-navy/5 text-brand-navy rounded-xl h-fit">
                        <Camera size={20} />
                      </div>
                      <div>
                        <h4 className="font-black text-brand-text-main">AI Proctoring</h4>
                        <p className="text-sm text-brand-text-sub font-bold mt-1">Your camera and microphone will be monitored during the entire session to ensure academic integrity.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="p-3 bg-brand-navy/5 text-brand-navy rounded-xl h-fit">
                        <Lock size={20} />
                      </div>
                      <div>
                        <h4 className="font-black text-brand-text-main">Restricted Access</h4>
                        <p className="text-sm text-brand-text-sub font-bold mt-1">Calculators and external notes are only permitted if explicitly mentioned by the instructor.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-yellow/10 border border-brand-yellow/20 text-brand-yellow-dark">
                    <AlertTriangle size={20} className="shrink-0" />
                    <p className="text-xs font-black">By clicking "Start Exam", you agree to the university's academic integrity policy and the use of digital proctoring.</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <Card title="Pre-Exam Checklist" borderLeft={false}>
                <div className="space-y-4 pt-2">
                  {[
                    'Internet connection stable',
                    'Webcam & Mic working',
                    'Quiet environment',
                    'University ID ready',
                    'No prohibited devices'
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-navy/5 transition-colors group">
                      <div className="h-5 w-5 rounded-full border-2 border-brand-green flex items-center justify-center group-hover:bg-brand-green transition-all">
                        <CheckCircle2 size={12} className="text-transparent group-hover:text-white" />
                      </div>
                      <span className="text-sm font-bold text-brand-text-main">{item}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Button 
                onClick={startExam}
                className="w-full h-16 rounded-2xl shadow-xl shadow-brand-green/20 text-lg font-black flex items-center justify-center gap-3"
              >
                <Play size={20} fill="currentColor" /> Start Digital Exam
              </Button>

              <div className="text-center">
                <p className="text-caption flex items-center justify-center gap-2">
                  <ShieldCheck size={14} className="text-brand-green" /> Secure Session ID: {id.substring(0, 8).toUpperCase()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {status === 'IN_PROGRESS' && (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center space-y-6 animate-in zoom-in duration-500">
          <div className="sticky top-0 z-20 w-full flex justify-end mb-8">
            <div className={`flex items-center px-6 py-3 rounded-2xl font-mono text-xl font-black shadow-xl transition-colors ${isTimeCritical ? 'bg-error text-white animate-pulse' : 'bg-brand-navy text-brand-green'}`}>
              <Timer size={24} className="mr-3" />
              {formatTime(timeLeft)}
            </div>
          </div>

          {isTimeCritical && (
            <div className="mb-4 p-4 rounded-2xl bg-error/10 border border-error/20 flex items-center gap-3 animate-bounce">
              <AlertTriangle size={20} className="text-error" />
              <p className="text-sm font-black text-error uppercase tracking-widest">
                {i18n.language === 'ar' ? 'تبقى 5 دقائق فقط!' : 'Only 5 minutes left!'}
              </p>
            </div>
          )}

          <div className="relative">
            <div className="h-32 w-32 rounded-full border-4 border-brand-green border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Monitor size={48} className="text-brand-green" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-black text-brand-text-main">Digital Exam in Progress</h2>
            <p className="text-brand-text-sub font-bold mt-2 max-w-md mx-auto">
              You are now in a secure proctored session. Please follow the instructions on your screen and do not leave this window.
            </p>
          </div>
          <div className="flex gap-4">
            <Button variant="outline" className="border-brand-border" onClick={() => setShowEmergencyExitConfirm(true)}>
              Emergency Exit
            </Button>
            <Button onClick={() => setStatus('COMPLETED')}>
              Submit Exam
            </Button>
          </div>
        </div>
      )}

      {status === 'COMPLETED' && (
        <div className="max-w-md mx-auto text-center space-y-8 animate-in slide-in-from-bottom-8 duration-700">
          <div className="h-24 w-24 rounded-full bg-brand-green/10 flex items-center justify-center mx-auto border-2 border-brand-green">
            <CheckCircle2 size={48} className="text-brand-green" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-brand-text-main">Exam Submitted</h2>
            <p className="text-brand-text-sub font-bold mt-2">
              Your exam has been successfully submitted and received by the system.
            </p>
          </div>
          <Card className="border-l-0 bg-brand-navy/5">
            <div className="space-y-4 text-left">
              <div className="flex justify-between items-center py-2 border-b border-brand-border">
                <span className="text-xs font-black text-brand-text-muted uppercase">Submission ID</span>
                <span className="text-sm font-black text-brand-text-main">EX-{id.substring(0, 6).toUpperCase()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-brand-border">
                <span className="text-xs font-black text-brand-text-muted uppercase">Submitted At</span>
                <span className="text-sm font-black text-brand-text-main">{new Date().toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs font-black text-brand-text-muted uppercase">Status</span>
                <Badge variant="success">PENDING GRADING</Badge>
              </div>
            </div>
          </Card>
          <Button className="w-full h-14 rounded-2xl" onClick={() => navigate('/exams')}>
            Return to Dashboard
          </Button>
        </div>
      )}

      {/* Navigation Protection Modal */}
      <ConfirmDeleteModal
        isOpen={blocker.state === 'blocked'}
        onClose={() => blocker.reset()}
        onConfirm={() => blocker.proceed()}
        title={t('exam.leaveWarningTitle')}
        message={t('exam.leaveWarningMessage')}
        confirmLabel={t('exam.leaveButton')}
        cancelLabel={t('exam.stayButton')}
        variant="warning"
      />

      <ConfirmDeleteModal
        isOpen={showEmergencyExitConfirm}
        onClose={() => setShowEmergencyExitConfirm(false)}
        onConfirm={() => {
          setShowEmergencyExitConfirm(false);
          setStatus('PREPARING');
        }}
        title={t('exam.leaveWarningTitle')}
        message={t('exam.leaveWarningMessage')}
        confirmLabel={t('exam.leaveButton')}
        cancelLabel={t('exam.stayButton')}
        variant="warning"
      />
    </div>
  );
};

export default TakeExam;
