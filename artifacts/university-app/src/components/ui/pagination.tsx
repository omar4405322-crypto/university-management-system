import * as React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ButtonProps, buttonVariants } from './button';
import { useTranslation } from 'react-i18next';

export interface PaginationProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  page?: number;
  currentPage?: number;
  totalPages?: number;
  total?: number;
  totalRecords?: number;
  totalCount?: number;
  pageSize?: number;
  limit?: number;
  onPageChange?: (page: number) => void;
  onChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onLimitChange?: (limit: number) => void;
  pageSizeOptions?: number[];
  showPageSize?: boolean;
  showTotal?: boolean;
  showPageNumbers?: boolean;
  showQuickJumper?: boolean;
}

function getPageNumbers(currentPage: number, totalPages: number, siblingCount = 1): (number | '...')[] {
  if (totalPages <= 1) return [1];

  const totalNumbers = siblingCount * 2 + 3;
  const totalBlocks = totalNumbers + 2;

  if (totalPages <= totalBlocks) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

  const shouldShowLeftDots = leftSiblingIndex > 2;
  const shouldShowRightDots = rightSiblingIndex < totalPages - 2;

  const firstPageIndex = 1;
  const lastPageIndex = totalPages;

  if (!shouldShowLeftDots && shouldShowRightDots) {
    const leftItemCount = 3 + 2 * siblingCount;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, '...', totalPages];
  }

  if (shouldShowLeftDots && !shouldShowRightDots) {
    const rightItemCount = 3 + 2 * siblingCount;
    const rightRange = Array.from(
      { length: rightItemCount },
      (_, i) => totalPages - rightItemCount + i + 1
    );
    return [firstPageIndex, '...', ...rightRange];
  }

  if (shouldShowLeftDots && shouldShowRightDots) {
    const middleRange = Array.from(
      { length: rightSiblingIndex - leftSiblingIndex + 1 },
      (_, i) => leftSiblingIndex + i
    );
    return [firstPageIndex, '...', ...middleRange, '...', lastPageIndex];
  }

  return Array.from({ length: totalPages }, (_, i) => i + 1);
}

/**
 * Universal, responsive Pagination component supporting numeric buttons,
 * arrow navigation, total record summaries, and page-size selector.
 */
