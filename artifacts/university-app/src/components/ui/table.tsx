import * as React from "react"

import { cn } from "@/lib/utils"

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  containerClassName?: string;
}

const Table = React.forwardRef<
  HTMLTableElement,
  TableProps
>(({ className, containerClassName, ...props }, ref) => (
  <div className={cn("relative w-full overflow-auto", containerClassName)}>
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm text-brand-text-primary", className)}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  sticky?: boolean;
}

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  TableHeaderProps
>(({ className, sticky, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "bg-surface-subtle/70 [&_tr]:border-b [&_tr]:border-brand-border",
      sticky && "sticky top-0 z-10 bg-white dark:bg-slate-900 shadow-2xs border-b border-brand-border [&_th]:bg-white dark:[&_th]:bg-slate-900",
      className
    )}
    {...props}
  />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t border-brand-border bg-surface-subtle/70 font-semibold [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-brand-border transition-colors hover:bg-brand-primary-50/45 dark:hover:bg-brand-primary-950/15 data-[state=selected]:bg-brand-primary-50 dark:data-[state=selected]:bg-brand-primary-950/20",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & { hideOnMobile?: boolean; sticky?: boolean }
>(({ className, hideOnMobile, sticky, scope, ...props }, ref) => (
  <th
    ref={ref}
    scope={scope ?? "col"}
    className={cn(
      "h-11 px-3 text-start align-middle text-[11px] font-black uppercase tracking-wider text-brand-text-secondary [&:has([role=checkbox])]:pe-0 [&>[role=checkbox]]:translate-y-[2px]",
      hideOnMobile && "hidden md:table-cell",
      sticky && "sticky top-0 z-10 bg-white dark:bg-slate-900",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & { hideOnMobile?: boolean }
>(({ className, hideOnMobile, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "px-3 py-3 align-middle [&:has([role=checkbox])]:pe-0 [&>[role=checkbox]]:translate-y-[2px]",
      hideOnMobile && "hidden md:table-cell",
      className
    )}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-brand-text-secondary", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

interface ActionMenuProps {
  children?: React.ReactNode
  actions?: Array<{
    label: string
    ariaLabel?: string
    icon: React.ComponentType<{ size?: number; className?: string }>
    variant?: string
    onClick: () => void
  }>
  className?: string
}

const ActionMenu = React.forwardRef<HTMLDivElement, ActionMenuProps>(
  ({ children, actions, className }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center justify-end gap-2", className)}
    >
      {children}
      {actions &&
        actions.map((act, index) => {
          const Icon = act.icon;
          let buttonClass = "p-2.5 rounded-xl text-brand-text-secondary hover:text-brand-primary-600 hover:bg-brand-primary-50 dark:hover:bg-brand-primary-950/25 transition-all duration-200";
          if (act.variant === 'delete') {
            buttonClass = "p-2.5 rounded-xl text-brand-text-secondary hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/25 transition-all duration-200";
          } else if (act.variant === 'edit') {
            buttonClass = "p-2.5 rounded-xl text-brand-text-secondary hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/25 transition-all duration-200";
          }
          return (
            <button
              key={index}
              type="button"
              onClick={act.onClick}
              className={buttonClass}
              title={act.ariaLabel ?? act.label}
              aria-label={act.ariaLabel ?? act.label}
              /* aria-label={act.label} */
            >
              <Icon size={18} aria-hidden="true" />
            </button>
          );
        })}
    </div>
  )
)
ActionMenu.displayName = "ActionMenu"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  ActionMenu,
}

export default Table;
