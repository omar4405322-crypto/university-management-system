// @ts-nocheck
// FIXED: Department detail page + breadcrumbs - Phase 1 / Phase 6
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
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
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';

interface DepartmentDetailsProps {
  departmentId?: string;
  isDrawerMode?: boolean;
}

const DepartmentDetails: React.FC<DepartmentDetailsProps> = ({ departmentId, isDrawerMode = false }) => {
  const { id } = useParams();
  const actualId = departmentId || id;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [department, setDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    if (actualId) fetchDepartment();
  }, [actualId]);

  const fetchDepartment = async () => {
    try {
      setLoading(true);
      const result = await departmentService.getDepartmentById(actualId);
      if (result.success) {
        setDepartment(result.data);
      } else {
        setDepartment(null);
      }
    } catch (error: any) {
      logger.error('Error fetching department:', error);
      setDepartment(null);
      showToast(t('common.errorFetching'), 'error');
    } finally {
      setLoading(false);
    }
  };



  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin text-brand-green" size={48} />
        <p className="text-brand-text-sub font-bold uppercase tracking-widest text-sm">
          {t('common.loading')}
        </p>
      </div>
    );
  }

  if (!department) {
    return (
      <div className="text-center py-20 bg-brand-bg-card rounded-3xl border border-brand-border">
        <AlertCircle size={40} className="text-brand-text-muted mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-brand-text-main">
          {t('departments.notFound', 'Department not found')}
        </h2>
        {!isDrawerMode && (
          <Button variant="outline" className="mt-6" onClick={() => navigate('/departments')}>
            <ArrowLeft size={18} className="rtl:-scale-x-100 mr-2" /> {t('common.back')}
          </Button>
        )}
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
    <div className={isDrawerMode ? "animate-in fade-in duration-500" : "section-gap animate-in fade-in duration-500"}>
            {!isDrawerMode && <Breadcrumbs items={breadcrumbItems} />}
      

      {!isDrawerMode && (
        <div className="flex items-center gap-4 mb-6 mt-4">
          <button
            type="button"
            onClick={() => navigate('/departments')}
            className="p-3 text-brand-text-sub hover:text-brand-green hover:bg-brand-green/10 rounded-2xl transition-all"
          >
            <ArrowLeft size={24} className="rtl:-scale-x-100" />
          </button>
        </div>
      )}

      {students.length > 0 && (
        <Card title={t('nav.students')} noPadding className="border-l-0">
          <Table headers={[t('students.studentId'), t('students.name'), t('auth.year')]}>
            {students.map((s) => (
              <TableRow
                key={s.id}
                className="cursor-pointer hover:bg-brand-navy-500/[0.02]"
                onClick={() => navigate(`/students/${s.id}`)}
              >
                <TableCell className="font-black">{s.studentId}</TableCell>
                <TableCell>
                  {s.firstName} {s.lastName}
                </TableCell>
                <TableCell>{s.year}</TableCell>
              </TableRow>
            ))}
          </Table>
        </Card>
      )}

      {courses.length > 0 && (
        <Card title={t('nav.courses')} noPadding className="border-l-0">
          <Table headers={[t('courses.code'), t('courses.name'), t('courses.credits')]}>
            {courses.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Badge variant="info">{c.courseCode}</Badge>
                </TableCell>
                <TableCell className="font-black">{c.name}</TableCell>
                <TableCell>{c.credits}</TableCell>
              </TableRow>
            ))}
          </Table>
        </Card>
      )}

      {doctors.length > 0 && (
        <Card
          title={t('departments.assignedProfessors', 'Assigned professors')}
          noPadding
          className="border-l-0"
        >
          <Table headers={[t('doctors.doctorId'), t('doctors.name'), t('doctors.specialty')]}>
            {doctors.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-black">{d.doctorId}</TableCell>
                <TableCell>
                  {d.firstName} {d.lastName}
                </TableCell>
                <TableCell>{d.specialty || '—'}</TableCell>
              </TableRow>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
};

export default DepartmentDetails;
