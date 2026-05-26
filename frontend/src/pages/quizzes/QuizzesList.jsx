import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import quizService from '../../services/quiz.service';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { BookOpen, Clock, Plus, HelpCircle, FileText, CheckCircle } from 'lucide-react';

const QuizzesList = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDoctor = user?.role === 'DOCTOR';
  const isStudent = user?.role === 'STUDENT';
  
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const result = await quizService.getQuizzes();
      if (result.success) {
        setQuizzes(result.data);
      }
    } catch (error) {
      showToast('Error fetching quizzes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto dark:bg-gray-900 transition-colors duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">{t('quizzes.title')}</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            {isDoctor ? t('quizzes.subtitleDoctor') : t('quizzes.subtitleStudent')}
          </p>
        </div>
        {isDoctor && (
          <button 
            onClick={() => navigate('/quizzes/create')}
            className="w-full sm:w-auto flex items-center justify-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition duration-150 shadow-sm"
          >
            <Plus size={18} className="mr-2" />
            {t('quizzes.createQuiz')}
          </button>
        )}
      </div>

      {toast && (
        <div className={`fixed top-20 right-4 z-50 p-4 rounded-md shadow-lg text-white transition-opacity duration-300 ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-dashed border-gray-300 dark:border-gray-700">
            {t('quizzes.noQuizzes')}
          </div>
        ) : (
          quizzes.map((quiz) => (
            <div key={quiz.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col transition-transform hover:scale-[1.01]">
              <div className="p-4 sm:p-5 flex-grow">
                <div className="flex justify-between items-start mb-3">
                  <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] sm:text-xs font-bold rounded uppercase tracking-wider">
                    {quiz.course?.courseCode}
                  </span>
                  <div className="flex items-center text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs">
                    <Clock size={14} className="mr-1" />
                    {quiz.duration} {t('quizzes.minutes')}
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white mb-2">{quiz.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mb-4 line-clamp-2">
                  {quiz.description || t('common.noData')}
                </p>
                
                <div className="space-y-2 text-[11px] sm:text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center">
                    <HelpCircle size={16} className="mr-2 text-gray-400 dark:text-gray-500" />
                    <span>{quiz._count?.questions || 0} {t('quizzes.questions')}</span>
                  </div>
                  <div className="flex items-center">
                    <BookOpen size={16} className="mr-2 text-gray-400 dark:text-gray-500" />
                    <span className="truncate">{quiz.course?.name}</span>
                  </div>
                </div>
              </div>
              <div className="px-4 sm:px-5 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 mt-auto">
                {isStudent ? (
                  <button 
                    onClick={() => navigate(`/quizzes/${quiz.id}/take`)}
                    className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition duration-150 flex items-center justify-center text-sm"
                  >
                    <FileText size={16} className="mr-2" />
                    {t('quizzes.takeQuiz')}
                  </button>
                ) : (
                  <button className="w-full border border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 py-2 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition duration-150 flex items-center justify-center text-sm">
                    <CheckCircle size={16} className="mr-2" />
                    {t('quizzes.viewSubmissions')}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default QuizzesList;
