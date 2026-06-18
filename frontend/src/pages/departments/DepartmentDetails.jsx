// FIXED: Department detail page + breadcrumbs - Phase 1 / Phase 6
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Users,
  BookOpen,
  GraduationCap,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Table, { TableRow, TableCell } from '../../components/ui/Table';
import departmentService from '../../services/department.service';
import { useTranslation } from 'react-i18next';
import Breadcrumbs from '../../components/ui/Breadcrumbs';

const DepartmentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [department, setDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchDepartment();
  }, [id]);

  const fetchDepartment = async () => {
    try {
      setLoading(true);
      const result = await departmentService.getDepartmentById(id);
      if (result.success) {
        setDepartment(result.data);
      } else {
        setDepartment(null);
      }
    } catch (error) {
      console.error('Error fetching department:', error);
      setDepartment(null);
      showToast(t('common.errorFetching'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openSchedule = () => {
    navigate(`/schedules-management?departmentId=${id}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin text-brand-green" size={48} />
        <p className="text-brand-text-sub font-bold uppercase tracking-widest text-sm">{t('common.loading')}</p>
      </div>
    );
  }

  if (!department) {
    return (
      <div className="text-center py-20 bg-brand-bg-card rounded-3xl border border-brand-border">
        <AlertCircle size={40} className="text-brand-text-muted mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-brand-text-main">{t('departments.notFound', 'Department not found')}</h2>
        <Button variant="outline" className="mt-6" onClick={() => navigate('/departments')}>
          <ArrowLeft size={18} className="rtl:-scale-x-100 mr-2" /> {t('common.back')}
        </Button>
      </div>
    );
  }

  const students = department.students || [];
  const courses = department.courses || [];
  const doctors = department.doctors || [];

  const breadcrumbItems = [
    { label: t('nav.colleges'), link: '/colleges' },
    ...(department.college?.id
      ? [{ label: department.college.name, link: `/colleges/${department.college.id}` }]
      : []),
    { label: department.name },
  ];

  return (
    <div className="section-gap animate-in fade-in duration-500">
      <Breadcrumbs items={breadcrumbItems} />
      {toast && (
        <div className={`${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between bg-brand-bg-card p-6 rounded-3xl border border-brand-border shadow-soft">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => navigate('/departments')}
            className="p-3 text-brand-text-sub hover:text-brand-green hover:bg-brand-green/10 rounded-2xl transition-all"
          >
            <ArrowLeft size={24} className="rtl:-scale-x-100" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-brand-text-main">{department.name}</h1>
            {department.nameAr && (
              <p className="text-xl text-brand-text-sub mt-1 font-arabic" dir="rtl">{department.nameAr}</p>
            )}
            <p className="text-sm text-brand-text-sub font-bold mt-2 flex items-center gap-2">
              <Building2 size={16} className="text-brand-green" />
              {t('departments.homeCollege', 'Home college')}: {department.college?.name || '—'}
            </p>
          </div>
        </div>
        <Button
          className="flex items-center gap-2 shadow-xl shadow-brand-green/20 font-bold"
          onClick={openSchedule}
        >
          <Calendar size={18} /> {t('nav.schedule')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="flex items-center gap-5 border-l-0">
          <div className="p-4 bg-brand-green/10 text-brand-green rounded-2xl">
            <Users size={28} />
          </div>
          <div>
            <p className="text-xs font-black text-brand-text-muted uppercase tracking-widest">{t('nav.students')}</p>
            <h3 className="text-2xl font-black text-brand-text-main mt-1">{students.length}</h3>
          </div>
        </Card>
        <Card className="flex items-center gap-5 border-l-0">
          <div className="p-4 bg-brand-navy/10 text-brand-navy rounded-2xl">
            <BookOpen size={28} />
          </div>
          <div>
            <p className="text-xs font-black text-brand-text-muted uppercase tracking-widest">{t('nav.courses')}</p>
            <h3 className="text-2xl font-black text-brand-text-main mt-1">{courses.length}</h3>
          </div>
        </Card>
        <Card className="flex items-center gap-5 border-l-0">
          <div className="p-4 bg-brand-yellow/10 text-brand-yellow rounded-2xl">
            <GraduationCap size={28} />
          </div>
          <div>
            <p className="text-xs font-black text-brand-text-muted uppercase tracking-widest">{t('nav.doctors')}</p>
            <h3 className="text-2xl font-black text-brand-text-main mt-1">{doctors.length}</h3>
          </div>
        </Card>
      </div>

      <Card title={t('nav.students')} noPadding className="border-l-0">
        {students.length === 0 ? (
          <p className="p-8 text-center text-brand-text-sub font-bold">{t('departments.noStudents', 'No students enrolled in this department.')}</p>
        ) : (
          <Table headers={[t('students.studentId'), t('students.name'), t('auth.year')]}>
            {students.map((s) => (
              <TableRow key={s.id} className="cursor-pointer hover:bg-brand-navy/[0.02]" onClick={() => navigate(`/students/${s.id}`)}>
                <TableCell className="font-black">{s.studentId}</TableCell>
                <TableCell>{s.firstName} {s.lastName}</TableCell>
                <TableCell>{s.year}</TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </Card>

      <Card title={t('nav.courses')} noPadding className="border-l-0">
        {courses.length === 0 ? (
          <p className="p-8 text-center text-brand-text-sub font-bold">{t('departments.noCourses', 'No courses in this department.')}</p>
        ) : (
          <Table headers={[t('courses.code'), t('courses.name'), t('courses.credits')]}>
            {courses.map((c) => (
              <TableRow key={c.id}>
                <TableCell><Badge variant="info">{c.courseCode}</Badge></TableCell>
                <TableCell className="font-black">{c.name}</TableCell>
                <TableCell>{c.credits}</TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </Card>

      <Card title={t('departments.assignedProfessors', 'Assigned professors')} noPadding className="border-l-0">
        {doctors.length === 0 ? (
          <p className="p-8 text-center text-brand-text-sub font-bold">{t('departments.noDoctors', 'No professors assigned.')}</p>
        ) : (
          <Table headers={[t('doctors.doctorId'), t('doctors.name'), t('doctors.specialty')]}>
            {doctors.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-black">{d.doctorId}</TableCell>
                <TableCell>{d.firstName} {d.lastName}</TableCell>
                <TableCell>{d.specialty || '—'}</TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
};

export default DepartmentDetails;
