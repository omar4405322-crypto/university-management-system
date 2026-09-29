import React from "react";
import { useTranslation } from "react-i18next";
import {
  CheckSquare,
  Square,
  MinusSquare,
  Eye,
  Pencil,
  Trash2,
  FileUp,
} from "lucide-react";
import Button from "../../../components/ui/button";
import Table, {
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../../components/ui/table";
import type { TaskItem } from "../types";

export interface TasksTableProps {
  tasks: TaskItem[];
  selectedIds: Set<string | number>;
  onToggleSelect: (id: string | number) => void;
  onSelectAll: () => void;
  allSelected: boolean;
  isDoctor: boolean;
  isRTL: boolean;
  locale: string;
  isOverdue: (date: string) => boolean;
  onGrade: (task: TaskItem) => void;
  onEdit: (task: TaskItem) => void;
  onDelete: (task: TaskItem) => void;
  onSubmit: (task: TaskItem) => void;
  renderStudentStatusBadge: (task: TaskItem) => React.ReactNode;
}

export const TasksTable: React.FC<TasksTableProps> = ({
  tasks,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  allSelected,
  isDoctor,
  isRTL,
  locale,
  isOverdue,
  onGrade,
  onEdit,
  onDelete,
  onSubmit,
  renderStudentStatusBadge,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 overflow-hidden shadow-2xs">
      <div className="overflow-x-auto">
        <Table className="w-full text-xs">
          <TableHeader className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
            <TableRow>
              <TableHead className="w-10 p-2.5 text-center">
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="text-slate-400 hover:text-brand-primary-600 focus:outline-none transition-colors"
                >
                  {allSelected ? (
                    <CheckSquare size={14} className="text-brand-primary-600" />
                  ) : selectedIds.size > 0 ? (
                    <MinusSquare size={14} className="text-brand-primary-600" />
                  ) : (
                    <Square size={14} />
                  )}
                </button>
              </TableHead>
              <TableHead className="p-2.5 font-bold text-slate-500">
                {isRTL ? "كود" : "Code"}
              </TableHead>
              <TableHead className="p-2.5 font-bold text-slate-500">
                {isRTL ? "عنوان التكليف" : "Assignment Title"}
              </TableHead>
              <TableHead className="p-2.5 font-bold text-slate-500">
                {isRTL ? "المقرر" : "Course"}
              </TableHead>
              <TableHead className="p-2.5 font-bold text-slate-500 text-center">
                {isRTL ? "النقاط" : "Points"}
              </TableHead>
              <TableHead className="p-2.5 font-bold text-slate-500 text-center">
                {isRTL ? "موعد التسليم" : "Due Date"}
              </TableHead>
              <TableHead className="p-2.5 font-bold text-slate-500 text-center">
                {isDoctor
                  ? isRTL
                    ? "التسليمات"
                    : "Submissions"
                  : isRTL
                    ? "الحالة"
                    : "Status"}
              </TableHead>
              <TableHead className="p-2.5 font-bold text-slate-500 text-end pe-4">
                {isRTL ? "الإجراءات" : "Actions"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const overdue = isOverdue(task.dueDate);
              const subsCount = task._count?.submissions || 0;
              const isSelected = selectedIds.has(task.id);

              return (
                <TableRow
                  key={task.id}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-700/20 border-b border-slate-100 dark:border-slate-700/50 ${
                    isSelected
                      ? "bg-brand-primary-500/[0.04] dark:bg-brand-primary-500/[0.08]"
                      : ""
                  }`}
                >
                  <TableCell
                    className="w-10 p-2.5 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onToggleSelect(task.id)}
                      className="text-slate-400 hover:text-brand-primary-600 focus:outline-none transition-colors"
                    >
                      {isSelected ? (
                        <CheckSquare
                          size={14}
                          className="text-brand-primary-600"
                        />
                      ) : (
                        <Square size={14} />
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="p-2.5 font-mono font-bold text-brand-primary-600">
                    {task.course?.courseCode}
                  </TableCell>
                  <TableCell className="p-2.5">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {task.title}
                    </div>
                    <div className="text-[10px] text-slate-400 line-clamp-1 max-w-[200px]">
                      {task.description}
                    </div>
                  </TableCell>
                  <TableCell className="p-2.5 text-slate-600 dark:text-slate-300 text-[11px] truncate max-w-[150px]">
                    {task.course?.name}
                  </TableCell>
                  <TableCell className="p-2.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                    {task.maxScore}
                  </TableCell>
                  <TableCell className="p-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        overdue
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      }`}
                    >
                      {new Date(task.dueDate).toLocaleDateString(locale, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </TableCell>
                  <TableCell className="p-2.5 text-center">
                    {isDoctor ? (
                      <span className="font-mono font-bold text-brand-primary-600 bg-brand-primary-50 dark:bg-brand-primary-950/50 px-2 py-0.5 rounded">
                        {subsCount}
                      </span>
                    ) : (
                      renderStudentStatusBadge(task)
                    )}
                  </TableCell>
                  <TableCell className="p-2.5 text-end pe-4">
                    <div className="inline-flex items-center gap-1.5">
                      {isDoctor ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => onGrade(task)}
                            className="h-7 px-2.5 bg-brand-primary-600 hover:bg-brand-primary-700 text-white rounded-lg text-xs font-bold gap-1 cursor-pointer"
                          >
                            <Eye size={12} />
                            <span>{isRTL ? "رصد" : "Grade"}</span>
                          </Button>
                          <button
                            onClick={() => onEdit(task)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => onDelete(task)}
                            className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => onSubmit(task)}
                          className="h-7 px-2.5 bg-brand-primary-600 hover:bg-brand-primary-700 text-white rounded-lg text-xs font-bold gap-1 cursor-pointer"
                        >
                          <FileUp size={12} />
                          <span>{isRTL ? "تسليم" : "Submit"}</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
