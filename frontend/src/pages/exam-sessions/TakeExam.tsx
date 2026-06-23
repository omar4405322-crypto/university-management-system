import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { examSessionService, ExamSession, ExamQuestion, ExamSubmission } from '../../services/examSession.service';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Clock, AlertCircle, CheckCircle, ChevronRight, ChevronLeft, Upload, Loader2, Send } from 'lucide-react';
import Button from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/ui/Modal';
import { useAntiCheat } from '../../hooks/useAntiCheat';

const TakeExam = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [session, setSession] = useState<ExamSession | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [submission, setSubmission] = useState<ExamSubmission | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  
  // Format: { questionId: { selectedOption, essayText, file } }
  const [answers, setAnswers] = useState<Record<number, any>>({});

  useEffect(() => {
    const startExam = async () => {
      try {
        setLoading(true);
        const data = await examSessionService.startExam(Number(id));
        setSession(data.submission.examSession); // Need to adjust this depending on exactly what API returns, assuming it returns submission, questions, timeRemainingSeconds
        // The API returns { submission, questions, timeRemainingSeconds }
        setSubmission(data.submission);
        setQuestions(data.questions);
        setTimeRemaining(data.timeRemainingSeconds);
        
        // Load saved answers from local storage if they exist
        const saved = localStorage.getItem(`exam_${id}_answers`);
        if (saved) {
          setAnswers(JSON.parse(saved));
        }
      } catch (error: any) {
        showToast(error.response?.data?.message || 'Failed to start exam', 'error');
        navigate('/exam-sessions');
      } finally {
        setLoading(false);
      }
    };

    if (id) startExam();
  }, [id, navigate, showToast]);

  const hasAutoSubmitted = useRef(false);

  const handleAutoSubmit = async () => {
    if (hasAutoSubmitted.current) return;
    hasAutoSubmitted.current = true;
    await handleSubmit(true); // pass flag indicating auto-submit
  };

  useEffect(() => {
    if (timeRemaining === null) return;
    if (timeRemaining <= 0) {
      handleAutoSubmit();
      return;
    }
    const timer = setInterval(() => {
      setTimeRemaining(prev => (prev !== null ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeRemaining]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Auto-save logic
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      localStorage.setItem(`exam_${id}_answers`, JSON.stringify(answers));
    }
  }, [answers, id]);

  // ─── Anti-Cheat ─────────────────────────────────────────────────────────────
  useAntiCheat({
    sessionId: Number(id),
    enabled: !!submission && submission.status === 'IN_PROGRESS',
    onAutoSubmit: () => {
      alert('Your exam was auto-submitted due to repeated integrity violations.');
      navigate(`/exam-sessions/${id}/result`);
    },
    onWarning: (count, remaining) => {
      setWarningMessage(
        `⚠️ Violation #${count} detected! ${remaining} warning(s) remaining before auto-submit.`
      );
      setTimeout(() => setWarningMessage(null), 5000);
    },
  });

  const handleAnswerChange = (questionId: number, field: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [field]: value
      }
    }));
  };

  const handleFileUpload = async (questionId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !submission) return;

    try {
      showToast('Uploading file...', 'info');
      
      // Need a placeholder answer first to attach file to
      // The backend expects an ExamAnswer record to exist before we can upload to it.
      // Actually, we can submit a draft answer, then upload the file to it.
      // But according to the API, submitExam takes all answers at once, then we upload.
      // We need to alter the flow slightly or store the file locally and upload on submit.
      // Given the requirements, I will store the file in state, and upload it AFTER submitting the exam answers.
      
      handleAnswerChange(questionId, 'file', file);
      handleAnswerChange(questionId, 'fileName', file.name); // for display
      showToast('File selected for upload', 'success');

    } catch (error) {
       showToast('Failed to prepare file', 'error');
    }
  };

  const handleSubmit = async (isAuto = false) => {
    if (submitting) return;
    try {
      setSubmitting(true);
      
      // 1. Prepare answers array
      const formattedAnswers = Object.entries(answers).map(([qId, ans]: [string, any]) => ({
        questionId: Number(qId),
        selectedOption: ans.selectedOption,
        essayText: ans.essayText,
      }));

      // 2. Submit textual answers
      const submitResult = await examSessionService.submitExam(Number(id), formattedAnswers);

      // 3. Upload files for FILE_UPLOAD questions
      // Find the created answers to get their IDs
      const createdSubmission = submitResult.submission;
      
      const fileUploadPromises = Object.entries(answers)
        .filter(([_, ans]: [string, any]) => ans.file)
        .map(async ([qId, ans]: [string, any]) => {
           const answerRecord = createdSubmission.answers.find((a: any) => a.questionId === Number(qId));
           if (answerRecord && ans.file) {
              await examSessionService.uploadAnswerFile(Number(id), answerRecord.id, ans.file);
           }
        });
      
      await Promise.all(fileUploadPromises);

      localStorage.removeItem(`exam_${id}_answers`);
      showToast(isAuto ? 'Exam auto-submitted due to time limit!' : 'Exam submitted successfully!', 'success');
      navigate(`/exam-sessions/${id}/result`);

    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to submit exam', 'error');
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-brand-green-dark mb-4" size={48} />
        <h2 className="text-xl font-bold">Preparing Exam...</h2>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isTimeLow = timeRemaining !== null && timeRemaining < 300; // less than 5 min

  return (
    <div className="fixed inset-0 z-50 bg-surface-subtle dark:bg-slate-900 flex flex-col">
      {/* Top Bar */}
      <div className="bg-white dark:bg-slate-800 shadow-sm px-6 py-4 flex items-center justify-between z-10 shrink-0">
        <h1 className="text-xl font-black tracking-tight text-brand-text-primary dark:text-white">
          {session?.title || 'Exam'}
        </h1>
        
        <div className={`flex items-center gap-3 px-4 py-2 rounded-xl font-bold ${
          isTimeLow ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
        }`}>
          <Clock size={18} className={isTimeLow ? 'animate-pulse' : ''} />
          {timeRemaining !== null ? formatTime(timeRemaining) : '--:--'}
        </div>

        <Button 
          onClick={() => setShowConfirmModal(true)}
          className="gap-2 shadow-lg shadow-brand-green-dark/20"
        >
          <Send size={16} />
          Submit Exam
        </Button>
      </div>

      {/* Anti-Cheat Warning Banner */}
      {warningMessage && (
        <div className="bg-red-500 text-white text-center py-2 px-4 text-sm font-medium animate-pulse z-20 shrink-0">
          {warningMessage}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar Navigator */}
        <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-y-auto p-4 shrink-0">
          <h3 className="text-xs font-black uppercase tracking-widest text-brand-text-muted mb-4">Questions</h3>
          <div className="grid grid-cols-4 gap-2">
            {questions.map((q, idx) => {
              const isAnswered = answers[q.id]?.selectedOption || answers[q.id]?.essayText || answers[q.id]?.file;
              const isCurrent = idx === currentQuestionIndex;
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`
                    h-10 rounded-lg text-sm font-bold flex items-center justify-center transition-all
                    ${isCurrent ? 'ring-2 ring-brand-green-dark ring-offset-2 dark:ring-offset-slate-800' : ''}
                    ${isAnswered 
                      ? 'bg-brand-accent-emerald/20 text-brand-green-dark dark:bg-brand-accent-emerald/30' 
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-200'}
                  `}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question Area */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          <div className="max-w-3xl mx-auto pb-24">
            <div className="flex items-center justify-between mb-8">
              <span className="text-sm font-bold text-brand-text-muted uppercase tracking-widest">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <span className="px-3 py-1 bg-surface-subtle dark:bg-slate-800 rounded-lg text-xs font-bold">
                {currentQuestion.points} Points
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm mb-8">
              <h2 className="text-xl font-bold text-brand-text-primary dark:text-white leading-relaxed mb-6">
                {currentQuestion.text}
              </h2>
              {currentQuestion.textAr && (
                <h2 className="text-xl font-bold text-brand-text-primary dark:text-white leading-relaxed mb-6 text-right" dir="rtl">
                  {currentQuestion.textAr}
                </h2>
              )}

              {/* MCQ Options */}
              {currentQuestion.type === 'MCQ' && (
                <div className="space-y-3">
                  {['A', 'B', 'C', 'D'].map((opt) => {
                    const optText = currentQuestion[`option${opt}` as keyof ExamQuestion];
                    if (!optText) return null;
                    const isSelected = answers[currentQuestion.id]?.selectedOption === opt;
                    return (
                      <label 
                        key={opt}
                        className={`
                          flex items-center p-4 rounded-xl cursor-pointer border-2 transition-all
                          ${isSelected 
                            ? 'border-brand-green-dark bg-brand-accent-emerald/5 dark:bg-brand-green-dark/10' 
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}
                        `}
                      >
                        <input
                          type="radio"
                          name={`question-${currentQuestion.id}`}
                          value={opt}
                          checked={isSelected}
                          onChange={(e) => handleAnswerChange(currentQuestion.id, 'selectedOption', e.target.value)}
                          className="w-5 h-5 text-brand-green-dark mr-4 focus:ring-brand-green-dark"
                        />
                        <span className="font-medium text-brand-text-primary dark:text-slate-200">{String(optText)}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* TRUE/FALSE Options */}
              {currentQuestion.type === 'TRUE_FALSE' && (
                <div className="grid grid-cols-2 gap-4">
                  {['TRUE', 'FALSE'].map((opt) => {
                    const isSelected = answers[currentQuestion.id]?.selectedOption === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => handleAnswerChange(currentQuestion.id, 'selectedOption', opt)}
                        className={`
                          py-6 rounded-2xl text-lg font-black tracking-wide border-2 transition-all
                          ${isSelected 
                            ? 'border-brand-green-dark bg-brand-accent-emerald/10 text-brand-green-dark' 
                            : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'}
                        `}
                      >
                        {opt === 'TRUE' ? 'True' : 'False'}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ESSAY */}
              {currentQuestion.type === 'ESSAY' && (
                <div>
                  <textarea
                    rows={8}
                    className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-brand-green-dark outline-none resize-none"
                    placeholder="Type your answer here..."
                    value={answers[currentQuestion.id]?.essayText || ''}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, 'essayText', e.target.value)}
                  />
                  {currentQuestion.maxWords && (
                    <p className="text-xs text-right mt-2 text-slate-500">
                      Max words: {currentQuestion.maxWords}
                    </p>
                  )}
                </div>
              )}

              {/* FILE UPLOAD */}
              {currentQuestion.type === 'FILE_UPLOAD' && (
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-8 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <input
                    type="file"
                    id={`file-${currentQuestion.id}`}
                    className="hidden"
                    accept={currentQuestion.allowedFileTypes ? currentQuestion.allowedFileTypes.split(',').map(ext => `.${ext.trim()}`).join(',') : undefined}
                    onChange={(e) => handleFileUpload(currentQuestion.id, e)}
                  />
                  <label htmlFor={`file-${currentQuestion.id}`} className="cursor-pointer flex flex-col items-center">
                    <Upload size={32} className="text-slate-400 mb-4" />
                    <span className="font-bold text-brand-green-dark mb-2">Click to select file</span>
                    <span className="text-sm text-slate-500">
                      Allowed types: {currentQuestion.allowedFileTypes || 'Any'}
                    </span>
                    {answers[currentQuestion.id]?.fileName && (
                      <div className="mt-4 px-4 py-2 bg-brand-accent-emerald/20 text-brand-green-dark rounded-lg flex items-center gap-2">
                        <CheckCircle size={16} />
                        {answers[currentQuestion.id].fileName}
                      </div>
                    )}
                  </label>
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center absolute bottom-0 left-0 right-0 p-6 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <Button
                variant="outline"
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                className="gap-2"
              >
                <ChevronLeft size={16} /> Previous
              </Button>
              
              {!isLastQuestion ? (
                <Button
                  onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                  className="gap-2"
                >
                  Next <ChevronRight size={16} />
                </Button>
              ) : (
                <Button
                   onClick={() => setShowConfirmModal(true)}
                   className="gap-2 shadow-lg shadow-brand-green-dark/20"
                >
                  Review & Submit
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Submit Exam?">
        <div className="p-6">
          <div className="flex items-center gap-4 p-4 mb-6 rounded-xl bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            <AlertCircle size={24} className="shrink-0" />
            <p className="text-sm">Are you sure you want to submit your exam? You cannot change your answers after submission.</p>
          </div>
          
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => setShowConfirmModal(false)}
              className="flex-1"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleSubmit(false)}
              className="flex-1 gap-2"
              disabled={submitting}
            >
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
              {submitting ? 'Submitting...' : 'Yes, Submit Exam'}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default TakeExam;
