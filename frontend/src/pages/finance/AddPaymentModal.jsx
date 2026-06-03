import React, { useState, useEffect } from 'react';
import studentsService from '../../services/students.service';
import paymentsService from '../../services/payments.service';
import { Search, AlertCircle, Loader2, DollarSign, Calendar, FileText, User } from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { useTranslation } from 'react-i18next';

const AddPaymentModal = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    studentId: '',
    type: 'TUITION',
    amount: '',
    description: '',
    dueDate: '',
  });
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchStudents();
    }
  }, [isOpen]);

  const fetchStudents = async () => {
    try {
      const result = await studentsService.getStudents();
      if (result.success) {
        setStudents(result.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredStudents = students.filter(s => 
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.studentId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.studentId) {
      setError(t('finance.selectStudent'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await paymentsService.createPayment(formData);
      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.message || t('finance.createError'));
      }
    } catch (err) {
      setError(err.response?.data?.message || t('finance.createError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('finance.addNewPayment')}
      subtitle={t('finance.addPaymentDesc')}
    >
      <form onSubmit={handleSubmit} className="form-section">
        {error && (
          <div className="p-4 bg-rose-500 text-white rounded-xl text-sm font-medium flex items-center gap-2 animate-in shake duration-300">
            <AlertCircle size={18} />
            {error}
          </div>
        )}
        
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <User size={14} className="text-brand-text-muted" /> {t('finance.studentAssignment')} <span className="text-rose-500">*</span>
            </label>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted group-focus-within:text-brand-green transition-colors" size={16} />
              <Input
                placeholder={t('finance.searchStudentPlaceholder')}
                className="pl-10 bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              required
              className="w-full h-10 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer select-custom-arrow"
              value={formData.studentId}
              onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
            >
              <option value="">{t('finance.selectStudent')}</option>
              {filteredStudents.map(s => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} ({s.studentId})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
                <FileText size={14} className="text-brand-text-muted" /> {t('finance.paymentType')} <span className="text-rose-500">*</span>
              </label>
              <select
                required
                className="w-full h-10 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all appearance-none cursor-pointer select-custom-arrow"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="TUITION">{t('finance.tuition')}</option>
                <option value="REGISTRATION">{t('finance.registration')}</option>
                <option value="LIBRARY">{t('finance.library')}</option>
                <option value="OTHER">{t('finance.other')}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
                <DollarSign size={14} className="text-brand-text-muted" /> {t('finance.amount')} <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                required
                step="0.01"
                min="0"
                placeholder="0.00"
                className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all font-bold"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <Calendar size={14} className="text-brand-text-muted" /> {t('finance.dueDate')}
            </label>
            <Input
              type="date"
              className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-brand-text-main flex items-center gap-2 ml-1">
              <FileText size={14} className="text-brand-text-muted" /> {t('finance.description')}
            </label>
            <textarea
              rows="3"
              placeholder={t('finance.descriptionPlaceholder')}
              className="w-full px-4 py-2 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all resize-none placeholder:text-brand-text-muted"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            ></textarea>
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
            {loading ? <Loader2 className="animate-spin" size={20} /> : t('finance.createPayment')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddPaymentModal;
