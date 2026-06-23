import React, { useState } from 'react';

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  table: 'w-11 h-11 text-sm',
};

const resolveImageUrl = (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  const trimmed = imageUrl.trim();
  if (!trimmed || trimmed.length < 4) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  return `/${trimmed.replace(/^\//, '')}`;
};

const TeachingAssistantAvatar = ({ name, imageUrl, size = 'md', className = '' }) => {
  const [imgError, setImgError] = useState(false);
  const resolvedUrl = resolveImageUrl(imageUrl);
  const roundedClass = size === 'table' ? 'rounded-2xl' : 'rounded-full';

  if (resolvedUrl && !imgError) {
    return (
      <img
        src={resolvedUrl}
        alt={name}
        className={`${sizeClasses[size]} ${roundedClass} object-cover shrink-0 ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} bg-brand-primary-500 ${roundedClass} flex shrink-0 items-center justify-center font-medium text-white select-none ${className}`}
      aria-hidden={!name}
    >
      {name?.slice(0, 2).toUpperCase() ?? 'TA'}
    </div>
  );
};

export default TeachingAssistantAvatar;
