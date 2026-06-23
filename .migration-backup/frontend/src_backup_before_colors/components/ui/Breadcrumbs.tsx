// @ts-nocheck
// FIXED: Reusable breadcrumb navigation - Phase 6
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const Breadcrumbs = ({ items = [] }) => {
  const { isRTL } = useLanguage();

  if (!items.length) return null;

  return (
    <nav aria-label="breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-sm font-bold text-brand-text-muted">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
                        <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight
                  size={14}
                  className={`shrink-0 text-brand-text-muted/60 ${isRTL ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              )}
                            {item.link && !isLast ? (
                <Link
                                    to={item.link}
                  className="text-brand-primary-600 hover:text-brand-primary-500 transition-colors"
                >
                                    {item.label}
                </Link>
              ) : (
                                <span className={isLast ? 'text-brand-text-primary' : ''}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
