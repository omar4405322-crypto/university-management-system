// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  BookOpen,
  User,
  Building2,
  FileText,
  ArrowLeft,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Download,
  Info,
  Plus,
  Trash2,
  Edit2,
  Users
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import examsService from '../../services/exams.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { logger } from '../../lib/logger';

const ExamDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    text: '',
    type: 'MCQ',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: '',
    points: 1
  });

  const isTeacher = user?.role === 'ADMIN' || user?.role === 'DOCTOR' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    fetchExamData();
  }, [id]);

  const fetchExamData = async () => {
    try {
      setLoading(true);
      const result = await examsService.getExamById(id);
      if (result.success) setExam(result.data);
      
      if (isTeacher) {
        const qRes = await examsService.getExamQuestions(id);
        if (qRes.success) setQuestions(qRes.data);
      }
    } catch (err: any) {
      setError('Exam details could not be loaded.');
      logger.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = async () => {
    try {
      const qRes = await examsService.addExamQuestion(id, newQuestion);
      if (qRes.success) {
        setQuestions([...questions, qRes.data]);
        setShowAddQuestion(false);
        setNewQuestion({ text: '', type: 'MCQ', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: '', points: 1 });
      }
    } catch (err) {
      alert('Failed to add question');
    }
  };

  const handleDeleteQuestion = async (qId) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      await examsService.deleteExamQuestion(qId);
      setQuestions(questions.filter(q => q.id !== qId));
    } catch (err) {
      alert('Failed to delete question');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin text-brand-primary-500" size={48} />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">
          Loading Exam Details...
        </p>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={40} className="text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{error || 'Exam not found'}</h2>
        <Button variant="outline" className="mt-6 border-slate-200 dark:border-slate-700" onClick={() => navigate('/exams')}>
          <ArrowLeft size={18} className="rtl:-scale-x-100 mr-2" /> Back to Schedule
        </Button>
      </div>
    );
  }

  const isUpcoming = new Date(exam.date) > new Date();

  return (
    <div className="section-gap animate-in fade-in duration-700 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate('/exams')}
            className="p-3 text-slate-400 hover:text-brand-primary-500 hover:bg-brand-primary-50 dark:hover:bg-brand-primary-900/20 rounded-2xl transition-all duration-300 group"
          >
            <ArrowLeft size={24} className="rtl:-scale-x-100 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100">{exam.course?.name}</h1>
              <Badge variant={exam.type === 'FINAL' ? 'danger' : 'info'} className="px-3 py-1 font-bold">
                {exam.type}
              </Badge>
            </div>
            <p className="text-lg text-slate-500 mt-1 font-bold">{exam.course?.courseCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isTeacher && (
            <Button
              onClick={() => navigate(`/exams/${id}/submissions`)}
              className="flex items-center gap-2 font-bold bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600 border-none"
            >
              <Users size={18} /> عرض إجابات الطلاب
            </Button>
          )}
          {isUpcoming && user?.role === 'STUDENT' && (
            <Button
              onClick={() => navigate(`/exams/${id}/take`)}
              className="flex items-center gap-2 shadow-xl shadow-brand-primary-500/20 font-bold bg-brand-primary-500 hover:bg-brand-primary-600 text-white"
            >
              <CheckCircle2 size={18} /> Enter Exam Portal
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card title="Exam Info" borderLeft={false}>
             <div className="space-y-4 pt-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-700/50">
                  <span className="text-slate-500 flex items-center gap-2 text-sm font-bold"><Calendar size={16}/> Date</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{new Date(exam.date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-700/50">
                  <span className="text-slate-500 flex items-center gap-2 text-sm font-bold"><Clock size={16}/> Time</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{exam.startTime} - {exam.endTime}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-700/50">
                  <span className="text-slate-500 flex items-center gap-2 text-sm font-bold"><Clock size={16}/> Duration</span>
                  <span className="font-bold text-brand-primary-500">{exam.durationMinutes} Min</span>
                </div>
             </div>
          </Card>
        </div>

        <div className="lg:col-span-2 xl:col-span-3 space-y-6">
          
          {isTeacher && (
            <Card
              title={t('exams.questionsManagement', 'Questions Management')}
              extra={
                <Button onClick={() => setShowAddQuestion(!showAddQuestion)} size="sm" className="bg-brand-primary-500 hover:bg-brand-primary-600 text-white rounded-lg flex items-center gap-2">
                  <Plus size={16} /> {t('exams.addQuestion', 'Add Question')}
                </Button>
              }
              borderLeft={false}
            >
              {showAddQuestion && (
                <div className="p-6 mb-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                  <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{t('exams.addQuestion', 'Add Question')}</h3>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">{t('exams.questionText', 'Question Text')}</label>
                    <textarea 
                      value={newQuestion.text} 
                      onChange={(e) => setNewQuestion({...newQuestion, text: e.target.value})}
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-primary-500 outline-none"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">{t('exams.questionType', 'Type')}</label>
                      <select 
                        value={newQuestion.type} 
                        onChange={(e) => setNewQuestion({...newQuestion, type: e.target.value})}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-primary-500 outline-none"
                      >
                        <option value="MCQ">{t('exams.mcq', 'Multiple Choice')}</option>
                        <option value="TRUE_FALSE">{t('exams.trueFalse', 'True/False')}</option>
                        <option value="SHORT_ANSWER">{t('exams.shortAnswer', 'Short Answer')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">{t('exams.points', 'Points')}</label>
                      <input 
                        type="number" 
                        value={newQuestion.points} 
                        onChange={(e) => setNewQuestion({...newQuestion, points: parseInt(e.target.value)})}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-primary-500 outline-none"
                      />
                    </div>
                  </div>

                  {newQuestion.type === 'MCQ' && (
                    <div className="grid grid-cols-2 gap-4">
                      {['A', 'B', 'C', 'D'].map(opt => (
                        <div key={opt}>
                          <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">Option {opt}</label>
                          <input 
                              value={newQuestion[`option${opt}` as keyof typeof newQuestion] as string} 
                              onChange={(e) => setNewQuestion({...newQuestion, [`option${opt}`]: e.target.value})}
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-primary-500 outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">{t('exams.correctAnswer', 'Correct Answer')}</label>
                    <input 
                      value={newQuestion.correctAnswer} 
                      onChange={(e) => setNewQuestion({...newQuestion, correctAnswer: e.target.value})}
                      placeholder={newQuestion.type === 'MCQ' ? 'A, B, C, or D' : newQuestion.type === 'TRUE_FALSE' ? 'true or false' : 'Keyword or exact answer'}
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-primary-500 outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="ghost" onClick={() => setShowAddQuestion(false)}>{t('common.cancel', 'Cancel')}</Button>
                    <Button onClick={handleAddQuestion} className="bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold rounded-xl">{t('common.save', 'Save')}</Button>
                  </div>
                </div>
              )}

              <div className="space-y-4 pt-2">
                {questions.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 border-dashed">
                    <FileText className="mx-auto text-slate-300 mb-3" size={32} />
                    <p className="text-slate-500 font-bold">{t('exams.noQuestions', 'No questions added yet')}</p>
                  </div>
                ) : (
                  questions.map((q, i) => (
                    <div key={q.id} className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex justify-between items-start group hover:border-brand-primary-500/50 transition-colors">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-black text-brand-primary-500">Q{i + 1}.</span>
                          <Badge variant="outline" className="text-xs">{q.type}</Badge>
                          <span className="text-xs font-bold text-slate-500">{q.points} Points</span>
                        </div>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{q.text}</p>
                        <p className="text-sm text-green-600 dark:text-green-400 font-bold mt-2">Ans: {q.correctAnswer}</p>
                      </div>
                      <button onClick={() => handleDeleteQuestion(q.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}

          <Card title="Exam Instructions & Guidelines" extra={<FileText size={20} className="text-brand-primary-500" />} borderLeft={false}>
            <div className="prose prose-sm max-w-none space-y-6 pt-2">
              <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 border-s-4 border-s-brand-primary-500">
                <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-3">General Rules</h4>
                <ul className="space-y-3">
                  <li className="flex gap-3 text-slate-600 dark:text-slate-400 font-bold leading-relaxed">
                    <div className="h-1.5 w-1.5 rounded-full bg-brand-primary-500 mt-2 shrink-0"></div>
                    Students must present a valid University ID card to enter the examination hall.
                  </li>
                  <li className="flex gap-3 text-slate-600 dark:text-slate-400 font-bold leading-relaxed">
                    <div className="h-1.5 w-1.5 rounded-full bg-brand-primary-500 mt-2 shrink-0"></div>
                    All electronic devices must be powered off.
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ExamDetails;
