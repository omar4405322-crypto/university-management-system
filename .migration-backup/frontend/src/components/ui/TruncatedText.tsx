import React from 'react';

const isArabic = (text) => /[\u0600-\u06FF]/.test(text);

export function TruncatedText({ text, maxWidth = '100%' }) {
  if (!text) return null;

  const className = isArabic(text) ? 'truncate-rtl' : 'truncate-ltr';

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
