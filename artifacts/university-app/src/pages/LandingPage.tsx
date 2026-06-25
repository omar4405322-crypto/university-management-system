import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CollegesSection, colleges } from '../components/CollegesSection';
import { CountUp } from '../components/ui/CountUp';
import { useUniversityStats } from '../hooks/useUniversityStats';
import {
  GraduationCap,
  Building2,
  Users,
  BookOpen,
  ChevronDown,
  Menu,
  X,
  Globe,
  Trophy,
  Briefcase,
  Microscope,
  ArrowLeft,
  Play,
  Monitor,
  Cog,
  Pill,
  BarChart2,
  PenTool,
  Zap,
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
const _PORTRAIT_2 = '/assets/university/ne/campus-portrait-2.png';

const ImageWithFallback = ({ src, alt, className, ...props }) => {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div
        className={`${className} bg-gradient-to-br from-brand-navy-500 to-brand-navy-dark flex items-center justify-center`}
        {...props}
      >
        <Building2 className="text-white/20" size={48} />
      </div>
    );
  }

  return (
    <img src={src} alt={alt} loading="lazy" decoding="async" className={className} onError={() => setError(true)} {...props} />
  );
};

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("home");
  const { stats: universityStats, isLoading: statsLoading } = useUniversityStats();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll);
    
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
    
    // Simulate data loading
    setIsLoading(false);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      sections.forEach((section) => observer.unobserve(section));
    };
  }, []);

  const navLinks = [
    { name: 'الرئيسية', href: '#home' },
    { name: 'عن الجامعة', href: '#about' },
    { name: 'الكليات', href: '#colleges' },
    { name: 'التخصصات', href: '#specialties' },
    { name: 'التواصل', href: '#contact' },
  ];

  const statsData = universityStats || {
    totalStudents: 15420,
    totalColleges: 8,
    totalFaculty: 850,
    totalSpecializations: 45
  };

  const stats = [
    { 
      label: 'طالب مسجل', 
      value: <CountUp end={statsData.totalStudents} prefix="+" />,
      icon: <Users size={24} strokeWidth={2} /> 
    },
    { 
      label: 'كلية أكاديمية', 
      value: <CountUp end={statsData.totalColleges} />,
      icon: <Building2 size={24} strokeWidth={2} /> 
    },
    { 
      label: 'عضو هيئة تدريس', 
      value: <CountUp end={statsData.totalFaculty} prefix="+" />,
      icon: <GraduationCap size={24} strokeWidth={2} /> 
    },
    { 
      label: 'تخصص دراسي', 
      value: <CountUp end={statsData.totalSpecializations} prefix="+" />,
      icon: <BookOpen size={24} strokeWidth={2} /> 
    },
  ];

  const features = [
    {
      title: 'تعليم رقمي متطور',
      desc: 'منصة إلكترونية متكاملة لإدارة المقررات والتفاعل الأكاديمي.',
      icon: <Globe size={32} strokeWidth={2} />,
    },
    {
      title: 'تميز أكاديمي',
      desc: 'أعضاء هيئة تدريس من نخبة الأساتذة والباحثين العالميين.',
      icon: <Trophy size={32} strokeWidth={2} />,
    },
    {
      title: 'ربط بسوق العمل',
      desc: 'شراكات استراتيجية مع كبرى الشركات التكنولوجية والصناعية.',
      icon: <Briefcase size={32} strokeWidth={2} />,
    },
    {
      title: 'بحث علمي',
      desc: 'مراكز بحثية متخصصة ومختبرات مجهزة بأحدث التقنيات العالمية.',
      icon: <Microscope size={32} strokeWidth={2} />,
    },
  ];

  return (
    <div
      className="min-h-screen bg-white font-arabic selection:bg-brand-green/30 selection:text-brand-navy-500 overflow-x-hidden"
      dir="rtl"
    >
      {/* 1. Navbar */}
      <nav
        className={`fixed top-0 w-full z-[100] transition-all duration-500 ${
          isScrolled
            ? 'bg-white/95 backdrop-blur-md shadow-[0_2px_20px_rgba(0,0,0,0.08)] py-3'
            : 'bg-transparent py-6'
        }`}
      >
        <div className="container mx-auto px-6 flex items-center justify-between">
          {/* Logo and Video (Right in RTL) */}
          <div className="flex items-center gap-2 relative z-10 min-w-0 flex-shrink-0">
            <Link to="/">
              <ImageWithFallback
                src={isScrolled ? LOGO : LOGO_WHITE}
                alt="شعار الجامعة"
                className="h-10 md:h-12 w-auto object-contain transition-all duration-500"
              />
            </Link>
            <button className={`video-btn hidden md:flex items-center gap-2 ${isScrolled ? 'text-brand-navy-500' : 'text-white'}`} aria-label="Watch Introduction Video">
              <span className="label hidden md:inline text-sm font-bold px-2 py-1 rounded bg-white/90 text-brand-navy-500">
                جولة افتراضية
              </span>
              <div className="w-10 h-10 rounded-full bg-brand-green flex items-center justify-center shadow-lg">
                <Play size={18} className="fill-current text-white" />
              </div>
            </button>
          </div>

          {/* Desktop Nav Links (Left in RTL) */}
          <div className="hidden lg:flex items-center gap-10">
            <ul className="flex items-center gap-8">
              {navLinks.map((link) => {
                const sectionId = link.href.replace('#', '');
                const isActive = activeSection === sectionId;
                return (
                <li key={link.name}>
                  <a
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`text-sm font-bold tracking-tight transition-all relative ${
                      isActive 
                        ? 'text-brand-green after:absolute after:-bottom-2 after:left-0 after:w-full after:h-0.5 after:bg-brand-green after:rounded-full' 
                        : isScrolled ? 'text-brand-navy-500 hover:text-brand-green' : 'text-white hover:text-brand-green'
                    }`}
                  >
                    {link.name}
                  </a>
                </li>
              )})}
            </ul>
            <Link
              to="/login"
              className="px-6 py-2.5 bg-brand-green hover:bg-brand-green-dark text-white font-black rounded-xl shadow-lg shadow-brand-green/20 transition-all duration-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-brand-green/30"
            >
              تسجيل الدخول
            </Link>
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`lg:hidden p-2 z-[101] relative rounded-xl transition-colors ${
              isScrolled
                ? 'text-brand-navy-500 hover:bg-brand-primary-50'
                : 'text-white hover:bg-white/10'
            }`}
          >
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile Menu Backdrop (clicks outside) */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 z-[98] bg-brand-navy-500/20 backdrop-blur-sm lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Mobile Dropdown Menu */}
        <div
          className={`absolute top-full left-0 w-full z-[99] bg-white shadow-2xl transition-all duration-300 lg:hidden origin-top ${
            isMobileMenuOpen ? 'opacity-100 scale-y-100 visible' : 'opacity-0 scale-y-0 invisible pointer-events-none'
          }`}
        >
          <div className="flex flex-col py-4 px-6 gap-2 border-t border-brand-border/50">
            {navLinks.map((link) => {
              const sectionId = link.href.replace('#', '');
              const isActive = activeSection === sectionId;
              return (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-lg font-bold py-3 border-b border-brand-border/50 last:border-none ${
                  isActive ? 'text-brand-green' : 'text-brand-navy-500 hover:text-brand-green'
                }`}
              >
                {link.name}
              </a>
            )})}

            <Link
              to="/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className="mt-4 w-full py-3 rounded-xl bg-brand-green text-brand-navy-500 hover:bg-brand-green-dark hover:text-white font-black text-lg shadow-lg text-center transition-all"
            >
              تسجيل الدخول
            </Link>
          </div>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <section id="home" className="relative z-30 pt-40 pb-48 lg:pt-48 lg:pb-56 flex items-center justify-center hero-section min-h-[85vh]">
        {/* Background Image */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <ImageWithFallback
            src={HERO_1}
            alt="الحرم الجامعي"
            className="w-full h-full object-cover scale-110 animate-slow-zoom"
          />
          <div className="absolute inset-0 z-[1]" style={{ background: 'linear-gradient(to bottom, rgba(10, 20, 50, 0.55) 0%, rgba(10, 20, 50, 0.35) 50%, rgba(10, 20, 50, 0.65) 100%)' }} />
        </div>

        {/* Hero Content */}
        <div className="container mx-auto px-6 relative z-10 text-center space-y-8">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-brand-green/20 border border-brand-green/30 backdrop-blur-md animate-fade-in-up">
            <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-brand-navy-500">
              منصة إدارة أكاديمية متكاملة
            </span>
          </div>

          <h1 className="hero-title text-5xl md:text-7xl lg:text-8xl font-black text-white leading-tight tracking-tightest drop-shadow-2xl animate-fade-in-up delay-100">
            جامعة ٦ أكتوبر <br />
            <span className="text-brand-green">التكنولوجية</span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg md:text-xl text-white/80 font-medium leading-relaxed animate-fade-in-up delay-200">
            نبني جيلاً من القادة والمبتكرين في قلب مصر التكنولوجية. تعليم أكاديمي يجمع بين المعرفة
            النظرية والخبرة العملية.
          </p>

          <div className="hero-buttons flex flex-col sm:flex-row items-center justify-center gap-5 pt-8 animate-fade-in-up delay-300">
            <Link
              to="/register"
              className="group flex items-center gap-3 px-8 py-4 bg-brand-green hover:bg-brand-green-dark text-brand-navy-500 font-black rounded-2xl shadow-xl shadow-brand-green/20 transition-all duration-300 transform hover:-translate-y-1"
            >
              <span>ابدأ التسجيل الآن</span>
              <ArrowLeft
                size={18}
                className="rtl:-scale-x-100 transition-transform group-hover:-translate-x-1"
              />
            </Link>
            <a
              href="#about"
              className="px-8 py-4 border-2 border-white/30 hover:border-white bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl backdrop-blur-md transition-all duration-300"
            >
              تعرف علينا أكثر
            </a>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-48 left-1/2 -translate-x-1/2 animate-bounce opacity-50">
          <ChevronDown className="text-white" size={32} />
        </div>

        {/* Stats Bar (Overlapping) */}
        <div className="absolute bottom-0 left-0 w-full translate-y-1/2 z-20">
          <div className="container mx-auto px-6">
            <div className="stats-cards-row grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
              {stats.map((stat, i) => (
                <div
                  key={i}
                  className="bg-white/95 backdrop-blur-md p-8 md:p-10 rounded-[2rem] shadow-2xl shadow-brand-navy-500/10 border border-brand-border flex flex-col items-center text-center group hover:-translate-y-2 transition-all duration-500 ring-1 ring-brand-navy-500/5 min-h-[140px]"
                >
                  <div className="w-12 h-12 rounded-2xl bg-brand-primary-50 text-brand-green flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-brand-green group-hover:text-white transition-all duration-500 shadow-inner">
                    {stat.icon}
                  </div>
                  {statsLoading ? (
                    <div className="h-8 w-20 rounded-lg skeleton mb-1 mx-auto" />
                  ) : (
                    <h4 className="text-2xl md:text-3xl font-black text-brand-navy-500 mb-1">
                      {stat.value}
                    </h4>
                  )}
                  <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-brand-text-muted">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. About Section */}
      <section id="about" className="pt-32 pb-24 lg:pt-40 lg:pb-32 bg-brand-bg-page relative overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Image (Left) */}
            <div className="relative group order-2 lg:order-1">
              <div className="absolute -inset-4 bg-brand-green/20 rounded-[3rem] blur-2xl group-hover:bg-brand-green/30 transition-all duration-500" />
              <div className="relative rounded-[2.5rem] overflow-hidden shadow-elevated aspect-[4/3]">
                <ImageWithFallback
                  src={AERIAL}
                  alt="الحرم الجامعي للجامعة"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>
              <div className="absolute -bottom-8 -right-8 w-48 h-48 bg-brand-navy-500 rounded-3xl p-6 hidden md:flex flex-col justify-center items-center text-center shadow-2xl">
                <p className="text-brand-green font-black text-4xl mb-1">١٠+</p>
                <p className="text-white/80 text-[10px] font-black uppercase tracking-widest">
                  سنوات من التميز
                </p>
              </div>
            </div>

            {/* Text (Right) */}
            <div className="space-y-8 order-1 lg:order-2">
              <div className="space-y-4">
                <span className="text-xs font-black uppercase tracking-widest text-brand-navy-500">
                  عن جامعتنا
                </span>
                <h2 className="text-4xl md:text-5xl font-black text-brand-navy-500 leading-tight">
                  ريادة تكنولوجية <br />
                  <span className="text-brand-green">لمستقبل أفضل</span>
                </h2>
                <p className="text-brand-text-secondary text-lg leading-relaxed font-medium">
                  تعد جامعة ٦ أكتوبر التكنولوجية صرحاً أكاديمياً رائداً يسعى لتقديم تعليم تكنولوجي
                  متميز يواكب المعايير العالمية، من خلال برامج دراسية مبتكرة وبيئة تعليمية محفزة
                  للإبداع والبحث العلمي.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {['معتمدة دولياً', 'بحث علمي متقدم', 'شراكات عالمية'].map((pill) => (
                  <span
                    key={pill}
                    className="px-5 py-2 rounded-xl bg-white border border-brand-border text-brand-navy-500 text-xs font-black shadow-soft hover:shadow-md hover:border-brand-green transition-all duration-300"
                  >
                    {pill}
                  </span>
                ))}
              </div>

              <div className="pt-4">
                <Link
                  to="/about"
                  className="inline-flex items-center gap-3 text-brand-navy-500 font-black text-sm group"
                >
                  <span className="border-b-2 border-brand-green pb-1">اعرف المزيد عن الجامعة</span>
                  <ArrowLeft
                    size={16}
                    className="rtl:-scale-x-100 transition-transform group-hover:-translate-x-1"
                  />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Colleges Grid */}
      <CollegesSection isLoading={isLoading} />

      {/* 5. Why Choose Us Section */}
      <section id="specialties" className="py-24 md:py-32 bg-brand-navy-500 relative overflow-hidden">
        {/* Abstract shapes */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-green/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-primary-600/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-12">
              <div className="space-y-4">
                <span className="text-xs font-black uppercase tracking-widest text-brand-green">
                  لماذا تختارنا؟
                </span>
                <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
                  التميز هو معيارنا <br />
                  الوحيد في التعليم
                </h2>
              </div>

              <div className="grid sm:grid-cols-2 gap-8">
                {features.map((feature, i) => (
                  <div key={i} className="space-y-4 group">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 text-brand-green flex items-center justify-center group-hover:bg-brand-green group-hover:text-brand-navy-500 transition-all duration-500">
                      {feature.icon}
                    </div>
                    <h4 className="text-lg font-black text-white">{feature.title}</h4>
                    <p className="text-white/60 text-sm leading-relaxed font-medium">
                      {feature.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 bg-brand-green/20 rounded-[3rem] blur-2xl" />
              <div className="relative rounded-[3rem] overflow-hidden shadow-2xl aspect-square border-8 border-white/5">
                <ImageWithFallback
                  src={HERO_2}
                  alt="نجاح الطلاب"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Campus Gallery */}
      <section className="py-24 lg:py-32 bg-brand-bg-page">
        <div className="container mx-auto px-6 space-y-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4 text-right">
              <span className="text-xs font-black uppercase tracking-widest text-brand-navy-500">
                معرض الصور
              </span>
              <h2 className="text-4xl md:text-5xl font-black text-brand-navy-500 tracking-tight">
                استكشف حرمنا الجامعي
              </h2>
            </div>
            <button className="px-8 py-3 rounded-2xl border border-brand-border text-brand-navy-500 font-black text-sm hover:bg-white hover:border-brand-green transition-all duration-300">
              مشاهدة المعرض الكامل
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-2 md:row-span-2 group overflow-hidden rounded-[2.5rem] shadow-elevated">
              <ImageWithFallback
                src={BUILDING}
                alt="المبنى الرئيسي"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 cursor-pointer"
              />
            </div>
            <div className="group overflow-hidden rounded-[2rem] shadow-elevated h-64">
              <ImageWithFallback
                src={ENTRANCE}
                alt="المدخل"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 cursor-pointer"
              />
            </div>
            <div className="group overflow-hidden rounded-[2rem] shadow-elevated h-64">
              <ImageWithFallback
                src={PORTRAIT_1}
                alt="الطلاب"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 cursor-pointer"
              />
            </div>
            <div className="md:col-span-2 group overflow-hidden rounded-[2rem] shadow-elevated h-80">
              <ImageWithFallback
                src={WIDE}
                alt="رؤية بانورامية"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 7. CTA Banner */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="relative rounded-[3rem] overflow-hidden bg-gradient-to-r from-brand-green to-brand-green-dark p-12 md:p-20 text-center space-y-8 shadow-2xl shadow-brand-green/30">
            {/* Abstract Background pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <div className="absolute top-0 left-0 w-full h-full transform -skew-y-12 bg-white/20" />
            </div>

            <div className="relative z-10 space-y-6">
              <h2 className="text-4xl md:text-6xl font-black text-brand-navy-500 tracking-tight">
                جاهز لبدء رحلتك الأكاديمية؟
              </h2>
              <p className="max-w-2xl mx-auto text-lg md:text-xl text-brand-navy-500 font-bold leading-relaxed">
                سجّل الآن وانضم لآلاف الطلاب في منصتنا الرقمية المتقدمة واستفد من أحدث التقنيات
                التعليمية.
              </p>
              <div className="pt-6">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-4 px-10 py-5 bg-brand-navy-500 text-white font-black rounded-2xl shadow-2xl hover:bg-brand-navy-600 transition-all duration-300 transform hover:-translate-y-1"
                >
                  <span className="text-lg">سجّل دخولك الآن</span>
                  <ArrowLeft size={20} className="rtl:-scale-x-100" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Footer */}
      <footer id="contact" className="bg-brand-navy-500 pt-24 pb-12 text-white">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 pb-20 border-b border-white/10">
            {/* Brand Col */}
            <div className="space-y-8">
              <ImageWithFallback
                src={LOGO_WHITE}
                alt="شعار الجامعة"
                className="h-14 w-auto object-contain"
              />
              <p className="text-white/60 text-sm leading-relaxed font-medium">
                صرح تعليمي تكنولوجي رائد يسعى للتميز والابتكار في إعداد أجيال قادرة على قيادة
                المستقبل الرقمي في مصر.
              </p>
              <div className="flex items-center gap-4">
                <a
                  href="#"
                  aria-label="Facebook"
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-brand-green hover:text-brand-navy-500 hover:border-brand-green transition-all duration-300 text-sm font-bold"
                >
                  f
                </a>
                <a
                  href="#"
                  aria-label="Twitter"
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-brand-green hover:text-brand-navy-500 hover:border-brand-green transition-all duration-300 text-sm font-bold"
                >
                  𝕏
                </a>
                <a
                  href="#"
                  aria-label="Instagram"
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-brand-green hover:text-brand-navy-500 hover:border-brand-green transition-all duration-300 text-sm font-bold"
                >
                  ig
                </a>
                <a
                  href="#"
                  aria-label="LinkedIn"
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-brand-green hover:text-brand-navy-500 hover:border-brand-green transition-all duration-300 text-sm font-bold"
                >
                  in
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-8">
              <h4 className="text-lg font-black tracking-tight">روابط سريعة</h4>
              <ul className="space-y-4">
                {navLinks.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-white/60 hover:text-brand-green text-sm font-bold transition-colors"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Colleges */}
            <div className="space-y-8">
              <h4 className="text-lg font-black tracking-tight">كلياتنا</h4>
              <ul className="space-y-4">
                {colleges.slice(0, 5).map((college) => (
                  <li key={college.name}>
                    <a
                      href="#"
                      className="text-white/60 hover:text-brand-green text-sm font-bold transition-colors"
                    >
                      {college.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div className="space-y-8 text-right">
              <h4 className="text-lg font-black tracking-tight">تواصل معنا</h4>
              <div className="space-y-6">
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-widest text-brand-green">
                    الموقع
                  </p>
                  <p className="text-white/60 text-sm font-bold">مدينة ٦ أكتوبر، الجيزة، مصر</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-widest text-brand-green">
                    البريد الإلكتروني
                  </p>
                  <p className="text-white/60 text-sm font-bold">info@university.edu.eg</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-widest text-brand-green">
                    الهاتف
                  </p>
                  <p className="text-white/60 text-sm font-bold" dir="ltr">
                    +20 123 456 7890
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-12 flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-white/40 text-xs font-black tracking-widest uppercase">
              جميع الحقوق محفوظة © {new Date().getFullYear()} جامعة ٦ أكتوبر التكنولوجية
            </p>
            <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-widest text-white/40">
              <button type="button" className="hover:text-brand-green transition-colors">
                سياسة الخصوصية
              </button>
              <button type="button" className="hover:text-brand-green transition-colors">
                شروط الاستخدام
              </button>
              <span className="text-white/20">v1.0.0</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Global CSS for animations */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slow-zoom {
          from { transform: scale(1); }
          to { transform: scale(1.1); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 1s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .animate-slow-zoom {
          animation: slow-zoom 20s ease-in-out infinite alternate;
        }
        .delay-100 { animation-delay: 100ms; }
        .delay-200 { animation-delay: 200ms; }
        .delay-300 { animation-delay: 300ms; }
        
        html {
          scroll-behavior: smooth;
        }

        /* 3. Clarify Video Icon */
        .video-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          position: relative;
        }
        .video-btn:hover .label {
          opacity: 1;
        }



        /* 8. Skeleton Loading */
        .skeleton {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: skeleton-loading 1.5s infinite;
          border-radius: 8px;
        }
        @keyframes skeleton-loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* 9. Responsive Improvements */
        @media (max-width: 768px) {
          .hero-title {
            font-size: clamp(2rem, 8vw, 4rem) !important;
          }
          .hero-buttons {
            flex-direction: column;
            align-items: center;
            gap: 12px;
          }
          .hero-stats {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
          .stats-cards-row {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 480px) {
          .stats-cards-row {
            grid-template-columns: 1fr !important;
          }
        }
      `,
        }}
      />
    </div>
  );
};

export default LandingPage;
