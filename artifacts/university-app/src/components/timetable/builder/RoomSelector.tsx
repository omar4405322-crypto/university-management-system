import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Search, Plus, Loader2, Check, AlertCircle, Building2 } from 'lucide-react';
import roomsService, { Room } from '../../../services/rooms.service';
import Button from '../../ui/button';
import Badge from '../../ui/badge';

export interface RoomSelectorProps {
  value: number | null;
  roomName: string;
  legacyRoomName?: string | null;
  onChange: (roomId: number | null, roomName: string) => void;
  disabled?: boolean;
  role?: string;
  isRTL?: boolean;
}

export const RoomSelector: React.FC<RoomSelectorProps> = ({
  value,
  roomName,
  legacyRoomName,
  onChange,
  disabled = false,
  role,
  isRTL = false,
}) => {
  const { t } = useTranslation();
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Inline create room state for SUPER_ADMIN
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await roomsService.getRooms({
        search: search.trim() || undefined,
        includeInactive: false,
        limit: 100,
      });
      if (res.success && res.data) {
        const roomList = Array.isArray(res.data) ? res.data : (res.data.rooms || []);
        setRooms(roomList);
      } else {
        setRooms([]);
        setError(res.message || 'Failed to load rooms');
      }
    } catch (err: unknown) {
      setRooms([]);
      setError('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleCreateRoom = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newRoomName.trim() || !isSuperAdmin) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await roomsService.createRoom({
        name: newRoomName.trim(),
        isActive: true,
      });
      if (res.success && res.data) {
        const created = res.data;
        setRooms((prev) => [created, ...prev]);
        onChange(created.id, created.name);
        setNewRoomName('');
        setShowCreateForm(false);
      } else {
        setCreateError(res.message || 'Failed to create room');
      }
    } catch (err: unknown) {
      setCreateError('Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const isLegacyActive = Boolean(!value && (legacyRoomName || (roomName && !rooms.some((r) => r.id === value))));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5">
            <MapPin size={14} className="text-brand-primary-500" />
            {t('schedules.selectRoom', 'Classroom / Hall')}
          </span>
        </label>
        {isSuperAdmin && !disabled && (
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="text-xs font-bold text-brand-primary-600 hover:text-brand-primary-700 dark:text-brand-primary-400 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus size={13} />
            <span>{showCreateForm ? t('common.cancel', 'Cancel') : t('schedules.addNewRoom', 'Add Hall')}</span>
          </button>
        )}
      </div>

      {/* Legacy room retention badge if applicable */}
      {isLegacyActive && (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              {t('schedules.legacyRoomNotice', 'Legacy slot room: ')}
              <strong className="font-bold">{legacyRoomName || roomName}</strong>
            </span>
          </div>
          <Badge variant="warning" className="text-[10px]">
            {t('schedules.legacyRoom', 'Legacy')}
          </Badge>
        </div>
      )}

      {/* SUPER_ADMIN Inline Create Room Form */}
      {showCreateForm && isSuperAdmin && (
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-brand-primary-500/30 space-y-2 animate-in fade-in duration-200">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Building2 size={14} className="text-brand-primary-500" />
            <span>{t('schedules.createRoomTitle', 'Register New Hall in Directory')}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder={t('schedules.roomNamePlaceholder', 'e.g. Hall 301, Lab B...')}
              disabled={isCreating}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => handleCreateRoom()}
              disabled={isCreating || !newRoomName.trim()}
              className="px-3 py-1.5 text-xs font-bold bg-brand-primary-600 hover:bg-brand-primary-700 text-white rounded-lg flex items-center gap-1 cursor-pointer"
            >
              {isCreating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              <span>{t('common.add', 'Add')}</span>
            </Button>
          </div>
          {createError && (
            <p className="text-[11px] text-rose-500 dark:text-rose-400 font-semibold" role="alert">
              {createError}
            </p>
          )}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('schedules.searchRoomsPlaceholder', 'Search rooms by name...')}
          disabled={disabled}
          className="w-full ps-9 pe-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all"
        />
      </div>

      {/* Room Directory List */}
      <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-slate-200 dark:border-slate-700 p-1.5 bg-slate-50/50 dark:bg-slate-900/40">
        {loading ? (
          <div className="p-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 size={14} className="animate-spin text-brand-primary-500" />
            <span>{t('common.loading', 'Loading rooms...')}</span>
          </div>
        ) : rooms.length === 0 ? (
          <div className="p-4 text-center space-y-1 text-slate-500">
            <Building2 size={24} className="mx-auto text-slate-400 opacity-60" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
              {t('schedules.noRoomsFound', 'No rooms found in directory')}
            </p>
            <p className="text-[11px] text-slate-400">
              {isSuperAdmin
                ? t('schedules.superAdminAddRoomHint', 'Use "Add Hall" above to register a room.')
                : t('schedules.contactAdminAddRoom', 'Contact super administrator to create rooms in the directory.')}
            </p>
          </div>
        ) : (
          rooms.map((room) => {
            const isSelected = value === room.id;
            return (
              <button
                key={room.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange(room.id, room.name)}
                className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-semibold text-start transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-brand-primary-500 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin size={13} className={isSelected ? 'text-white' : 'text-slate-400'} />
                  <span className="truncate">{room.name}</span>
                </div>
                {isSelected && <Check size={14} className="text-white shrink-0" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RoomSelector;
