import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Table, { TableRow, TableCell } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { 
  Search, 
  Plus, 
  Filter, 
  BookOpen, 
  User, 
  Layers, 
  Edit2, 
  Trash2, 
  AlertCircle, 
  CheckCircle,
  Loader2,
  X
} from 'lucide-react';
import coursesService from '../../services/courses.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import CourseModal from './CourseModal';

const CoursesList = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [coursesRes, collegesRes] = await Promise.all([
        coursesService.getCourses(),
        collegeService.getColleges()
      ]);

      if (coursesRes.success) setCourses(coursesRes.data);
      if (collegesRes.success) setColleges(collegesRes.data);
    } catch (error) {
      console.error('Error fetching initial data:', error);
      showToast('Failed to load courses', 'error');
    } finally {
      setLoading(false);
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
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchFilteredCourses = async () => {
    try {
      setLoading(true);
      const params = {
        search,
        collegeId: selectedCollege || undefined,
        departmentId: selectedDept || undefined
      };
      const res = await coursesService.getCourses(params);
      if (res.success) setCourses(res.data);
    } catch (error) {
      console.error('Error filtering courses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFilteredCourses();
    }, 400);
    return () => clearTimeout(timer);
  }, [search, selectedCollege, selectedDept]);

  const handleCollegeChange = (e) => {
    const collegeId = e.target.value;
    setSelectedCollege(collegeId);
    setSelectedDept('');
    fetchDepartments(collegeId);
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this course?')) return;
    try {
      const res = await coursesService.deleteCourse(id);
      if (res.success) {
        showToast('Course deleted successfully', 'success');
        fetchFilteredCourses();
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to delete course', 'error');
    }
  };

  const handleEdit = (course) => {
    setSelectedCourse(course);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedCourse(null);
    setIsModalOpen(true);
  };

  const resetFilters = () => {
    setSearch('');
    setSelectedCollege('');
    setSelectedDept('');
    setDepartments([]);
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || (user?.role === 'ADMIN' && user?.adminRole === 'SUPER_ADMIN');

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-20 right-4 z-50 p-4 rounded-xl shadow-xl text-white transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Course Catalog</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Browse and manage all available university courses.</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={handleAdd} className="flex items-center gap-2">
            <Plus size={18} /> Add New Course
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card className="md:col-span-1 h-fit">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Filter size={18} /> Filters
            </h3>
            <button onClick={resetFilters} className="text-xs text-blue-600 hover:underline">Reset</button>
          </div>
          
          <div className="space-y-4">
            <Input 
              label="Search Course" 
              placeholder="Name or ID..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">College</label>
              <select 
                value={selectedCollege}
                onChange={handleCollegeChange}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
              >
                <option value="">All Colleges</option>
                {colleges.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Department</label>
              <select 
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                disabled={!selectedCollege}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <Card noPadding className="md:col-span-3 min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="animate-spin text-blue-600" size={32} />
              <p className="text-sm text-slate-500 font-medium">Loading courses...</p>
            </div>
          ) : courses.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="h-16 w-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4">
                <Search size={32} className="text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">No courses found</p>
              <p className="text-sm text-slate-500 mt-1">Try adjusting your filters or search query.</p>
            </div>
          ) : (
            <Table headers={['Course', 'Credits', 'Department / College', 'Instructor', 'Students', 'Actions']}>
              {courses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <BookOpen size={18} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{course.name}</p>
                        <p className="text-xs text-slate-500">{course.courseCode}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral">{course.credits} Credits</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-slate-700 dark:text-slate-300 text-xs font-medium">
                        {course.department?.name || 'Unassigned'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {course.department?.college?.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-400">
                        {course.doctor ? `${course.doctor.firstName[0]}${course.doctor.lastName[0]}` : '?'}
                      </div>
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {course.doctor ? `Dr. ${course.doctor.firstName} ${course.doctor.lastName}` : 'TBA'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <User size={14} className="text-slate-400" />
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {course._count?.students || 0} / {course.maxStudents}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isSuperAdmin && (
                        <>
                          <button 
                            onClick={() => handleEdit(course)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(course.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <CourseModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        course={selectedCourse}
        onSuccess={() => {
          setIsModalOpen(false);
          fetchFilteredCourses();
          showToast(selectedCourse ? 'Course updated successfully' : 'Course added successfully', 'success');
        }}
      />
    </div>
  );
};

export default CoursesList;
