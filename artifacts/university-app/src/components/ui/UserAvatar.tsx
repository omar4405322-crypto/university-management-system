import React, { useState, useEffect, useMemo } from 'react';
import { getDynamicBaseUrl } from '../../services/api';

export interface UserAvatarUser {
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  role?: string;
  profilePicture?: string;
  avatar?: string;
}

export interface UserAvatarProps {
  user?: UserAvatarUser | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'rounded' | 'circle' | 'square';
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  showBorder?: boolean;
}

export function getUserInitials(user?: UserAvatarUser | null): string {
  if (!user) return '?';
  if (user.role === 'SUPER_ADMIN') {
    return 'SU';
  }
  if (user.firstName && user.lastName) {
    const f = user.firstName.trim();
    const l = user.lastName.trim();
    if (f && l) {
      return `${f[0]}${l[0]}`.toUpperCase();
    }
  }
  if (user.name) {
    const parts = user.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length === 1) {
      return parts[0].toUpperCase();
    }
  }
  if (user.firstName) {
    return user.firstName.trim().slice(0, 2).toUpperCase();
  }
  if (user.email) {
    return user.email.trim().slice(0, 2).toUpperCase();
  }
  return 'U';
}

export function getProfilePictureUrl(path?: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  try {
    const baseUrl = typeof getDynamicBaseUrl === 'function' ? getDynamicBaseUrl().replace(/\/api$/, '') : '';
    return `${baseUrl || ''}${path.startsWith('/') ? path : `/${path}`}`;
  } catch {
    return path;
  }
}

const SIZE_STYLES = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
};

const SHAPE_STYLES = {
  rounded: 'rounded-xl',
  circle: 'rounded-full',
  square: 'rounded-2xl',
};

export const UserAvatar: React.FC<UserAvatarProps> = React.memo(function UserAvatar({
  user,
  size = 'sm',
  shape = 'rounded',
  className = '',
  imageClassName = '',
  fallbackClassName = '',
  showBorder = true,
}) {
  const [hasImageError, setHasImageError] = useState(false);
  const rawPicture = user?.profilePicture || user?.avatar;

  // Reset error state if the user's picture path changes
  useEffect(() => {
    setHasImageError(false);
  }, [rawPicture]);

  const initials = useMemo(() => getUserInitials(user), [user]);
  const imageUrl = useMemo(() => getProfilePictureUrl(rawPicture), [rawPicture]);

  const sizeClass = SIZE_STYLES[size] || SIZE_STYLES.sm;
  const shapeClass = shape === 'circle' ? SHAPE_STYLES.circle : size === 'md' ? SHAPE_STYLES.square : SHAPE_STYLES.rounded;
  const borderClass = showBorder ? 'ring-2 ring-brand-bg-card shadow-sm' : '';

  const displayName = user?.name || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || 'User');

  if (imageUrl && !hasImageError) {
    return (
      <div
        data-testid="user-avatar"
        className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden bg-brand-primary-700/20 ${sizeClass} ${shapeClass} ${borderClass} ${className}`}
      >
        <img
          src={imageUrl}
          alt={displayName}
          onError={() => setHasImageError(true)}
          className={`h-full w-full object-cover ${imageClassName}`}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      data-testid="user-avatar"
      data-avatar-fallback="true"
      className={`relative inline-flex items-center justify-center shrink-0 font-black text-white bg-brand-primary-600 shadow-brand-primary-600/20 transition-transform ${sizeClass} ${shapeClass} ${borderClass} ${fallbackClassName} ${className}`}
      aria-label={displayName}
    >
      <span className="select-none tracking-tight">{initials}</span>
    </div>
  );
});

export default UserAvatar;
