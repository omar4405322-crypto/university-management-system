import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calendar,
  Clock,
  BookOpen,
  Check,
  Loader2,
  Users,
  Settings,
  Shuffle,
  FileText,
  AlertTriangle,
  Info,
} from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { examSessionService } from '../../../services/examSession.service';
import { useToast } from '../../../context/ToastContext';
import api from '../../../services/api';

interface CreateExamSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateExamSessionModal: React.FC<CreateExamSessionModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState<any[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    instructions: '',
    courseId: '',
    linkToExam: false,
    examId: '',
    durationMinutes: 60,
    allowedAttempts: 1,
    opensAt: '',
    closesAt: '',
    passingScore: 50,
    shuffleQuestions: false,
    showResultsAfter: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setShowDiscardConfirm(false);
      setFormData({
        title: '',
        instructions: '',
        courseId: '',
        linkToExam: false,
        examId: '',
        durationMinutes: 60,
        allowedAttempts: 1,
        opensAt: '',
        closesAt: '',
        passingScore: 50,
        shuffleQuestions: false,
        showResultsAfter: true,
      });
      setErrors({});

      api.get('/exams')
        .then(res => {
          if (res.data?.data) {
            setExams(res.data.data);
          }
        })
        .catch(() => {
          showToast('Failed to load exams', 'error');
        });
    }
  }, [isOpen]);

  const coursesMap = new Map();
  exams.forEach(ex => {
    if (ex.courseId && ex.course) {
      coursesMap.set(ex.courseId, {
        id: ex.courseId,
        name: ex.course.name,
        courseCode: ex.course.courseCode,
      });
    }
  });
  const uniqueCourses = Array.from(coursesMap.values());

  const courseExams = exams.filter(ex => ex.courseId === Number(formData.courseId));

  const validateStep = (currentStep: number) => {
    const newErrors: Record<string, string> = {};

    if (currentStep === 1) {
      if (!formData.title.trim()) {
        newErrors.title = 'Title is required';
      }
      if (!formData.courseId) {
        newErrors.courseId = 'Course selection is required';
      }
      if (formData.linkToExam && !formData.examId) {
        newErrors.examId = 'Linking to an exam is required when toggled ON';
      }
      if (!formData.durationMinutes || formData.durationMinutes < 10 || formData.durationMinutes > 300) {
        newErrors.durationMinutes = 'Duration must be between 10 and 300 minutes';
      }
      if (!formData.allowedAttempts || formData.allowedAttempts < 1 || formData.allowedAttempts > 3) {
        newErrors.allowedAttempts = 'Allowed attempts must be between 1 and 3';
      }
    }

    if (currentStep === 2) {
      if (!formData.opensAt) {
        newErrors.opensAt = 'Opens At is required';
      }
      if (!formData.closesAt) {
        newErrors.closesAt = 'Closes At is required';
      }
      if (formData.opensAt && formData.closesAt) {
        const openDate = new Date(formData.opensAt);
        const closeDate = new Date(formData.closesAt);
        if (closeDate <= openDate) {
          newErrors.closesAt = 'Closes At must be after Opens At';
        }
      }
      if (formData.passingScore === undefined || formData.passingScore < 0 || formData.passingScore > 100) {
        newErrors.passingScore = 'Passing score must be between 0 and 100';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => (prev + 1) as any);
    }
  };

  const handleBack = () => {
    setStep((prev) => (prev - 1) as any);
  };

  const handleCloseAttempt = () => {
    const hasChanges = formData.title || formData.instructions || formData.courseId || formData.opensAt || formData.closesAt;
    if (hasChanges) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(1) || !validateStep(2)) return;

    let finalExamId = Number(formData.examId);
    if (!formData.linkToExam) {
      const firstExam = courseExams[0];
      if (!firstExam) {
        showToast('No scheduled exam exists for this course to link to.', 'error');
        return;
      }
      finalExamId = firstExam.id;
    }

    try {
      setLoading(true);
      await examSessionService.create({
        examId: finalExamId,
        title: formData.title,
        instructions: formData.instructions,
        durationMinutes: Number(formData.durationMinutes),
        passingScore: Number(formData.passingScore),
        opensAt: formData.opensAt ? new Date(formData.opensAt).toISOString() : undefined,
        closesAt: formData.closesAt ? new Date(formData.closesAt).toISOString() : undefined,
        shuffleQuestions: formData.shuffleQuestions,
        showResultsAfter: formData.showResultsAfter,
        allowedAttempts: Number(formData.allowedAttempts),
      });
      showToast('Exam session created successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to create exam session', 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedCourseName = uniqueCourses.find(c => c.id === Number(formData.courseId))?.name || '';
  const selectedExamDetails = exams.find(e => e.id === Number(formData.examId));

  const isStep1Valid = !!(formData.title.trim() && formData.courseId && (!formData.linkToExam || formData.examId) && formData.durationMinutes >= 10 && formData.durationMinutes <= 300 && formData.allowedAttempts >= 1 && formData.allowedAttempts <= 3);
  const isStep2Valid = !!(formData.opensAt && formData.closesAt && new Date(formData.closesAt) > new Date(formData.opensAt) && formData.passingScore >= 0 && formData.passingScore <= 100);

  return (
    <Modal isOpen={isOpen} onClose={handleCloseAttempt} title="Create Exam Session" size="lg">
      <div className="relative">
        {showDiscardConfirm && (
          <div className="absolute inset-0 bg-brand-bg-page/95 dark:bg-slate-900/95 z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center mb-4">
              <AlertTriangle className="text-red-500" size={32} />
            </div>
            <h3 className="text-lg font-black text-brand-text-primary dark:text-white mb-2">Discard Changes?</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-xs">All entered information will be lost. Are you sure you want to exit?</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowDiscardConfirm(false)}>No, keep editing</Button>
              <Button variant="danger" onClick={onClose}>Yes, discard</Button>
            </div>
          </div>
        )}

        <div className="p-6">
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${step >= 1 ? 'bg-brand-green-dark text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                  {step > 1 ? <Check size={14} /> : '1'}
                </div>
                <span className={`text-xs font-black uppercase tracking-wider ${step === 1 ? 'text-brand-green-dark' : 'text-slate-400'}`}>Basic Info</span>
              </div>
              <div className="h-0.5 w-8 bg-slate-200 dark:bg-slate-800" />
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${step >= 2 ? 'bg-brand-green-dark text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                  {step > 2 ? <Check size={14} /> : '2'}
                </div>
                <span className={`text-xs font-black uppercase tracking-wider ${step === 2 ? 'text-brand-green-dark' : 'text-slate-400'}`}>Schedule</span>
              </div>
              <div className="h-0.5 w-8 bg-slate-200 dark:bg-slate-800" />
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${step >= 3 ? 'bg-brand-green-dark text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                  3
                </div>
                <span className={`text-xs font-black uppercase tracking-wider ${step === 3 ? 'text-brand-green-dark' : 'text-slate-400'}`}>Review</span>
              </div>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); if (step === 3) handleSubmit(e); }} className="space-y-6">
            {step === 1 && (
              <div className="space-y-4 animate-in slide-in-from-right-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-brand-text-primary dark:text-white">Session Title *</label>
                  <input
                    type="text"
                    className={`w-full p-3 rounded-xl border ${errors.title ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'} bg-transparent outline-none focus:ring-2 focus:ring-brand-green-dark/20`}
                    placeholder="e.g. Midterm Online Exam"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                  {errors.title && <p className="text-red-500 text-xs font-bold">{errors.title}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-brand-text-primary dark:text-white">Instructions</label>
                  <textarea
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent outline-none focus:ring-2 focus:ring-brand-green-dark/20"
                    rows={3}
                    placeholder="e.g. No calculators allowed, read each question carefully"
                    value={formData.instructions}
                    onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-brand-text-primary dark:text-white">Course Selector *</label>
                  <select
                    className={`w-full p-3 rounded-xl border ${errors.courseId ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-900`}
                    value={formData.courseId}
                    onChange={(e) => setFormData({ ...formData, courseId: e.target.value, examId: '' })}
                  >
                    <option value="">Select a course...</option>
                    {uniqueCourses.map(c => (
                      <option key={c.id} value={c.id}>{c.courseCode} - {c.name}</option>
                    ))}
                  </select>
                  {errors.courseId && <p className="text-red-500 text-xs font-bold">{errors.courseId}</p>}
                </div>

                {formData.courseId && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-brand-text-primary dark:text-white">Link to scheduled exam?</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.linkToExam}
                          onChange={(e) => setFormData({ ...formData, linkToExam: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-650 peer-checked:bg-brand-green-dark" />
                      </label>
                    </div>

                    {formData.linkToExam && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-brand-text-secondary dark:text-slate-400">Scheduled Exam *</label>
                        <select
                          className={`w-full p-3 rounded-xl border ${errors.examId ? 'border-red-500' : 'border-slate-200 dark:border-slate-750'} bg-white dark:bg-slate-900`}
                          value={formData.examId}
                          onChange={(e) => setFormData({ ...formData, examId: e.target.value })}
                        >
                          <option value="">Select a scheduled exam...</option>
                          {courseExams.map(ex => (
                            <option key={ex.id} value={ex.id}>
                              {ex.type} ({new Date(ex.date).toLocaleDateString()}) - Room {ex.room || 'TBD'}
                            </option>
                          ))}
                        </select>
                        {errors.examId && <p className="text-red-500 text-xs font-bold">{errors.examId}</p>}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-brand-text-primary dark:text-white">Duration (minutes) *</label>
                    <input
                      type="number"
                      min={10}
                      max={300}
                      className={`w-full p-3 rounded-xl border ${errors.durationMinutes ? 'border-red-500' : 'border-slate-200 dark:border-slate-750'} bg-transparent outline-none focus:ring-2 focus:ring-brand-green-dark/20`}
                      value={formData.durationMinutes}
                      onChange={(e) => setFormData({ ...formData, durationMinutes: Number(e.target.value) })}
                    />
                    {errors.durationMinutes && <p className="text-red-500 text-xs font-bold">{errors.durationMinutes}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-brand-text-primary dark:text-white">Allowed Attempts *</label>
                    <input
                      type="number"
                      min={1}
                      max={3}
                      className={`w-full p-3 rounded-xl border ${errors.allowedAttempts ? 'border-red-500' : 'border-slate-200 dark:border-slate-750'} bg-transparent outline-none focus:ring-2 focus:ring-brand-green-dark/20`}
                      value={formData.allowedAttempts}
                      onChange={(e) => setFormData({ ...formData, allowedAttempts: Number(e.target.value) })}
                    />
                    {errors.allowedAttempts && <p className="text-red-500 text-xs font-bold">{errors.allowedAttempts}</p>}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in slide-in-from-right-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-brand-text-primary dark:text-white">Opens At *</label>
                    <input
                      type="datetime-local"
                      className={`w-full p-3 rounded-xl border ${errors.opensAt ? 'border-red-500' : 'border-slate-200 dark:border-slate-750'} bg-transparent outline-none focus:ring-2`}
                      value={formData.opensAt}
                      onChange={(e) => setFormData({ ...formData, opensAt: e.target.value })}
                    />
                    {errors.opensAt && <p className="text-red-500 text-xs font-bold">{errors.opensAt}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-brand-text-primary dark:text-white">Closes At *</label>
                    <input
                      type="datetime-local"
                      className={`w-full p-3 rounded-xl border ${errors.closesAt ? 'border-red-500' : 'border-slate-200 dark:border-slate-750'} bg-transparent outline-none focus:ring-2`}
                      value={formData.closesAt}
                      onChange={(e) => setFormData({ ...formData, closesAt: e.target.value })}
                    />
                    {errors.closesAt && <p className="text-red-500 text-xs font-bold">{errors.closesAt}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-brand-text-primary dark:text-white">Passing Score (%) *</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={`w-full p-3 rounded-xl border ${errors.passingScore ? 'border-red-500' : 'border-slate-200 dark:border-slate-750'} bg-transparent outline-none focus:ring-2`}
                    value={formData.passingScore}
                    onChange={(e) => setFormData({ ...formData, passingScore: Number(e.target.value) })}
                  />
                  {errors.passingScore && <p className="text-red-500 text-xs font-bold">{errors.passingScore}</p>}
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-brand-text-primary dark:text-white">Shuffle Questions</p>
                      <p className="text-xs text-slate-400">Randomize question order for each student</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.shuffleQuestions}
                        onChange={(e) => setFormData({ ...formData, shuffleQuestions: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-650 peer-checked:bg-brand-green-dark" />
                    </label>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-750">
                    <div>
                      <p className="text-sm font-bold text-brand-text-primary dark:text-white">Show Results Immediately</p>
                      <p className="text-xs text-slate-400">Show score and answers to student immediately after submitting</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.showResultsAfter}
                        onChange={(e) => setFormData({ ...formData, showResultsAfter: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-650 peer-checked:bg-brand-green-dark" />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-in slide-in-from-right-4">
                <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
                  <h4 className="text-lg font-black text-brand-text-primary dark:text-white mb-2">Review Session Parameters</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-brand-green-dark/10 text-brand-green-dark flex items-center justify-center">
                        <FileText size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Title</p>
                        <p className="text-sm font-bold text-brand-text-primary dark:text-white">{formData.title}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-brand-green-dark/10 text-brand-green-dark flex items-center justify-center">
                        <BookOpen size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Course</p>
                        <p className="text-sm font-bold text-brand-text-primary dark:text-white">{selectedCourseName}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-brand-green-dark/10 text-brand-green-dark flex items-center justify-center">
                        <Clock size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Duration</p>
                        <p className="text-sm font-bold text-brand-text-primary dark:text-white">{formData.durationMinutes} Minutes</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-brand-green-dark/10 text-brand-green-dark flex items-center justify-center">
                        <Users size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Attempts</p>
                        <p className="text-sm font-bold text-brand-text-primary dark:text-white">{formData.allowedAttempts} Attempt(s)</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-brand-green-dark/10 text-brand-green-dark flex items-center justify-center">
                        <Calendar size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Opens At</p>
                        <p className="text-xs font-bold text-brand-text-primary dark:text-white">{formData.opensAt ? new Date(formData.opensAt).toLocaleString() : ''}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-brand-green-dark/10 text-brand-green-dark flex items-center justify-center">
                        <Calendar size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Closes At</p>
                        <p className="text-xs font-bold text-brand-text-primary dark:text-white">{formData.closesAt ? new Date(formData.closesAt).toLocaleString() : ''}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-brand-green-dark/10 text-brand-green-dark flex items-center justify-center">
                        <Shuffle size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Shuffle Order</p>
                        <p className="text-sm font-bold text-brand-text-primary dark:text-white">{formData.shuffleQuestions ? 'Yes' : 'No'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-brand-green-dark/10 text-brand-green-dark flex items-center justify-center">
                        <Settings size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Passing Score</p>
                        <p className="text-sm font-bold text-brand-text-primary dark:text-white">{formData.passingScore}%</p>
                      </div>
                    </div>
                  </div>

                  {formData.linkToExam && selectedExamDetails && (
                    <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700 flex items-center gap-3">
                      <Info size={16} className="text-brand-green-dark" />
                      <p className="text-xs text-slate-550 dark:text-slate-400 font-medium">
                        Linked to exam schedule: <span className="font-bold text-brand-text-primary dark:text-white">{selectedExamDetails.type}</span> (Room {selectedExamDetails.room || 'TBD'})
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                  <Info size={20} className="shrink-0" />
                  <p className="text-xs font-bold">
                    After creating, you can add questions from the exam session page.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800">
              <div>
                {step > 1 && (
                  <Button variant="outline" type="button" onClick={handleBack} disabled={loading}>
                    Back
                  </Button>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" type="button" onClick={handleCloseAttempt} disabled={loading}>
                  Cancel
                </Button>
                {step < 3 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={(step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)}
                    className="min-w-[120px]"
                  >
                    Next
                  </Button>
                ) : (
                  <Button type="submit" disabled={loading} className="min-w-[140px] gap-2">
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    {loading ? 'Creating...' : 'Create Exam'}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
};

export default CreateExamSessionModal;
