import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  FileText,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Edit2,
  Trash2,
  ExternalLink,
  Info,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import examsService from '../../services/exams.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import { logger } from '../../lib/logger';

const ExamDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'DOCTOR'].includes(user?.role);
  const isStudent = user?.role === 'STUDENT';
  
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [examToDelete, setExamToDelete] = useState(null);

  useEffect(() => {
    fetchExamDetails();
  }, [id]);

  const fetchExamDetails = async () => {
    try {
      setLoading(true);
      const result = await examsService.getExamById(id);
      if (result.success) {
        setExam(result.data);
      } else {
        setError('Exam not found');
      }
    } catch (err: any) {
      setError('Exam details could not be loaded.');
      logger.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!examToDelete) return;
    try {
      const result = await examsService.deleteExam(examToDelete);
      if (result.success) {
        navigate('/exams');
      }
    } catch (err: any) {
      setError('Error deleting exam.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin text-brand-green-dark" size={48} />
        <p className="text-brand-text-sub font-bold uppercase tracking-widest text-sm">
          Loading Exam Details...
        </p>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="text-center py-20 bg-brand-bg-card rounded-3xl border border-brand-border">
        <div className="h-20 w-20 rounded-full bg-brand-navy-500/5 flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={40} className="text-brand-text-muted" />
        </div>
        <h2 className="text-2xl font-bold text-brand-text-main">{error || 'Exam not found'}</h2>
        <Button
          variant="outline"
          className="mt-6 border-brand-border"
          onClick={() => navigate('/exams')}
        >
          <ArrowLeft size={18} className="rtl:-scale-x-100 mr-2" /> Back to Schedule
        </Button>
      </div>
    );
  }

  const calculateDuration = (start: string, end: string) => {
    if (!start || !end) return '';
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;
    const diff = endTotal - startTotal;
    if (diff <= 0) return '';
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes > 0 ? `${minutes} min${minutes > 1 ? 's' : ''}` : ''}`;
    }
    return `${minutes} min${minutes > 1 ? 's' : ''}`;
  };

  const getExamStatus = (examDate: string, startTime: string, endTime: string) => {
    const now = new Date();
    const datePart = examDate.split('T')[0];
    const startDateTime = new Date(`${datePart}T${startTime}:00`);
    const endDateTime = new Date(`${datePart}T${endTime}:00`);
    
    if (now < startDateTime) {
      return { label: 'Upcoming', variant: 'info' };
    } else if (now >= startDateTime && now <= endDateTime) {
      return { label: 'Ongoing', variant: 'warning' };
    } else {
      return { label: 'Completed', variant: 'success' };
    }
  };

  const formattedDate = new Date(exam.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const durationStr = calculateDuration(exam.startTime, exam.endTime);
  const statusInfo = getExamStatus(exam.date, exam.startTime, exam.endTime);

  return (
    <div className="section-gap animate-in fade-in duration-700">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-brand-bg-card p-6 rounded-3xl border border-brand-border shadow-soft">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/exams')}
            className="p-3 text-brand-text-sub hover:text-brand-green-dark hover:bg-brand-green-dark/10 rounded-2xl transition-all duration-300 group"
          >
            <ArrowLeft
              size={24}
              className="rtl:-scale-x-100 group-hover:-translate-x-1 transition-transform"
            />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-black text-brand-text-main">
                {exam.course?.name}
              </h1>
              <Badge variant={statusInfo.variant as any} className="px-3 py-1 font-bold">
                {statusInfo.label}
              </Badge>
            </div>
            <p className="text-sm text-brand-text-sub mt-1 font-bold">
              {exam.course?.courseCode} — {exam.type}
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="flex items-center gap-2 border-brand-border font-bold text-brand-green-dark hover:bg-brand-green-dark/10"
              onClick={() => navigate(`/exams/${id}/edit`)}
            >
              <Edit2 size={18} /> Edit Exam
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2 border-brand-border font-bold text-error hover:bg-error/10"
              onClick={() => setExamToDelete(id)}
            >
              <Trash2 size={18} /> Delete
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Exam Details" extra={<Calendar size={20} className="text-brand-green-dark" />} borderLeft={false}>
            <div className="p-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-brand-bg-page border border-brand-border">
                  <div className="p-3 bg-brand-green-dark/10 text-brand-green-dark rounded-xl">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-brand-text-sub uppercase tracking-wider">Date</p>
                    <p className="text-lg font-black text-brand-text-main mt-1">{formattedDate}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-brand-bg-page border border-brand-border">
                  <div className="p-3 bg-brand-green-dark/10 text-brand-green-dark rounded-xl">
                    <Clock size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-brand-text-sub uppercase tracking-wider">Duration</p>
                    <p className="text-lg font-black text-brand-text-main mt-1">{durationStr || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-brand-bg-page border border-brand-border">
                  <div className="p-3 bg-brand-green-dark/10 text-brand-green-dark rounded-xl">
                    <Clock size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-brand-text-sub uppercase tracking-wider">Time</p>
                    <p className="text-lg font-black text-brand-text-main mt-1">
                      {exam.startTime} – {exam.endTime}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-brand-bg-page border border-brand-border">
                  <div className="p-3 bg-brand-green-dark/10 text-brand-green-dark rounded-xl">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-brand-text-sub uppercase tracking-wider">Location / Room</p>
                    <p className="text-lg font-black text-brand-text-main mt-1">{exam.room || 'TBD'}</p>
                  </div>
                </div>
              </div>

              {isStudent && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200 rounded-2xl border border-blue-100 dark:border-blue-800">
                  <Info size={20} className="shrink-0" />
                  <p className="text-sm font-bold">
                    This is a scheduled exam. Check your schedule for room and time details.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {exam.examSession && (
            <Card title="Online Exam Component" extra={<ExternalLink size={20} className="text-brand-green-dark" />} borderLeft={false}>
              <div className="p-2 space-y-4">
                <div>
                  <h4 className="font-bold text-brand-text-main">{exam.examSession.title}</h4>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-bold text-brand-text-sub">Status:</span>
                    <Badge variant={exam.examSession.status === 'ACTIVE' ? 'success' : 'info'} className="text-[10px] font-black uppercase">
                      {exam.examSession.status}
                    </Badge>
                  </div>
                </div>
                <Button
                  onClick={() => navigate(`/exam-sessions/${exam.examSession.id}`)}
                  className="w-full mt-2 gap-2"
                >
                  Go to Online Exam <ExternalLink size={16} />
                </Button>
              </div>
            </Card>
          )}

          <Card title="Guidelines" extra={<FileText size={20} className="text-brand-green-dark" />} borderLeft={false}>
            <div className="prose prose-sm max-w-none space-y-4 pt-2">
              <div className="p-4 rounded-2xl bg-brand-bg-page border border-brand-border border-l-4 border-l-brand-green-dark">
                <h4 className="text-sm font-black text-brand-text-main mb-2">General Rules</h4>
                <ul className="space-y-2 text-xs font-bold text-brand-text-sub">
                  <li className="flex gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-brand-green-dark mt-1.5 shrink-0" />
                    Present a valid University ID card.
                  </li>
                  <li className="flex gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-brand-green-dark mt-1.5 shrink-0" />
                    Electronic devices must be powered off.
                  </li>
                  <li className="flex gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-brand-green-dark mt-1.5 shrink-0" />
                    Late entry allowed only in first 30 mins.
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={!!examToDelete}
        onClose={() => setExamToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Exam"
        confirmLabel="Delete Exam"
      />
    </div>
  );
};

export default ExamDetails;
