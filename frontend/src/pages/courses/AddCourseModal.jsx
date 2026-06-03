import React, { useState, useEffect } from 'react';
import coursesService from '../../services/courses.service';
import doctorsService from '../../services/doctors.service';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTranslation } from 'react-i18next';
import { BookOpen, User, Hash, FileText, Users, CreditCard, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

const AddCourseModal = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    courseCode: '',
    name: '',
    description: '',
    credits: 3,
    maxStudents: 30,
    doctorId: '',
  });
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchDoctors();
    }
  }, [isOpen]);

  const fetchDoctors = async () => {
    try {
      const result = await doctorsService.getDoctors({ limit: 100 });
      if (result.success) {
        setDoctors(result.data.doctors);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ 
      ...formData, 
      [name]: (name === 'credits' || name === 'maxStudents') ? parseInt(value) || 0 : value 
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.courseCode || !formData.name || !formData.credits || !formData.maxStudents) {
      showToast(t('courses.fillRequired'), 'error');
      return;
    }

    try {
      setLoading(true);
      const result = await coursesService.createCourse(formData);
      if (result.success) {
        onSuccess();
      }
    } catch (error) {
      showToast(error.response?.data?.message || t('courses.createError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('courses.addNew')}
      subtitle={t('courses.addDesc')}
    >
      <form onSubmit={handleSubmit} className="form-section">
        {toast && (
          <div className={`p-4 rounded-xl text-white flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-brand-green'}`}>
            {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Hash size={14} className="text-brand-text-muted" /> {t('courses.courseCode')} <span className="text-rose-500">*</span>
            </label>
            <Input
              name="courseCode"
              value={formData.courseCode}
              onChange={handleChange}
              placeholder="e.g. CS101"
              required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <BookOpen size={14} className="text-brand-text-muted" /> {t('courses.courseName')} <span className="text-rose-500">*</span>
            </label>
            <Input
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Intro to CS"
              required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <FileText size={14} className="text-brand-text-muted" /> {t('courses.description')}
            </label>
            <textarea
              name="description"
              rows="3"
              value={formData.description}
              onChange={handleChange}
              placeholder={t('courses.descPlaceholder')}
              className="w-full px-4 py-2 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all resize-none placeholder:text-brand-text-muted"
            ></textarea>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <CreditCard size={14} className="text-brand-text-muted" /> {t('courses.credits')} <span className="text-rose-500">*</span>
            </label>
            <Input
              type="number"
              name="credits"
              min="1"
              max="10"
              value={formData.credits}
              onChange={handleChange}
              required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Users size={14} className="text-brand-text-muted" /> {t('courses.maxStudents')} <span className="text-rose-500">*</span>
            </label>
            <Input
              type="number"
              name="maxStudents"
              min="1"
              value={formData.maxStudents}
              onChange={handleChange}
              required
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <User size={14} className="text-brand-text-muted" /> {t('courses.assignDoctor')}
            </label>
            <select
              name="doctorId"
              value={formData.doctorId}
              onChange={handleChange}
              className="w-full h-10 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23132231'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
            >
              <option value="">{t('courses.unassigned')}</option>
              {doctors.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.firstName} {doc.lastName} ({doc.doctorId})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-brand-border pt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={loading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="min-w-[140px]"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : t('courses.addCourse')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddCourseModal;

export default AddCourseModal;
