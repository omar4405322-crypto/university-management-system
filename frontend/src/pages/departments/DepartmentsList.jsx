import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import departmentService from '../../services/department.service';
import collegeService from '../../services/college.service';
import { useAuth } from '../../context/AuthContext';
import AddDepartmentModal from './AddDepartmentModal';
import EditDepartmentModal from './EditDepartmentModal';
import { Search, Plus, Edit2, Trash2, Layers, Building, Calendar } from 'lucide-react';
const DepartmentsList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCollegeId = searchParams.get('collegeId') || '';
  
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'COLLEGE_ADMIN';
  
  const [departments, setDepartments] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCollegeId, setSelectedCollegeId] = useState(initialCollegeId);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const result = await departmentService.getDepartments();
      if (result.success) {
        setDepartments(result.data);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
      showToast(t('common.errorFetching'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchColleges = async () => {
    try {
      const result = await collegeService.getColleges();
      if (result.success) {
        setColleges(result.data);
      }
    } catch (error) {
      console.error('Error fetching colleges:', error);
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('departments.deleteConfirm'))) {
      try {
        const result = await departmentService.deleteDepartment(id);
        if (result.success) {
          showToast(t('departments.deleteSuccess'), 'success');
          fetchDepartments();
        }
      } catch (error) {
        showToast(error.response?.data?.message || t('departments.deleteError'), 'error');
      }
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      const result = await departmentService.updateDepartment(id, data);
      if (result.success) {
        showToast(t('departments.updateSuccess'), 'success');
        fetchDepartments();
      }
    } catch (error) {
      showToast(error.response?.data?.message || t('common.errorFetching'), 'error');
    }
  };

  const filteredDepartments = departments.filter(dept => {
    const matchesSearch = dept.name.toLowerCase().includes(search.toLowerCase());
    const matchesCollege = selectedCollegeId === 'all' || selectedCollegeId === '' || dept.collegeId === parseInt(selectedCollegeId);
    return matchesSearch && matchesCollege;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen dark:bg-gray-900 transition-colors duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">University Departments</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Manage academic departments across colleges</p>
        </div>
        {canManage && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition duration-150 w-full sm:w-auto justify-center shadow-sm hover:shadow-md"
          >
            <Plus size={18} className="mr-2" />
            <span className="font-medium">Add Department</span>
          </button>
        )}
      </div>

      {toast && (
        <div className={`fixed top-20 right-4 z-50 p-4 rounded-xl shadow-2xl text-white transition-all duration-300 transform translate-y-0 animate-fade-in ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.message}
        </div>
      )}

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow sm:max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Search departments..."
            className="pl-10 pr-4 py-2.5 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-400 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative sm:max-w-xs w-full">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
            <Building size={18} />
          </span>
          <select
            className="pl-10 pr-10 py-2.5 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white transition-all"
            value={selectedCollegeId}
            onChange={(e) => setSelectedCollegeId(e.target.value)}
          >
            <option value="">All Colleges</option>
            {colleges.map(college => (
              <option key={college.id} value={college.id}>{college.name}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-dashed border-gray-300 dark:border-gray-700">
            No departments found matching your criteria.
          </div>
        ) : (
          filteredDepartments.map((dept) => (
            <div key={dept.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col border border-gray-100 dark:border-gray-700">
              <div className="p-5 flex-grow">
                <div className="flex justify-between items-start mb-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <Layers size={24} />
                  </div>
                  {canManage && (
                    <div className="flex space-x-1">
                      <button 
                        onClick={() => handleEdit(dept)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Edit Department"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(dept.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Delete Department"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-1">{dept.name}</h3>
                {dept.nameAr && (
                  <h4 className="text-lg text-gray-600 dark:text-gray-400 mb-2 font-arabic" dir="rtl">{dept.nameAr}</h4>
                )}
                
                <div className="mt-4 space-y-2">
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <Building size={16} className="mr-2 text-gray-400 dark:text-gray-500" />
                    <span className="font-medium text-gray-700 dark:text-gray-300">{dept.college?.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-50 dark:border-gray-700">
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                      <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Courses</div>
                      <div className="text-lg font-bold text-gray-800 dark:text-white">{dept._count?.courses || 0}</div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                      <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Students</div>
                      <div className="text-lg font-bold text-gray-800 dark:text-white">{dept._count?.students || 0}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 mt-auto flex justify-between items-center">
                <button 
                  className="text-indigo-600 dark:text-indigo-400 font-semibold text-sm hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center transition-colors"
                  onClick={() => {/* Link to department details */}}
                >
                  Manage Curriculum
                </button>
                <button 
                  className="text-blue-600 dark:text-blue-400 font-semibold text-sm hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1.5 transition-colors"
                  onClick={() => navigate(`/schedules-management?departmentId=${dept.id}`)}
                >
                  <Calendar size={16} />
                  Schedules
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <AddDepartmentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        colleges={colleges}
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchData();
          showToast('Department created successfully!', 'success');
        }}
      />

      <EditDepartmentModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedDepartment(null);
        }}
        department={selectedDepartment}
        colleges={colleges}
        onSuccess={() => {
          setIsEditModalOpen(false);
          setSelectedDepartment(null);
          fetchData();
          showToast('Department updated successfully!', 'success');
        }}
      />
    </div>
  );
};

export default DepartmentsList;
