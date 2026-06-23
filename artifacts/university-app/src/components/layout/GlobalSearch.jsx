// FIXED [Phase 7.2]: Header global search with grouped results
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Users, GraduationCap, BookOpen, Building2, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import searchService from '../../services/search.service';

const GlobalSearch = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const wrapRef = useRef(null);

  const runSearch = useCallback(async (q) => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    try {
      setLoading(true);
      const res = await searchService.globalSearch(q.trim());
      if (res.success) setResults(res.data);
    } catch (err) {
      console.error('Global search failed:', err);
      setResults({ students: [], doctors: [], courses: [], colleges: [], departments: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const go = (path) => {
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
          items: results.students?.map((s) => ({
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
          items: results.doctors?.map((d) => ({
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
          items: results.courses?.map((c) => ({
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
          items: results.colleges?.map((c) => ({
            id: c.id,
            title: c.name,
            path: `/colleges/${c.id}`,
          })) || [],
        },
        {
          key: 'departments',
          label: t('nav.departments'),
          icon: Layers,
          items: results.departments?.map((d) => ({
            id: d.id,
            title: d.name,
            meta: d.college?.name,
            path: `/departments/${d.id}`,
          })) || [],
        },
      ].filter((s) => s.items.length > 0)
    : [];

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={wrapRef} className="relative hidden max-w-md md:block group w-80">
      <Search className="absolute left-4 rtl:left-auto rtl:right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted group-focus-within:text-brand-primary-500 transition-colors" />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t('search.placeholder')}
        className="h-11 w-full rounded-2xl border border-brand-border bg-surface-subtle pl-11 pr-4 rtl:pl-4 rtl:pr-11 text-sm text-brand-text-primary transition-all placeholder:text-brand-text-muted focus:border-brand-primary-500 focus:bg-brand-bg-card focus:outline-none focus:ring-4 focus:ring-brand-primary-500/10"
        aria-expanded={showPanel}
        aria-autocomplete="list"
      />

      {showPanel && (
        <div className="absolute top-full mt-2 w-full max-h-[24rem] overflow-y-auto rounded-2xl border border-brand-border bg-brand-bg-card shadow-elevated z-50 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-brand-text-muted">
              <Loader2 className="animate-spin" size={20} />
              <span className="text-sm font-bold">{t('search.searching')}</span>
            </div>
          ) : sections.length === 0 ? (
            <p className="py-8 text-center text-sm font-bold text-brand-text-muted">{t('search.noResults')}</p>
          ) : (
            sections.map((section) => (
              <div key={section.key} className="border-b border-brand-border last:border-0">
                <p className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-brand-text-muted flex items-center gap-2">
                  <section.icon size={12} /> {section.label}
                </p>
                {section.items.map((item) => (
                  <button
                    key={`${section.key}-${item.id}`}
                    type="button"
                    onClick={() => go(item.path)}
                    className="w-full text-start px-4 py-2.5 hover:bg-surface-subtle transition-colors"
                  >
                    <p className="text-sm font-bold text-brand-text-main truncate">{item.title}</p>
                    {item.meta && (
                      <p className="text-xs text-brand-text-muted font-semibold truncate">{item.meta}</p>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
