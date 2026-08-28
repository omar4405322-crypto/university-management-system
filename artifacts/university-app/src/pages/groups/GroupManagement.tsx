// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Loader2,
  FolderTree,
  SplitSquareHorizontal,
  Trash2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search,
  RotateCcw,
  Building2,
  Sparkles,
  LayoutGrid,
  ListTree,
  RefreshCw,
  ArrowRight,
  ChevronsUpDown,
  Folder,
  Layers,
  X,
  RotateCw,
  Plus
} from 'lucide-react';
import studentGroupsService from '../../services/studentGroups.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import Modal from '../../components/ui/Modal';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/button';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import Badge from '../../components/ui/Badge';

export default function GroupManagement() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const { showToast } = useToast();

  // Core Data States
  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>('all');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'tree'>('grid');

  // Expanded Tree Nodes State
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Modal States
  const [autoDivideModalOpen, setAutoDivideModalOpen] = useState(false);
  const [targetDeptForDivide, setTargetDeptForDivide] = useState<number | null>(null);
  const [targetYearForDivide, setTargetYearForDivide] = useState<number>(1);
  const [divideMode, setDivideMode] = useState<'number' | 'maxSize'>('number');
  const [numGroups, setNumGroups] = useState(2);
  const [maxSize, setMaxSize] = useState(30);

  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [activeGroupToSplit, setActiveGroupToSplit] = useState<any>(null);
  const [splitMode, setSplitMode] = useState<'number' | 'maxSize'>('number');
  const [numSubgroups, setNumSubgroups] = useState(2);
  const [maxSubgroupSize, setMaxSubgroupSize] = useState(15);

  // Safety Confirmation Modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [affectedSlotsList, setAffectedSlotsList] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role || '');

  // 1. Initial Data Fetching
  const fetchAllData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [groupsRes, collegesRes, deptsRes] = await Promise.all([
        studentGroupsService.getAllGroups(),
        collegeService.getColleges({ limit: 100 }).catch(() => ({ data: [] })),
        departmentService.getDepartments({ limit: 200 }).catch(() => ({ data: [] })),
      ]);

      const rawGroups = Array.isArray(groupsRes?.data) ? groupsRes.data : [];
      const rawColleges = Array.isArray(collegesRes?.data) ? collegesRes.data : collegesRes?.data?.data || [];
      const rawDepts = Array.isArray(deptsRes?.data) ? deptsRes.data : [];

      setAllGroups(rawGroups);
      setColleges(rawColleges);
      setDepartments(rawDepts);

      // Auto expand root nodes
      const initialExpanded = new Set<string>();
      rawGroups.forEach((g: any) => {
        initialExpanded.add(`group-${g.id}`);
      });
      setExpandedNodes(initialExpanded);
    } catch (err: any) {
      showToast(err.message || t('groups.fetchFailed', 'Failed to fetch groups data'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t, showToast]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Filtered Departments based on selected College
  const availableDepartments = useMemo(() => {
    if (selectedCollegeId === 'all') return departments;
    const cid = parseInt(selectedCollegeId, 10);
    return departments.filter((d) => d.collegeId === cid);
  }, [departments, selectedCollegeId]);

  // Hierarchical Filtered Groups Calculation
  const filteredHierarchy = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const matchesGroup = (g: any): boolean => {
      if (!g) return false;
      const nameMatches = !query || (g.name || '').toLowerCase().includes(query);
      const studentRangeMatches =
        !query ||
        (g.rangeStartName && g.rangeStartName.toLowerCase().includes(query)) ||
        (g.rangeEndName && g.rangeEndName.toLowerCase().includes(query));

      const childrenMatch = g.children && g.children.some((c: any) => matchesGroup(c));
      return Boolean(nameMatches || studentRangeMatches || childrenMatch);
    };

    return allGroups.filter((group: any) => {
      // 1. College Filter
      if (selectedCollegeId !== 'all') {
        const colId = group.department?.collegeId || group.department?.college?.id;
        if (String(colId) !== String(selectedCollegeId)) return false;
      }

      // 2. Department Filter
      if (selectedDeptId !== 'all') {
        if (String(group.departmentId) !== String(selectedDeptId)) return false;
      }

      // 3. Academic Year Filter
      if (selectedYear !== 'all') {
        const yNum = parseInt(selectedYear, 10);
        if (group.year !== yNum) return false;
      }

      // 4. Search Filter
      return matchesGroup(group);
    });
  }, [allGroups, selectedCollegeId, selectedDeptId, selectedYear, searchQuery]);

  // Compute Metrics
  const metrics = useMemo(() => {
    let totalStudents = 0;
    let totalSubgroups = 0;
    const activeDeptIds = new Set<number>();

    const traverse = (g: any) => {
      if (g.departmentId) activeDeptIds.add(g.departmentId);
      const sCount = g._count?.students ?? g.studentCount ?? 0;
      totalStudents += sCount;

      if (g.children && g.children.length > 0) {
        totalSubgroups += g.children.length;
        g.children.forEach(traverse);
      }
    };

    filteredHierarchy.forEach(traverse);

    return {
      totalRootGroups: filteredHierarchy.length,
      totalSubgroups,
      totalStudents,
      activeDepartmentsCount: activeDeptIds.size,
    };
  }, [filteredHierarchy]);

  // Tree Expand / Collapse Helpers
  const toggleNode = (nodeKey: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeKey)) next.delete(nodeKey);
      else next.add(nodeKey);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>();
    const traverse = (g: any) => {
      all.add(`group-${g.id}`);
      if (g.children) g.children.forEach(traverse);
    };
    allGroups.forEach(traverse);
    setExpandedNodes(all);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Modals & Actions
  const openAutoDivideModal = (deptId?: number, yearNum?: number) => {
    if (deptId) {
      setTargetDeptForDivide(deptId);
    } else if (selectedDeptId !== 'all') {
      setTargetDeptForDivide(parseInt(selectedDeptId, 10));
    } else if (departments.length > 0) {
      setTargetDeptForDivide(departments[0].id);
    }
    setTargetYearForDivide(yearNum || (selectedYear !== 'all' ? parseInt(selectedYear, 10) : 1));
    setAutoDivideModalOpen(true);
  };

  const handleExecuteAutoDivide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDeptForDivide) return;

    setActionLoading(true);
    try {
      const payload: any = { year: targetYearForDivide };
      if (divideMode === 'number') {
        payload.numberOfGroups = numGroups;
      } else {
        payload.maxGroupSize = maxSize;
      }

      const res = await studentGroupsService.autoDivideStudents(targetDeptForDivide, payload);
      if (res.requiresConfirmation) {
        setConfirmMessage(t('groups.confirmAutoDivide'));
        setAffectedSlotsList(res.affectedSlots || []);
        setConfirmAction(() => async () => {
          payload.confirmed = true;
          await studentGroupsService.autoDivideStudents(targetDeptForDivide, payload);
          showToast(t('groups.divideSuccess'), 'success');
          setConfirmModalOpen(false);
          setAutoDivideModalOpen(false);
          fetchAllData(true);
        });
        setConfirmModalOpen(true);
        return;
      }

      showToast(t('groups.divideSuccess'), 'success');
      setAutoDivideModalOpen(false);
      fetchAllData(true);
    } catch (err: any) {
      showToast(err.message || t('groups.divideFailed'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openSplitModal = (group: any) => {
    setActiveGroupToSplit(group);
    setSplitModalOpen(true);
  };

  const handleExecuteSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroupToSplit) return;

    setActionLoading(true);
    try {
      const payload: any = {};
      if (splitMode === 'number') {
        payload.numberOfSubgroups = numSubgroups;
      } else {
        payload.maxSubgroupSize = maxSubgroupSize;
      }

      const res = await studentGroupsService.splitGroup(activeGroupToSplit.id, payload);
      if (res.requiresConfirmation) {
        setConfirmMessage(t('groups.confirmSplit'));
        setAffectedSlotsList(res.affectedSlots || []);
        setConfirmAction(() => async () => {
          payload.confirmed = true;
          await studentGroupsService.splitGroup(activeGroupToSplit.id, payload);
          showToast(t('groups.splitSuccess'), 'success');
          setConfirmModalOpen(false);
          setSplitModalOpen(false);
          fetchAllData(true);
        });
        setConfirmModalOpen(true);
        return;
      }

      showToast(t('groups.splitSuccess'), 'success');
      setSplitModalOpen(false);
      fetchAllData(true);
    } catch (err: any) {
      showToast(err.message || t('groups.splitFailed'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    try {
      const res = await studentGroupsService.deleteGroup(groupId);
      if (res.requiresConfirmation) {
        setConfirmMessage(t('groups.confirmDelete'));
        setAffectedSlotsList(res.affectedSlots || []);
        setConfirmAction(() => async () => {
          await studentGroupsService.deleteGroup(groupId, { confirmed: true });
          showToast(t('groups.deleteSuccess'), 'success');
          setConfirmModalOpen(false);
          fetchAllData(true);
        });
        setConfirmModalOpen(true);
        return;
      }

      showToast(t('groups.deleteSuccess'), 'success');
      fetchAllData(true);
    } catch (err: any) {
      showToast(err.message || t('groups.deleteFailed'), 'error');
    }
  };

  // Render Recursive Tree Node
  const renderTreeGroupNode = (group: any, level = 0) => {
    const nodeKey = `group-${group.id}`;
    const isExpanded = expandedNodes.has(nodeKey);
    const hasChildren = group.children && group.children.length > 0;
    const studentCount = group._count?.students ?? group.studentCount ?? 0;

    return (
      <div key={group.id} className="w-full flex flex-col gap-2">
        <div
          className={`flex items-center justify-between p-3 bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/90 rounded-2xl shadow-2xs hover:border-brand-primary-500/50 hover:shadow-xs transition-all ${
            level > 0 ? 'border-s-4 border-s-brand-primary-500/40 bg-slate-50/50 dark:bg-slate-900/40' : ''
          }`}
          style={isRTL ? { marginRight: `${level * 20}px` } : { marginLeft: `${level * 20}px` }}
        >
          <div className="flex items-center gap-2.5">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleNode(nodeKey)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"
                aria-label="Toggle node"
              >
                {isExpanded ? (
                  <ChevronDown size={16} />
                ) : isRTL ? (
                  <ChevronLeft size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </button>
            ) : (
              <div className="w-5" />
            )}

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <FolderTree size={15} className="text-brand-primary-500 shrink-0" />
                <span className="font-bold text-xs md:text-sm text-slate-800 dark:text-white">
                  {group.name}
                </span>
                {group.year && (
                  <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    {t('groups.yearPill', { year: group.year })}
                  </span>
                )}
              </div>
              {group.rangeStartName && group.rangeEndName && (
                <span className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  {group.rangeStartName} → {group.rangeEndName}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
              <Users size={12} />
              <span>{studentCount} {t('groups.students')}</span>
            </span>

            {isAdmin && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openSplitModal(group)}
                  className="h-7 px-2 text-xs font-bold text-brand-primary-600 hover:bg-brand-primary-50 dark:hover:bg-brand-primary-900/30 rounded-lg transition-colors flex items-center gap-1"
                  title={t('groups.splitGroup')}
                >
                  <SplitSquareHorizontal size={13} />
                  <span className="hidden sm:inline">{t('groups.splitGroup')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteGroup(group.id)}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                  title={t('groups.deleteGroup')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="flex flex-col gap-2 w-full">
            {group.children.map((child: any) => renderTreeGroupNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCollegeId('all');
    setSelectedDeptId('all');
    setSelectedYear('all');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCollegeId !== 'all' ||
    selectedDeptId !== 'all' ||
    selectedYear !== 'all';

  return (
    <div className="section-gap animate-in fade-in duration-500 space-y-4 w-full min-w-0 pb-20">
      {/* 1. Sleek Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-800 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400">
              <FolderTree size={22} />
            </span>
            {t('groups.title', 'Groups & Subgroups Management')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            {t('groups.subtitle', 'Organize student groups, sections, and automated section splits')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Mode Switcher (Grid vs Tree) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-brand-primary-600 dark:text-brand-primary-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <LayoutGrid size={14} />
              <span>{t('groups.cardView', 'Cards')}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'tree'
                  ? 'bg-white dark:bg-slate-700 text-brand-primary-600 dark:text-brand-primary-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <ListTree size={14} />
              <span>{t('groups.treeView', 'Tree')}</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchAllData(true)}
            disabled={refreshing}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all border border-slate-200 dark:border-slate-700 shadow-2xs active:scale-95 cursor-pointer"
            title={t('common.refresh', 'Refresh')}
          >
            <RotateCw size={15} className={refreshing || loading ? 'animate-spin' : ''} />
          </button>

          {/* Auto Divide Button */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => openAutoDivideModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold text-xs shadow-sm shadow-brand-primary-500/20 active:scale-95 transition-all"
            >
              <Sparkles size={15} />
              <span>{t('groups.autoDivide', 'Auto Divide')}</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. EXECUTIVE 4-METRIC RIBBON                                              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {/* Total Main Groups */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('groups.totalGroups', 'Total Main Groups')}
            </span>
            <span className="text-lg font-black text-brand-primary-600 dark:text-brand-primary-400 block mt-0.5 font-mono">
              {metrics.totalRootGroups}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-950/50 text-brand-primary-600 flex items-center justify-center shrink-0">
            <FolderTree size={16} />
          </div>
        </div>

        {/* Total Subgroups / Sections */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('groups.totalSubgroups', 'Subgroups & Sections')}
            </span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 block mt-0.5 font-mono">
              {metrics.totalSubgroups}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
            <SplitSquareHorizontal size={16} />
          </div>
        </div>

        {/* Total Enrolled Students */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('groups.assignedStudents', 'Distributed Students')}
            </span>
            <span className="text-lg font-black text-blue-600 dark:text-blue-400 block mt-0.5 font-mono">
              {metrics.totalStudents}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
            <Users size={16} />
          </div>
        </div>

        {/* Active Departments */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              {t('groups.activeDepartments', 'Active Departments')}
            </span>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400 block mt-0.5 font-mono">
              {metrics.activeDepartmentsCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
            <Layers size={16} />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. UNIFIED COMPACT FILTER TOOLBAR                                         */}
      {/* ========================================================================= */}
      <div className="p-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('groups.searchPlaceholder', 'Search groups, sections, or student names...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8.5 ps-8 pe-8 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* College Dropdown */}
        <select
          value={selectedCollegeId}
          onChange={(e) => {
            setSelectedCollegeId(e.target.value);
            setSelectedDeptId('all');
          }}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="all">{t('common.allColleges', 'All Colleges')}</option>
          {colleges.map((c) => (
            <option key={c.id} value={c.id}>
              {isRTL ? c.nameAr || c.name : c.name}
            </option>
          ))}
        </select>

        {/* Department Dropdown */}
        <select
          value={selectedDeptId}
          onChange={(e) => setSelectedDeptId(e.target.value)}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="all">{t('common.allDepartments', 'All Departments')}</option>
          {availableDepartments.map((d) => (
            <option key={d.id} value={d.id}>
              {isRTL ? d.nameAr || d.name : d.name}
            </option>
          ))}
        </select>

        {/* Year Dropdown */}
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="h-8.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer"
        >
          <option value="all">{t('common.allYears', 'All Years')}</option>
          <option value="1">{t('common.year', 'Year')} 1</option>
          <option value="2">{t('common.year', 'Year')} 2</option>
          <option value="3">{t('common.year', 'Year')} 3</option>
          <option value="4">{t('common.year', 'Year')} 4</option>
        </select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            className="h-8.5 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl font-bold cursor-pointer"
          >
            <X size={13} className="me-1" />
            {t('common.clear', 'Clear')}
          </Button>
        )}

        {/* Tree Controls (If tree view active) */}
        {viewMode === 'tree' && (
          <div className="flex items-center gap-1 ms-auto">
            <button
              type="button"
              onClick={expandAll}
              className="h-8.5 px-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            >
              {t('groups.expandAll', 'Expand All')}
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="h-8.5 px-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            >
              {t('groups.collapseAll', 'Collapse All')}
            </button>
          </div>
        )}
      </div>

      {/* 3. Main Views: Cards Grid vs Tree Hierarchy */}
      {loading ? (
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 flex flex-col items-center justify-center gap-3 text-center">
          <Loader2 className="animate-spin text-brand-primary-500" size={32} />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {t('groups.loadingGroups', 'Loading student groups...')}
          </p>
        </Card>
      ) : filteredHierarchy.length === 0 ? (
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-full bg-brand-primary-500/10 text-brand-primary-500 flex items-center justify-center text-2xl mb-3">
            <FolderTree size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
            {hasActiveFilters ? t('groups.noGroupsFound', 'No Groups Match Filter') : t('groups.emptyTitle', 'No Groups Created Yet')}
          </h3>
          <p className="text-xs text-slate-400 font-medium max-w-sm mb-4">
            {hasActiveFilters
              ? t('groups.noGroupsFoundDesc', 'Try clearing some of your search or department filters.')
              : t('groups.emptySubtitle', 'Auto divide students into groups or create your first group structure.')}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-1.5 bg-brand-primary-500 text-white font-bold rounded-xl text-xs shadow-xs flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              <span>{t('groups.resetFilters', 'Reset Filters')}</span>
            </button>
          ) : (
            isAdmin && (
              <button
                type="button"
                onClick={() => openAutoDivideModal()}
                className="px-4 py-2 rounded-xl bg-brand-primary-500 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
              >
                <Sparkles size={15} />
                <span>{t('groups.autoDivide', 'Auto Divide')}</span>
              </button>
            )
          )}
        </Card>
      ) : viewMode === 'tree' ? (
        /* MODE A: HIERARCHICAL TREE VIEW */
        <div className="flex flex-col gap-2.5">
          {filteredHierarchy.map((group: any) => renderTreeGroupNode(group, 0))}
        </div>
      ) : (
        /* MODE B: RESPONSIVE CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredHierarchy.map((group: any) => {
            const studentCount = group._count?.students ?? group.studentCount ?? 0;
            const subCount = group.children ? group.children.length : 0;

            return (
              <Card
                key={group.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400">
                        <FolderTree size={16} />
                      </span>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {group.name}
                      </h4>
                    </div>

                    {group.year && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                        {t('groups.yearPill', { year: group.year })}
                      </span>
                    )}
                  </div>

                  {/* Dept & College */}
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-3">
                    {group.department?.nameAr || group.department?.name || t('common.generalDept', 'Department')}
                  </p>

                  {/* Student Roll Range */}
                  {group.rangeStartName && group.rangeEndName && (
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400 mb-3">
                      {group.rangeStartName} → {group.rangeEndName}
                    </div>
                  )}

                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                      <Users size={12} />
                      <span>{studentCount} {t('groups.students')}</span>
                    </span>

                    {subCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800">
                        <SplitSquareHorizontal size={12} />
                        <span>{subCount} {t('groups.totalSubgroups', 'Subgroups')}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                {isAdmin && (
                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => openSplitModal(group)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
                    >
                      <SplitSquareHorizontal size={13} />
                      <span>{t('groups.splitGroup')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(group.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                      title={t('groups.deleteGroup')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Auto Divide Modal */}
      {autoDivideModalOpen && (
        <Modal
          isOpen={autoDivideModalOpen}
          onClose={() => setAutoDivideModalOpen(false)}
          title={t('groups.autoDivideTitle', 'Auto Divide Students into Groups')}
        >
          <form onSubmit={handleExecuteAutoDivide} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('common.department', 'Department')}
              </label>
              <select
                value={targetDeptForDivide || ''}
                onChange={(e) => setTargetDeptForDivide(parseInt(e.target.value, 10))}
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white"
                required
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {isRTL ? d.nameAr || d.name : d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('common.year', 'Academic Year')}
              </label>
              <select
                value={targetYearForDivide}
                onChange={(e) => setTargetYearForDivide(parseInt(e.target.value, 10))}
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white"
              >
                <option value={1}>{t('common.year', 'Year')} 1</option>
                <option value={2}>{t('common.year', 'Year')} 2</option>
                <option value={3}>{t('common.year', 'Year')} 3</option>
                <option value={4}>{t('common.year', 'Year')} 4</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('groups.divideMethod', 'Division Method')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDivideMode('number')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                    divideMode === 'number'
                      ? 'bg-brand-primary-50 dark:bg-brand-primary-950/40 border-brand-primary-500 text-brand-primary-700 dark:text-brand-primary-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {t('groups.byNumberOfGroups', 'By Number of Groups')}
                </button>
                <button
                  type="button"
                  onClick={() => setDivideMode('maxSize')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                    divideMode === 'maxSize'
                      ? 'bg-brand-primary-50 dark:bg-brand-primary-950/40 border-brand-primary-500 text-brand-primary-700 dark:text-brand-primary-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {t('groups.byMaxGroupSize', 'By Max Size per Group')}
                </button>
              </div>
            </div>

            {divideMode === 'number' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('groups.numGroupsLabel', 'Number of Groups')}
                </label>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={numGroups}
                  onChange={(e) => setNumGroups(parseInt(e.target.value, 10) || 2)}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('groups.maxStudentsPerGroup', 'Max Students per Group')}
                </label>
                <input
                  type="number"
                  min={5}
                  max={200}
                  value={maxSize}
                  onChange={(e) => setMaxSize(parseInt(e.target.value, 10) || 30)}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white"
                />
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAutoDivideModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-brand-primary-500 hover:bg-brand-primary-600 text-white text-xs font-bold shadow-sm"
              >
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : t('groups.executeAutoDivide', 'Divide Students')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Split Modal */}
      {splitModalOpen && activeGroupToSplit && (
        <Modal
          isOpen={splitModalOpen}
          onClose={() => setSplitModalOpen(false)}
          title={`${t('groups.splitGroupTitle', 'Split Group')}: ${activeGroupToSplit.name}`}
        >
          <form onSubmit={handleExecuteSplit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('groups.splitMethod', 'Split Method')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSplitMode('number')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                    splitMode === 'number'
                      ? 'bg-brand-primary-50 dark:bg-brand-primary-950/40 border-brand-primary-500 text-brand-primary-700 dark:text-brand-primary-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {t('groups.byNumberOfSubgroups', 'By Number of Subgroups')}
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('maxSize')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                    splitMode === 'maxSize'
                      ? 'bg-brand-primary-50 dark:bg-brand-primary-950/40 border-brand-primary-500 text-brand-primary-700 dark:text-brand-primary-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {t('groups.byMaxSubgroupSize', 'By Max Size')}
                </button>
              </div>
            </div>

            {splitMode === 'number' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('groups.numberOfSubgroups', 'Number of Subgroups')}
                </label>
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={numSubgroups}
                  onChange={(e) => setNumSubgroups(parseInt(e.target.value, 10) || 2)}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('groups.maxStudentsPerSubgroup', 'Max Students per Subgroup')}
                </label>
                <input
                  type="number"
                  min={2}
                  max={100}
                  value={maxSubgroupSize}
                  onChange={(e) => setMaxSubgroupSize(parseInt(e.target.value, 10) || 15)}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white"
                />
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSplitModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-brand-primary-500 hover:bg-brand-primary-600 text-white text-xs font-bold shadow-sm"
              >
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : t('groups.executeSplit', 'Split Group')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Safety Confirmation Modal */}
      {confirmModalOpen && (
        <Modal
          isOpen={confirmModalOpen}
          onClose={() => setConfirmModalOpen(false)}
          title={t('groups.confirmActionTitle', 'Confirm Schedule Impact')}
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                {confirmMessage}
              </p>
            </div>

            {affectedSlotsList && affectedSlotsList.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  {t('groups.affectedScheduleSlots', 'Affected Schedule Sessions')}:
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                  {affectedSlotsList.map((slot: any, idx: number) => (
                    <div key={idx} className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-white">
                        {slot.courseName || slot.course?.name || 'Class Session'}
                      </span>
                      <span>{slot.dayOfWeek} {slot.startTime}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => confirmAction && confirmAction()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm"
              >
                {t('common.confirm', 'Confirm and Apply')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
