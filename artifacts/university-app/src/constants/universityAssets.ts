/** Public paths under /assets/university/ (files live in repo under ne/ and root after copy). */
const BASE = '/assets/university/ne';

export const UNIVERSITY_LOGO = `${BASE}/logo.svg`;
export const UNIVERSITY_LOGO_WHITE = `${BASE}/logo-white.svg`;

export const CAMPUS_HERO_1 = `${BASE}/campus-hero-1.png`;
export const CAMPUS_HERO_2 = `${BASE}/campus-hero-2.png`;
export const UNIVERSITY_PROMO_VIDEO = `${BASE}/university-promo.mp4`;

export const CAMPUS_FALLBACK_IMAGES = [
  `${BASE}/campus-building.png`,
  `${BASE}/campus-entrance.png`,
  `${BASE}/campus-aerial.png`,
  `${BASE}/campus-wide.png`,
];

export const getCampusFallbackImage = (collegeId = 0) => {
  const index = Math.abs(Number(collegeId) || 0) % CAMPUS_FALLBACK_IMAGES.length;
  return CAMPUS_FALLBACK_IMAGES[index];
};
