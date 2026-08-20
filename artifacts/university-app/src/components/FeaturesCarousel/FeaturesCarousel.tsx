import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './FeaturesCarousel.css';

// ─── Unique Dark Background SVG Illustrations ─────────────────────────────────

function ScheduleSVG() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e1b4b', position: 'relative', overflow: 'hidden' }}>
      {/* Glowing line backgrounds */}
      <div style={{ position: 'absolute', width: '200px', height: '2px', background: 'linear-gradient(90deg, transparent, #22c55e, transparent)', transform: 'rotate(-30deg)', top: '30%', opacity: 0.3 }} />
      <div style={{ position: 'absolute', width: '200px', height: '2px', background: 'linear-gradient(90deg, transparent, #34d399, transparent)', transform: 'rotate(45deg)', bottom: '20%', opacity: 0.3 }} />
      
      <svg viewBox="0 0 120 120" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Calendar Outline */}
        <rect x="15" y="20" width="90" height="85" rx="10" stroke="#34d399" strokeWidth="3" fill="#111827" fillOpacity="0.6" style={{ filter: 'drop-shadow(0 0 8px rgba(52, 211, 153, 0.4))' }}/>
        {/* Header */}
        <path d="M15 35h90" stroke="#34d399" strokeWidth="3"/>
        <line x1="35" y1="12" x2="35" y2="25" stroke="#22c55e" strokeWidth="4" strokeLinecap="round"/>
        <line x1="85" y1="12" x2="85" y2="25" stroke="#22c55e" strokeWidth="4" strokeLinecap="round"/>
        {/* Grid Slots */}
        <rect x="28" y="47" width="18" height="12" rx="3" fill="#22c55e" style={{ filter: 'drop-shadow(0 0 4px #22c55e)' }}/>
        <rect x="52" y="47" width="40" height="12" rx="3" fill="#1e1b4b" stroke="#34d399" strokeWidth="1.5"/>
        <rect x="28" y="67" width="40" height="12" rx="3" fill="#1e1b4b" stroke="#34d399" strokeWidth="1.5"/>
        <rect x="74" y="67" width="18" height="12" rx="3" fill="#34d399" style={{ filter: 'drop-shadow(0 0 4px #34d399)' }}/>
        <rect x="28" y="87" width="64" height="12" rx="3" fill="#22c55e" opacity="0.6"/>
      </svg>
    </div>
  );
}

function ExamSVG() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#042f2e', position: 'relative', overflow: 'hidden' }}>
      <svg viewBox="0 0 120 120" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Exam Sheet */}
        <rect x="15" y="15" width="60" height="90" rx="8" stroke="#34d399" strokeWidth="2.5" fill="#111827" fillOpacity="0.7"/>
        <line x1="28" y1="35" x2="62" y2="35" stroke="#d1fae5" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="28" y1="50" x2="55" y2="50" stroke="#d1fae5" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="28" y1="65" x2="62" y2="65" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="28" y1="80" x2="48" y2="80" stroke="#d1fae5" strokeWidth="2.5" strokeLinecap="round"/>
        
        {/* Timer Circle overlay */}
        <g transform="translate(68, 58)">
          <circle cx="20" cy="20" r="22" fill="#042f2e" stroke="#22c55e" strokeWidth="3" style={{ filter: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.6))' }}/>
          <circle cx="20" cy="20" r="16" stroke="#d1fae5" strokeWidth="1.5" strokeDasharray="4 4"/>
          <path d="M20 10v10h8" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="20" cy="20" r="2.5" fill="#22c55e"/>
        </g>
      </svg>
    </div>
  );
}

