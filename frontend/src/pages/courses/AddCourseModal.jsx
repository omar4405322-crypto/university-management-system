import React, { useState, useEffect } from 'react';
import coursesService from '../../services/courses.service';
import doctorsService from '../../services/doctors.service';

const AddCourseModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    courseCode: '',
    name: '',
    description: '',
    credits: 3,
    maxStudents: 30,
    doctorId: '',
  });
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchDoctors();
    }
  }, [isOpen]);

  const fetchDoctors = async () => {
    try {
      // Fetching all doctors for the dropdown
      const result = await doctorsService.getDoctors({ limit: 100 });
      if (result.success) {
        setDoctors(result.data.doctors);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ 
      ...formData, 
      [name]: (name === 'credits' || name === 'maxStudents') ? parseInt(value) || 0 : value 
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.courseCode || !formData.name || !formData.credits || !formData.maxStudents) {
      showToast('Please fill all required fields', 'error');
      return;
    }

    try {
      setLoading(true);
      const result = await coursesService.createCourse(formData);
      if (result.success) {
        onSuccess();
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Error creating course', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 sm:px-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Add New Course</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {toast && (
            <div className={`mb-4 p-3 rounded text-white ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
              {toast.message}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course Code *</label>
              <input
                type="text"
                name="courseCode"
                placeholder="e.g. CS101"
                value={formData.courseCode}
                onChange={handleChange}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                name="description"
                rows="3"
                value={formData.description}
                onChange={handleChange}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              ></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Credits *</label>
              <input
                type="number"
                name="credits"
                min="1"
                max="10"
                value={formData.credits}
                onChange={handleChange}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Students *</label>
              <input
                type="number"
                name="maxStudents"
                min="1"
                value={formData.maxStudents}
                onChange={handleChange}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign Doctor</label>
              <select
                name="doctorId"
                value={formData.doctorId}
                onChange={handleChange}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Unassigned</option>
                {doctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.firstName} {doc.lastName} ({doc.doctorId})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Add Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCourseModal;
