import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { examSessionService, ExamSession, ExamQuestion, ExamSubmission } from '../../services/examSession.service';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/PageHeader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import { useToast } from '../../context/ToastContext';
import { Clock, Plus, Trash2, Edit2, CheckCircle, FileText, LayoutList, Users, Settings } from 'lucide-react';
import AddQuestionModal from './modals/AddQuestionModal';
import GradeSubmissionModal from './modals/GradeSubmissionModal';

const ExamSessionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const isDoctorOrAdmin = ['DOCTOR', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'].includes(user?.role || '');

  const [session, setSession] = useState<ExamSession | null>(null);
  const [submissions, setSubmissions] = useState<ExamSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'QUESTIONS' | 'SUBMISSIONS' | 'SETTINGS'>('QUESTIONS');
  
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [gradeModalData, setGradeModalData] = useState<ExamSubmission | null>(null);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState<Partial<ExamSession>>({});

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await examSessionService.getById(Number(id));
      setSession(data);
      setSettingsForm(data);
      
      if (activeTab === 'SUBMISSIONS') {
        const subs = await examSessionService.getSubmissions(Number(id));
        setSubmissions(subs);
      }
    } catch (error) {
      showToast('Failed to fetch session details', 'error');
      navigate('/exam-sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isDoctorOrAdmin) {
      navigate('/exam-sessions');
      return;
    }
    fetchData();
  }, [id, activeTab]);

  const handleStatusChange = async (newStatus: string) => {
    try {
      await examSessionService.updateStatus(Number(id), newStatus);
      showToast(`Status updated to ${newStatus}`, 'success');
      fetchData();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  const handleDeleteQuestion = async (qId: number) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      await examSessionService.deleteQuestion(Number(id), qId);
      showToast('Question deleted', 'success');
      fetchData();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to delete question', 'error');
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await examSessionService.update(Number(id), {
        title: settingsForm.title,
        instructions: settingsForm.instructions,
        durationMinutes: settingsForm.durationMinutes,
        totalPoints: settingsForm.totalPoints,
        passingScore: settingsForm.passingScore,
        shuffleQuestions: settingsForm.shuffleQuestions,
        showResultsAfter: settingsForm.showResultsAfter,
        opensAt: settingsForm.opensAt ? new Date(settingsForm.opensAt).toISOString() : undefined,
        closesAt: settingsForm.closesAt ? new Date(settingsForm.closesAt).toISOString() : undefined,
      });
      showToast('Settings updated successfully', 'success');
      fetchData();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to update settings', 'error');
    }
  };

  if (loading && !session) {
    return <div className="section-gap flex justify-center py-24"><span className="loader"></span></div>;
  }

  if (!session) return null;

  return (
    <div className="section-gap animate-page">
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-black text-brand-text-primary dark:text-white">
              {session.title}
            </h1>
            <Badge className={`uppercase tracking-widest text-xs font-black ${
              session.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 
              session.status === 'PUBLISHED' ? 'bg-blue-100 text-blue-700' :
              session.status === 'CLOSED' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {session.status}
            </Badge>
          </div>
          <p className="text-brand-text-secondary font-bold">
            {session.course?.courseCode} - {session.course?.name} | Exam Date: {session.exam ? new Date(session.exam.date).toLocaleDateString() : 'N/A'}
          </p>
        </div>

        <div className="flex gap-2">
          {session.status === 'DRAFT' && (
            <Button onClick={() => handleStatusChange('PUBLISHED')} className="bg-blue-600 hover:bg-blue-700">
              Publish
            </Button>
          )}
          {session.status === 'PUBLISHED' && (
             <Button onClick={() => handleStatusChange('ACTIVE')} className="bg-green-600 hover:bg-green-700">
               Set Active
             </Button>
          )}
          {session.status === 'ACTIVE' && (
             <Button onClick={() => handleStatusChange('CLOSED')} className="bg-red-600 hover:bg-red-700">
               Close Session
             </Button>
          )}
          {session.status === 'CLOSED' && (
             <Button onClick={() => handleStatusChange('GRADED')} className="bg-purple-600 hover:bg-purple-700">
               Mark as Graded
             </Button>
          )}
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="flex items-center gap-4 p-5 bg-brand-bg-card rounded-2xl border border-brand-border">
          <div className="p-3 bg-brand-green-dark/10 text-brand-green-dark rounded-xl">
            <LayoutList size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-brand-text-sub uppercase tracking-wider">Total Questions</p>
            <p className="text-2xl font-black text-brand-text-main mt-1">
              {session.questions?.length || 0}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-5 bg-brand-bg-card rounded-2xl border border-brand-border">
          <div className="p-3 bg-brand-green-dark/10 text-brand-green-dark rounded-xl">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-brand-text-sub uppercase tracking-wider">Total Points</p>
            <p className="text-2xl font-black text-brand-text-main mt-1">
              {session.questions?.reduce((sum, q) => sum + (q.points || 0), 0) || 0}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-5 bg-brand-bg-card rounded-2xl border border-brand-border">
          <div className="p-3 bg-brand-green-dark/10 text-brand-green-dark rounded-xl">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-brand-text-sub uppercase tracking-wider">Duration</p>
            <p className="text-2xl font-black text-brand-text-main mt-1">
              {session.durationMinutes} Mins
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-8 border-b border-slate-200 dark:border-slate-700 pb-2">
        <button
          onClick={() => setActiveTab('QUESTIONS')}
          className={`flex items-center gap-2 px-4 py-2 font-bold transition-colors ${activeTab === 'QUESTIONS' ? 'text-brand-green-dark border-b-2 border-brand-green-dark' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <LayoutList size={18} /> Questions ({session.questions?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('SUBMISSIONS')}
          className={`flex items-center gap-2 px-4 py-2 font-bold transition-colors ${activeTab === 'SUBMISSIONS' ? 'text-brand-green-dark border-b-2 border-brand-green-dark' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Users size={18} /> Submissions ({session._count?.submissions || 0})
        </button>
        <button
          onClick={() => setActiveTab('SETTINGS')}
          className={`flex items-center gap-2 px-4 py-2 font-bold transition-colors ${activeTab === 'SETTINGS' ? 'text-brand-green-dark border-b-2 border-brand-green-dark' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Settings size={18} /> Settings
        </button>
      </div>

      {activeTab === 'QUESTIONS' && (
        <div className="space-y-6">
          <div className="flex justify-end">
             {['DRAFT', 'PUBLISHED'].includes(session.status) && (
                <Button onClick={() => setShowAddQuestion(true)} className="gap-2">
                  <Plus size={16} /> Add Question
                </Button>
             )}
          </div>

          {session.questions?.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No questions added yet.
            </div>
          ) : (
            <div className="space-y-4">
              {session.questions?.map((q, idx) => (
                <Card key={q.id} noPadding className="p-6 border-none shadow-sm rounded-2xl flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                     <div className="flex items-center gap-3 mb-2">
                       <span className="w-8 h-8 rounded-full bg-surface-subtle flex items-center justify-center font-black text-brand-green-dark text-sm">
                         {idx + 1}
                       </span>
                       <Badge className="bg-slate-100 text-slate-700 border-none uppercase tracking-widest text-[10px]">{q.type}</Badge>
                       <span className="text-sm font-bold text-brand-text-muted">{q.points} Points</span>
                     </div>
                     <h4 className="text-lg font-bold text-brand-text-primary dark:text-white mt-2 mb-4">{q.text}</h4>
                     
                     {q.type === 'MCQ' && (
                       <div className="grid grid-cols-2 gap-2 text-sm text-brand-text-secondary">
                         <div className={`p-2 rounded-lg ${q.correctAnswer === 'A' ? 'bg-green-50 text-green-700 font-bold' : 'bg-slate-50 dark:bg-slate-800'}`}>A: {q.optionA}</div>
                         <div className={`p-2 rounded-lg ${q.correctAnswer === 'B' ? 'bg-green-50 text-green-700 font-bold' : 'bg-slate-50 dark:bg-slate-800'}`}>B: {q.optionB}</div>
                         <div className={`p-2 rounded-lg ${q.correctAnswer === 'C' ? 'bg-green-50 text-green-700 font-bold' : 'bg-slate-50 dark:bg-slate-800'}`}>C: {q.optionC}</div>
                         <div className={`p-2 rounded-lg ${q.correctAnswer === 'D' ? 'bg-green-50 text-green-700 font-bold' : 'bg-slate-50 dark:bg-slate-800'}`}>D: {q.optionD}</div>
                       </div>
                     )}
                     {q.type === 'TRUE_FALSE' && (
                        <p className="text-sm font-bold text-green-600">Correct Answer: {q.correctAnswer === 'TRUE' ? 'True' : 'False'}</p>
                     )}
                     {q.type === 'ESSAY' && (
                        <p className="text-sm text-slate-500">Max Words: {q.maxWords || 'No limit'}</p>
                     )}
                     {q.type === 'FILE_UPLOAD' && (
                        <p className="text-sm text-slate-500">Allowed Types: {q.allowedFileTypes || 'Any'}</p>
                     )}
                  </div>
                  
                  {['DRAFT', 'PUBLISHED'].includes(session.status) && (
                    <div className="flex md:flex-col gap-2 shrink-0">
                      <Button variant="outline" onClick={() => handleDeleteQuestion(q.id)} className="border-red-200 text-red-600 hover:bg-red-50 p-2">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'SUBMISSIONS' && (
        <Card noPadding className="border-none shadow-sm rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-subtle dark:bg-slate-800/50">
                  <th className="p-4 text-xs font-black uppercase tracking-widest text-brand-text-muted">Student</th>
                  <th className="p-4 text-xs font-black uppercase tracking-widest text-brand-text-muted">Status</th>
                  <th className="p-4 text-xs font-black uppercase tracking-widest text-brand-text-muted">Score</th>
                  <th className="p-4 text-xs font-black uppercase tracking-widest text-brand-text-muted">Submitted At</th>
                  <th className="p-4 text-xs font-black uppercase tracking-widest text-brand-text-muted text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">No submissions yet.</td>
                  </tr>
                ) : (
                  submissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-green-dark text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {sub.student?.firstName?.[0]}{sub.student?.lastName?.[0]}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-brand-text-primary dark:text-white">
                              {sub.student?.firstName} {sub.student?.lastName}
                            </p>
                            <p className="text-xs text-brand-text-muted">{sub.student?.studentId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge className={`text-[10px] font-black uppercase border-none ${
                          sub.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-700' :
                          sub.status === 'GRADED' ? 'bg-green-100 text-green-700' :
                          sub.status === 'LATE' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {sub.status}
                        </Badge>
                      </td>
                      <td className="p-4 font-black">{sub.totalScore || 0} <span className="text-xs text-slate-400">/ {session.totalPoints}</span></td>
                      <td className="p-4 text-sm text-slate-500">
                        {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : '-'}
                      </td>
                      <td className="p-4 text-right">
                        {(sub.status === 'SUBMITTED' || sub.status === 'LATE' || sub.status === 'GRADED') && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs py-1"
                            onClick={() => setGradeModalData(sub)}
                          >
                            {sub.status === 'GRADED' ? 'Review Grade' : 'Grade'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'SETTINGS' && (
        <Card className="max-w-3xl border-none shadow-sm rounded-3xl p-8">
           <form onSubmit={handleUpdateSettings} className="space-y-6">
              <Input
                label="Session Title *"
                value={settingsForm.title || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, title: e.target.value })}
                required
                disabled={['ACTIVE', 'CLOSED', 'GRADED'].includes(session.status)}
              />

              <div className="space-y-2">
                <label className="text-sm font-bold text-brand-text-primary">Instructions</label>
                <textarea 
                  className="w-full p-3 rounded-xl border border-slate-200 bg-transparent disabled:opacity-50"
                  rows={4}
                  value={settingsForm.instructions || ''}
                  onChange={(e) => setSettingsForm({ ...settingsForm, instructions: e.target.value })}
                  disabled={['ACTIVE', 'CLOSED', 'GRADED'].includes(session.status)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Input
                  type="number"
                  label="Duration (mins) *"
                  min={5}
                  max={360}
                  value={settingsForm.durationMinutes || 60}
                  onChange={(e) => setSettingsForm({ ...settingsForm, durationMinutes: Number(e.target.value) })}
                  required
                  disabled={['ACTIVE', 'CLOSED', 'GRADED'].includes(session.status)}
                />
                <Input
                  type="number"
                  label="Total Points *"
                  min={1}
                  value={settingsForm.totalPoints || 100}
                  onChange={(e) => setSettingsForm({ ...settingsForm, totalPoints: Number(e.target.value) })}
                  required
                  disabled={['ACTIVE', 'CLOSED', 'GRADED'].includes(session.status)}
                />
                <Input
                  type="number"
                  label="Passing Score *"
                  min={0}
                  max={100}
                  value={settingsForm.passingScore || 50}
                  onChange={(e) => setSettingsForm({ ...settingsForm, passingScore: Number(e.target.value) })}
                  required
                  disabled={['ACTIVE', 'CLOSED', 'GRADED'].includes(session.status)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  type="datetime-local"
                  label="Opens At"
                  // input expects YYYY-MM-DDThh:mm format, so slice the Z off
                  value={settingsForm.opensAt ? new Date(settingsForm.opensAt).toISOString().slice(0,16) : ''}
                  onChange={(e) => setSettingsForm({ ...settingsForm, opensAt: e.target.value })}
                  disabled={['ACTIVE', 'CLOSED', 'GRADED'].includes(session.status)}
                />
                <Input
                  type="datetime-local"
                  label="Closes At"
                  value={settingsForm.closesAt ? new Date(settingsForm.closesAt).toISOString().slice(0,16) : ''}
                  onChange={(e) => setSettingsForm({ ...settingsForm, closesAt: e.target.value })}
                  disabled={['ACTIVE', 'CLOSED', 'GRADED'].includes(session.status)}
                />
              </div>

              <div className="flex gap-8 border-t border-slate-200 dark:border-slate-700 pt-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={settingsForm.shuffleQuestions || false}
                    onChange={(e) => setSettingsForm({ ...settingsForm, shuffleQuestions: e.target.checked })}
                    className="w-5 h-5 text-brand-green-dark rounded focus:ring-brand-green-dark"
                    disabled={['ACTIVE', 'CLOSED', 'GRADED'].includes(session.status)}
                  />
                  <span className="font-bold text-brand-text-primary dark:text-white">Shuffle Questions</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={settingsForm.showResultsAfter || false}
                    onChange={(e) => setSettingsForm({ ...settingsForm, showResultsAfter: e.target.checked })}
                    className="w-5 h-5 text-brand-green-dark rounded focus:ring-brand-green-dark"
                    disabled={['ACTIVE', 'CLOSED', 'GRADED'].includes(session.status)}
                  />
                  <span className="font-bold text-brand-text-primary dark:text-white">Show Results After</span>
                </label>
              </div>

              {!['ACTIVE', 'CLOSED', 'GRADED'].includes(session.status) && (
                 <div className="flex justify-end pt-4">
                   <Button type="submit">Save Changes</Button>
                 </div>
              )}
           </form>
        </Card>
      )}

      {/* Modals */}
      <AddQuestionModal 
        isOpen={showAddQuestion} 
        onClose={() => setShowAddQuestion(false)} 
        onSuccess={fetchData}
        sessionId={Number(id)}
      />

      <GradeSubmissionModal
        isOpen={Boolean(gradeModalData)}
        onClose={() => setGradeModalData(null)}
        onSuccess={fetchData}
        submission={gradeModalData}
      />
    </div>
  );
};

export default ExamSessionDetail;
