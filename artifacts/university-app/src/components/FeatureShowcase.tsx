import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD_W = 380;
const CARD_H = 520;
const GAP    = 32;

// ─── Card data ────────────────────────────────────────────────────────────────

interface ShowcaseCard {
  id: string;
  icon: string;
  color: string;    // illustration background tint
  accent: string;   // SVG primary accent colour
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
}

const CARDS: ShowcaseCard[] = [
  {
    id: 'exams',
    icon: '📝',
    color: '#EEF7E0',
    accent: '#84BD3A',
    titleAr: 'نظام الامتحانات الإلكتروني',
    titleEn: 'Online Exam System',
    descAr: 'امتحانات إلكترونية متكاملة مع نظام مكافحة الغش ومتابعة الأداء في الوقت الفعلي',
    descEn: 'Full online exams with anti-cheat system and real-time performance tracking',
  },
  {
    id: 'schedule',
    icon: '📅',
    color: '#E8F0FE',
    accent: '#4285F4',
    titleAr: 'الجداول الدراسية',
    titleEn: 'Smart Timetables',
    descAr: 'جداول دراسية ذكية تُحدَّث تلقائياً مع إشعارات فورية لأي تغييرات',
    descEn: 'Smart schedules that auto-update with instant notifications for any changes',
  },
  {
    id: 'grades',
    icon: '🎓',
    color: '#FFF8E1',
    accent: '#F9A825',
    titleAr: 'إدارة الدرجات والنتائج',
    titleEn: 'Grades & Results',
    descAr: 'تتبع درجاتك ونتائجك أولاً بأول مع تحليلات تفصيلية لأدائك الأكاديمي',
    descEn: 'Track your grades and results with detailed academic performance analytics',
  },
  {
    id: 'attendance',
    icon: '✅',
    color: '#F3E5F5',
    accent: '#8E24AA',
    titleAr: 'نظام الحضور والغياب',
    titleEn: 'Attendance Tracking',
    descAr: 'نظام حضور رقمي دقيق مع تنبيهات تلقائية عند الاقتراب من حد الغياب المسموح',
    descEn: 'Accurate digital attendance with automatic alerts near absence limits',
  },
  {
    id: 'courses',
    icon: '📚',
    color: '#E8F5E9',
    accent: '#2E7D32',
    titleAr: 'إدارة المقررات',
    titleEn: 'Course Management',
    descAr: 'استعراض وتسجيل المقررات الدراسية بكل سهولة مع المواد التعليمية المرفقة',
    descEn: 'Browse and enroll in courses easily with all attached learning materials',
  },
];

// ─── SVG Illustrations ────────────────────────────────────────────────────────
// Each illustration uses a 300×200 viewBox with a floated focal element.

function ExamSVG({ accent, active }: { accent: string; active: boolean }) {
  return (
    <svg viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true" style={{ width: '100%', height: '100%' }}>

      {/* Answer sheet — back layer */}
      <rect x="30" y="30" width="148" height="148" rx="12"
        fill="white" stroke={accent} strokeWidth="1.5" opacity="0.5" />

      {/* Answer sheet — main */}
      <rect x="44" y="18" width="148" height="148" rx="12"
        fill="white" stroke={accent} strokeWidth="1.5" />
      {/* Sheet header bar */}
      <rect x="44" y="18" width="148" height="30" rx="12" fill={accent} />
      <rect x="44" y="36" width="148" height="12" rx="0" fill={accent} />
      <rect x="56" y="24" width="80" height="8" rx="4" fill="white" opacity="0.55" />
      {/* MCQ rows */}
      {[64, 84, 104, 124].map((y, i) => (
        <g key={y}>
          <circle cx="62" cy={y} r="7" stroke={accent} strokeWidth="1.5" fill="none" />
          {i === 1 && <circle cx="62" cy={y} r="4" fill={accent} />}
          <rect x="76" y={y - 4} width="100" height="8" rx="4"
            fill={accent} opacity={i === 1 ? 0.25 : 0.12} />
        </g>
      ))}
      {/* Checkmark badge — floated, with CSS animation */}
      <g style={{
        transformOrigin: '230px 60px',
        animation: active ? 'fs-float 3s ease-in-out infinite' : 'none',
      }}>
        <circle cx="230" cy="60" r="30" fill={accent} />
        <path d="M218 60l9 9 18-18" stroke="white" strokeWidth="3"
          strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* Timer — floated offset */}
      <g style={{
        transformOrigin: '236px 150px',
        animation: active ? 'fs-float 3.6s ease-in-out infinite 0.8s' : 'none',
      }}>
        <circle cx="236" cy="150" r="22" fill="white" stroke={accent} strokeWidth="2" />
        <line x1="236" y1="134" x2="236" y2="150" stroke={accent}
          strokeWidth="2" strokeLinecap="round" />
        <line x1="236" y1="150" x2="247" y2="158" stroke={accent}
          strokeWidth="2" strokeLinecap="round" />
        <circle cx="236" cy="150" r="3" fill={accent} />
      </g>
    </svg>
  );
}