function CoursesSVG() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#14532d', position: 'relative', overflow: 'hidden' }}>
      <svg viewBox="0 0 120 120" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Book 3 (Bottom) */}
        <rect x="20" y="75" width="80" height="18" rx="3" fill="#166534" stroke="#86efac" strokeWidth="2"/>
        <rect x="25" y="79" width="70" height="4" fill="#22c55e" opacity="0.7"/>
        <rect x="92" y="75" width="8" height="18" fill="#d1fae5" />
        
        {/* Book 2 (Middle) */}
        <rect x="25" y="52" width="70" height="18" rx="3" fill="#15803d" stroke="#34d399" strokeWidth="2"/>
        <rect x="30" y="56" width="60" height="4" fill="#22c55e" opacity="0.7"/>
        <rect x="87" y="52" width="8" height="18" fill="#d1fae5" />
        
        {/* Book 1 (Top) */}
        <rect x="15" y="28" width="85" height="18" rx="3" fill="#22c55e" stroke="#d1fae5" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 6px rgba(34, 197, 94, 0.5))' }}/>
        <rect x="20" y="32" width="75" height="4" fill="white" opacity="0.5"/>
        <rect x="92" y="28" width="8" height="18" fill="#d1fae5" />
      </svg>
    </div>
  );
}

function NotificationSVG() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', position: 'relative', overflow: 'hidden' }}>
      {/* Ping animation rings */}
      <div className="fs-ping-ring" style={{ position: 'absolute', width: '70px', height: '70px', borderRadius: '50%', border: '2px solid #22c55e', opacity: 0, animation: 'fs-ping 2s infinite' }} />
      <div className="fs-ping-ring" style={{ position: 'absolute', width: '90px', height: '90px', borderRadius: '50%', border: '2px solid #34d399', opacity: 0, animation: 'fs-ping 2s infinite 0.6s' }} />

      <svg viewBox="0 0 120 120" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ zIndex: 1 }}>
        <path d="M60 22a20 20 0 00-20 20v22l-6 6v4h52v-4l-6-6V42a20 20 0 00-20-20z" fill="#22c55e" stroke="#d1fae5" strokeWidth="2"/>
        <path d="M52 79a8 8 0 0016 0h-16z" fill="#34d399"/>
        <circle cx="60" cy="18" r="3" fill="#d1fae5"/>
        {/* Notification Badge */}
        <circle cx="75" cy="30" r="9" fill="#ef4444" stroke="#0f172a" strokeWidth="2"/>
        <circle cx="75" cy="30" r="3" fill="white"/>
      </svg>
    </div>
  );
}

function PerformanceSVG() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1c1917', position: 'relative', overflow: 'hidden' }}>
      <svg viewBox="0 0 120 120" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Grid lines */}
        <line x1="20" y1="90" x2="100" y2="90" stroke="#2c2520" strokeWidth="1"/>
        <line x1="20" y1="65" x2="100" y2="65" stroke="#2c2520" strokeWidth="1"/>
        <line x1="20" y1="40" x2="100" y2="40" stroke="#2c2520" strokeWidth="1"/>
        
        {/* Bars */}
        <rect x="28" y="70" width="10" height="20" rx="2" fill="#166534" stroke="#22c55e" strokeWidth="1.5"/>
        <rect x="48" y="55" width="10" height="35" rx="2" fill="#15803d" stroke="#34d399" strokeWidth="1.5"/>
        <rect x="68" y="38" width="10" height="52" rx="2" fill="#22c55e" stroke="#86efac" strokeWidth="1.5" style={{ filter: 'drop-shadow(0 0 4px rgba(34, 197, 94, 0.4))' }}/>
        <rect x="88" y="20" width="10" height="70" rx="2" fill="#22c55e" stroke="#d1fae5" strokeWidth="1.5" style={{ filter: 'drop-shadow(0 0 6px rgba(34, 197, 94, 0.6))' }}/>
        
        {/* Line graph */}
        <path d="M33 70l20-15 20-17 20-18" fill="none" stroke="#d1fae5" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="33" cy="70" r="3" fill="#d1fae5"/>
        <circle cx="53" cy="55" r="3" fill="#d1fae5"/>
        <circle cx="73" cy="38" r="3" fill="#d1fae5"/>
        <circle cx="93" cy="20" r="3" fill="#22c55e"/>
      </svg>
    </div>
  );
}

