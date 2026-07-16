import React from 'react';

const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

export function TruncatedText({ text, maxWidth = '100%', lineClamp = 1 }: { text: string; maxWidth?: string | number; lineClamp?: number }) {
  if (!text) return null;

  const isAr = isArabic(text);
  const className = lineClamp > 1
    ? (isAr ? 'line-clamp-rtl' : 'line-clamp-ltr')
    : (isAr ? 'truncate-rtl' : 'truncate-ltr');

  return (
    <div className="relative group inline-block max-w-full">
      <span className={`${className} block`} style={{ maxWidth }}>
        {text}
      </span>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-brand-navy-500 text-white text-[10px] font-bold rounded-lg shadow-elevated invisible group-hover:visible whitespace-normal max-w-[250px] w-max z-50 pointer-events-none text-center">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-brand-navy-500" />
      </div>
    </div>
  );
}
