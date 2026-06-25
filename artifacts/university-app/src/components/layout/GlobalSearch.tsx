import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Users, GraduationCap, BookOpen, Building2, Layers, X, Command } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import searchService from '../../services/search.service';
import { createPortal } from 'react-dom';
import { logger } from '../../lib/logger';

const GlobalSearch = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      document.body.style.overflow = 'hidden';
    } else {
      setQuery('');
      setResults(null);
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    try {
      setLoading(true);
      const res = await searchService.globalSearch(q.trim());
      if (res.success) setResults(res.data);
      setSelectedIndex(0);
    } catch (err: any) {
      logger.error('Global search failed:', err);
      setResults({ students: [], doctors: [], courses: [], colleges: [], departments: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
    setQuery('');
    setResults(null);
  };

  const sections = results
    ? [
        {
          key: 'students',
          label: t('nav.students'),
          icon: Users,
          items:
            results.students?.map((s: { id: string, firstName: string, lastName: string, studentId: string }) => ({
              id: s.id,
              title: `${s.firstName} ${s.lastName}`,
              meta: s.studentId,
              path: `/students/${s.id}`,
            })) || [],
        },
        {
          key: 'doctors',
          label: t('nav.doctors'),
          icon: GraduationCap,
          items:
            results.doctors?.map((d: { id: string, firstName: string, lastName: string, doctorId: string }) => ({
              id: d.id,
              title: `${d.firstName} ${d.lastName}`,
              meta: d.doctorId,
              path: '/doctors',
            })) || [],
        },
        {
          key: 'courses',
          label: t('nav.courses'),
          icon: BookOpen,
          items:
            results.courses?.map((c: { id: string, name: string, courseCode: string }) => ({
              id: c.id,
              title: c.name,
              meta: c.courseCode,
              path: `/courses/${c.id}`,
            })) || [],
        },
        {
          key: 'colleges',
          label: t('nav.colleges'),
          icon: Building2,
          items:
            results.colleges?.map((c: { id: string, name: string }) => ({
              id: c.id,
              title: c.name,
              path: `/colleges/${c.id}`,
            })) || [],
        },
        {
          key: 'departments',
          label: t('nav.departments'),
          icon: Layers,
          items:
            results.departments?.map((d: { id: string, name: string, college: { name: string } }) => ({
              id: d.id,
              title: d.name,
              meta: d.college?.name,
              path: `/departments/${d.id}`,
            })) || [],
        },
      ].filter((s) => s.items.length > 0)
    : [];

  const flattenedItems = sections.flatMap((section) => section.items);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(flattenedItems.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + flattenedItems.length) % Math.max(flattenedItems.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flattenedItems[selectedIndex]) {
        go(flattenedItems[selectedIndex].path);
      }
    }
  };

  const isMac = navigator.userAgent.toLowerCase().includes('mac');

  const modal = open ? createPortal(
    <div className="fixed inset-0 z-[200] bg-brand-navy-500/60 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4">
      <div className="absolute inset-0" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-2xl bg-brand-bg-card rounded-3xl shadow-2xl overflow-hidden border border-brand-border flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center px-4 py-4 border-b border-brand-border">
          <Search className="h-5 w-5 text-brand-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={t('search.placeholder') + "..."}
            className="flex-1 bg-transparent px-4 py-2 text-lg text-brand-text-primary focus:outline-none placeholder:text-brand-text-muted"
          />
          <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-surface-subtle text-brand-text-muted transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar flex-1 p-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-brand-text-muted gap-3">
              <Loader2 className="animate-spin h-6 w-6" />
              <span className="text-sm font-medium">{t('search.searching')}</span>
            </div>
          ) : query.length > 0 && sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-brand-text-muted gap-2">
              <Search className="h-8 w-8 opacity-20" />
              <p className="text-sm font-medium">{t('search.noResults')}</p>
            </div>
          ) : sections.length > 0 ? (
            sections.map((section) => {
              // Calculate global index offset for this section
              const sectionStartIndex = sections.slice(0, sections.indexOf(section)).reduce((acc, s) => acc + s.items.length, 0);
              
              return (
                <div key={section.key} className="mb-4 last:mb-0">
                  <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
                    <section.icon size={14} /> {section.label}
                  </div>
                  <div className="flex flex-col gap-1">
                    {section.items.map((item: { id: string, path: string, title: string, meta?: string }, localIdx: number) => {
                      const globalIdx = sectionStartIndex + localIdx;
                      const isSelected = globalIdx === selectedIndex;
                      return (
                        <button
                          key={item.id}
                          onClick={() => go(item.path)}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          className={`w-full text-start px-3 py-3 rounded-2xl flex items-center justify-between transition-colors ${isSelected ? 'bg-brand-primary-600/10 text-brand-primary-600' : 'hover:bg-surface-subtle text-brand-text-primary dark:text-brand-text-main'}`}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className={`text-sm font-bold ${isSelected ? 'text-brand-primary-600' : ''}`}>{item.title}</span>
                            {item.meta && <span className="text-xs text-brand-text-muted font-medium">{item.meta}</span>}
                          </div>
                          {isSelected && <span className="text-xs font-bold text-brand-primary-600 opacity-60 px-2 py-1 bg-brand-primary-600/10 rounded-lg">Enter ↵</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 px-4 flex flex-col items-center justify-center text-center">
              <div className="flex items-center gap-2 text-brand-text-muted mb-4">
                <kbd className="px-2 py-1 bg-surface-subtle border border-brand-border rounded-lg font-mono text-xs font-bold">↑</kbd>
                <kbd className="px-2 py-1 bg-surface-subtle border border-brand-border rounded-lg font-mono text-xs font-bold">↓</kbd>
                <span className="text-xs font-medium px-2">to navigate</span>
                <kbd className="px-2 py-1 bg-surface-subtle border border-brand-border rounded-lg font-mono text-xs font-bold">↵</kbd>
                <span className="text-xs font-medium px-2">to select</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  , document.body) : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center justify-between w-64 lg:w-80 h-10 px-4 rounded-xl border border-brand-border bg-surface-subtle hover:bg-brand-bg-card hover:border-brand-primary-600/50 transition-all group"
      >
        <div className="flex items-center gap-2 text-brand-text-muted group-hover:text-brand-primary-600 transition-colors">
          <Search size={16} />
          <span className="text-sm">{t('search.placeholder')}...</span>
        </div>
        <kbd className="hidden lg:flex items-center gap-1 text-[10px] font-bold text-brand-text-muted bg-brand-bg-card px-2 py-1 rounded-lg border border-brand-border shadow-sm">
          {isMac ? <Command size={12} /> : 'Ctrl'} K
        </kbd>
      </button>
      
      {/* Mobile search button */}
      <button 
        onClick={() => setOpen(true)}
        className="md:hidden p-2 text-brand-text-primary dark:text-brand-text-main rounded-xl hover:bg-surface-subtle transition-colors"
      >
        <Search size={20} />
      </button>

      {modal}
    </>
  );
};

export default GlobalSearch;