function ScheduleSVG({ accent, active }: { accent: string; active: boolean }) {
  const slots: Array<{ col: number; row: number; span: number; op: number }> = [
    { col: 0, row: 0, span: 1, op: 1 },
    { col: 1, row: 0, span: 2, op: 0.7 },
    { col: 3, row: 0, span: 1, op: 0.5 },
    { col: 0, row: 1, span: 2, op: 0.6 },
    { col: 2, row: 1, span: 1, op: 1 },
    { col: 3, row: 1, span: 1, op: 0.4 },
    { col: 1, row: 2, span: 1, op: 0.8 },
    { col: 2, row: 2, span: 2, op: 0.6 },
  ];
  const COL_W = 46;
  const ROW_H = 24;
  const GRID_X = 38;
  const GRID_Y = 70;
  return (
    <svg viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true" style={{ width: '100%', height: '100%' }}>

      {/* Calendar body */}
      <rect x="24" y="18" width="210" height="162" rx="14"
        fill="white" stroke={accent} strokeWidth="1.5" />
      {/* Header */}
      <rect x="24" y="18" width="210" height="38" rx="14" fill={accent} />
      <rect x="24" y="44" width="210" height="12" rx="0" fill={accent} />
      <text x="129" y="42" textAnchor="middle" fill="white"
        fontSize="13" fontWeight="700" fontFamily="system-ui, sans-serif">
        مارس ٢٠٢٥
      </text>
      {/* Day labels */}
      {['أح', 'إث', 'ثل', 'أر', 'خم'].map((d, i) => (
        <text key={d} x={GRID_X + i * COL_W + 18} y={GRID_Y - 8}
          textAnchor="middle" fill={accent} fontSize="9" fontWeight="700"
          fontFamily="system-ui, sans-serif">{d}</text>
      ))}
      <line x1="30" y1={GRID_Y - 2} x2="228" y2={GRID_Y - 2}
        stroke={accent} strokeWidth="0.5" opacity="0.3" />
      {/* Slots */}
      {slots.map((s, i) => (
        <rect key={i}
          x={GRID_X + s.col * COL_W}
          y={GRID_Y + s.row * ROW_H + 2}
          width={s.span * COL_W - 4}
          height={ROW_H - 5}
          rx="5"
          fill={accent}
          opacity={s.op * 0.9}
        />
      ))}
      {/* Bell notification — floated */}
      <g style={{
        transformOrigin: '256px 80px',
        animation: active ? 'fs-float 3.2s ease-in-out infinite 0.4s' : 'none',
      }}>
        <circle cx="256" cy="80" r="26" fill={accent} />
        <path d="M256 67 Q264 67 264 76 L264 80 L267 83 L245 83 L248 80 L248 76 Q248 67 256 67Z"
          fill="white" />
        <ellipse cx="256" cy="85" rx="3" ry="3" fill="white" />
        <rect x="252" y="58" width="8" height="4" rx="2" fill="white" opacity="0.9" />
      </g>
    </svg>
  );
}

