import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import examsService from '../../services/exams.service';
import coursesService from '../../services/courses.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import useScope from '../../hooks/useScope';
import { Plus, Search, Calendar, Clock, MapPin, Filter, Trash2, Eye, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';

const AddExamModal = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    courseId: '',
    type: 'MIDTERM',
    date: '',
    startTime: '09:00',
    endTime: '11:00',
    room: '',
  });
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchCourses();
    }
  }, [isOpen]);

  const fetchCourses = async () => {
    try {
      const result = await coursesService.getCourses();
      if (result.success) {
        // Handle both old array format and new paginated object format
        const coursesData = Array.isArray(result.data) ? result.data : result.data.courses;
        setCourses(coursesData || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await examsService.createExam(formData);
      if (result.success) {
        onSuccess();
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || t('exams.createError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('exams.scheduleNew')}
      subtitle={t('exams.scheduleSubtitle')}
    >
      <form onSubmit={handleSubmit} className="form-section">
        {error && <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-bold">{error}</div>}
        
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-brand-text-main ml-1">{t('exams.selectCourse')} *</label>
          <select
            required
            className="w-full h-11 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer"
            value={formData.courseId}
            onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
          >
            <option value="">{t('exams.chooseCourse')}</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.courseCode} - {c.name}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-bold text-brand-text-main ml-1">{t('exams.examType')} *</label>
          <select
            required
            className="w-full h-11 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          >
            <option value="MIDTERM">{t('exams.midterm')}</option>
            <option value="FINAL">{t('exams.final')}</option>
            <option value="QUIZ">{t('exams.quiz')}</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-bold text-brand-text-main ml-1">Exam Date *</label>
          <Input
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main ml-1">Start Time *</label>
            <Input
              type="time"
              required
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main ml-1">End Time *</label>
            <Input
              type="time"
              required
              value={formData.endTime}
              onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-bold text-brand-text-main ml-1">Location / Room</label>
          <Input
            placeholder="e.g. Auditorium A, Hall 302"
            value={formData.room}
            onChange={(e) => setFormData({ ...formData, room: e.target.value })}
          />
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-brand-border pt-6">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading} className="min-w-[140px]">
            {loading ? 'Scheduling...' : 'Schedule Exam'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const ExamsList = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { scopeParams } = useScope();
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const params = { ...scopeParams };
      if (filter !== 'ALL') params.type = filter;
      if (upcomingOnly) params.upcoming = 'true';
      
      const result = await examsService.getExams(params);
      if (result.success) setExams(result.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [filter, upcomingOnly, scopeParams]);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this exam?')) {
      try {
        const result = await examsService.deleteExam(id);
        if (result.success) {
          showToast('Exam deleted successfully', 'success');
          fetchExams();
        }
      } catch (err) {
        showToast('Error deleting exam', 'error');
      }
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="section-gap animate-page">
      {/* Toast Notification */}
      {toast && (
        <div className={`${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <PageHeader 
        title={t('nav.exams')}
        subtitle="MIDTERMS, FINALS, AND UPCOMING ASSESSMENTS"
        action={isAdmin ? {
          label: t('nav.exams'),
          onClick: () => navigate('/exams/create')
        } : null}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Card noPadding className="border-none shadow-soft overflow-hidden">
            <div className="p-6 bg-surface-subtle dark:bg-slate-800/30 border-b border-brand-border dark:border-brand-border">
              <h3 className="text-sm font-black uppercase tracking-widest text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                <Filter size={16} className="text-brand-primary-500" />
                Filter Exams
              </h3>
            </div>
            <div className="p-4 space-y-1">
              {['ALL', 'MIDTERM', 'FINAL', 'QUIZ'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                    filter === type 
                    ? 'bg-brand-primary-500 text-white shadow-lg shadow-brand-primary-500/20' 
                    : 'text-brand-text-secondary hover:bg-brand-primary-50 dark:hover:bg-brand-primary-900/10 hover:text-brand-primary-500'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            
            <div className="p-6 border-t border-brand-border dark:border-brand-border">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="label-stat group-hover:text-brand-text-primary transition-colors">Upcoming Only</span>
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={upcomingOnly}
                    onChange={(e) => setUpcomingOnly(e.target.checked)}
                  />
                  <div className={`w-10 h-5 rounded-full transition-colors duration-300 ${upcomingOnly ? 'bg-brand-primary-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform duration-300 ${upcomingOnly ? 'translate-x-5' : ''}`} />
                </div>
              </label>
            </div>
          </Card>
        </div>

        {/* Exams Grid */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 className="animate-spin text-brand-primary-500" size="40" />
              <p className="label-stat">Fetching schedule...</p>
            </div>
          ) : exams.length === 0 ? (
            <EmptyState 
              icon={<Calendar size={48} />}
              title="No Exams Found"
              subtitle="There are no exams scheduled matching your criteria."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {exams.map((exam) => (
                <Card key={exam.id} noPadding className="group hover:-translate-y-1 duration-300 border-none shadow-soft overflow-hidden">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                      <Badge variant={exam.type === 'FINAL' ? 'danger' : exam.type === 'MIDTERM' ? 'warning' : 'primary'} className="px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                        {exam.type}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Calendar size={14} className="text-brand-text-muted" />
                        <span className="label-stat">
                          {new Date(exam.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-xl font-black text-brand-text-primary dark:text-brand-text-main tracking-tight mb-2 group-hover:text-brand-primary-500 transition-colors">
                      {exam.course?.name}
                    </h3>
                    <p className="text-caption text-brand-primary-500 mb-6">
                      {exam.course?.courseCode}
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-subtle dark:bg-slate-800/50">
                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-brand-primary-500">
                          <Clock size={16} />
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-brand-text-muted uppercase tracking-widest">Time</p>
                          <p className="text-xs font-black text-brand-text-primary dark:text-brand-text-main">{exam.startTime} - {exam.endTime}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-subtle dark:bg-slate-800/50">
                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-brand-accent-yellow">
                          <MapPin size={16} />
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-brand-text-muted uppercase tracking-widest">Room</p>
                          <p className="text-xs font-black text-brand-text-primary dark:text-brand-text-main truncate max-w-[80px]">{exam.room || 'TBA'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-4 bg-surface-subtle dark:bg-slate-800/30 border-t border-brand-border dark:border-brand-border flex justify-between items-center">
                    <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-widest" onClick={() => navigate(`/exams/${exam.id}`)}>
                      View Details
                    </Button>
                    {isSuperAdmin && (
                      <div className="flex gap-1">
                        <button 
                          onClick={() => handleDelete(exam.id)}
                          className="p-2 rounded-lg text-brand-text-muted hover:text-error hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <AddExamModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchExams} 
      />
    </div>
  );
};

export default ExamsList;
