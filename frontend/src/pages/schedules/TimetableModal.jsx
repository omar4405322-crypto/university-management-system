import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Loader2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Clock, 
  User, 
  MapPin, 
  BookOpen 
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import timetableService from '../../services/timetable.service';
import { useTranslation } from 'react-i18next';

const TimetableModal = ({ isOpen, onClose, timetable, onSuccess }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    collegeId: '',
    departmentId: '',
    academicYear: '1',
    semester: '1',
    title: '',
    description: '',
    status: 'DRAFT',
    scheduleData: {
      slots: []
    }
  });

  const [newSlot, setNewSlot] = useState({
    day: 'Monday',
    courseName: '',
    instructor: '',
    startTime: '08:00',
    endTime: '10:00',
    room: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchColleges();
      if (timetable) {
        setFormData({
          ...timetable,
          collegeId: (timetable.collegeId || '').toString(),
          departmentId: (timetable.departmentId || '').toString(),
          academicYear: (timetable.academicYear || '1').toString(),
          semester: (timetable.semester || '1').toString(),
          scheduleData: timetable.scheduleData?.slots ? timetable.scheduleData : { slots: [] }
        });
        if (timetable.collegeId) fetchDepartments(timetable.collegeId);
      } else {
        resetForm();
      }
    }
  }, [isOpen, timetable]);

  const resetForm = () => {
    setFormData({
      collegeId: '',
      departmentId: '',
      academicYear: '1',
      semester: '1',
      title: '',
      description: '',
      status: 'DRAFT',
      scheduleData: { slots: [] }
    });
    setError('');
  };

  const fetchColleges = async () => {
    try {
      const res = await collegeService.getColleges();
      if (res.success) {
        setColleges(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error(err);
      setColleges([]);
    }
  };

  const fetchDepartments = async (collegeId) => {
    try {
      const res = await departmentService.getDepartments({ collegeId });
      if (res.success) {
        setDepartments(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error(err);
      setDepartments([]);
    }
  };

  const handleCollegeChange = (id) => {
    setFormData({ ...formData, collegeId: id, departmentId: '' });
    if (id) fetchDepartments(id);
  };

  const addSlot = () => {
    if (!newSlot.courseName || !newSlot.startTime || !newSlot.endTime) {
      setError('Please fill in course name, start time, and end time.');
      return;
    }
    
    setFormData({
      ...formData,
      scheduleData: {
        ...formData.scheduleData,
        slots: [...(formData.scheduleData?.slots || []), { ...newSlot, id: Date.now() }]
      }
    });
    
    setNewSlot({
      day: 'Monday',
      courseName: '',
      instructor: '',
      startTime: '08:00',
      endTime: '10:00',
      room: ''
    });
    setError('');
  };

  const removeSlot = (id) => {
    setFormData({
      ...formData,
      scheduleData: {
        ...formData.scheduleData,
        slots: (formData.scheduleData?.slots || []).filter(s => s.id !== id)
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Create a clean copy for the API
      const payload = {
        collegeId: parseInt(formData.collegeId),
        departmentId: parseInt(formData.departmentId),
        academicYear: parseInt(formData.academicYear),
        semester: parseInt(formData.semester),
        title: formData.title,
        description: formData.description,
        status: formData.status,
        scheduleData: formData.scheduleData
      };

      if (timetable) {
        await timetableService.updateTimetable(timetable.id, payload);
      } else {
        await timetableService.createTimetable(payload);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || t('common.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={timetable ? t('timetables.edit') : t('timetables.create')}
      subtitle={t('timetables.subtitle')}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="form-section">
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-bold flex items-center gap-2">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {/* Basic Info Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h3 className="text-lg font-black text-brand-text-main border-b border-brand-border pb-2">
              {t('common.basicInfo')}
            </h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-black text-brand-text-main uppercase tracking-widest ml-1">{t('timetables.selectFaculty')} *</label>
                <select
                  required
                  className="w-full h-11 px-4 bg-brand-bg-page/50 border border-brand-border rounded-xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20"
                  value={formData.collegeId}
                  onChange={(e) => handleCollegeChange(e.target.value)}
                >
                  <option value="">{t('timetables.selectFaculty')}</option>
                  {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-black text-brand-text-main uppercase tracking-widest ml-1">{t('timetables.selectDept')} *</label>
                <select
                  required
                  className="w-full h-11 px-4 bg-brand-bg-page/50 border border-brand-border rounded-xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 disabled:opacity-50"
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  disabled={!formData.collegeId}
                >
                  <option value="">{t('timetables.selectDept')}</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-black text-brand-text-main uppercase tracking-widest ml-1">{t('timetables.academicYear')} *</label>
                  <select
                    required
                    className="w-full h-11 px-4 bg-brand-bg-page/50 border border-brand-border rounded-xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20"
                    value={formData.academicYear}
                    onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                  >
                    {[1, 2, 3, 4, 5].map(y => <option key={y} value={y}>{t('auth.year')} {y}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-black text-brand-text-main uppercase tracking-widest ml-1">{t('timetables.semester')} *</label>
                  <select
                    required
                    className="w-full h-11 px-4 bg-brand-bg-page/50 border border-brand-border rounded-xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20"
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-black text-brand-text-main border-b border-brand-border pb-2">
              {t('timetables.details')}
            </h3>
            <div className="space-y-4">
              <Input
                label={t('common.title') + " *"}
                placeholder="e.g. CS Year 2 - Fall 2026"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
              <div className="space-y-1.5">
                <label className="text-sm font-black text-brand-text-main uppercase tracking-widest ml-1">{t('common.description')}</label>
                <textarea
                  className="w-full p-4 bg-brand-bg-page/50 border border-brand-border rounded-xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20 min-h-[80px]"
                  placeholder="Notes..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-black text-brand-text-main uppercase tracking-widest ml-1">{t('finance.status')}</label>
                <select
                  className="w-full h-11 px-4 bg-brand-bg-page/50 border border-brand-border rounded-xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="DRAFT">{t('timetables.draft')}</option>
                  <option value="PUBLISHED">{t('timetables.published')}</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Schedule Grid Editor */}
        <div className="space-y-6">
          <h3 className="text-lg font-black text-brand-text-main border-b border-brand-border pb-2 flex items-center justify-between">
            {t('nav.schedule')}
            <Badge variant="info">{formData.scheduleData.slots.length} {t('nav.schedule')}</Badge>
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end bg-brand-navy/5 p-6 rounded-3xl border border-brand-border">
            <div className="lg:col-span-2 space-y-1.5">
              <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest ml-1">{t('timetables.day')}</label>
              <select
                className="w-full h-11 px-3 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border rounded-xl text-xs font-bold text-brand-text-primary dark:text-brand-text-main"
                value={newSlot.day}
                onChange={(e) => setNewSlot({ ...newSlot, day: e.target.value })}
              >
                {days.map(d => <option key={d} value={d}>{t(`days.${d.toLowerCase()}`)}</option>)}
              </select>
            </div>
            <div className="lg:col-span-3 space-y-1.5">
              <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest ml-1">{t('timetables.courseName')}</label>
              <input
                className="w-full h-11 px-3 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border rounded-xl text-xs font-bold text-brand-text-primary dark:text-brand-text-main"
                placeholder="e.g. Data Structures"
                value={newSlot.courseName}
                onChange={(e) => setNewSlot({ ...newSlot, courseName: e.target.value })}
              />
            </div>
            <div className="lg:col-span-2 space-y-1.5">
              <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest ml-1">{t('timetables.instructor')}</label>
              <input
                className="w-full h-11 px-3 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border rounded-xl text-xs font-bold text-brand-text-primary dark:text-brand-text-main"
                placeholder="Professor name"
                value={newSlot.instructor}
                onChange={(e) => setNewSlot({ ...newSlot, instructor: e.target.value })}
              />
            </div>
            <div className="lg:col-span-2 space-y-1.5">
              <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest ml-1">{t('timetables.startTime')}</label>
              <input
                type="time"
                className="w-full h-11 px-3 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border rounded-xl text-xs font-bold text-brand-text-primary dark:text-brand-text-main"
                value={newSlot.startTime}
                onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })}
              />
            </div>
            <div className="lg:col-span-1 space-y-1.5">
              <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest ml-1">{t('timetables.room')}</label>
              <input
                className="w-full h-11 px-3 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border rounded-xl text-xs font-bold text-brand-text-primary dark:text-brand-text-main"
                placeholder="Hall A"
                value={newSlot.room}
                onChange={(e) => setNewSlot({ ...newSlot, room: e.target.value })}
              />
            </div>
            <div className="lg:col-span-2">
              <Button type="button" onClick={addSlot} className="w-full h-11 flex items-center justify-center gap-2">
                <Plus size={16} /> {t('common.add')}
              </Button>
            </div>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {(formData.scheduleData?.slots || []).length === 0 ? (
              <div className="text-center py-12 bg-brand-bg-page/30 border border-dashed border-brand-border rounded-3xl">
                <p className="text-sm font-bold text-brand-text-muted">{t('timetables.noSlots')}</p>
              </div>
            ) : (
              (formData.scheduleData?.slots || []).map((slot, idx) => (
                <div key={slot.id || idx} className="flex items-center justify-between p-4 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border rounded-2xl hover:border-brand-green/30 transition-all group">
                  <div className="flex items-center gap-6">
                    <div className="w-24 text-xs font-black text-brand-navy bg-brand-navy/5 py-1 px-3 rounded-lg text-center">
                      {t(`days.${(slot.day || 'Monday').toLowerCase()}`)}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-brand-text-main">{slot.courseName}</span>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-[10px] font-bold text-brand-text-muted">
                            <Clock size={12} /> {slot.startTime} - {slot.endTime}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-bold text-brand-text-muted">
                            <User size={12} /> {slot.instructor}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-bold text-brand-text-muted">
                            <MapPin size={12} /> {slot.room}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => removeSlot(slot.id)}
                    className="p-2 text-brand-text-muted hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-brand-border flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={loading} className="min-w-[140px] shadow-lg shadow-brand-green/20">
            {loading ? <Loader2 className="animate-spin" size={18} /> : (
              <span className="flex items-center gap-2">
                <Save size={18} /> {timetable ? t('common.update') : t('common.save')}
              </span>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default TimetableModal;
