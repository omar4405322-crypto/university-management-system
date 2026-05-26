import React from 'react';

const Table = ({ headers, children, className = '' }) => {
  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            {headers.map((header, index) => (
              <th key={index} className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {children}
        </tbody>
      </table>
    </div>
  );
};

export const TableRow = ({ children, className = '', ...props }) => (
  <tr className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors duration-150 ${className}`} {...props}>
    {children}
  </tr>
);

export const TableCell = ({ children, className = '' }) => (
  <td className={`px-6 py-4 text-sm text-slate-600 dark:text-slate-300 ${className}`}>
    {children}
  </td>
);

export default Table;
