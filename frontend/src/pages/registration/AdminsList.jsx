import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Table, { TableRow, TableCell } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Search, Plus, Trash2, UserShield, Mail, Building2, Layers, AlertCircle, CheckCircle, X } from 'lucide-react';
import usersService from '../../services/users.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

const AdminModal = ({ isOpen, onClose, onSuccess, colleges }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'SUPER_ADMIN',
    collegeId: '',
    departmentId: ''
  });
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchDepartments = async (collegeId) => {
    try {
      const res = await departmentService.getDepartments(collegeId);
      if (res.success) setDepartments(res.data);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      if (name === 'role') {
        newData.collegeId = '';
        newData.departmentId = '';
      }
      if (name === 'collegeId') {
        newData.departmentId = '';
        if (value) fetchDepartments(value);
      }
      return newData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      showToast('Please fill required fields', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await usersService.createAdmin(formData);
      if (res.success) {
        onSuccess();
        onClose();
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Error creating admin', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-arabic" dir="rtl">إضافة مسؤول جديد</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {toast && (
            <div className={`p-4 rounded-xl text-white flex items-center gap-2 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
              <AlertCircle size={20} />
              <span>{toast.message}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1 font-arabic" dir="rtl">البريد الإلكتروني</label>
            <Input name="email" type="email" value={formData.email} onChange={handleChange} required placeholder="admin@university.com" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1 font-arabic" dir="rtl">كلمة المرور</label>
            <Input name="password" type="password" value={formData.password} onChange={handleChange} required placeholder="••••••••" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1 font-arabic" dir="rtl">نوع المسؤول</label>
            <select name="role" value={formData.role} onChange={handleChange} className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none dark:text-white">
              <option value="SUPER_ADMIN">مسؤول الجامعة (Super Admin)</option>
              <option value="COLLEGE_ADMIN">مسؤول كلية (College Admin)</option>
              <option value="DEPARTMENT_ADMIN">مسؤول قسم (Dept Admin)</option>
            </select>
          </div>

          {(formData.role === 'COLLEGE_ADMIN' || formData.role === 'DEPARTMENT_ADMIN') && (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1 font-arabic" dir="rtl">الكلية</label>
              <select 
                name="collegeId" 
                value={formData.collegeId} 
                onChange={handleChange} 
                required 
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
              >
                <option value="">اختر الكلية</option>
                {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {formData.role === 'DEPARTMENT_ADMIN' && (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1 font-arabic" dir="rtl">القسم</label>
              <select 
                name="departmentId" 
                value={formData.departmentId} 
                onChange={handleChange} 
                required 
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
              >
                <option value="">اختر القسم</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}

          <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
            <Button type="submit" loading={loading}>إنشاء المسؤول</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AdminsList = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchAdmins();
    fetchColleges();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const res = await usersService.getUsers({ role: ['SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'] });
      if (res.success) setAdmins(res.data);
    } catch (error) {
      console.error('Error fetching admins:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchColleges = async () => {
    try {
      const res = await collegeService.getColleges();
      if (res.success) setColleges(res.data);
    } catch (error) {
      console.error('Error fetching colleges:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المسؤول؟')) {
      try {
        const res = await usersService.deleteUser(id);
        if (res.success) {
          showToast('تم حذف المسؤول بنجاح', 'success');
          fetchAdmins();
        }
      } catch (error) {
        showToast(error.response?.data?.message || 'خطأ في حذف المسؤول', 'error');
      }
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filteredAdmins = admins.filter(admin => 
    admin.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-20 right-4 z-50 p-4 rounded-xl shadow-xl text-white animate-in fade-in slide-in-from-top-4 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
          <div className="flex items-center gap-2">
            <CheckCircle size={18} />
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-arabic" dir="rtl">إدارة المسؤولين</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-arabic" dir="rtl">إدارة حسابات مسؤولي الجامعة والكليات والأقسام</p>
        </div>
        {user?.role === 'SUPER_ADMIN' && (
          <Button className="flex items-center gap-2" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> إضافة مسؤول جديد
          </Button>
        )}
      </div>

      <Card noPadding>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="بحث عن مسؤول..." className="pl-10 h-10 w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600/20 border-t-blue-600"></div>
            </div>
          ) : (
            <Table headers={['المسؤول', 'النوع', 'النطاق', 'رقم الهاتف', 'تاريخ الإنشاء', 'الإجراءات']}>
              {filteredAdmins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                        <UserShield size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {admin.doctor ? `${admin.doctor.firstName} ${admin.doctor.lastName}` : 'Super Admin'}
                        </span>
                        <span className="text-xs text-slate-500">{admin.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={admin.role === 'SUPER_ADMIN' ? 'success' : admin.role === 'COLLEGE_ADMIN' ? 'indigo' : 'warning'}>
                      {admin.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      {admin.role === 'SUPER_ADMIN' ? (
                        <span className="text-slate-700 dark:text-slate-300">الجامعة بأكملها</span>
                      ) : admin.role === 'COLLEGE_ADMIN' ? (
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <Building2 size={14} className="text-slate-400" />
                          <span>{admin.college?.name}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 text-sm">
                            <Layers size={14} className="text-slate-400" />
                            <span>{admin.department?.name}</span>
                          </div>
                          <span className="text-xs text-slate-400">{admin.college?.name}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400 font-medium">
                    {admin.doctor?.phone || '---'}
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400">
                    {new Date(admin.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {user?.role === 'SUPER_ADMIN' && admin.id !== user.id && (
                      <button onClick={() => handleDelete(admin.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          )}
        </div>
      </Card>

      <AdminModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchAdmins} colleges={colleges} />
    </div>
  );
};

export default AdminsList;