const Pagination: React.FC<PaginationProps> = ({
  page,
  currentPage: propCurrentPage,
  totalPages: propTotalPages,
  total,
  totalRecords,
  totalCount,
  pageSize,
  limit,
  onPageChange,
  onChange,
  onPageSizeChange,
  onLimitChange,
  pageSizeOptions = [10, 25, 50, 100],
  showPageSize = true,
  showTotal = true,
  showPageNumbers = true,
  className,
  ...rest
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const activePage = page ?? propCurrentPage ?? 1;
  const activePageSize = pageSize ?? limit ?? 10;
  const effectiveTotal = total ?? totalRecords ?? totalCount ?? 0;

  const effectiveTotalPages =
    propTotalPages ??
    (effectiveTotal > 0 ? Math.ceil(effectiveTotal / activePageSize) : 1);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > effectiveTotalPages || newPage === activePage) return;
    if (onPageChange) onPageChange(newPage);
    if (onChange) onChange(newPage);
  };

  const handleSizeChange = (newSize: number) => {
    if (onPageSizeChange) onPageSizeChange(newSize);
    if (onLimitChange) onLimitChange(newSize);
  };

  const startRecord = Math.min((activePage - 1) * activePageSize + 1, effectiveTotal || 1);
  const endRecord = Math.min(activePage * activePageSize, effectiveTotal || activePageSize);

  const pageNumbers = getPageNumbers(activePage, effectiveTotalPages);

  // If there's no data and single page, render nothing or minimal summary
  if (effectiveTotalPages <= 1 && effectiveTotal === 0) {
    return null;
  }

  return (
    <div
      role="navigation"
      aria-label={t('common.pagination', 'التنقل بين الصفحات')}
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 p-4 border-t border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-900/30 text-xs text-slate-500 dark:text-slate-400 select-none',
        className
      )}
      {...rest}
    >
      {/* 1. Left / Start: Record counts and optional page-size selector */}
      <div className="flex items-center flex-wrap gap-2.5">
        {showTotal && effectiveTotal > 0 && (
          <span className="font-semibold text-slate-600 dark:text-slate-300">
            {isRTL
              ? `عرض ${startRecord} - ${endRecord} من إجمالي ${effectiveTotal}`
              : `Showing ${startRecord} - ${endRecord} of ${effectiveTotal}`}
          </span>
        )}

        {showPageSize && (onPageSizeChange || onLimitChange) && (
          <div className="flex items-center gap-1.5 ms-2">
            <span className="text-[11px] text-slate-400">
              {isRTL ? 'لكل صفحة:' : 'Per page:'}
            </span>
            <select
              value={activePageSize}
              onChange={(e) => handleSizeChange(Number(e.target.value))}
              className="h-7.5 px-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-brand-primary-500 cursor-pointer"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 2. Right / End: Navigation Controls */}
      <div className="flex items-center gap-1">
        {/* Jump to First Page */}
        {effectiveTotalPages > 4 && (
          <button
            type="button"
            onClick={() => handlePageChange(1)}
            disabled={activePage <= 1}
            title={isRTL ? 'الصفحة الأولى' : 'First page'}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <ChevronsLeft className={cn('w-3.5 h-3.5', isRTL && 'rotate-180')} />
          </button>
        )}

        {/* Previous Page Button */}
        <button
          type="button"
          onClick={() => handlePageChange(activePage - 1)}
          disabled={activePage <= 1}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-bold text-xs cursor-pointer"
        >
          <ChevronLeft className={cn('w-3.5 h-3.5', isRTL && 'rotate-180')} />
          <span>{isRTL ? 'السابق' : 'Previous'}</span>
        </button>

        {/* Page Number Buttons */}
        {showPageNumbers && (
          <div className="flex items-center gap-1 mx-1">
            {pageNumbers.map((p, idx) => {
              if (p === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-8 h-8 flex items-center justify-center text-slate-400"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </span>
                );
              }

              const isCurrent = p === activePage;
              return (
                <button
                  key={`page-${p}`}
                  type="button"
                  onClick={() => handlePageChange(Number(p))}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={cn(
                    'w-8 h-8 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center font-mono',
                    isCurrent
                      ? 'bg-brand-primary-500 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>
        )}

        {/* Next Page Button */}
        <button
          type="button"
          onClick={() => handlePageChange(activePage + 1)}
          disabled={activePage >= effectiveTotalPages}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-bold text-xs cursor-pointer"
        >
          <span>{isRTL ? 'التالي' : 'Next'}</span>
          <ChevronRight className={cn('w-3.5 h-3.5', isRTL && 'rotate-180')} />
        </button>

        {/* Jump to Last Page */}
        {effectiveTotalPages > 4 && (
          <button
            type="button"
            onClick={() => handlePageChange(effectiveTotalPages)}
            disabled={activePage >= effectiveTotalPages}
            title={isRTL ? 'الصفحة الأخيرة' : 'Last page'}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <ChevronsRight className={cn('w-3.5 h-3.5', isRTL && 'rotate-180')} />
          </button>
        )}
      </div>
    </div>
  );
};

Pagination.displayName = 'Pagination';

// Shadcn compatibility sub-components
const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<'ul'>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn('flex flex-row items-center gap-1', className)}
    {...props}
  />
));
PaginationContent.displayName = 'PaginationContent';

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<'li'>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn('', className)} {...props} />
));
PaginationItem.displayName = 'PaginationItem';

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<ButtonProps, 'size'> &
  React.ComponentProps<'a'>;

const PaginationLink = ({
  className,
  isActive,
  size = 'icon',
  ...props
}: PaginationLinkProps) => (
  <a
    aria-current={isActive ? 'page' : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? 'outline' : 'ghost',
        size,
      }),
      className
    )}
    {...props}
  />
);
PaginationLink.displayName = 'PaginationLink';

const PaginationPrevious = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to previous page"
    size="default"
    className={cn('gap-1 pl-2.5', className)}
    {...props}
  >
    <ChevronLeft className="h-4 w-4" />
    <span>Previous</span>
  </PaginationLink>
);
PaginationPrevious.displayName = 'PaginationPrevious';

const PaginationNext = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to next page"
    size="default"
    className={cn('gap-1 pr-2.5', className)}
    {...props}
  >
    <span>Next</span>
    <ChevronRight className="h-4 w-4" />
  </PaginationLink>
);
PaginationNext.displayName = 'PaginationNext';

const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<'span'>) => (
  <span
    aria-hidden
    className={cn('flex h-9 w-9 items-center justify-center', className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
);
PaginationEllipsis.displayName = 'PaginationEllipsis';

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};

export default Pagination;
