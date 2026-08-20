import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { CollegesSection, collegesKeys } from '../components/CollegesSection';
import { FeaturesCarousel } from '../components/FeaturesCarousel/FeaturesCarousel';
import { CountUp } from '../components/ui/CountUp';
import { useUniversityStats } from '../hooks/useUniversityStats';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import LanguageToggle from '../components/ui/LanguageToggle';
import ThemeToggle from '../components/ui/ThemeToggle';
import Modal from '../components/ui/Modal';
import {
  Search,
  GraduationCap,
  Building2,
  Users,
  BookOpen,
  Globe,
  Trophy,
  Briefcase,
  Microscope,
  ArrowLeft,
  ArrowRight,
  Play,
  ChevronDown,
  Menu,
  X,
  ShieldCheck,
  CalendarRange,
  Languages,
  MapPin,
  Beaker,
  MonitorPlay,
  Users2,
  QrCode,
  CheckCircle2,
  Clock,
  ScanLine
} from 'lucide-react';

// Assets
const LOGO = '/assets/university/ne/logo.svg';
const LOGO_WHITE = '/assets/university/ne/logo-white.svg';
const HERO_1 = '/assets/university/ne/campus-hero-1.png';
const HERO_2 = '/assets/university/ne/campus-hero-2.png';
const BUILDING = '/assets/university/ne/campus-building.png';
const ENTRANCE = '/assets/university/ne/campus-entrance.png';
const AERIAL = '/assets/university/ne/campus-aerial.png';
const WIDE = '/assets/university/ne/campus-wide.png';
const PORTRAIT_1 = '/assets/university/ne/campus-portrait-1.png';
const PROMO_VIDEO = '/assets/university/ne/university-promo.mp4';

// Feature Flags
const VIRTUAL_TOUR_ENABLED = true;

const LandingPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');
  const { isDark } = useTheme();

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTourModalOpen, setIsTourModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('home');
  const { stats: universityStats, colleges, sampleSlots, isLoading: statsLoading } = useUniversityStats();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    const sections = document.querySelectorAll('section[id], footer[id]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.1, rootMargin: '-20% 0px -60% 0px' }
    );
    sections.forEach((section) => observer.observe(section));

    return () => {
      window.removeEventListener('scroll', handleScroll);
      sections.forEach((section) => observer.unobserve(section));
    };
  }, []);

  const navLinks = useMemo(() => [
    { name: t('landing.nav.home'), href: '#home' },
    { name: t('landing.nav.about'), href: '#about' },
    { name: t('landing.nav.whyUs'), href: '#why-us' },
    { name: t('landing.nav.colleges'), href: '#colleges' },
    { name: t('landing.nav.contact'), href: '#contact' },
  ], [t]);

  const statsData = useMemo(() => universityStats || {
    totalStudents: 605,
    totalColleges: 2,
    totalFaculty: 12,
    totalSpecializations: 9,
    totalCourses: 61,
  }, [universityStats]);

  const stats = useMemo(() => [
    {
      label: t('landing.stats.colleges'),
      desc: t('landing.stats.collegesDesc'),
      value: <CountUp end={statsData.totalColleges} />,
      icon: <Building2 size={22} strokeWidth={2} />,
    },
    {
      label: t('landing.stats.students'),
      desc: t('landing.stats.studentsDesc'),
      value: <CountUp end={statsData.totalStudents} />,
      icon: <Users size={22} strokeWidth={2} />,
    },
    {
      label: t('landing.stats.faculty'),
      desc: t('landing.stats.facultyDesc'),
      value: <CountUp end={statsData.totalFaculty} />,
      icon: <GraduationCap size={22} strokeWidth={2} />,
    },
    {
      label: t('landing.stats.departments'),
      desc: t('landing.stats.departmentsDesc'),
      value: <CountUp end={statsData.totalSpecializations} />,
      icon: <Briefcase size={22} strokeWidth={2} />,
    },
    {
      label: t('landing.stats.courses'),
      desc: t('landing.stats.coursesDesc'),
      value: <CountUp end={statsData.totalCourses} />,
      icon: <BookOpen size={22} strokeWidth={2} />,
    },
  ], [statsData, t]);

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 font-sans selection:bg-brand-green/30 selection:text-brand-navy overflow-x-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* ─── 1. NAVBAR ────────────────────────────────────────────────────────── */}
      <nav
        className={`fixed top-0 w-full z-[100] transition-all duration-500 ${isScrolled
            ? 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-[0_2px_20px_rgba(0,0,0,0.08)] py-2'
            : 'bg-transparent py-4'
          }`}
      >
        <div className="max-w-screen-xl mx-auto px-6 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0">
            <ImageWithFallback
              src={(!isDark && isScrolled) ? LOGO : LOGO_WHITE}
              alt="University Logo"
              className="h-10 md:h-11 w-auto object-contain transition-all duration-500"
            />
          </Link>

          {/* Centered Nav Links */}
          <ul className="hidden lg:flex items-center justify-center gap-8">
            {navLinks.map((link) => {
              const sectionId = link.href.replace('#', '');
              const isActive = activeSection === sectionId;
              return (
                <li key={link.name}>
                  <a
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`text-sm font-bold tracking-tight transition-all relative pb-1 ${isActive
                        ? 'text-brand-green after:absolute after:-bottom-1 after:right-0 after:w-full after:h-0.5 after:bg-brand-green after:rounded-full'
                        : isScrolled
                          ? 'text-brand-navy dark:text-brand-text-main hover:text-brand-green'
                          : 'text-white/90 hover:text-white'
                      }`}
                  >
                    {link.name}
                  </a>
                </li>
              );
            })}
          </ul>

          {/* Right Controls */}
          <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
            {/* Search Input Box */}
            {isSearchOpen && (
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('landing.nav.searchPlaceholder')}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 transition-all w-48"
                autoFocus
              />
            )}

            {/* Search Icon Button */}
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className={`p-2 rounded-xl transition-colors ${isScrolled
                  ? 'text-brand-navy dark:text-brand-text-main hover:bg-slate-100 dark:hover:bg-slate-800'
                  : 'text-white hover:bg-white/10'
                }`}
              aria-label="Search"
            >
              <Search size={20} />
            </button>

            {/* Language Toggle */}
            <LanguageToggle />

            {/* Theme Toggle */}
            <ThemeToggle
              className={isScrolled
                ? 'text-brand-navy dark:text-brand-text-main hover:bg-slate-100 dark:hover:bg-slate-800'
                : 'text-white hover:bg-white/10'
              }
            />

            {/* Outline: virtual tour */}
            {VIRTUAL_TOUR_ENABLED && (
              <button
                onClick={() => setIsTourModalOpen(true)}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl border font-bold text-sm transition-all duration-300 ${isScrolled
                    ? 'border-brand-navy/30 dark:border-slate-700 text-brand-navy dark:text-brand-text-main hover:border-brand-green hover:text-brand-green'
                    : 'border-white/40 text-white hover:border-white hover:bg-white/10'
                  }`}
              >
                <div className="w-5 h-5 rounded-full border border-current flex items-center justify-center">
                  <Play size={8} className="fill-current" />
                </div>
                {t('landing.nav.virtualTour')}
              </button>
            )}

            {/* Solid green: login */}
            <Link
              to="/login"
              className="px-5 py-2 bg-brand-green hover:bg-brand-green-dark text-white font-black text-sm rounded-xl shadow-md shadow-brand-green/25 transition-all duration-300 hover:-translate-y-0.5"
            >
              {t('landing.nav.login')}
            </Link>
          </div>

          {/* Mobile controls & hamburger */}
          <div className="flex lg:hidden items-center gap-2">
            <LanguageToggle />
            <ThemeToggle
              className={isScrolled
                ? 'text-brand-navy dark:text-brand-text-main hover:bg-slate-100 dark:hover:bg-slate-800'
                : 'text-white hover:bg-white/10'
              }
            />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-expanded={isMobileMenuOpen}
              aria-label="Open menu"
              className={`p-2 rounded-xl transition-colors ${isScrolled
                  ? 'text-brand-navy dark:text-brand-text-main hover:bg-slate-100 dark:hover:bg-slate-850'
                  : 'text-white hover:bg-white/10'
                }`}
            >
              {isMobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
            </button>
          </div>
        </div>

        {/* Mobile backdrop */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-[98] bg-brand-navy/20 dark:bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Mobile dropdown */}
        <div
          className={`absolute top-full left-0 w-full z-[99] bg-white dark:bg-slate-900 shadow-2xl transition-all duration-300 lg:hidden origin-top ${isMobileMenuOpen ? 'opacity-100 scale-y-100 visible' : 'opacity-0 scale-y-0 invisible pointer-events-none'
            }`}
        >
          <div className="flex flex-col py-4 px-6 gap-2 border-t border-slate-100 dark:border-slate-800">
            {navLinks.map((link) => {
              const sectionId = link.href.replace('#', '');
              const isActive = activeSection === sectionId;
              return (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`text-lg font-bold py-3 border-b border-slate-100 dark:border-slate-800 last:border-none ${isActive ? 'text-brand-green' : 'text-brand-navy dark:text-brand-text-main hover:text-brand-green'
                    }`}
                >
                  {link.name}
                </a>
              );
            })}
            <div className="flex flex-col gap-3 pt-4 border-t border-slate-150 dark:border-slate-800 mt-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('landing.nav.searchPlaceholder')}
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
              </div>
              {VIRTUAL_TOUR_ENABLED && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsTourModalOpen(true);
                  }}
                  className="py-3 rounded-xl border border-brand-navy/30 dark:border-slate-700 text-brand-navy dark:text-brand-text-main font-bold text-sm text-center flex items-center justify-center gap-2"
                >
                  <Play size={12} className="fill-current" />
                  {t('landing.nav.virtualTour')}
                </button>
              )}
              <Link
                to="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-3 rounded-xl bg-brand-green text-white font-black text-sm shadow-md text-center transition-all"
              >
                {t('landing.nav.login')}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main>
        {/* ─── 2. HERO SECTION ──────────────────────────────────────────────────── */}
        <section
          id="home"
          className="relative flex items-center justify-center min-h-screen bg-brand-navy dark:bg-slate-950 pt-28 pb-36 overflow-hidden"
        >
          {/* Decorative Campus Photo Backdrop Fragment */}
          <div className="absolute inset-0 z-0 opacity-15 dark:opacity-10 pointer-events-none scale-105 filter blur-xs">
            <ImageWithFallback
              src={HERO_1}
              alt="Campus decorative backdrop"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="max-w-screen-xl mx-auto px-6 relative z-10 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Right column (RTL: right, LTR: left) - Headline text */}
            <div className="lg:col-span-6 space-y-8 text-center lg:text-start order-1">
              <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-brand-navy-700/60 dark:bg-slate-900/60 border border-white/10 backdrop-blur-sm">
                <span className="text-[11px] md:text-xs font-bold tracking-wider text-white/90">
                  {t('landing.hero.eyebrow')}
                </span>
              </div>

              <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tight text-white font-display">
                {t('landing.hero.titlePart1')}
                <br />
                <span className="text-brand-green">{t('landing.hero.titlePart2')}</span>
              </h1>

              <p className="text-slate-300 dark:text-slate-400 text-base md:text-lg font-medium leading-relaxed max-w-xl mx-auto lg:mx-0">
                {t('landing.hero.desc')}
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Link
                  to="/register"
                  className="group w-full sm:w-auto inline-flex items-center justify-center gap-3 px-7 py-3.5 bg-brand-green hover:bg-brand-green-dark text-white font-black text-sm rounded-xl shadow-lg shadow-brand-green/25 transition-all duration-300 hover:-translate-y-0.5"
                >
                  <span>{t('landing.hero.ctaRegister')}</span>
                  {isRTL ? (
                    <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
                  ) : (
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  )}
                </Link>
                <a
                  href="#about"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-3.5 border border-white/30 hover:border-white/60 bg-white/5 hover:bg-white/10 text-white font-bold text-sm rounded-xl backdrop-blur-xs transition-all duration-300"
                >
                  {t('landing.hero.ctaAbout')}
                </a>
              </div>
            </div>

            {/* Left column (RTL: left, LTR: right) - Smart Attendance Check-in Preview Card */}
            <div className="lg:col-span-6 flex justify-center order-2">
              <div className="w-full max-w-md relative">
                {/* Visual card */}
                <div
                  className="w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 p-5 md:p-6 transition-all duration-500 transform rotate-1 md:rotate-2 hover:rotate-0 hover:-translate-y-1.5 motion-reduce:hover:transform-none"
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700 mb-4">
                    <span className="text-xs md:text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <ScanLine size={16} className="text-brand-green" />
                      {t('landing.attendance.title')}
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] md:text-xs font-black text-brand-green bg-brand-primary-50 dark:bg-brand-primary-950/30 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 bg-brand-green rounded-full animate-pulse" />
                      {t('landing.attendance.autoCheckIn')}
                    </span>
                  </div>

                  {/* Stacked Attendance Check-in rows */}
                  <div className="space-y-3">
                    {(['lecture1', 'lab1', 'section1'] as const).map((rowKey) => (
                      <div
                        key={rowKey}
                        className="p-3 rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-750/70 transition-all duration-200 shadow-xs flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-brand-green/10 dark:bg-brand-green/20 text-brand-green flex items-center justify-center flex-shrink-0">
                            <QrCode size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-extrabold text-xs md:text-sm text-slate-800 dark:text-slate-100 truncate">
                              {t(`landing.attendance.rows.${rowKey}.title`)}
                            </p>
                            <div className="flex items-center gap-2.5 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <MapPin size={10} className="text-brand-green" />
                                {t(`landing.attendance.rows.${rowKey}.location`)}
                              </span>
                              <span className="text-slate-300 dark:text-slate-600">•</span>
                              <span className="flex items-center gap-1">
                                <QrCode size={10} className="text-brand-primary-500" />
                                {t(`landing.attendance.rows.${rowKey}.mode`)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end flex-shrink-0 gap-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black">
                            <CheckCircle2 size={11} className="text-emerald-500" />
                            {t('landing.attendance.statusVerified')}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-mono text-slate-400 dark:text-slate-500 font-medium">
                            <Clock size={10} />
                            {t(`landing.attendance.rows.${rowKey}.time`)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating Verified status badge */}
                <div className="absolute -top-3 -end-3 bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-3.5 py-2 rounded-xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 flex items-center gap-2 transform -rotate-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-brand-green flex items-center justify-center">
                    <ShieldCheck size={11} className="text-white" />
                  </div>
                  <span className="text-[10px] md:text-xs font-black tracking-tight font-mono">
                    {t('landing.attendance.verifiedBadge')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 3. STATS CARD ────────────────────────────────────────────────────── */}
        <section className="relative z-30 max-w-screen-xl mx-auto px-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-150 dark:border-slate-700 -mt-16 md:-mt-24">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-100 dark:divide-slate-700">
              {stats.map((stat, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-4 p-6 group hover:bg-slate-50/50 dark:hover:bg-slate-750/30 transition-colors duration-300 ${i === 0 ? 'rounded-t-2xl lg:rounded-tr-2xl lg:rounded-tl-none' : ''
                    } ${i === stats.length - 1 ? 'rounded-b-2xl lg:rounded-bl-2xl lg:rounded-br-none' : ''
                    }`}
                >
                  <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-950/20 text-brand-green flex items-center justify-center group-hover:bg-brand-green group-hover:text-white transition-all duration-300">
                    {stat.icon}
                  </div>
                  <div className="min-w-0">
                    {statsLoading ? (
                      <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 animate-pulse rounded mb-1" />
                    ) : (
                      <p className="text-2xl md:text-3xl font-black text-brand-accent-gold dark:text-brand-accent-gold leading-none font-mono">
                        {stat.value}
                      </p>
                    )}
                    <p className="text-xs font-extrabold text-brand-navy dark:text-white leading-snug mt-1.5">{stat.label}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-snug mt-1">{stat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 4. COLLEGES SECTION ───────────────────────────────────────────────── */}
        <CollegesSection colleges={colleges} isLoading={statsLoading} />

        {/* ─── 5. WHY CHOOSE US SECTION ──────────────────────────────────────────── */}
        <section id="why-us" className="py-24 md:py-32 bg-brand-navy dark:bg-slate-950 relative overflow-hidden">
          {/* Abstract shapes */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-green/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-primary-600/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />

          <div className="max-w-screen-xl mx-auto px-6 relative z-10">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Left Column: Text & Features List */}
              <div className="space-y-12 order-1">
                <div className="space-y-4">
                  <span className="text-xs font-black uppercase tracking-widest text-brand-green">
                    {t('landing.whyUs.eyebrow')}
                  </span>
                  <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight font-display m-0">
                    {t('landing.whyUs.title')}
                  </h2>
                </div>

                <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Feature 1: Roles */}
                  <div className="space-y-4 group">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 text-brand-green flex items-center justify-center group-hover:bg-brand-green group-hover:text-brand-navy transition-all duration-500">
                      <ShieldCheck size={28} />
                    </div>
                    <h4 className="text-lg font-black text-white">{t('landing.whyUs.roles.title')}</h4>
                    <p className="text-white/60 dark:text-slate-400 text-sm leading-relaxed font-medium">
                      {t('landing.whyUs.roles.desc')}
                    </p>
                  </div>

                  {/* Feature 2: Scheduling */}
                  <div className="space-y-4 group">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 text-brand-green flex items-center justify-center group-hover:bg-brand-green group-hover:text-brand-navy transition-all duration-500">
                      <CalendarRange size={28} />
                    </div>
                    <h4 className="text-lg font-black text-white">{t('landing.whyUs.scheduling.title')}</h4>
                    <p className="text-white/60 dark:text-slate-400 text-sm leading-relaxed font-medium">
                      {t('landing.whyUs.scheduling.desc')}
                    </p>
                  </div>

                  {/* Feature 3: RTL Support */}
                  <div className="space-y-4 group col-span-1 md:col-span-2">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 text-brand-green flex items-center justify-center group-hover:bg-brand-green group-hover:text-brand-navy transition-all duration-500">
                      <Languages size={28} />
                    </div>
                    <h4 className="text-lg font-black text-white">{t('landing.whyUs.rtl.title')}</h4>
                    <p className="text-white/60 dark:text-slate-400 text-sm leading-relaxed font-medium">
                      {t('landing.whyUs.rtl.desc')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Visual success image */}
              <div className="relative order-2 flex justify-center">
                <div className="absolute -inset-4 bg-brand-green/20 rounded-[3rem] blur-2xl" />
                <div className="relative rounded-[3.5rem] overflow-hidden shadow-2xl aspect-square max-w-sm md:max-w-md">
                  <ImageWithFallback
                    src={HERO_2}
                    alt="Student success"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 6. ABOUT SECTION ──────────────────────────────────────────────────── */}
        <section id="about" className="py-24 lg:py-32 bg-slate-50 dark:bg-slate-900 relative overflow-hidden">
          <div className="max-w-screen-xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Visual Campus Image (RTL: left, LTR: right) - rhythm shift */}
              <div className="relative group order-2 lg:order-1 flex justify-center">
                <div className="absolute -inset-4 bg-brand-green/10 rounded-[3rem] blur-2xl group-hover:bg-brand-green/20 transition-all duration-500" />
                <div className="relative rounded-[2.5rem] overflow-hidden shadow-xl aspect-[4/3] max-w-md w-full">
                  <ImageWithFallback
                    src={AERIAL}
                    alt="Campus main layout"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                </div>

              {/* Text Column (RTL: right, LTR: left) */}
              <div className="space-y-8 order-1 lg:order-2">
                <div className="space-y-4">
                  <span className="block text-xs font-black uppercase tracking-widest text-brand-green">
                    {t('landing.about.eyebrow')}
                  </span>
                  <h2 className="text-3xl md:text-5xl font-extrabold text-brand-navy dark:text-white leading-tight font-display m-0">
                    {t('landing.about.title1')} <br />
                    <span className="text-brand-green">{t('landing.about.title2')}</span>
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-base md:text-lg leading-relaxed font-medium">
                    {t('landing.about.desc')}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {[
                    t('landing.about.pills.accredited'),
                    t('landing.about.pills.advancedResearch'),
                    t('landing.about.pills.partnerships')
                  ].map((pill) => (
                    <span
                      key={pill}
                      className="px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-150 dark:border-slate-700 text-brand-navy dark:text-white text-xs font-bold shadow-sm hover:shadow-md hover:border-brand-green transition-all duration-300"
                    >
                      {pill}
                    </span>
                  ))}
                </div>

                <div className="pt-4">
                  <Link
                    to="/about"
                    className="inline-flex items-center gap-3 text-brand-navy dark:text-white hover:text-brand-green font-black text-sm group"
                  >
                    <span className="border-b-2 border-brand-green pb-1">{t('landing.about.learnMore')}</span>
                    {isRTL ? (
                      <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
                    ) : (
                      <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                    )}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 7. FEATURE SHOWCASE CAROUSEL ──────────────────────────────────────── */}
        <FeaturesCarousel />

        {/* ─── 8. CTA BANNER ─────────────────────────────────────────────────────── */}
        <section className="py-20 bg-slate-50 dark:bg-slate-900/50">
          <div className="max-w-screen-xl mx-auto px-6">
            <div className="relative rounded-[3rem] overflow-hidden bg-brand-navy dark:bg-slate-950 p-12 md:p-20 text-center space-y-8 shadow-2xl border border-white/5">
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full transform -skew-y-12 bg-white/20" />
              </div>

              <div className="relative z-10 space-y-6">
                <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight font-display m-0">
                  {t('landing.cta.title')}
                </h2>
                <p className="max-w-2xl mx-auto text-base md:text-lg text-slate-300 dark:text-slate-400 font-bold leading-relaxed">
                  {t('landing.cta.desc')}
                </p>
                <div className="pt-6">
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-4 px-10 py-5 bg-brand-green hover:bg-brand-green-dark text-white font-black rounded-2xl shadow-xl hover:shadow-brand-green/20 transition-all duration-300 transform hover:-translate-y-1"
                  >
                    <span className="text-base md:text-lg">{t('landing.cta.button')}</span>
                    {isRTL ? (
                      <ArrowLeft size={20} className="transition-transform" />
                    ) : (
                      <ArrowRight size={20} className="transition-transform" />
                    )}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ─── 9. FOOTER ─────────────────────────────────────────────────────────── */}
      <footer id="contact" className="bg-slate-900 dark:bg-slate-950 pt-24 pb-12 text-white border-t border-slate-800">
        <div className="max-w-screen-xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 pb-20 border-b border-slate-800">
            {/* Brand Col */}
            <div className="space-y-8 text-start">
              <ImageWithFallback
                src={LOGO_WHITE}
                alt="University Logo"
                className="h-14 w-auto object-contain"
              />
              <p className="text-slate-400 text-sm leading-relaxed font-medium">
                {t('landing.footer.desc')}
              </p>
              {/* TODO: Re-add social media links once official university handles are provided */}
            </div>

            {/* Quick Links */}
            <div className="space-y-8 text-start">
              <h4 className="text-lg font-black tracking-tight">{t('landing.footer.quickLinks')}</h4>
              <ul className="space-y-4">
                {navLinks.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-slate-400 hover:text-brand-green text-sm font-bold transition-colors"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Colleges */}
            <div className="space-y-8 text-start">
              <h4 className="text-lg font-black tracking-tight">{t('landing.footer.ourColleges')}</h4>
              <ul className="space-y-4">
                {collegesKeys.map((college) => (
                  <li key={college.id}>
                    <a
                      href={`/colleges/${college.id}`}
                      className="text-slate-400 hover:text-brand-green text-sm font-bold transition-colors"
                    >
                      {t(college.nameKey)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div className="space-y-8 text-start">
              <h4 className="text-lg font-black tracking-tight">{t('landing.footer.contactUs')}</h4>
              <div className="space-y-6">
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-widest text-brand-green">
                    {t('landing.footer.location')}
                  </p>
                  <p className="text-slate-400 text-sm font-bold">{t('landing.footer.address')}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-widest text-brand-green">
                    {t('landing.footer.email')}
                  </p>
                  <a href="mailto:info@university.edu.eg" className="text-slate-400 hover:text-brand-green text-sm font-bold transition-colors">
                    info@university.edu.eg
                  </a>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-widest text-brand-green">
                    {t('landing.footer.phone')}
                  </p>
                  <a href="tel:+201234567890" dir="ltr" className="text-slate-400 hover:text-brand-green text-sm font-bold transition-colors">
                    +20 123 456 7890
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-12 flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-slate-500 text-xs font-bold tracking-wider uppercase text-center md:text-start">
              {t('landing.footer.rights', { year: new Date().getFullYear() })}
            </p>
            <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <a href="#" className="hover:text-brand-green transition-colors">
                {t('landing.footer.privacy')}
              </a>
              <a href="#" className="hover:text-brand-green transition-colors">
                {t('landing.footer.terms')}
              </a>
              <span className="text-slate-700">v1.0.0</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Virtual Tour Video Modal */}
      <Modal
        isOpen={isTourModalOpen}
        onClose={() => setIsTourModalOpen(false)}
        title={t('landing.nav.virtualTour')}
        size="xl"
      >
        {isTourModalOpen && (
          <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl">
            <video
              controls
              autoPlay
              className="w-full h-full object-contain"
              src={PROMO_VIDEO}
            >
              <source src={PROMO_VIDEO} type="video/mp4" />
            </video>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LandingPage;

