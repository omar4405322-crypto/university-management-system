import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  GraduationCap, 
  Layers, 
  ArrowLeft,
  Settings,
  Plus,
  Edit2,
  Trash2,
  Info,
  Calendar,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Table, { TableRow, TableCell } from '../../components/ui/Table';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import AddDepartmentModal from '../departments/AddDepartmentModal';

const CollegeDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [college, setCollege] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const canManage = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);

  useEffect(() => {
    fetchCollegeDetails();
  }, [id]);

  const fetchCollegeDetails = async () => {
    try {
      setLoading(true);
      const result = await collegeService.getCollegeById(id);
      if (result.success) {
        setCollege(result.data);
      }
    } catch (error) {
      console.error('Error fetching college details:', error);
      showToast('Error fetching college details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDeleteDept = async (deptId) => {
    if (window.confirm('Are you sure you want to delete this department?')) {
      try {
        const result = await departmentService.deleteDepartment(deptId);
        if (result.success) {
          showToast('Department deleted successfully', 'success');
          fetchCollegeDetails();
        }
      } catch (error) {
        showToast(error.response?.data?.message || 'Error deleting department', 'error');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!college) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">College not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/colleges')}>
          Back to Colleges
        </Button>
      </div>
    );
  }

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

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/colleges')}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{college.name}</h1>
            <p className="text-slate-500 dark:text-slate-400 font-arabic" dir="rtl">{college.nameAr}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canManage && (
            <>
              <Button 
                variant="outline" 
                className="flex items-center gap-2"
                onClick={() => navigate(`/schedules-management?collegeId=${college.id}`)}
              >
                <Calendar size={18} /> Manage Schedules
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <Settings size={18} /> Settings
              </Button>
            </>
          )}
          <Button className="flex items-center gap-2" onClick={() => setIsAddDeptModalOpen(true)}>
            <Plus size={18} /> Add Department
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl">
            <Layers size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Departments</p>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{college.departments?.length || 0}</h3>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Students</p>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">--</h3>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-xl">
            <GraduationCap size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Faculty</p>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">--</h3>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* About College */}
        <div className="lg:col-span-1">
          <Card title="About College" extra={<Info size={18} className="text-slate-400" />}>
            <div className="space-y-4">
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {college.description || "No description available for this college."}
              </p>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 flex items-center gap-2"><Calendar size={14} /> Created At</span>
                  <span className="text-slate-900 dark:text-white font-medium">{new Date(college.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 flex items-center gap-2"><Building2 size={14} /> Status</span>
                  <Badge variant="success">Operational</Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Departments List */}
        <div className="lg:col-span-2">
          <Card title="Departments" noPadding>
            <Table headers={['Name', 'Arabic Name', 'Actions']}>
              {college.departments?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-slate-500">
                    No departments found for this college.
                  </TableCell>
                </TableRow>
              ) : (
                college.departments?.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-semibold text-slate-900 dark:text-white">{dept.name}</TableCell>
                    <TableCell className="font-arabic text-slate-600 dark:text-slate-400" dir="rtl">{dept.nameAr}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button 
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="View Details"
                          onClick={() => navigate(`/departments?collegeId=${college.id}`)}
                        >
                          <Info size={18} />
                        </button>
                        <button 
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          title="Schedules"
                          onClick={() => navigate(`/schedules-management?departmentId=${dept.id}`)}
                        >
                          <Calendar size={18} />
                        </button>
                        {canManage && (
                          <>
                            <button 
                              className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                              title="Delete"
                              onClick={() => handleDeleteDept(dept.id)}
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
        </div>
      </div>

      <AddDepartmentModal
        isOpen={isAddDeptModalOpen}
        onClose={() => setIsAddDeptModalOpen(false)}
        colleges={[college]}
        onSuccess={() => {
          setIsAddDeptModalOpen(false);
          fetchCollegeDetails();
          showToast('Department added successfully', 'success');
        }}
      />
    </div>
  );
};

export default CollegeDetails;
