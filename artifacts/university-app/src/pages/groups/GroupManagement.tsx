import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, FolderTree, SplitSquareHorizontal, Trash2, Settings, AlertCircle, ChevronDown, ChevronRight, ChevronLeft, Plus, X } from 'lucide-react';
import studentGroupsService from '../../services/studentGroups.service';
import collegeService from '../../services/college.service';
import Modal from '../../components/ui/Modal';
import { TimeRange } from '../../components/ui/TimeRange';
import departmentService from '../../services/department.service';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { Badge } from '../../components/ui/Badge';

export default function GroupManagement() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const { showToast } = useToast();
  
  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState<number | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  
  const [tree, setTree] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  // Modal States
  const [autoDivideModalOpen, setAutoDivideModalOpen] = useState(false);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  
  // Toggle between numberOfGroups vs maxGroupSize mode
  const [divideMode, setDivideMode] = useState<'number' | 'maxSize'>('number');
  const [splitMode, setSplitMode] = useState<'number' | 'maxSize'>('number');
  const [numGroups, setNumGroups] = useState(2);
  const [maxSize, setMaxSize] = useState(50);

  // Confirmation modal state
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [affectedSlotsList, setAffectedSlotsList] = useState<any[]>([]);

  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role || '');

  useEffect(() => {
    if (isAdmin) {
      collegeService.getColleges({ limit: 100 }).then(res => setColleges(res.data || []));
    }
  }, [isAdmin]);

  useEffect(() => {
    if (selectedCollegeId) {
      departmentService.getDepartments({ collegeId: selectedCollegeId, limit: 100 })
        .then(res => setDepartments(res.data || []));
    } else {
      setDepartments([]);
    }
    setSelectedDeptId(null);
  }, [selectedCollegeId]);

  useEffect(() => {
    if (selectedDeptId) {
      fetchGroups();
    } else {
      setTree([]);
    }
  }, [selectedDeptId]);

  const fetchGroups = async () => {
    if (!selectedDeptId) return;
    setLoading(true);
    try {
      const res = await studentGroupsService.getDepartmentGroups(selectedDeptId);
      setTree(res.data || []);
    } catch (err: any) {
      showToast(err.message || t('groups.fetchFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAutoDivide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptId) return;
    try {
      const payload: any = { };
      if (divideMode === 'number') {
        payload.numberOfGroups = numGroups;
      } else {
        payload.maxGroupSize = maxSize;
      }
      const res = await studentGroupsService.autoDivideStudents(selectedDeptId, payload);
      if (res.requiresConfirmation) {
        // Show confirmation modal
        setConfirmMessage(t('groups.confirmAutoDivide'));
        setAffectedSlotsList(res.affectedSlots || []);
        setConfirmAction(() => async () => {
          payload.confirmed = true;
          await studentGroupsService.autoDivideStudents(selectedDeptId, payload);
          showToast(t('groups.divideSuccess'), 'success');
          setConfirmModalOpen(false);
          setAutoDivideModalOpen(false);
          fetchGroups();
        });
        setConfirmModalOpen(true);
        return;
      }
      showToast(t('groups.divideSuccess'), 'success');
      setAutoDivideModalOpen(false);
      fetchGroups();
    } catch (err: any) {
      showToast(err.message || t('groups.divideFailed'), 'error');
    }
  };

  const handleSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroupId) return;
    try {
      const payload: any = {};
      if (splitMode === 'number') {
        payload.numberOfSubgroups = numGroups;
      } else {
        payload.maxSubgroupSize = maxSize;
      }
      const res = await studentGroupsService.splitGroup(activeGroupId, payload);
      if (res.requiresConfirmation) {
        setConfirmMessage(t('groups.confirmSplit'));
        setAffectedSlotsList(res.affectedSlots || []);
        setConfirmAction(() => async () => {
          payload.confirmed = true;
          await studentGroupsService.splitGroup(activeGroupId!, payload);
          showToast(t('groups.splitSuccess'), 'success');
          setConfirmModalOpen(false);
          setSplitModalOpen(false);
          fetchGroups();
        });
        setConfirmModalOpen(true);
        return;
      }
      showToast(t('groups.splitSuccess'), 'success');
      setSplitModalOpen(false);
      fetchGroups();
    } catch (err: any) {
      showToast(err.message || t('groups.splitFailed'), 'error');
    }
  };

  const handleDelete = async (groupId: number) => {
    try {
      const res = await studentGroupsService.deleteGroup(groupId);
      if (res.requiresConfirmation) {
        setConfirmMessage(t('groups.confirmDelete'));
        setAffectedSlotsList(res.affectedSlots || []);
        setConfirmAction(() => async () => {
          await studentGroupsService.deleteGroup(groupId, { confirmed: true });
          showToast(t('groups.deleteSuccess'), 'success');
          setConfirmModalOpen(false);
          fetchGroups();
        });
        setConfirmModalOpen(true);
        return;
      }
      showToast(t('groups.deleteSuccess'), 'success');
      fetchGroups();
    } catch (err: any) {
      showToast(err.message || t('groups.deleteFailed'), 'error');
    }
  };

  const renderTree = (nodes: any[], level = 0) => {
    if (!nodes || nodes.length === 0) return null;
    
    return (
      <div className="flex flex-col gap-2 w-full mt-2">
        {nodes.map(node => {
          const isExpanded = expandedNodes.has(node.id);
          const hasChildren = node.children && node.children.length > 0;
          
          return (
            <div key={node.id} className="w-full">
              <div 
                className={`flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-primary-500/50 transition-colors ${level > 0 ? 'border-s-4 border-s-brand-primary-500/30' : ''}`}
                style={isRTL ? { marginRight: `${level * 24}px` } : { marginLeft: `${level * 24}px` }}
              >
                <div className="flex items-center gap-3">
                  {hasChildren ? (
                    <button onClick={() => toggleExpand(node.id)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-500">
                      {isExpanded ? (
                        <ChevronDown size={16} />
                      ) : isRTL ? (
                        <ChevronLeft size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </button>
                  ) : (
                    <div className="w-6" /> // spacer
                  )}
                  <div className="flex flex-col">
                    <span className="font-semibold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                      <FolderTree size={16} className="text-brand-primary-500" />
                      {node.name}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-2">
                      <Users size={12} /> {node.studentCount ?? 0} {t('groups.students')}
                      {node.rangeStartName && node.rangeEndName && (
                        <span className="text-slate-400 ms-2">({node.rangeStartName} — {node.rangeEndName})</span>
                      )}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {node.studentCount ?? 0} {t('groups.students')}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveGroupId(node.id);
                        setNumGroups(2);
                        setMaxSize(50);
                        setSplitMode('number');
                        setSplitModalOpen(true);
                      }}
                      className="p-1.5 text-slate-500 hover:text-brand-primary-500 hover:bg-brand-primary-50 dark:hover:bg-brand-primary-900/20 rounded-md transition-colors"
                      title={t('groups.splitGroup')}
                    >
                      <SplitSquareHorizontal size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(node.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-md transition-colors"
                      title={t('groups.deleteGroup')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
              
              {isExpanded && hasChildren && (
                <div className="mt-2">
                  {renderTree(node.children, level + 1)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="section-gap animate-page">
      <PageHeader
        title={t('groups.title')}
        subtitle={t('groups.subtitle')}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {isAdmin && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 ms-1">{t('groups.college')}</label>
            <select
              value={selectedCollegeId || ''}
              onChange={(e) => setSelectedCollegeId(Number(e.target.value) || null)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-primary-500/20"
            >
              <option value="">{t('groups.selectCollege')}</option>
              {colleges.map(c => (
                <option key={c.id} value={c.id}>{isRTL ? c.nameAr || c.name : c.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 ms-1">{t('groups.department')}</label>
          <select
            value={selectedDeptId || ''}
            onChange={(e) => setSelectedDeptId(Number(e.target.value) || null)}
            disabled={!selectedCollegeId && isAdmin}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-primary-500/20"
          >
            <option value="">{t('groups.selectDept')}</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{isRTL ? d.nameAr || d.name : d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedDeptId ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <FolderTree size={20} className="text-brand-primary-500" />
              {t('groups.deptGroups')}
            </CardTitle>
            <Button
              onClick={() => {
                setNumGroups(2);
                setMaxSize(50);
                setDivideMode('number');
                setAutoDivideModalOpen(true);
              }}
              className="bg-brand-primary-500 hover:bg-brand-primary-600 text-white rounded-xl shadow-md text-sm font-semibold"
            >
              <Settings size={16} className="me-2" /> {t('groups.autoDivide')}
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-brand-primary-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : tree.length > 0 ? (
              renderTree(tree)
            ) : (
              <EmptyState
                icon={<FolderTree size={40} />}
                title={t('groups.noGroupsTitle')}
                subtitle={t('groups.noGroupsDesc')}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
          <FolderTree size={48} className="mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300">{t('groups.selectDeptTitle')}</h3>
          <p className="text-sm">{t('groups.selectDeptDesc')}</p>
        </div>
      )}

      {/* Auto-Divide Modal */}
      {autoDivideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-lg font-bold">{t('groups.autoDivideTitle')}</h2>
              <button onClick={() => setAutoDivideModalOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleAutoDivide} className="p-6 space-y-4">
              {/* Toggle between modes */}
              <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDivideMode('number')}
                  className={`flex-1 py-2 text-sm font-semibold transition-colors ${divideMode === 'number' ? 'bg-brand-primary-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                  {t('groups.numGroups')}
                </button>
                <button
                  type="button"
                  onClick={() => setDivideMode('maxSize')}
                  className={`flex-1 py-2 text-sm font-semibold transition-colors ${divideMode === 'maxSize' ? 'bg-brand-primary-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                  {t('groups.maxStudents')}
                </button>
              </div>
              {divideMode === 'number' ? (
                <div>
                  <label className="text-xs font-bold mb-1 block">{t('groups.numGroups')}</label>
                  <input type="number" min="1" value={numGroups} onChange={e => setNumGroups(Number(e.target.value))} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:border-slate-600" required />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold mb-1 block">{t('groups.maxStudents')}</label>
                  <input type="number" min="1" value={maxSize} onChange={e => setMaxSize(Number(e.target.value))} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:border-slate-600" required />
                </div>
              )}
              <Button type="submit" className="w-full bg-brand-primary-500 text-white rounded-xl py-2">{t('groups.executeAutoDivide')}</Button>
            </form>
          </div>
        </div>
      )}

      {/* Split Modal */}
      {splitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-lg font-bold">{t('groups.splitGroupTitle')}</h2>
              <button onClick={() => setSplitModalOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleSplit} className="p-6 space-y-4">
              {/* Toggle between modes */}
              <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSplitMode('number')}
                  className={`flex-1 py-2 text-sm font-semibold transition-colors ${splitMode === 'number' ? 'bg-brand-primary-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                  {t('groups.numSubgroups')}
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('maxSize')}
                  className={`flex-1 py-2 text-sm font-semibold transition-colors ${splitMode === 'maxSize' ? 'bg-brand-primary-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                  {t('groups.maxStudentsSubgroup')}
                </button>
              </div>
              {splitMode === 'number' ? (
                <div>
                  <label className="text-xs font-bold mb-1 block">{t('groups.numSubgroups')}</label>
                  <input type="number" min="2" value={numGroups} onChange={e => setNumGroups(Number(e.target.value))} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:border-slate-600" required />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold mb-1 block">{t('groups.maxStudentsSubgroup')}</label>
                  <input type="number" min="1" value={maxSize} onChange={e => setMaxSize(Number(e.target.value))} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-700 dark:border-slate-600" required />
                </div>
              )}
              <Button type="submit" className="w-full bg-brand-primary-500 text-white rounded-xl py-2">{t('groups.executeSplitGroup')}</Button>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for requiresConfirmation responses */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-lg font-bold flex items-center gap-2 text-amber-600">
                <AlertCircle size={20} /> {t('groups.confirmRequired')}
              </h2>
              <button onClick={() => setConfirmModalOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">{confirmMessage}</p>
              {affectedSlotsList.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-xs font-bold text-slate-500 mb-2">{t('groups.affectedSlots', { count: affectedSlotsList.length })}</p>
                  {affectedSlotsList.map((slot: any, index: number) => (
                    <div key={slot.id || index} className="text-xs text-slate-600 dark:text-slate-400 py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      {t(`days.${(slot.dayOfWeek || '').toLowerCase()}`, slot.dayOfWeek)} <TimeRange start={slot.startTime} end={slot.endTime} /> {slot.room ? `(${slot.room})` : ''} — {t('groups.course')} #{slot.courseId}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmModalOpen(false)}
                  className="flex-1 rounded-xl"
                >
                  {t('groups.cancel')}
                </Button>
                <Button
                  type="button"
                  onClick={() => confirmAction && confirmAction()}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
                >
                  {t('groups.confirmProceed')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
