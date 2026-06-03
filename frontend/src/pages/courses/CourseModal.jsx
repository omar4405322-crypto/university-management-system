import React, { useState, useEffect } from 'react';
import coursesService from '../../services/courses.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import doctorsService from '../../services/doctors.service';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTranslation } from 'react-i18next';
import { X, BookOpen, Hash, FileText, User, GraduationCap, School, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

const CourseModal = ({ isOpen, onClose, onSuccess, course }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    courseCode: '',
    description: '',
    credits: 3,
    maxStudents: 30,
    departmentId: '',
    collegeId: '',
    doctorId: '',
    year: 1,
    semester: 1
  });
  
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchInitialData();
      if (course) {
        setFormData({
          name: course.name || '',
          courseCode: course.courseCode || '',
          description: course.description || '',
          credits: course.credits || 3,
          maxStudents: course.maxStudents || 30,
          departmentId: course.departmentId || '',
          collegeId: course.department?.collegeId || '',
          doctorId: course.doctorId || '',
          year: course.year || 1,
          semester: course.semester || 1
        });
        if (course.department?.collegeId) {
          fetchDepartments(course.department.collegeId);
        }
      } else {
        setFormData({
          name: '',
          courseCode: '',
          description: '',
          credits: 3,
          maxStudents: 30,
          departmentId: '',
          collegeId: '',
          doctorId: '',
          year: 1,
          semester: 1
        });
      }
    }
  }, [isOpen, course]);

  const fetchInitialData = async () => {
    try {
      setFetchingData(true);
      const [collegesRes, doctorsRes] = await Promise.all([
        collegeService.getColleges(),
        doctorsService.getDoctors({ limit: 100 })
      ]);
      
      if (collegesRes.success) setColleges(collegesRes.data);
      if (doctorsRes.success) setDoctors(doctorsRes.data.doctors || doctorsRes.data);
    } catch (err) {
      console.error('Error fetching modal data:', err);
    } finally {
      setFetchingData(false);
    }
  };

  const fetchDepartments = async (collegeId) => {
    if (!collegeId) {
      setDepartments([]);
      return;
    }
    try {
      const res = await departmentService.getDepartmentsByCollege(collegeId);
      if (res.success) setDepartments(res.data);
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'collegeId') {
      setFormData(prev => ({ ...prev, departmentId: '' }));
      fetchDepartments(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let res;
      if (course) {
        res = await coursesService.updateCourse(course.id, formData);
      } else {
        res = await coursesService.createCourse(formData);
      }

      if (res.success) {
        onSuccess();
      } else {
        setError(res.message || 'An error occurred');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save course');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-navy-500/40 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative bg-brand-bg-card dark:bg-brand-bg-elevated rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-brand-border dark:border-brand-border flex justify-between items-center bg-brand-bg-page/50 dark:bg-brand-bg-elevated/50">
          <div>
            <h2 className="text-xl font-bold text-brand-text-primary dark:text-brand-text-main">
              {course ? 'Edit Course' : 'Add New Course'}
            </h2>
            <p className="text-sm text-brand-text-secondary dark:text-brand-text-muted mt-0.5">
              {course ? 'Update course details and linking.' : 'Create a new course and link it to a department.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-brand-text-muted hover:text-brand-text-secondary dark:hover:text-brand-text-secondary hover:bg-brand-bg-page dark:hover:bg-brand-bg-elevated rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-error text-white flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
              <AlertCircle size={20} />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <BookOpen size={14} className="text-brand-text-muted" /> Course Name <span className="text-error">*</span>
              </label>
              <Input
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Advanced Web Development"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <Hash size={14} className="text-brand-text-muted" /> Course Code <span className="text-error">*</span>
              </label>
              <Input
                name="courseCode"
                value={formData.courseCode}
                onChange={handleChange}
                placeholder="e.g. CS302"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <GraduationCap size={14} className="text-brand-text-muted" /> Credits <span className="text-error">*</span>
              </label>
              <Input
                type="number"
                name="credits"
                value={formData.credits}
                onChange={handleChange}
                min="1"
                max="10"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <School size={14} className="text-brand-text-muted" /> College <span className="text-error">*</span>
              </label>
              <select
                name="collegeId"
                value={formData.collegeId}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border dark:border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 dark:text-brand-text-main"
              >
                <option value="">Select College</option>
                {colleges.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <GraduationCap size={14} className="text-brand-text-muted" /> Department <span className="text-error">*</span>
              </label>
              <select
                name="departmentId"
                value={formData.departmentId}
                onChange={handleChange}
                required
                disabled={!formData.collegeId}
                className="w-full px-4 py-2 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border dark:border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 dark:text-brand-text-main disabled:opacity-50"
              >
                <option value="">Select Department</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <User size={14} className="text-brand-text-muted" /> Instructor
              </label>
              <select
                name="doctorId"
                value={formData.doctorId}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border dark:border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 dark:text-brand-text-main"
              >
                <option value="">Select Instructor (TBA)</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <User size={14} className="text-brand-text-muted" /> Max Students
              </label>
              <Input
                type="number"
                name="maxStudents"
                value={formData.maxStudents}
                onChange={handleChange}
                min="1"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                Year
              </label>
              <select
                name="year"
                value={formData.year}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border dark:border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 dark:text-brand-text-main"
              >
                {[1, 2, 3, 4, 5].map(y => (
                  <option key={y} value={y}>Year {y}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                Semester
              </label>
              <select
                name="semester"
                value={formData.semester}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border dark:border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 dark:text-brand-text-main"
              >
                <option value={1}>First Semester</option>
                <option value={2}>Second Semester</option>
                <option value={3}>Summer Semester</option>
              </select>
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-secondary flex items-center gap-2 ml-1">
                <FileText size={14} className="text-brand-text-muted" /> Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
                className="w-full px-4 py-2 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border dark:border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 dark:text-brand-text-main resize-none"
                placeholder="Course overview and objectives..."
              ></textarea>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t border-brand-border dark:border-brand-border pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              className="min-w-[120px]"
            >
              {course ? 'Update Course' : 'Create Course'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourseModal;
