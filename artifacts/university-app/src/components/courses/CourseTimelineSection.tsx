import React from 'react';
import { TimelineFeed } from '../tasks/TimelineFeed';
import Card from '../ui/Card';
import { History } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CourseTimelineSectionProps {
  courseId: number | string;
}

export const CourseTimelineSection: React.FC<CourseTimelineSectionProps> = ({
  courseId,
}) => {
  const { t } = useTranslation();

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-brand-border">
        <div className="flex items-center gap-2">
          <History className="text-brand-primary-500" size={20} />
          <h3 className="text-sm font-black text-brand-text-primary dark:text-brand-text-main">
            {t('timeline.courseTitle', 'Course Activity Feed')}
          </h3>
        </div>
      </div>

      <TimelineFeed
        courseId={courseId}
        emptyMessage={t('timeline.noCourseHistoryDesc', 'No administrative activity recorded for this course yet.')}
      />
    </Card>
  );
};

export default CourseTimelineSection;
