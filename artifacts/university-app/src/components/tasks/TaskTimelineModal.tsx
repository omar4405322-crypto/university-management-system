import React from 'react';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import { TimelineFeed } from './TimelineFeed';
import { History } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TaskTimelineModalProps {
  task: any;
  isOpen: boolean;
  onClose: () => void;
}

export const TaskTimelineModal: React.FC<TaskTimelineModalProps> = ({
  task,
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();

  if (!task) return null;

  const portalState = task.portalState || (task.isManuallyClosed ? 'MANUALLY_CLOSED' : 'OPEN');

  const getPortalStateBadge = () => {
    switch (portalState) {
      case 'MANUALLY_CLOSED':
        return <Badge variant="warning">{t('tasks.statusClosedManually', 'Manually Closed')}</Badge>;
      case 'CLOSED':
        return <Badge variant="danger">{t('tasks.statusClosed', 'Closed')}</Badge>;
      case 'SCHEDULED':
        return <Badge variant="info" className="font-bold">{t('tasks.statusScheduled', 'Scheduled')}</Badge>;
      default:
        return <Badge variant="success">{t('tasks.statusOpen', 'Open')}</Badge>;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('timeline.title', 'Assignment Activity Timeline')}
      subtitle={task.title}
      size="lg"
    >
      <div className="space-y-4">
        {/* Task Info & Portal Status Sub-header */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-surface-subtle dark:bg-slate-800/60 rounded-2xl border border-brand-border">
          <div className="flex items-center gap-2">
            <History size={16} className="text-brand-primary-500 shrink-0" />
            <span className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main truncate max-w-xs sm:max-w-md">
              {task.title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted">
              {t('timeline.portalStatus', 'Portal Status:')}
            </span>
            {getPortalStateBadge()}
          </div>
        </div>

        {/* Timeline Feed Container */}
        <TimelineFeed taskId={task.id} />
      </div>
    </Modal>
  );
};

export default TaskTimelineModal;
