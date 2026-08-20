import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  FileCheck2,
  BookOpen,
  BellRing,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  LucideIcon
} from 'lucide-react';
import './FeaturesCarousel.css';

// ─── Unified Hero Badge Component ────────────────────────────────────────────

interface FeatureHeroBadgeProps {
  Icon: LucideIcon;
}

function FeatureHeroBadge({ Icon }: FeatureHeroBadgeProps) {
  return (
    <div className="features-card-hero">
      <div className="features-card-hero-glow" />
      <div className="features-card-hero-ring-outer" />
      <div className="features-card-hero-ring-inner" />
      <div className="features-card-hero-icon-wrapper">
        <Icon size={38} strokeWidth={1.8} className="features-card-hero-icon" />
      </div>
    </div>
  );
}

// ─── Cards Data ───────────────────────────────────────────────────────────────

interface FeatureItem {
  id: string;
  titleKey: string;
  descKey: string;
  icon: LucideIcon;
}

const FEATURE_KEYS: FeatureItem[] = [
  {
    id: 'schedule',
    titleKey: 'landing.showcase.items.schedule.title',
    descKey: 'landing.showcase.items.schedule.desc',
    icon: CalendarDays,
  },
  {
    id: 'exams',
    titleKey: 'landing.showcase.items.exams.title',
    descKey: 'landing.showcase.items.exams.desc',
    icon: FileCheck2,
  },
  {
    id: 'courses',
    titleKey: 'landing.showcase.items.courses.title',
    descKey: 'landing.showcase.items.courses.desc',
    icon: BookOpen,
  },
  {
    id: 'notifications',
    titleKey: 'landing.showcase.items.notifications.title',
    descKey: 'landing.showcase.items.notifications.desc',
    icon: BellRing,
  },
  {
    id: 'performance',
    titleKey: 'landing.showcase.items.performance.title',
    descKey: 'landing.showcase.items.performance.desc',
    icon: TrendingUp,
  },
];

// ─── Circular Loop Helpers ───────────────────────────────────────────────────

const getCircularIndex = (index: number, total: number) => ((index % total) + total) % total;

const getDistance = (cardIndex: number, activeIndex: number, total: number) => {
  const rawDistance = cardIndex - getCircularIndex(activeIndex, total);
  if (rawDistance > total / 2) return rawDistance - total;
  if (rawDistance < -total / 2) return rawDistance + total;
  return rawDistance;
};

// ─── Exact Google Labs Card Style calculation ────────────────────────────────

const getCardStyle = (distance: number) => {
  const absD = Math.abs(distance);

  if (distance === 0) {
    // Center card — fully upright, full size, highest z-index
    return {
      transform: 'translateX(-50%) scale(1) rotate(0deg)',
      opacity: 1,
      zIndex: 5,
      filter: 'none',
    };
  }
  if (absD === 1) {
    // Adjacent cards — slightly behind, rotated toward center, partially hidden
    const translateX = distance < 0 ? 'calc(-50% + 480px)' : 'calc(-50% - 480px)';
    const rotate = distance < 0 ? '5deg' : '-5deg';
    return {
      transform: `translateX(${translateX}) scale(0.9) rotate(${rotate})`,
      opacity: 1,
      zIndex: 3,
      filter: 'brightness(0.85)',
    };
  }
  if (absD === 2) {
    // Distant cards
    const translateX = distance < 0 ? 'calc(-50% + 820px)' : 'calc(-50% - 820px)';
    const rotate = distance < 0 ? '10deg' : '-10deg';
    return {
      transform: `translateX(${translateX}) scale(0.78) rotate(${rotate})`,
      opacity: 0.6,
      zIndex: 1,
      filter: 'brightness(0.6)',
    };
  }
  // Hidden cards
  const translateX = distance < 0 ? 'calc(-50% + 1100px)' : 'calc(-50% - 1100px)';
  return {
    transform: `translateX(${translateX}) scale(0.65) rotate(${distance < 0 ? '15deg' : '-15deg'})`,
    opacity: 0,
    zIndex: 0,
    filter: 'brightness(0.4)',
  };
};

