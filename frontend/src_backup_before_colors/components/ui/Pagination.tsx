// @ts-nocheck
// FIXED: RTL-aware prev/next chevrons - Phase 6
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useTranslation } from 'react-i18next';

const Pagination = ({ page, totalPages, onPageChange, total, pageSize }) => {
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;
  if (totalPages <= 0) return null;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible + 2) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
            pages.push(1);
      let start = Math.max(2, page - 1);
      let end = Math.min(totalPages - 1, page + 1);
      
      if (page <= 3) {
        end = Math.min(maxVisible, totalPages - 1);
      }
      if (page >= totalPages - 2) {
        start = Math.max(2, totalPages - maxVisible + 1);
      }
      
            if (start > 2) pages.push('...');
            for (let i = start; i <= end; i++) pages.push(i);
            if (end < totalPages - 1) pages.push('...');
            pages.push(totalPages);
    }
    return pages;
  };

  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = total ? Math.min(page * pageSize, total) : 0;

  return (
    <div className="flex flex-col gap-3 px-6 py-3 border-t border-brand-border bg-brand-bg-card sm:flex-row sm:items-center sm:justify-between">
      {/* Record count — hidden on very small screens */}
      {total > 0 && (
        <p className="hidden sm:block text-xs font-semibold text-brand-text-muted">
          <span className="text-brand-text-primary">{from}</span>–<span className="text-brand-text-primary">{to}</span>
          {total && <span> of <span className="text-brand-text-primary">{total.toLocaleString()}</span></span>}
        </p>
      )}

      {/* Mobile: simple prev/page-info/next */}
      <div className="flex items-center justify-between sm:hidden">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-brand-text-secondary hover:text-brand-text-primary hover:bg-surface-subtle disabled:opacity-30 disabled:pointer-events-none transition-all"
        >
          <PrevIcon size={14} /> {t('common.previousShort', 'Prev')}
        </button>
        <span className="text-xs font-bold text-brand-text-primary">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-brand-text-secondary hover:text-brand-text-primary hover:bg-surface-subtle disabled:opacity-30 disabled:pointer-events-none transition-all"
        >
          {t('common.next', 'Next')} <NextIcon size={14} />
        </button>
      </div>

      {/* Desktop: full page number buttons */}
      <div className="hidden sm:flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="flex items-center justify-center h-9 w-9 rounded-xl text-brand-text-secondary hover:text-brand-text-primary hover:bg-surface-subtle disabled:opacity-30 disabled:pointer-events-none transition-all duration-150"
        >
          <PrevIcon size={16} aria-hidden />
        </button>

        <div className="flex items-center gap-0.5">
          {getPageNumbers().map((p, i) =>
            p === '...' ? (
              <span key={`ellipsis-${i}`} className="flex items-center justify-center h-9 w-9 text-xs font-bold text-brand-text-muted">...</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`flex items-center justify-center h-9 w-9 rounded-xl text-xs font-bold transition-all duration-150 ${
                  p === page
                    ? 'bg-brand-primary-500 text-white shadow-sm shadow-brand-primary-500/20'
                    : 'text-brand-text-secondary hover:text-brand-text-primary hover:bg-surface-subtle'
                }`}
              >
                {p}
              </button>
            )
          )}
        </div>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="flex items-center justify-center h-9 w-9 rounded-xl text-brand-text-secondary hover:text-brand-text-primary hover:bg-surface-subtle disabled:opacity-30 disabled:pointer-events-none transition-all duration-150"
        >
          <NextIcon size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
