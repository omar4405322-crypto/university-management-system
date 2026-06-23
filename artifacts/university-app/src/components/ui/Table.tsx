import React, {
  useState,
  useRef,
  useEffect,
  HTMLAttributes,
  TdHTMLAttributes,
  _ThHTMLAttributes,
} from 'react';
import ReactDOM from 'react-dom';
import { MoreVertical } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface TableProps extends HTMLAttributes<HTMLDivElement> {
  headers: (string | React.ReactNode)[];
  headerClassName?: string;
}

const Table: React.FC<TableProps> = ({
  headers,
  children,
  className = '',
  headerClassName = '',
}) => {
  return (
    <div className={`w-full overflow-hidden rounded-lg border border-brand-border/60 ${className}`}>
      <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] custom-scrollbar">
        <table className="w-full table-fixed text-start border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-brand-bg-card">
              {headers.map((header, index) => {
                const isEssential =
                  typeof header === 'string' &&
                  (header.toLowerCase().includes('name') ||
                    header.toLowerCase().includes('status') ||
                    header.toLowerCase().includes('actions') ||
                    header.toLowerCase().includes('الاسم') ||
                    header.toLowerCase().includes('الحالة') ||
                    header.toLowerCase().includes('إجراءات'));

                return (
                  <th
                    key={index}
                    className={`sticky top-0 z-10 bg-brand-bg-card px-5 py-3.5 text-start text-caption text-brand-text-secondary first:pl-6 last:pr-6 whitespace-nowrap after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-brand-border ${!isEssential ? 'hidden md:table-cell' : ''} ${headerClassName}`}
                  >
                    {header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border/60">{children}</tbody>
        </table>
      </div>
    </div>
  );
};

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  isSelected?: boolean;
}

export const TableRow: React.FC<TableRowProps> = ({
  children,
  className = '',
  isSelected = false,
  ...props
}) => (
  <tr
    className={`group transition-all duration-150 ${
      isSelected
        ? 'bg-brand-brand-green-dark/10 dark:bg-brand-brand-green-dark/20'
        : 'hover:bg-gray-100 even:bg-gray-50 dark:even:bg-white/[0.02]'
    } ${className}`}
    {...props}
  >
    {children}
  </tr>
);

export const TableCell: React.FC<TdHTMLAttributes<HTMLTableCellElement>> = ({
  children,
  className = '',
}) => {
  const { isCompact } = useTheme();
  return (
  <td
    className={`px-5 ${isCompact ? 'py-1.5' : 'py-3.5'} text-sm text-brand-text-primary font-medium first:pl-6 last:pr-6 ${className}`}
  >
    {children}
  </td>
  );
};

export const TableActions: React.FC<TdHTMLAttributes<HTMLTableCellElement>> = ({
  children,
  className = '',
}) => {
  const { isCompact } = useTheme();
  return (
  <td className={`px-5 ${isCompact ? 'py-1.5' : 'py-3.5'} first:pl-6 last:pr-6 ${className}`}>
    <div className="flex items-center justify-end gap-1">{children}</div>
  </td>
  );
};

/* ─── Modern Action Menu ─── */

const actionVariants: Record<string, string> = {
  edit: 'text-brand-navy-500 hover:bg-brand-navy-500/5',
  delete: 'text-error hover:bg-error/5',
  view: 'text-brand-text-primary hover:bg-surface-subtle',
  default: 'text-brand-text-secondary hover:bg-surface-subtle',
};

export interface ActionItem {
  label: string;
  icon?: React.ElementType;
  variant?: 'edit' | 'delete' | 'view' | 'default';
  onClick?: () => void;
}

export interface ActionMenuProps {
  actions: ActionItem[];
  icon?: React.ElementType;
  size?: number;
  className?: string;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({
  actions,
  icon: Icon,
  size = 18,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top: number | string;
    left: number | string;
    bottom?: number | string;
  }>({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuWidth: number = 180;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceRight = window.innerWidth - rect.left;

      let top = rect.bottom + 8;
      let left = rect.right - menuWidth;
      let bottom: string | number = 'auto';

      // Adjust vertical position
      if (spaceBelow < 220) {
        top = 'auto';
        bottom = window.innerHeight - rect.top + 8;
      }

      // Adjust horizontal position (especially for RTL or edge cases)
      if (rect.right < menuWidth) {
        left = rect.left;
      } else if (spaceRight < menuWidth && rect.right > menuWidth) {
        left = rect.right - menuWidth;
      }

      setMenuPos({ top, left, bottom });
    }
    setOpen((prev) => !prev);
  };

  return (
    <>
      <div
        className={`relative inline-block ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="button"
        tabIndex={0}
      >
        <button
          ref={btnRef}
          onClick={handleToggle}
          className="p-2 rounded-xl text-brand-text-muted hover:text-brand-text-primary hover:bg-surface-subtle transition-all duration-150 flex items-center justify-center"
        >
          {Icon ? <Icon size={size} /> : <MoreVertical size={size} />}
        </button>
      </div>

      {open &&
        typeof document !== 'undefined' &&
        ReactDOM.createPortal(
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
            />
            <div
              ref={menuRef}
              style={{
                position: 'fixed',
                top: menuPos.top,
                bottom: menuPos.bottom,
                left: menuPos.left,
                zIndex: 9999,
                minWidth: '180px',
              }}
              className="bg-brand-bg-card dark:bg-brand-bg-elevated rounded-2xl border border-brand-border shadow-elevated py-2 animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
            >
              <div className="px-3 py-1.5 mb-1 border-b border-brand-border/50">
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted opacity-50">
                  Actions / إجراءات
                </span>
              </div>
              {actions.map((action, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick?.();
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-[11px] font-black uppercase tracking-tight transition-all duration-150 cursor-pointer ${actionVariants[action.variant] || actionVariants.default}`}
                >
                  {action.icon && <action.icon size={16} className="shrink-0" />}
                  <span className="truncate">{action.label}</span>
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
    </>
  );
};

export default Table;
