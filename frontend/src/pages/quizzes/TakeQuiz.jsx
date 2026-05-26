import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import quizService from '../../services/quiz.service';
import { Clock, CheckCircle, AlertCircle, ChevronRight, ChevronLeft, Send } from 'lucide-react';

const TakeQuiz = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { questionId: answer }
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);

  const fetchQuiz = useCallback(async () => {
    try {
      setLoading(true);
      const res = await quizService.getQuizById(id);
      if (res.success) {
        setQuiz(res.data);
        setTimeLeft(res.data.duration * 60);
        if (res.data.hasSubmitted) {
          setSubmitted(true);
          // If already submitted, we might want to fetch results or just show message
        }
      }
    } catch (error) {
      alert('Error loading quiz');
      navigate('/quizzes');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  const handleSubmit = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    try {
      const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => ({
        questionId: parseInt(questionId),
        answer
      }));
      const res = await quizService.submitQuiz(id, formattedAnswers);
      if (res.success) {
        setResult(res.data);
        setSubmitted(true);
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Error submitting quiz');
    } finally {
      setSubmitting(false);
    }
  }, [id, answers, submitting, submitted]);

  useEffect(() => {
    if (timeLeft <= 0 || submitted) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, submitted, handleSubmit]);

  const handleAnswerSelect = (questionId, option) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [questionId]: option }));
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  if (submitted && result) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-8 bg-white rounded-2xl shadow-lg text-center">
        <div className="bg-green-100 text-green-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={48} />
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Quiz Submitted!</h1>
        <p className="text-gray-600 mb-8">Your results are being processed or are shown below.</p>
        
        <div className="bg-gray-50 rounded-xl p-6 mb-8 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 uppercase font-bold">Your Score</p>
            <p className="text-3xl font-bold text-blue-600">{result.score} / {result.totalPoints}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase font-bold">Percentage</p>
            <p className="text-3xl font-bold text-blue-600">
              {Math.round((result.score / result.totalPoints) * 100)}%
            </p>
          </div>
        </div>

        <button 
          onClick={() => navigate('/quizzes')}
          className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
        >
          Back to Quizzes
        </button>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <h1 className="font-bold text-gray-800 truncate max-w-[200px] md:max-w-none">{quiz.title}</h1>
          <div className={`flex items-center px-4 py-2 rounded-lg font-mono font-bold ${timeLeft < 60 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-blue-50 text-blue-600'}`}>
            <Clock size={18} className="mr-2" />
            {formatTime(timeLeft)}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto mt-8 px-6">
        <div className="mb-6 flex justify-between items-center text-sm text-gray-500">
          <span>Question {currentQuestionIndex + 1} of {quiz.questions.length}</span>
          <div className="flex space-x-1">
            {quiz.questions.map((_, i) => (
              <div 
                key={i} 
                className={`w-2 h-2 rounded-full ${
                  i === currentQuestionIndex ? 'bg-blue-600' : 
                  answers[quiz.questions[i].id] ? 'bg-green-400' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-xl font-bold text-gray-800 mb-8">{currentQuestion.text}</h2>
          
          <div className="space-y-4">
            {['A', 'B', 'C', 'D'].map((opt) => {
              const optionKey = `option${opt}`;
              const isSelected = answers[currentQuestion.id] === opt;
              return (
                <button
                  key={opt}
                  onClick={() => handleAnswerSelect(currentQuestion.id, opt)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center ${
                    isSelected 
                      ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' 
                      : 'border-gray-100 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold mr-4 ${
                    isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {opt}
                  </span>
                  <span className="font-medium">{currentQuestion[optionKey]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex justify-between items-center">
          <button
            onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
            className="flex items-center px-6 py-2 rounded-xl font-bold text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={20} className="mr-1" /> Previous
          </button>
          
          {isLastQuestion ? (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to submit your quiz?')) {
                  handleSubmit();
                }
              }}
              disabled={submitting}
              className="flex items-center px-8 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-200 disabled:opacity-50 transition-all"
            >
              {submitting ? 'Submitting...' : (
                <span className="flex items-center">
                  Submit Quiz <Send size={18} className="ml-2" />
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={() => setCurrentQuestionIndex(prev => Math.min(quiz.questions.length - 1, prev + 1))}
              className="flex items-center px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
            >
              Next <ChevronRight size={20} className="ml-1" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TakeQuiz;
