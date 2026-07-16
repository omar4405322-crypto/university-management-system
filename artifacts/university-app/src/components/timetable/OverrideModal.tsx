import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Calendar, Clock, MapPin, FileText, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../hooks/use-toast';
import type { SlotEntry } from '../../types/timetable.types';

interface OverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: SlotEntry | null;
  onSuccess: () => void;
}

export function OverrideModal({ isOpen, onClose, entry, onSuccess }: OverrideModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
    room: '',
    reason: '',
  });

  if (!isOpen || !entry) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry.id) return;
    setLoading(true);
    try {
      if (entry.isTemporarilyModified && entry.overrides && entry.overrides.length > 0) {
        const overrideId = entry.overrides[0].id;
        await api.patch(`/schedules/${entry.id}/overrides/${overrideId}`, {
          startDate: formData.startDate,
          endDate: formData.endDate,
          room: formData.room || undefined,
          reason: formData.reason || undefined,
        });
        toast({ title: t('common.success', 'Success'), description: 'Override updated.' });
      } else {
        await api.post(`/schedules/${entry.id}/overrides`, {
          startDate: formData.startDate,
          endDate: formData.endDate,
          room: formData.room || undefined,
          reason: formData.reason || undefined,
        });
        toast({ title: t('common.success', 'Success'), description: 'Override created.' });
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
        ?? (err as { message?: string })?.message
        ?? 'An error occurred';
      toast({ title: t('common.error', 'Error'), description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!entry.id || !entry.isTemporarilyModified || !entry.overrides || entry.overrides.length === 0) return;
    setLoading(true);
    try {
      await api.delete(`/schedules/${entry.id}/overrides/${entry.overrides[0].id}`);
      toast({ title: t('common.success', 'Success'), description: 'Override removed. Slot reverted to original.' });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
        ?? (err as { message?: string })?.message
        ?? 'An error occurred';
      toast({ title: t('common.error', 'Error'), description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 bg-white dark:bg-slate-800 shadow-2xl rounded-2xl relative animate-in slide-in-from-bottom-4 duration-300">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rtl:left-4 rtl:right-auto text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <Calendar size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {entry.isTemporarilyModified
                ? t('schedule.editOverride', 'Edit Temporary Override')
                : t('schedule.createOverride', 'Set Temporary Override')}
            </h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 ml-11">
            {entry.courseName} &bull; {entry.room || 'No room'}
          </p>
          {entry.isTemporarilyModified && (
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 ml-11 mt-1">
              ⚠ This slot is currently modified by an active override
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Clock size={12} />
                {t('schedule.startDate', 'Start Date')}
              </label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Clock size={12} />
                {t('schedule.endDate', 'End Date')}
              </label>
              <input
                type="date"
                required
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Room */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <MapPin size={12} />
              {t('schedule.roomOverride', 'Room Override')}
              <span className="text-slate-400 font-normal">({t('common.optional', 'optional')})</span>
            </label>
            <input
              type="text"
              placeholder={entry.room || t('schedule.currentRoom', 'Current room')}
              value={formData.room}
              onChange={(e) => setFormData({ ...formData, room: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <FileText size={12} />
              {t('schedule.reason', 'Reason')}
              <span className="text-slate-400 font-normal">({t('common.optional', 'optional')})</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Room renovation, Doctor unavailable..."
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 dark:text-slate-100 placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              {loading ? t('common.saving', 'Saving...') : t('common.save', 'Save Override')}
            </button>
            {entry.isTemporarilyModified && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 font-semibold rounded-xl transition-colors flex items-center gap-1.5 text-sm"
              >
                <Trash2 size={14} />
                {t('schedule.removeOverride', 'Revert')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
