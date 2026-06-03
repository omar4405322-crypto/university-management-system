import React from 'react';

const isArabic = (text) => /[\u0600-\u06FF]/.test(text);

export function TruncatedText({ text, maxWidth = '100%' }) {
  if (!text) return null;
  
  const className = isArabic(text) ? 'truncate-rtl' : 'truncate-ltr';
  
  return (
    <span className={className} style={{ maxWidth }} title={text}>
      {text}
    </span>
  );
}
