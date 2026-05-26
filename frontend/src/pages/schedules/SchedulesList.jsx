import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Clock, 
  MapPin, 
  BookOpen,
  Loader2,
  AlertCircle,
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Table, { TableRow, TableCell } from '../../components/ui/Table';
import schedulesService from '../../services/schedules.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import coursesService from '../../services/courses.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import ScheduleModal from './ScheduleModal';

const SchedulesList = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  
  // Filters
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [search, setSearch] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [toast, setToast] = useState(null);

  const canManage = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const collegeId = queryParams.get('collegeId');
    const departmentId = queryParams.get('departmentId');
    
    if (collegeId) {
      setSelectedCollege(collegeId);
      fetchDepartments(collegeId);
    }
    
    if (departmentId) {
      setSelectedDept(departmentId);
    }

    fetchInitialData();
  }, [location.search]);

  useEffect(() => {
    fetchSchedules();
  }, [selectedCollege, selectedDept, selectedYear, selectedSemester]);

  const fetchInitialData = async () => {
    try {
      const [collegesRes, coursesRes] = await Promise.all([
        collegeService.getColleges(),
        coursesService.getCourses()
      ]);
      
      if (collegesRes.success) setColleges(collegesRes.data);
      if (coursesRes.success) setCourses(coursesRes.data);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  };

  const fetchDepartments = async (collegeId) => {
    try {
      const result = await departmentService.getDepartments({ collegeId });
      if (result.success) {
        setDepartments(result.data);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCollege) params.collegeId = selectedCollege;
      if (selectedDept) params.departmentId = selectedDept;
      if (selectedYear) params.year = selectedYear;
      if (selectedSemester) params.semester = selectedSemester;
      
      const result = await schedulesService.getSchedules(params);
      if (result.success) {
        setSchedules(result.data);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
      showToast('Error fetching schedules', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCollegeChange = async (collegeId) => {
    setSelectedCollege(collegeId);
    setSelectedDept('');
    if (collegeId) {
      fetchDepartments(collegeId);
    } else {
      setDepartments([]);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      try {
        const result = await schedulesService.deleteSchedule(id);
        if (result.success) {
          showToast('Schedule deleted successfully', 'success');
          fetchSchedules();
        }
      } catch (error) {
        showToast('Error deleting schedule', 'error');
      }
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filteredSchedules = schedules.filter(s => 
    s.course.name.toLowerCase().includes(search.toLowerCase()) ||
    s.course.courseCode.toLowerCase().includes(search.toLowerCase()) ||
    (s.room && s.room.toLowerCase().includes(search.toLowerCase()))
  );

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
          <h1 className="text-2xl font-bold text-slate-900">Schedules Management</h1>
          <p className="text-slate-500 mt-1">Manage university timetables and class assignments.</p>
        </div>
        {canManage && (
          <Button 
            className="flex items-center gap-2"
            onClick={() => {
              setEditingSchedule(null);
              setIsModalOpen(true);
            }}
          >
            <Plus size={18} /> Create Schedule
          </Button>
        )}
      </div>

      <Card>
        <div className="flex flex-col md:row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by course or room..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <select
              className="px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
              value={selectedCollege}
              onChange={(e) => handleCollegeChange(e.target.value)}
            >
              <option value="">All Colleges</option>
              {colleges.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              className="px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              disabled={!selectedCollege}
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <select
              className="px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="">All Years</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
              <option value="5">Year 5</option>
            </select>

            <select
              className="px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
            >
              <option value="">All Semesters</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
              <option value="3">Semester 3 (Summer)</option>
            </select>
          </div>
        </div>
      </Card>

      <Card noPadding>
        <Table headers={['Course', 'Time Slot', 'Room', 'Department', 'Actions']}>
          {loading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-12">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-blue-600" size={32} />
                  <p className="text-slate-500 font-medium">Loading schedules...</p>
                </div>
              </TableCell>
            </TableRow>
          ) : filteredSchedules.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-12">
                <div className="flex flex-col items-center gap-2 text-slate-500">
                  <Calendar size={48} className="text-slate-200" />
                  <p className="font-medium">No schedules found</p>
                  <p className="text-sm">Try adjusting your filters or search terms.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            filteredSchedules.map((schedule) => (
              <TableRow key={schedule.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900">{schedule.course.name}</span>
                    <span className="text-xs text-slate-500">{schedule.course.courseCode}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                      <Calendar size={14} className="text-slate-400" />
                      {t(`days.${schedule.dayOfWeek.toLowerCase()}`)}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock size={14} className="text-slate-400" />
                      {schedule.startTime} - {schedule.endTime}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <MapPin size={16} className="text-slate-400" />
                    {schedule.room || 'TBA'}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-700">
                      {schedule.course.department?.name || 'N/A'}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                      {schedule.course.department?.college?.name || ''}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {canManage && (
                      <>
                        <button 
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                          onClick={() => {
                            setEditingSchedule(schedule);
                            setIsModalOpen(true);
                          }}
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete"
                          onClick={() => handleDelete(schedule.id)}
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </Table>
      </Card>

      <ScheduleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        schedule={editingSchedule}
        courses={courses}
        onSuccess={() => {
          setIsModalOpen(false);
          fetchSchedules();
          showToast(editingSchedule ? 'Schedule updated successfully' : 'Schedule created successfully', 'success');
        }}
      />
    </div>
  );
};

export default SchedulesList;