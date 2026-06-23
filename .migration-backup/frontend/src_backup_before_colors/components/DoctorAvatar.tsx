import React, { useState } from 'react';

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  table: 'w-11 h-11 text-sm',
};

const _getInitials = (name) => {
  if (!name || !name.trim()) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
};

const _getAvatarColor = (name) => {
  const colors = [
    'bg-lime-600',
    'bg-emerald-600',
    'bg-teal-600',
    'bg-cyan-600',
    'bg-blue-600',
    'bg-indigo-600',
  ];
  const index = (name?.charCodeAt(0) || 0) % colors.length;
  return colors[index];
};

const resolveImageUrl = (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  const trimmed = imageUrl.trim();
  if (!trimmed || trimmed.length < 4) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  return `/${trimmed.replace(/^\//, '')}`;
};

const DoctorAvatar = ({ name, imageUrl, size = 'md', className = '' }) => {
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
      className={`${sizeClasses[size]} bg-[var(--color-brand-navy)] ${roundedClass} flex shrink-0 items-center justify-center font-medium text-white select-none ${className}`}
      aria-hidden={!name}
    >
      {name?.slice(0, 2).toUpperCase() ?? 'DR'}
    </div>
  );
};

export default DoctorAvatar;
