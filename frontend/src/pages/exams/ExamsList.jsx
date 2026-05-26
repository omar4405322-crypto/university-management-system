import React, { useState, useEffect } from 'react';
import examsService from '../../services/exams.service';
import coursesService from '../../services/courses.service';
import { useAuth } from '../../context/AuthContext';
import { Plus, Search, Calendar, Clock, MapPin, Filter, Trash2 } from 'lucide-react';

const AddExamModal = ({ isOpen, onClose, onSuccess }) => {
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
      if (result.success) setCourses(result.data);
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
      setError(err.response?.data?.message || 'Error creating exam');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Add Exam</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm border border-red-200 dark:border-red-800">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course *</label>
            <select
              required
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
              value={formData.courseId}
              onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
            >
              <option value="">Select Course</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.courseCode} - {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exam Type *</label>
            <select
              required
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="MIDTERM">Midterm</option>
              <option value="FINAL">Final</option>
              <option value="QUIZ">Quiz</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
            <input
              type="date"
              required
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Time *</label>
              <input
                type="time"
                required
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Time *</label>
              <input
                type="time"
                required
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room</label>
            <input
              type="text"
              placeholder="e.g. Hall A"
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
              value={formData.room}
              onChange={(e) => setFormData({ ...formData, room: e.target.value })}
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300">
              {loading ? 'Adding...' : 'Add Exam'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ExamsList = () => {
  const { user } = useAuth();
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
      const params = {};
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
  }, [filter, upcomingOnly]);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this exam?')) {
      try {
        const result = await examsService.deleteExam(id);
        if (result.success) {
          setToast({ message: 'Exam deleted successfully', type: 'success' });
          fetchExams();
          setTimeout(() => setToast(null), 3000);
        }
      } catch (err) {
        setToast({ message: 'Error deleting exam', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    }
  };

  const getTypeStyles = (type) => {
    switch (type) {
      case 'MIDTERM': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'FINAL': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'QUIZ': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600';
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto dark:bg-gray-900 transition-colors duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Exams Schedule</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Upcoming midterms, finals and quizzes</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition duration-150"
          >
            <Plus size={18} className="mr-2" />
            Add Exam
          </button>
        )}
      </div>

      {toast && (
        <div className={`fixed top-20 right-4 z-50 p-4 rounded-md shadow-lg text-white ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.message}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700 flex flex-col lg:flex-row justify-between items-center gap-4">
          <div className="flex w-full lg:w-auto bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-md overflow-hidden">
            {['ALL', 'MIDTERM', 'FINAL', 'QUIZ'].map(t => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`flex-1 lg:flex-none px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
                  filter === t ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <label className="flex items-center cursor-pointer self-start lg:self-center">
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={upcomingOnly}
                onChange={() => setUpcomingOnly(!upcomingOnly)}
              />
              <div className={`block w-10 h-6 rounded-full transition-colors ${upcomingOnly ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
              <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${upcomingOnly ? 'translate-x-4' : ''}`}></div>
            </div>
            <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">Upcoming Only</span>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs uppercase font-medium">
              <tr>
                <th className="px-4 sm:px-6 py-4">Course</th>
                <th className="px-4 sm:px-6 py-4">Type</th>
                <th className="px-4 sm:px-6 py-4">Date & Time</th>
                <th className="px-4 sm:px-6 py-4 hidden md:table-cell">Room</th>
                {isAdmin && <th className="px-4 sm:px-6 py-4">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="px-4 sm:px-6 py-10 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  </td>
                </tr>
              ) : exams.length > 0 ? (
                exams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 sm:px-6 py-4">
                      <div className="font-bold text-sm sm:text-base text-gray-800 dark:text-white line-clamp-1">{exam.course.name}</div>
                      <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{exam.course.courseCode}</div>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <span className={`px-2 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold border ${getTypeStyles(exam.type)}`}>
                        {exam.type}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                      <div className="flex items-center mb-1">
                        <Calendar size={12} className="mr-1 text-gray-400 shrink-0" />
                        <span className="truncate">{new Date(exam.date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock size={12} className="mr-1 text-gray-400 shrink-0" />
                        <span className="truncate">{exam.startTime} - {exam.endTime}</span>
                      </div>
                      {/* Show room on mobile under date/time since it's hidden from columns */}
                      <div className="flex items-center mt-1 md:hidden">
                        <MapPin size={12} className="mr-1 text-gray-400 shrink-0" />
                        <span className="truncate">{exam.room || 'TBA'}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-600 dark:text-gray-300 font-medium hidden md:table-cell">
                      <div className="flex items-center">
                        <MapPin size={14} className="mr-1 text-gray-400" />
                        {exam.room || 'TBA'}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-4 sm:px-6 py-4">
                        <button 
                          onClick={() => handleDelete(exam.id)}
                          className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                        >
                          <Trash2 size={16} sm:size={18} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="px-4 sm:px-6 py-10 text-center text-gray-500 dark:text-gray-400 italic text-sm">
                    No exams found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
