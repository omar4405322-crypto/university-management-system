import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { MoreVertical } from 'lucide-react';

const Table = ({ headers, children, className = '' }) => {
  return (
    <div className={`w-full overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-start border-collapse">
          <thead>
            <tr className="bg-brand-bg-card">
              {headers.map((header, index) => (
                <th key={index} className="sticky top-0 z-10 bg-brand-bg-card px-5 py-3.5 text-start text-caption text-brand-text-secondary first:pl-6 last:pr-6 whitespace-nowrap after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-brand-border">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border/60">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const TableRow = ({ children, className = '', ...props }) => (
  <tr className={`group transition-all duration-150 hover:bg-surface-subtle/80 even:bg-surface-subtle/30 dark:even:bg-white/[0.02] ${className}`} {...props}>
    {children}
  </tr>
);

export const TableCell = ({ children, className = '' }) => (
  <td className={`px-5 py-3.5 text-sm text-brand-text-primary font-medium first:pl-6 last:pr-6 ${className}`}>
    {children}
  </td>
);

export const TableActions = ({ children, className = '' }) => (
  <td className={`px-5 py-3.5 first:pl-6 last:pr-6 ${className}`}>
    <div className="flex items-center justify-end gap-1">
      {children}
    </div>
  </td>
);

/* ─── Modern Action Menu ─── */

const actionVariants = {
  edit: 'text-brand-navy hover:bg-brand-navy/5',
  delete: 'text-error hover:bg-error/5',
  view: 'text-brand-text-primary hover:bg-surface-subtle',
  default: 'text-brand-text-secondary hover:bg-surface-subtle',
};

export const ActionMenu = ({ actions, icon: Icon, size = 18, className = '' }) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) && 
        btnRef.current && !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 180) {
        setMenuPos({ bottom: window.innerHeight - rect.top + 4, left: rect.right - 160, top: 'auto' });
      } else {
        setMenuPos({ top: rect.bottom + 4, left: rect.right - 160, bottom: 'auto' });
      }
    }
    setOpen(prev => !prev);
  };

  return (
    <>
      <div className={`relative inline-block ${className}`}>
        <button
          ref={btnRef}
          onClick={handleToggle}
          className="p-2 rounded-xl text-brand-text-muted hover:text-brand-text-primary hover:bg-surface-subtle transition-all duration-150"
        >
          {Icon ? <Icon size={size} /> : <MoreVertical size={size} />}
        </button>
      </div>

      {open && typeof document !== 'undefined' && ReactDOM.createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: menuPos.top,
              bottom: menuPos.bottom,
              left: menuPos.left,
              zIndex: 9999,
            }}
            className="min-w-[160px] bg-brand-bg-card dark:bg-brand-bg-elevated rounded-xl border border-brand-border shadow-elevated py-1.5 animate-in fade-in zoom-in-95 duration-150"
          >
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={() => { action.onClick?.(); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${actionVariants[action.variant] || actionVariants.default}`}
              >
                {action.icon && <action.icon size={15} />}
                <span>{action.label}</span>
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