export function FeaturesCarousel() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');
  const [activeIndex, setActiveIndex] = useState(2); // Starts with middle card (index 2) active
  const totalCards = FEATURE_KEYS.length;

  const goNext = () => setActiveIndex(prev => prev + 1);
  const goPrev = () => setActiveIndex(prev => prev - 1);

  const goToCard = (targetIndex: number) => {
    const currentNormalized = getCircularIndex(activeIndex, totalCards);
    const diff = targetIndex - currentNormalized;
    let shortestDelta = diff;
    if (diff > totalCards / 2) shortestDelta -= totalCards;
    if (diff < -totalCards / 2) shortestDelta += totalCards;
    setActiveIndex(prev => prev + shortestDelta);
  };

  const activeNormalized = getCircularIndex(activeIndex, totalCards);

  return (
    <section className="features-section" id="features" aria-label={t('landing.showcase.title')}>
      <div className="features-section__inner">
        <div className="features-carousel-container">
          {/* Header */}
          <div className="features-carousel-header">
            <p className="features-carousel-subtitle">{t('landing.showcase.subtitle')}</p>
            <h2 className="features-carousel-title">{t('landing.showcase.title')}</h2>
          </div>

          {/* Carousel Window */}
          <div className="carousel-viewport">
            <div className="carousel-track">
              {FEATURE_KEYS.map((feat, idx) => {
                const IconComponent = feat.icon;
                const d = getDistance(idx, activeIndex, totalCards);
                const distance = Math.abs(d);
                const baseStyle = getCardStyle(d);

                return (
                  <article
                    key={feat.id}
                    className="carousel-slide"
                    aria-label={t(feat.titleKey)}
                    onClick={() => {
                      if (distance === 1) {
                        setActiveIndex(prev => prev + d);
                      }
                    }}
                    style={{
                      ...baseStyle,
                      pointerEvents: distance > 1 ? 'none' : 'auto',
                      cursor: distance === 1 ? 'pointer' : 'default',
                    }}
                  >
                    {/* Top half: Unified Hero Badge */}
                    <div className="features-carousel-card-top">
                      <FeatureHeroBadge Icon={IconComponent} />
                    </div>

                    {/* Bottom half: Content */}
                    <div className="features-carousel-card-bottom">
                      <div className="features-carousel-card-header">
                        <div className="features-carousel-card-icon-badge" aria-hidden="true">
                          <IconComponent size={18} strokeWidth={2} />
                        </div>
                        <h3 className="features-carousel-card-title">{t(feat.titleKey)}</h3>
                      </div>
                      <p className="features-carousel-card-desc">{t(feat.descKey)}</p>
                      <Link to="/login" className="features-carousel-card-link">
                        <span>{t('landing.showcase.learnMore')}</span>
                        <span>{isRTL ? '←' : '→'}</span>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Controls & Pagination */}
          <div className="features-carousel-controls">
            <button
              className="features-carousel-arrow"
              onClick={goPrev}
              aria-label={t('landing.showcase.prev')}
            >
              {isRTL ? <ChevronRight size={22} /> : <ChevronLeft size={22} />}
            </button>

            {/* Pagination Dots */}
            <div className="features-carousel-dots" role="tablist" aria-label="Carousel pagination">
              {FEATURE_KEYS.map((feat, idx) => {
                const isActive = activeNormalized === idx;
                return (
                  <button
                    key={feat.id}
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`${t(feat.titleKey)} (${idx + 1}/${totalCards})`}
                    className={`features-carousel-dot ${isActive ? 'is-active' : ''}`}
                    onClick={() => goToCard(idx)}
                  />
                );
              })}
            </div>

            <button
              className="features-carousel-arrow"
              onClick={goNext}
              aria-label={t('landing.showcase.next')}
            >
              {isRTL ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FeaturesCarousel;