function GradesSVG({ accent, active }: { accent: string; active: boolean }) {
  const bars = [55, 72, 48, 98, 65, 80];
  const trendY = [120, 104, 114, 82, 98, 88];
  const BAR_X0 = 38;
  const BAR_W = 22;
  const BAR_GAP = 30;
  const BASE_Y = 148;
  return (
    <svg viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true" style={{ width: '100%', height: '100%' }}>

      {/* Card base */}
      <rect x="16" y="16" width="226" height="168" rx="14"
        fill="white" stroke={accent} strokeWidth="1.5" />
      {/* Title strip */}
      <rect x="28" y="28" width="100" height="10" rx="5" fill={accent} opacity="0.35" />
      {/* Bars */}
      {bars.map((h, i) => (
        <rect key={i}
          x={BAR_X0 + i * BAR_GAP}
          y={BASE_Y - h * 0.7}
          width={BAR_W}
          height={h * 0.7}
          rx="5"
          fill={accent}
          opacity={i === 3 ? 1 : 0.28 + i * 0.08}
        />
      ))}
      {/* Trend line */}
      <polyline
        points={bars.map((_, i) =>
          `${BAR_X0 + i * BAR_GAP + BAR_W / 2},${trendY[i]}`).join(' ')}
        stroke={accent}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
      {trendY.map((y, i) => (
        <circle key={i}
          cx={BAR_X0 + i * BAR_GAP + BAR_W / 2}
          cy={y} r="3.5"
          fill="white" stroke={accent} strokeWidth="2" />
      ))}
      {/* Grade badge — pulse when active */}
      <g style={{
        transformOrigin: '253px 70px',
        animation: active ? 'fs-pulse 2.4s ease-in-out infinite' : 'none',
      }}>
        <circle cx="253" cy="70" r="32" fill={accent} />
        <text x="253" y="77" textAnchor="middle" fill="white"
          fontSize="20" fontWeight="800" fontFamily="system-ui, sans-serif">
          A+
        </text>
      </g>
      {/* Small star */}
      <g style={{
        transformOrigin: '262px 130px',
        animation: active ? 'fs-float 2.8s ease-in-out infinite 1.2s' : 'none',
      }}>
        <circle cx="262" cy="130" r="16" fill="white" stroke={accent} strokeWidth="1.5" />
        <text x="262" y="135" textAnchor="middle" fill={accent}
          fontSize="14" fontFamily="system-ui, sans-serif">★</text>
      </g>
    </svg>
  );
}