// ─── Cards Data ───────────────────────────────────────────────────────────────

const FEATURE_KEYS = [
  {
    id: 'schedule',
    titleKey: 'landing.showcase.items.schedule.title',
    descKey: 'landing.showcase.items.schedule.desc',
    icon: '📅',
    illustration: ScheduleSVG,
  },
  {
    id: 'exams',
    titleKey: 'landing.showcase.items.exams.title',
    descKey: 'landing.showcase.items.exams.desc',
    icon: '📝',
    illustration: ExamSVG,
  },
  {
    id: 'courses',
    titleKey: 'landing.showcase.items.courses.title',
    descKey: 'landing.showcase.items.courses.desc',
    icon: '📚',
    illustration: CoursesSVG,
  },
  {
    id: 'notifications',
    titleKey: 'landing.showcase.items.notifications.title',
    descKey: 'landing.showcase.items.notifications.desc',
    icon: '🔔',
    illustration: NotificationSVG,
  },
  {
    id: 'performance',
    titleKey: 'landing.showcase.items.performance.title',
    descKey: 'landing.showcase.items.performance.desc',
    icon: '📊',
    illustration: PerformanceSVG,
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
      transform: "translateX(-50%) scale(1) rotate(0deg)",
      opacity: 1,
      zIndex: 5,
      filter: "none",
    };
  }
  if (absD === 1) {
    // Adjacent cards — slightly behind, rotated toward center, partially hidden
    const translateX = distance < 0 ? "calc(-50% + 480px)" : "calc(-50% - 480px)";
    const rotate = distance < 0 ? "5deg" : "-5deg";
    return {
      transform: `translateX(${translateX}) scale(0.9) rotate(${rotate})`,
      opacity: 1,
      zIndex: 3,
      filter: "brightness(0.85)",
    };
  }
  if (absD === 2) {
    // Distant cards
    const translateX = distance < 0 ? "calc(-50% + 820px)" : "calc(-50% - 820px)";
    const rotate = distance < 0 ? "10deg" : "-10deg";
    return {
      transform: `translateX(${translateX}) scale(0.78) rotate(${rotate})`,
      opacity: 0.6,
      zIndex: 1,
      filter: "brightness(0.6)",
    };
  }
  // Hidden cards
  const translateX = distance < 0 ? "calc(-50% + 1100px)" : "calc(-50% - 1100px)";
  return {
    transform: `translateX(${translateX}) scale(0.65) rotate(${distance < 0 ? "15deg" : "-15deg"})`,
    opacity: 0,
    zIndex: 0,
    filter: "brightness(0.4)",
  };
};

export function FeaturesCarousel() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');
  const [activeIndex, setActiveIndex] = useState(2); // Starts with middle card (index 2) active
  const totalCards = FEATURE_KEYS.length;

  const goNext = () => setActiveIndex(prev => prev + 1);
  const goPrev = () => setActiveIndex(prev => prev - 1);

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
                const Illustration = feat.illustration;
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
                    {/* Top half */}
                    <div className="features-carousel-card-top">
                      <Illustration />
                    </div>

                    {/* Bottom half */}
                    <div className="features-carousel-card-bottom">
                      <div className="features-carousel-card-header">
                        <span className="features-carousel-card-icon" role="img" aria-hidden="true">
                          {feat.icon}
                        </span>
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

          {/* Controls */}
          <div className="features-carousel-controls">
            <button
              className="features-carousel-arrow"
              onClick={goPrev}
              aria-label={t('landing.showcase.prev')}
            >
              ›
            </button>
            <button
              className="features-carousel-arrow"
              onClick={goNext}
              aria-label={t('landing.showcase.next')}
            >
              ‹
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FeaturesCarousel;
