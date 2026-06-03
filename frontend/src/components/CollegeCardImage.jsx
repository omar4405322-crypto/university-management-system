import React, { useEffect, useState } from 'react';
import {
  UNIVERSITY_LOGO,
  getCampusFallbackImage,
} from '../constants/universityAssets';

/**
 * College card banner: campus photo when no custom image; logo only as last resort.
 */
const CollegeCardImage = ({ name, image, collegeId = 0 }) => {
  const campusFallback = getCampusFallbackImage(collegeId);
  const hasCustomImage = Boolean(image);

  const [src, setSrc] = useState(hasCustomImage ? image : campusFallback);
  const [useLogoFallback, setUseLogoFallback] = useState(false);

  useEffect(() => {
    setUseLogoFallback(false);
    setSrc(hasCustomImage ? image : campusFallback);
  }, [image, collegeId, campusFallback, hasCustomImage]);

  const handleError = () => {
    if (src === UNIVERSITY_LOGO) return;
    if (src !== campusFallback && hasCustomImage) {
      setSrc(campusFallback);
      return;
    }
    setUseLogoFallback(true);
    setSrc(UNIVERSITY_LOGO);
  };

  return (
    <div
      className={`absolute inset-0 ${
        useLogoFallback
          ? 'flex items-center justify-center bg-gray-50 dark:bg-slate-100'
          : ''
      }`}
    >
      <img
        src={src}
        alt={name}
        className={
          useLogoFallback
            ? 'h-32 w-32 object-contain p-4'
            : 'h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110'
        }
        onError={handleError}
      />
    </div>
  );
};

export default CollegeCardImage;
export { UNIVERSITY_LOGO } from '../constants/universityAssets';