function AttendanceSVG({ accent, active }: { accent: string; active: boolean }) {
  const cells = [
    true, true, false, true, true,
    true, false, true, true, true,
    true, true, true, false, true,
  ];
  const RADIUS = 34;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const PROGRESS = 0.87;
  return (
    <svg viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true" style={{ width: '100%', height: '100%' }}>

      {/* Main card */}
      <rect x="16" y="16" width="216" height="168" rx="14"
        fill="white" stroke={accent} strokeWidth="1.5" />
      {/* Header */}
      <rect x="16" y="16" width="216" height="32" rx="14" fill={accent} opacity="0.15" />
      <rect x="16" y="36" width="216" height="12" rx="0" fill={accent} opacity="0.15" />
      <text x="124" y="37" textAnchor="middle" fill={accent}
        fontSize="11" fontWeight="700" fontFamily="system-ui, sans-serif">
        سجل الحضور
      </text>
      {/* Attendance grid */}
      {cells.map((present, i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        return (
          <rect key={i}
            x={28 + col * 28}
            y={60 + row * 26}
            width={22} height={20} rx="5"
            fill={present ? accent : '#e5e7eb'}
            opacity={present ? 0.85 : 1}
          />
        );
      })}
      {/* Progress ring — floated */}
      <g style={{
        transformOrigin: '252px 100px',
        animation: active ? 'fs-float 3.4s ease-in-out infinite 0.6s' : 'none',
      }}>
        <circle cx="252" cy="100" r={RADIUS + 6} fill="white"
          stroke={accent} strokeWidth="1" strokeOpacity="0.15" />
        <circle cx="252" cy="100" r={RADIUS}
          stroke={accent} strokeWidth="6" strokeOpacity="0.12" fill="none" />
        <circle cx="252" cy="100" r={RADIUS}
          stroke={accent} strokeWidth="6" fill="none"
          strokeDasharray={`${PROGRESS * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={CIRCUMFERENCE * 0.25}
          strokeLinecap="round"
          transform="rotate(-90 252 100)"
        />
        <text x="252" y="104" textAnchor="middle" fill={accent}
          fontSize="14" fontWeight="800" fontFamily="system-ui, sans-serif">
          87%
        </text>
      </g>
      {/* Alert badge */}
      <g style={{
        transformOrigin: '50px 162px',
        animation: active ? 'fs-float 2.6s ease-in-out infinite 1.4s' : 'none',
      }}>
        <circle cx="50" cy="162" r="16" fill={accent} />
        <text x="50" y="168" textAnchor="middle" fill="white"
          fontSize="16" fontWeight="800" fontFamily="system-ui, sans-serif">!</text>
      </g>
    </svg>
  );
}

function CoursesSVG({ accent, active }: { accent: string; active: boolean }) {
  return (
    <svg viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true" style={{ width: '100%', height: '100%' }}>

      {/* Book stack — back layers */}
      {[2, 1].map((i) => (
        <rect key={i}
          x={28 + i * 6} y={80 - i * 8} width={150} height={90}
          rx="8" fill="white" stroke={accent}
          strokeWidth="1.5" opacity={0.4 + i * 0.2}
        />
      ))}
      {/* Book — front */}
      <rect x="28" y="80" width="150" height="90" rx="8"
        fill={accent} stroke={accent} strokeWidth="1.5" />
      <rect x="28" y="80" width="18" height="90" rx="4" fill="white" opacity="0.15" />
      <rect x="52" y="95" width="90" height="9" rx="4" fill="white" opacity="0.75" />
      <rect x="52" y="110" width="70" height="7" rx="3.5" fill="white" opacity="0.5" />
      <rect x="52" y="123" width="80" height="7" rx="3.5" fill="white" opacity="0.5" />

      {/* Floating course card */}
      <g style={{
        transformOrigin: '214px 72px',
        animation: active ? 'fs-float 3s ease-in-out infinite' : 'none',
      }}>
        <rect x="174" y="22" width="112" height="100" rx="12"
          fill="white" stroke={accent} strokeWidth="1.5" />
        <rect x="174" y="22" width="112" height="28" rx="12" fill={accent} opacity="0.18" />
        <rect x="174" y="38" width="112" height="12" rx="0" fill={accent} opacity="0.18" />
        <rect x="184" y="30" width="60" height="8" rx="4" fill={accent} opacity="0.55" />
        <rect x="184" y="60" width="72" height="7" rx="3.5" fill={accent} opacity="0.25" />
        <rect x="184" y="73" width="56" height="7" rx="3.5" fill={accent} opacity="0.2" />
        {/* Enroll button */}
        <rect x="184" y="88" width="50" height="22" rx="11" fill={accent} />
        <text x="209" y="103" textAnchor="middle" fill="white"
          fontSize="9" fontWeight="700" fontFamily="system-ui, sans-serif">تسجيل</text>
      </g>

      {/* Completion badge */}
      <g style={{
        transformOrigin: '252px 158px',
        animation: active ? 'fs-float 3.8s ease-in-out infinite 1s' : 'none',
      }}>
        <circle cx="252" cy="158" r="22" fill={accent} />
        <path d="M242 158l8 8 16-16" stroke="white" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

// ─── Illustration registry ────────────────────────────────────────────────────

type IllustrationComponent = React.FC<{ accent: string; active: boolean }>;

const ILLUSTRATIONS: Record<string, IllustrationComponent> = {
  exams: ExamSVG,
  schedule: ScheduleSVG,
  grades: GradesSVG,
  attendance: AttendanceSVG,
  courses: CoursesSVG,
};

// ─── Nav button ──────────────────────────────────────────────────────────────

function NavBtn({
  dir,
  onClick,
}: {
  dir: 'prev' | 'next';
  onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  const isPrev = dir === 'prev';
  return (
    <button
      onClick={onClick}
      aria-label={isPrev ? 'السابق' : 'التالي'}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 44, height: 44, borderRadius: '50%',
        border: '1.5px solid #ccc',
        background: hov ? '#84BD3A' : 'white',
        color: hov ? 'white' : '#333',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 250ms ease',
        flexShrink: 0, padding: 0,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        {isPrev
          ? <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
          : <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
        }
      </svg>
    </button>
  );
}

// ─── Card tilt style ──────────────────────────────────────────────────────────

function cardTilt(diff: number): React.CSSProperties {
  if (diff === 0) return {
    transform: 'rotate(0deg)',
    transformOrigin: 'bottom center',
    boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
    zIndex: 10,
  };
  if (diff === -1) return {
    transform: 'rotate(-6deg)',
    transformOrigin: 'bottom right',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    zIndex: 5,
  };
  if (diff === 1) return {
    transform: 'rotate(6deg)',
    transformOrigin: 'bottom left',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    zIndex: 5,
  };
  // far cards — hidden
  return { opacity: 0, pointerEvents: 'none', zIndex: 1 };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FeatureShowcase() {
  const total     = CARDS.length;                                    // 5
  const extCards  = [CARDS[total - 1], ...CARDS, CARDS[0]];         // 7 items

  const trackRef  = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(1);    // index into extCards (1 = real card 0)
  const [paused, setPaused] = useState(false);
  const touchX    = useRef(0);

  // ── scroll track so card `i` is centred ──────────────────────────────────
  const scrollTo = useCallback((i: number, smooth: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    // card left edge = i * (CARD_W + GAP)
    // card center    = i * (CARD_W + GAP) + CARD_W / 2
    // desired scrollLeft = cardCenter - trackHalfWidth
    const cardCenter  = i * (CARD_W + GAP) + CARD_W / 2;
    const halfTrack   = track.offsetWidth / 2;
    track.scrollTo({ left: cardCenter - halfTrack, behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  // ── init: jump to card 1 without animation ────────────────────────────────
  useEffect(() => {
    // Wait for next frame so track has rendered width
    const raf = requestAnimationFrame(() => {
      scrollTo(1, false);
    });
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── re-center whenever active changes ────────────────────────────────────
  useEffect(() => { scrollTo(active, true); }, [active, scrollTo]);

  // ── infinite loop: after scroll lands on a clone, silently jump to real ──
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const handleScrollEnd = () => {
      if (active === 0) {
        setActive(total);
        scrollTo(total, false);
      } else if (active === total + 1) {
        setActive(1);
        scrollTo(1, false);
      }
    };

    track.addEventListener('scrollend', handleScrollEnd);
    return () => track.removeEventListener('scrollend', handleScrollEnd);
  }, [active, total, scrollTo]);

  // ── navigation ────────────────────────────────────────────────────────────
  const goNext = useCallback(() => setActive(a => a + 1), []);
  const goPrev = useCallback(() => setActive(a => a - 1), []);

  // ── dot index: maps extCards index back to real 0-based index ────────────
  const realIdx = active === 0
    ? total - 1
    : active === total + 1
      ? 0
      : active - 1;

  // ── autoplay ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (paused) return;
    const id = setInterval(goNext, 4000);
    return () => clearInterval(id);
  }, [active, paused, goNext]);

  // ── styles injected once ──────────────────────────────────────────────────
  useEffect(() => {
    const id = 'fs-styles';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = `
      .fs-track { scrollbar-width: none; -ms-overflow-style: none; }
      .fs-track::-webkit-scrollbar { display: none; }
      @keyframes fs-float {
        0%,100% { transform: translateY(0px); }
        50%      { transform: translateY(-10px); }
      }
      @keyframes fs-pulse {
        0%,100% { transform: scale(1); }
        50%      { transform: scale(1.1); }
      }
    `;
    document.head.appendChild(el);
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  // ── RTL keyboard ─────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  goNext();
      if (e.key === 'ArrowRight') goPrev();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [goNext, goPrev]);

  return (
    <section
      id="features"
      role="region"
      aria-label="مميزات نظام إدارة الجامعة"
      style={{ background: '#F5F4F0', padding: '80px 0', overflow: 'hidden' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: 48, padding: '0 24px' }}>
        <p style={{
          fontSize: 12, fontWeight: 800, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: '#84BD3A', margin: '0 0 10px',
        }}>النظام الأكاديمي</p>
        <h2 style={{
          fontSize: 34, fontWeight: 700, color: '#1a1a1a',
          margin: '0 0 12px', lineHeight: 1.25,
        }}>مميزات نظام إدارة الجامعة</h2>
        <p style={{ fontSize: 16, color: '#777', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
          اكتشف كيف يسهّل النظام حياتك الأكاديمية
        </p>
      </div>

      {/* ── Track ────────────────────────────────────────────────────────────
           CSS scroll-snap centres the active card automatically.
           paddingInline = calc(50% - cardWidth/2) creates a snap
           pocket at the centre on every viewport width.
           alignItems:flex-end keeps all cards on the same baseline
           so the fan tilt fans out from the bottom.
      ───────────────────────────────────────────────────────────────────── */}
      <div
        ref={trackRef}
        className="fs-track"
        aria-live="polite"
        onScroll={() => {/* no-op: we drive scroll programmatically */}}
        onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          const delta = touchX.current - e.changedTouches[0].clientX;
          if (delta >  60) goNext();
          if (delta < -60) goPrev();
        }}
        // scrollend is the standard event that fires when scroll settles
        onScrollCapture={() => {}}
        style={{
          display: 'flex',
          gap: GAP,
          overflowX: 'scroll',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          // Centre snap: left/right padding = half-viewport minus half-card
          paddingLeft:  `calc(50vw - ${CARD_W / 2}px)`,
          paddingRight: `calc(50vw - ${CARD_W / 2}px)`,
          // Extra bottom padding so tilted corners don't clip
          paddingBottom: 48,
          // Align card bottoms so the tilt pivots from the shared baseline
          alignItems: 'flex-end',
        } as React.CSSProperties}
      >

        {extCards.map((card, i) => {
          const diff = i - active;
          const Illustration = ILLUSTRATIONS[card.id];
          return (
            <article
              key={`${card.id}-${i}`}
              aria-label={card.titleAr}
              aria-current={diff === 0 ? 'true' : undefined}
              onClick={() => {
                if (diff === -1) goPrev();
                else if (diff === 1) goNext();
              }}
              style={{
                flexShrink: 0,
                width: CARD_W,
                height: CARD_H,
                minHeight: CARD_H,
                borderRadius: 24,
                background: 'white',
                overflow: 'hidden',
                scrollSnapAlign: 'center',
                cursor: diff !== 0 ? 'pointer' : 'default',
                // smooth tilt transition on each card
                transition: 'transform 450ms cubic-bezier(0.25,0.46,0.45,0.94)',
                display: 'flex',
                flexDirection: 'column',
                ...cardTilt(diff),
              }}
            >
              {/* Illustration — top 280px */}
              <div style={{
                height: 280,
                background: card.color,
                borderRadius: '24px 24px 0 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px 28px',
                flexShrink: 0,
                overflow: 'hidden',
              }}>
                <Illustration accent={card.accent} active={diff === 0} />
              </div>

              {/* Content — bottom 240px */}
              <div style={{
                height: 240,
                display: 'flex',
                flexDirection: 'column',
                padding: '20px 24px 24px',
                background: 'white',
                borderRadius: '0 0 24px 24px',
                direction: 'rtl',
                overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 8,
                }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', margin: 0, lineHeight: 1.3 }}>
                    {card.titleAr}
                  </h3>
                  <span style={{ fontSize: 26, flexShrink: 0 }} role="img" aria-label={card.titleEn}>
                    {card.icon}
                  </span>
                </div>

                <p style={{ fontSize: 14, color: '#555', lineHeight: 1.75, marginTop: 10, marginBottom: 0, flexGrow: 1 }}>
                  {card.descAr}
                </p>

                <Link
                  to="/login"
                  aria-label={`اعرف أكثر عن ${card.titleAr}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    marginTop: 12, fontSize: 14, fontWeight: 600,
                    color: card.accent, textDecoration: 'none',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.7'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}
                >
                  <span style={{ borderBottom: `1.5px solid ${card.accent}` }}>اعرف أكثر</span>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M10 7H4M6.5 4.5L4 7l2.5 2.5" stroke="currentColor" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {/* ── Navigation ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 14, marginTop: 8,
      }}>
        <NavBtn dir="prev" onClick={goPrev} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          role="tablist" aria-label="تنقل بين البطاقات">
          {CARDS.map((card, i) => (
            <button
              key={card.id}
              role="tab"
              aria-selected={i === realIdx}
              aria-label={card.titleAr}
              onClick={() => { setActive(i + 1); }}
              style={{
                width: i === realIdx ? 24 : 8,
                height: 8, borderRadius: 4, border: 'none', padding: 0,
                background: i === realIdx ? '#84BD3A' : '#ccc',
                cursor: 'pointer',
                transition: 'width 300ms ease, background 300ms ease',
                flexShrink: 0,
              }}
            />
          ))}
        </div>

        <NavBtn dir="next" onClick={goNext} />
      </div>
    </section>
  );
}

export default FeatureShowcase;
