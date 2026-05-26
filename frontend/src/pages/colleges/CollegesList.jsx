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
  CheckCircle
} from 'lucide-react';
import collegeService from '../../services/college.service';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AddCollegeModal from './AddCollegeModal';

const CollegesList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

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

  const handleDelete = async (id) => {
    if (window.confirm(t('colleges.deleteConfirm'))) {
      try {
        const result = await collegeService.deleteCollege(id);
        if (result.success) {
          showToast(t('colleges.deleteSuccess'), 'success');
          fetchColleges();
        }
      } catch (error) {
        showToast(error.response?.data?.message || t('colleges.deleteError'), 'error');
      }
    }
  };

  const getCollegeImage = (name) => {
    if (name.includes('Industry')) return 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';
    if (name.includes('Health')) return 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';
    return 'https://images.unsplash.com/photo-1562774053-701939374585?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';
  };

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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('colleges.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t('colleges.subtitle')}</p>
        </div>
        <Button className="flex items-center gap-2" onClick={() => setIsAddModalOpen(true)}>
          <Plus size={18} /> {t('colleges.addCollege')}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {colleges.map((college) => (
            <Card key={college.id} noPadding className="group">
              <div className="relative h-40 w-full overflow-hidden">
                <img 
                  src={getCollegeImage(college.name)} 
                  alt={college.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                  <Badge variant="success">
                    {t('colleges.active')}
                  </Badge>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleDelete(college.id)}
                      className="rounded-full bg-white/20 p-1.5 text-white backdrop-blur-md hover:bg-rose-500/50 transition-colors"
                      title={t('common.delete')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">{college.name}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {college.description}
                </p>

                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase">{t('auth.department')}s</p>
                    <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{college._count?.departments || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase">{t('profile.status')}</p>
                    <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">{t('colleges.operational')}</p>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-2">
                  <Button variant="outline" className="flex-1 text-xs h-9" onClick={() => navigate(`/departments?collegeId=${college.id}`)}>
                    {t('colleges.manageDepts')}
                  </Button>
                  <Button variant="ghost" className="flex-1 text-xs h-9 gap-1.5" onClick={() => navigate(`/colleges/${college.id}`)}>
                    {t('colleges.viewDetails')} <ExternalLink size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddCollegeModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchColleges();
          showToast(t('colleges.addSuccess'), 'success');
        }} 
      />
    </div>
  );
};

export default CollegesList;
