import React, { useState, useEffect } from 'react';
import taskService from '../../services/task.service';
import coursesService from '../../services/courses.service';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Calendar, Plus, FileUp, CheckCircle, Clock, X, Send } from 'lucide-react';

const TasksList = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isDoctor = user?.role === 'DOCTOR';
  const isStudent = user?.role === 'STUDENT';
  
  const [tasks, setTasks] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [createFormData, setCreateFormData] = useState({
    title: '',
    description: '',
    courseId: '',
    dueDate: '',
    maxScore: 100
  });

  const [submitFormData, setSubmitFormData] = useState({
    notes: '',
    fileUrl: ''
  });

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const result = await taskService.getTasks();
      if (result.success) {
        setTasks(result.data);
      }
    } catch (error) {
      showToast('Error fetching tasks', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const result = await coursesService.getCourses();
      if (result.success) {
        setCourses(result.data);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  useEffect(() => {
    fetchTasks();
    if (isDoctor) fetchCourses();
  }, [isDoctor]);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const isOverdue = (dueDate) => {
    return new Date(dueDate) < new Date();
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await taskService.createTask(createFormData);
      if (result.success) {
        showToast('Assignment created successfully', 'success');
        setShowCreateModal(false);
        setCreateFormData({ title: '', description: '', courseId: '', dueDate: '', maxScore: 100 });
        fetchTasks();
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Error creating assignment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitTask = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await taskService.submitTask(selectedTask.id, submitFormData);
      if (result.success) {
        showToast('Assignment submitted successfully', 'success');
        setShowSubmitModal(false);
        setSubmitFormData({ notes: '', fileUrl: '' });
        fetchTasks();
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Error submitting assignment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto dark:bg-gray-900 transition-colors duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">{t('tasks.title')}</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            {isDoctor ? t('tasks.subtitleDoctor') : t('tasks.subtitleStudent')}
          </p>
        </div>
        {isDoctor && (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto flex items-center justify-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition duration-150 shadow-sm"
          >
            <Plus size={18} className="mr-2" />
            {t('tasks.createTask')}
          </button>
        )}
      </div>

      {toast && (
        <div className={`fixed top-20 right-4 z-50 p-4 rounded-md shadow-lg text-white transition-opacity duration-300 ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.message}
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border dark:border-gray-700">
            <div className="p-4 sm:p-6 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">{t('tasks.createTask')}</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('auth.title')}</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                  value={createFormData.title}
                  onChange={(e) => setCreateFormData({...createFormData, title: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.bio')}</label>
                <textarea
                  required
                  rows="3"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                  value={createFormData.description}
                  onChange={(e) => setCreateFormData({...createFormData, description: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('nav.courses')}</label>
                  <select
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                    value={createFormData.courseId}
                    onChange={(e) => setCreateFormData({...createFormData, courseId: e.target.value})}
                  >
                    <option value="">{t('courses.assignedDoctor')}</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('tasks.maxPoints')}</label>
                  <input
                    type="number"
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                    value={createFormData.maxScore}
                    onChange={(e) => setCreateFormData({...createFormData, maxScore: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('tasks.due')}</label>
                <input
                  type="datetime-local"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                  value={createFormData.dueDate}
                  onChange={(e) => setCreateFormData({...createFormData, dueDate: e.target.value})}
                />
              </div>
              <div className="pt-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 gap-3 sm:gap-0">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                >
                  {submitting ? t('common.loading') : t('tasks.createTask')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit Task Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border dark:border-gray-700">
            <div className="p-4 sm:p-6 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">{t('tasks.submitTask')}</h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{selectedTask?.title}</p>
              </div>
              <button onClick={() => setShowSubmitModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmitTask} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('tasks.submissions')} {t('profile.bio')}</label>
                <textarea
                  rows="3"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                  placeholder="..."
                  value={submitFormData.notes}
                  onChange={(e) => setSubmitFormData({...submitFormData, notes: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">File URL</label>
                <input
                  type="url"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                  placeholder="https://..."
                  value={submitFormData.fileUrl}
                  onChange={(e) => setSubmitFormData({...submitFormData, fileUrl: e.target.value})}
                />
              </div>
              <div className="pt-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 gap-3 sm:gap-0">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center justify-center shadow-sm"
                >
                  {submitting ? t('common.loading') : (
                    <>
                      {t('common.submit')} <Send size={16} className="ml-2" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-dashed border-gray-300 dark:border-gray-700">
            {t('tasks.noTasks')}
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col transition-transform hover:scale-[1.01]">
              <div className="p-4 sm:p-5 flex-grow">
                <div className="flex justify-between items-start mb-3">
                  <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] sm:text-xs font-bold rounded uppercase tracking-wider">
                    {task.course?.courseCode}
                  </span>
                  <div className={`flex items-center text-[10px] sm:text-xs font-medium ${isOverdue(task.dueDate) ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    <Clock size={14} className="mr-1" />
                    {t('tasks.due')}: {new Date(task.dueDate).toLocaleDateString()}
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white mb-2">{task.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mb-4 line-clamp-3">
                  {task.description}
                </p>
                
                <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700 flex justify-between items-center text-[11px] sm:text-sm">
                  <div className="flex items-center text-gray-500 dark:text-gray-400">
                    <ClipboardList size={16} className="mr-1" />
                    {t('tasks.maxPoints')}: {task.maxScore}
                  </div>
                  {isDoctor && (
                    <div className="text-blue-600 dark:text-blue-400 font-medium">
                      {task._count?.submissions || 0} {t('tasks.submissions')}
                    </div>
                  )}
                </div>
              </div>
              <div className="px-4 sm:px-5 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 mt-auto">
                {isStudent ? (
                  <button 
                    onClick={() => {
                      setSelectedTask(task);
                      setShowSubmitModal(true);
                    }}
                    className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition duration-150 flex items-center justify-center text-sm"
                  >
                    <FileUp size={16} className="mr-2" />
                    {t('tasks.submitTask')}
                  </button>
                ) : (
                  <button className="w-full border border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 py-2 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition duration-150 flex items-center justify-center text-sm">
                    <CheckCircle size={16} className="mr-2" />
                    {t('tasks.gradeSubmissions')}
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

export default TasksList;

