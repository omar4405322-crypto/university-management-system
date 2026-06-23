import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { examSessionService, ExamSession } from '../../services/examSession.service';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { BookOpen, Clock, HelpCircle, FileText, Settings, Loader2 } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../context/ToastContext';
import CreateExamSessionModal from './modals/CreateExamSessionModal';

const ExamSessionsList = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isStudent = user?.role === 'STUDENT';
  const isDoctorOrAdmin = ['DOCTOR', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'].includes(user?.role || '');

  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { showToast } = useToast();

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const data = await examSessionService.getAll();
      setSessions(data);
    } catch (_error) {
      showToast('Error fetching exam sessions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const filteredSessions = sessions.filter(session => {
    if (filterStatus === 'ALL') return true;
    return session.status === filterStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-500 text-white';
      case 'PUBLISHED': return 'bg-blue-500 text-white';
      case 'ACTIVE': return 'bg-green-500 text-white';
      case 'CLOSED': return 'bg-red-500 text-white';
      case 'GRADED': return 'bg-purple-500 text-white';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  return (
    <div className="section-gap animate-page">
      <PageHeader
        title="Exam Sessions"
        subtitle={isStudent ? "View and take your exams" : "Manage online exam sessions"}
        action={
          isDoctorOrAdmin
            ? {
                label: "Create Exam Session",
                onClick: () => setShowCreateModal(true),
              }
            : undefined
        }
      />

      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {['ALL', 'DRAFT', 'PUBLISHED', 'ACTIVE', 'CLOSED', 'GRADED'].map(status => (
           // Only show DRAFT to non-students
           (isStudent && status === 'DRAFT') ? null : (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-colors whitespace-nowrap ${
                filterStatus === status 
                  ? 'bg-brand-navy-500 text-white' 
                  : 'bg-surface-subtle text-brand-text-secondary hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {status}
            </button>
           )
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="animate-spin text-brand-green-dark" size={48} />
            <p className="label-stat">Loading exam sessions...</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              icon={<BookOpen size={48} />}
              title="No Exam Sessions Found"
              subtitle="There are currently no exam sessions matching your criteria."
            />
          </div>
        ) : (
          filteredSessions.map((session) => (
            <Card
              key={session.id}
              noPadding
              className="group hover:-translate-y-2 duration-500 border-none shadow-soft rounded-[2rem] overflow-hidden flex flex-col"
            >
              <div className="p-8 flex-grow">
                <div className="flex justify-between items-start mb-6">
                  <Badge className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest border-none ${getStatusColor(session.status)}`}>
                    {session.status}
                  </Badge>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-surface-subtle dark:bg-slate-800/50">
                    <Clock size={14} className="text-brand-green-dark" />
                    <span className="text-[10px] font-black text-brand-text-primary dark:text-brand-text-main uppercase tracking-widest">
                      {session.durationMinutes} min
                    </span>
                  </div>
                </div>

                <h3 className="text-2xl font-black text-brand-text-primary dark:text-brand-text-main tracking-tight mb-1 group-hover:text-brand-green-dark transition-colors">
                  {session.title}
                </h3>
                <p className="text-sm font-bold text-brand-text-secondary mb-4 opacity-80">
                  {session.course?.courseCode} - {session.course?.name}
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-subtle dark:bg-slate-800/50">
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-brand-green-dark">
                      <HelpCircle size={16} />
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-brand-text-muted uppercase tracking-widest">
                        Questions
                      </p>
                      <p className="text-xs font-black text-brand-text-primary dark:text-brand-text-main">
                        {session._count?.questions || 0}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-subtle dark:bg-slate-800/50">
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-brand-accent-emerald">
                      <FileText size={16} />
                    </div>
                    <div className="truncate">
                      <p className="text-[8px] font-black text-brand-text-muted uppercase tracking-widest">
                        Points
                      </p>
                      <p className="text-xs font-black text-brand-text-primary dark:text-brand-text-main">
                        {session.totalPoints}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-8 py-5 bg-surface-subtle dark:bg-slate-800/30 border-t border-brand-border dark:border-brand-border mt-auto">
                {isStudent ? (
                  <div className="flex gap-2">
                    {session.status === 'ACTIVE' && (
                      <Button
                        onClick={() => navigate(`/exam-sessions/${session.id}/take`)}
                        className="flex-1 text-[10px] font-black uppercase tracking-widest py-3.5 gap-2 shadow-lg"
                      >
                        Start Exam
                      </Button>
                    )}
                    {(session.status === 'GRADED' && session.showResultsAfter) && (
                       <Button
                       variant="outline"
                       onClick={() => navigate(`/exam-sessions/${session.id}/result`)}
                       className="flex-1 text-[10px] font-black uppercase tracking-widest py-3.5 gap-2 border-slate-200"
                     >
                       View Result
                     </Button>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full text-[10px] font-black uppercase tracking-widest py-3.5 gap-2 border-slate-200"
                    onClick={() => navigate(`/exam-sessions/${session.id}`)}
                  >
                    <Settings size={16} />
                    Manage Session
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      <CreateExamSessionModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchSessions}
      />
    </div>
  );
};

export default ExamSessionsList;
