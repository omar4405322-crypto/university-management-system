import React from 'react';

interface TimeRangeProps {
  start: string;
  end: string;
  className?: string;
}

export function TimeRange({ start, end, className }: TimeRangeProps) {
  return (
    <span dir="ltr" style={{ unicodeBidi: 'isolate' }} className={className}>
      {start} – {end}
    </span>
  );
}

export default TimeRange;
