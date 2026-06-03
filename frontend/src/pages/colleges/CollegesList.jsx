// FIXED [Phase 7]: Empty state + delete confirmation modal
import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { 
  Building2, 
  Users, 
  GraduationCap, 
  MoreVertical, 
  Plus,
  ExternalLink,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import collegeService from '../../services/college.service';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AddCollegeModal from './AddCollegeModal';
import EditCollegeModal from './EditCollegeModal';
import CollegeCardImage from '../../components/CollegeCardImage';
import { EmptyState } from '../../components/ui/EmptyState';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';

const CollegesList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCollege, setSelectedCollege] = useState(null);
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchColleges();
  }, []);

  const fetchColleges = async () => {
    try {
      setLoading(true);
      const result = await collegeService.getColleges();
      if (result.success) {
        setColleges(result.data);
      }
    } catch (error) {
      console.error('Error fetching colleges:', error);
      showToast(t('common.errorFetching'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      const result = await collegeService.deleteCollege(deleteTarget.id);
      if (result.success) {
        showToast(t('colleges.deleteSuccess'), 'success');
        setDeleteTarget(null);
        fetchColleges();
      }
    } catch (error) {
      showToast(error.response?.data?.message || t('colleges.deleteError'), 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEdit = (college) => {
    setSelectedCollege(college);
    setIsEditModalOpen(true);
  };

  return (
    <div className="section-gap animate-page">
      {/* Toast Notification */}
      {toast && (
        <div className={`${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <PageHeader 
        title={t('colleges.title')}
        subtitle={t('colleges.subtitle')}
        action={{
          label: t('colleges.addCollege'),
          onClick: () => setIsAddModalOpen(true)
        }}
      />

      {loading ? (
        <div className="flex flex-col justify-center items-center h-96 gap-4">
          <Loader2 className="animate-spin text-brand-primary-500" size={48} />
          <p className="text-caption">{t('common.loading')}</p>
        </div>
      ) : colleges.length === 0 ? (
        <EmptyState
          icon={<Building2 size={40} />}
          title={t('colleges.noColleges')}
          subtitle={t('colleges.noCollegesDesc')}
          action={{ label: t('colleges.addFirstCollege'), onClick: () => setIsAddModalOpen(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {colleges.map((college) => (
            <Card key={college.id} noPadding className="group border-none shadow-soft hover:-translate-y-2 duration-500 rounded-[2.5rem] overflow-hidden">
              <div className="relative h-64 w-full overflow-hidden">
                <CollegeCardImage name={college.name} image={college.image} collegeId={college.id} />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-navy-900/90 via-brand-navy-900/20 to-transparent z-10" />
                
                <div className="absolute top-6 right-6 z-20 flex gap-2">
                  <button 
                    onClick={() => handleEdit(college)}
                    className="w-10 h-10 rounded-xl bg-white/10 p-2.5 text-white backdrop-blur-xl hover:bg-brand-primary-500 transition-all duration-300 shadow-xl border border-white/10 flex items-center justify-center"
                    title={t('common.edit')}
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => setDeleteTarget({ id: college.id, name: college.name })}
                    className="w-10 h-10 rounded-xl bg-white/10 p-2.5 text-white backdrop-blur-xl hover:bg-error transition-all duration-300 shadow-xl border border-white/10 flex items-center justify-center"
                    title={t('common.delete')}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="absolute bottom-6 right-6 left-6 z-20">
                  <Badge variant="success" className="mb-3 px-3 py-1 text-[10px] font-black tracking-widest uppercase bg-brand-primary-500/90 text-white border-none shadow-lg">
                    {t('colleges.active')}
                  </Badge>
                  <h3 className="text-3xl font-black text-white tracking-tight drop-shadow-lg uppercase leading-tight">
                    {college.name} 
                  </h3>
                </div>
              </div>

              <div className="p-8">
                <p className="text-sm font-bold text-brand-text-secondary line-clamp-2 min-h-[3rem] leading-relaxed">
                  {college.description}
                </p>

                <div className="mt-8 grid grid-cols-2 gap-6 border-t border-brand-border dark:border-brand-border pt-6">
                  <div className="space-y-1">
                    <p className="label-stat">{t('nav.departments')}</p>
                    <p className="text-3xl font-black text-brand-text-primary dark:text-brand-text-main tracking-tighter">{college._count?.departments || 0}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="label-stat">{t('profile.status')}</p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-brand-primary-500 animate-pulse" />
                      <p className="text-[10px] font-black text-brand-primary-500 uppercase tracking-widest">{t('colleges.operational')}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex items-center gap-3">
                  <Button 
                    variant="primary" 
                    className="flex-1 text-[10px] font-black uppercase tracking-widest py-3.5 shadow-lg shadow-brand-primary-500/20" 
                    onClick={() => navigate(`/departments?collegeId=${college.id}`)}
                  >
                    {t('colleges.manageDepts')}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 text-[10px] font-black uppercase tracking-widest py-3.5 gap-2 border-slate-200" 
                    onClick={() => navigate(`/colleges/${college.id}`)}
                  >
                    {t('colleges.viewDetails')} <ExternalLink size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        itemName={deleteTarget?.name}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
      />

      <AddCollegeModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchColleges();
          showToast(t('colleges.addSuccess'), 'success');
        }} 
      />

      <EditCollegeModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedCollege(null);
        }}
        college={selectedCollege}
        onSuccess={() => {
          setIsEditModalOpen(false);
          setSelectedCollege(null);
          fetchColleges();
          showToast(t('colleges.updateSuccess'), 'success');
        }}
      />
    </div>
  );
};

export default CollegesList;
