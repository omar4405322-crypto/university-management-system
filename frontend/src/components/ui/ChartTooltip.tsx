// @ts-nocheck
import React from 'react';

export const ChartTooltip = ({
  active,
  payload,
  label,
}: {
  active?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  label?: Record<string, unknown>;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--brand-bg-card)] border border-[var(--brand-border)] rounded-xl p-3 shadow-elevated text-sm animate-in fade-in zoom-in-95 duration-200">
      {label && (
        <p className="text-[var(--brand-text-sub)] mb-1 text-[10px] font-black uppercase tracking-widest">
          {label}
        </p>
      )}
      <div className="space-y-1.5">
                {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color || entry.fill }}
            />
            <p className="font-bold text-[var(--brand-text-main)]">
              <span className="text-[var(--brand-text-sub)] font-medium">{entry.name}:</span>{' '}
              {entry.value?.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChartTooltip;
