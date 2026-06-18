import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  ArrowLeft
} from 'lucide-react';

// Assets
const LOGO = '/assets/university/logo.svg';
const LOGO_WHITE = '/assets/university/logo-white.svg';
const HERO_1 = '/assets/university/campus-hero-1.png';
const HERO_2 = '/assets/university/campus-hero-2.png';
const BUILDING = '/assets/university/campus-building.png';
const ENTRANCE = '/assets/university/campus-entrance.png';
const AERIAL = '/assets/university/campus-aerial.png';
const WIDE = '/assets/university/campus-wide.png';
const PORTRAIT_1 = '/assets/university/campus-portrait-1.png';
const PORTRAIT_2 = '/assets/university/campus-portrait-2.png';

const ImageWithFallback = ({ src, alt, className, ...props }) => {
  const [error, setError] = useState(false);
  
  if (error || !src) {
    return (
      <div 
        className={`${className} bg-gradient-to-br from-brand-navy to-brand-navy-700 flex items-center justify-center`}
        {...props}
      >
        <Building2 className="text-white/20" size={48} />
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={alt} 
      className={className} 
      onError={() => setError(true)} 
      {...props} 
    />
  );
};

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'الرئيسية', href: '#' },
    { name: 'عن الجامعة', href: '#about' },
    { name: 'الكليات', href: '#colleges' },
    { name: 'التخصصات', href: '#specialties' },
    { name: 'التواصل', href: '#contact' },
  ];

  const stats = [
    { label: 'طالب مسجل', value: '+٥٠٠٠', icon: <Users size={24} /> },
    { label: 'كلية أكاديمية', value: '١٢', icon: <Building2 size={24} /> },
    { label: 'عضو هيئة تدريس', value: '+٣٠٠', icon: <GraduationCap size={24} /> },
    { label: 'تخصص دراسي', value: '+١٥٠', icon: <BookOpen size={24} /> },
  ];

  const colleges = [
    { 
      name: 'كلية الحاسبات والمعلومات', 
      desc: 'إعداد كوادر تقنية متخصصة في هندسة البرمجيات والذكاء الاصطناعي.',
      students: '١٢٠٠ طالب',
      icon: '🖥️'
    },
    { 
      name: 'كلية الهندسة والتكنولوجيا', 
      desc: 'دراسات هندسية متطورة تلبي احتياجات الثورة الصناعية الرابعة.',
      students: '١٥٠٠ طالب',
      icon: '⚙️'
    },
    { 
      name: 'كلية الصيدلة والعلوم الطبية', 
      desc: 'تميز في الأبحاث الدوائية والعلوم الطبية الحديثة.',
      students: '٨٠٠ طالب',
      icon: '💊'
    },
    { 
      name: 'كلية إدارة الأعمال', 
      desc: 'تخريج قادة أعمال قادرين على المنافسة في السوق العالمي.',
      students: '٩٠٠ طالب',
      icon: '📊'
    },
    { 
      name: 'كلية التصميم والفنون التطبيقية', 
      desc: 'دمج الفن بالتكنولوجيا لخلق حلول إبداعية مبتكرة.',
      students: '٤٠٠ طالب',
      icon: '🎨'
    },
    { 
      name: 'كلية الهندسة الكهربائية', 
      desc: 'تخصصات دقيقة في الطاقة المتجددة وأنظمة الطاقة الذكية.',
      students: '٦٠٠ طالب',
      icon: '⚡'
    },
  ];

  const features = [
    { 
      title: 'تعليم رقمي متطور', 
      desc: 'منصة إلكترونية متكاملة لإدارة المقررات والتفاعل الأكاديمي.', 
      icon: <Globe size={32} /> 
    },
    { 
      title: 'تميز أكاديمي', 
      desc: 'أعضاء هيئة تدريس من نخبة الأساتذة والباحثين العالميين.', 
      icon: <Trophy size={32} /> 
    },
    { 
      title: 'ربط بسوق العمل', 
      desc: 'شراكات استراتيجية مع كبرى الشركات التكنولوجية والصناعية.', 
      icon: <Briefcase size={32} /> 
    },
    { 
      title: 'بحث علمي', 
      desc: 'مراكز بحثية متخصصة ومختبرات مجهزة بأحدث التقنيات العالمية.', 
      icon: <Microscope size={32} /> 
    },
  ];

  return (
    <div className="min-h-screen bg-white font-arabic selection:bg-brand-green/30 selection:text-brand-navy overflow-x-hidden" dir="rtl">
      
      {/* 1. Navbar */}
      <nav 
        className={`fixed top-0 w-full z-[100] transition-all duration-500 ${
          isScrolled 
            ? 'bg-white/95 backdrop-blur-md py-3 shadow-soft border-b border-brand-border' 
            : 'bg-transparent py-6'
        }`}
      >
        <div className="container mx-auto px-6 flex items-center justify-between">
          {/* Logo (Right in RTL) */}
          <Link to="/" className="relative z-10">
            <ImageWithFallback 
              src={isScrolled ? LOGO : LOGO_WHITE} 
              alt="University Logo" 
              className="h-10 md:h-12 w-auto object-contain transition-all duration-500" 
            />
          </Link>

          {/* Desktop Nav Links (Left in RTL) */}
          <div className="hidden lg:flex items-center gap-10">
            <ul className="flex items-center gap-8">
              {navLinks.map((link) => (
                <li key={link.name}>
                  <a 
                    href={link.href} 
                    className={`text-sm font-bold tracking-tight transition-colors hover:text-brand-green ${
                      isScrolled ? 'text-brand-navy' : 'text-white'
                    }`}
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
            <Link 
              to="/login" 
              className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-300 transform hover:scale-105 hover:shadow-lg ${
                isScrolled 
                  ? 'bg-brand-navy text-white hover:bg-brand-navy-600' 
                  : 'bg-white text-brand-navy hover:bg-brand-primary-50'
              }`}
            >
              تسجيل الدخول
            </Link>
          </div>

          {/* Mobile Hamburger */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`lg:hidden p-2 rounded-xl transition-colors ${
              isScrolled ? 'text-brand-navy hover:bg-brand-primary-50' : 'text-white hover:bg-white/10'
            }`}
          >
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        <div 
          className={`fixed inset-0 bg-brand-navy transition-all duration-500 lg:hidden ${
            isMobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
          }`}
        >
          <div className="flex flex-col items-center justify-center h-full space-y-8 p-6 text-center">
            {navLinks.map((link) => (
              <a 
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-2xl font-black text-white hover:text-brand-green transition-colors"
              >
                {link.name}
              </a>
            ))}
            <Link 
              to="/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full max-w-xs py-4 rounded-2xl bg-brand-green text-brand-navy font-black text-lg shadow-xl"
            >
              تسجيل الدخول
            </Link>
          </div>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <ImageWithFallback 
            src={HERO_1} 
            alt="Campus" 
            className="w-full h-full object-cover scale-110 animate-slow-zoom" 
          />
          <div className="absolute inset-0 bg-brand-navy/60 backdrop-blur-[2px]" />
        </div>

        {/* Hero Content */}
        <div className="container mx-auto px-6 relative z-10 text-center space-y-8">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-brand-green/20 border border-brand-green/30 backdrop-blur-md animate-fade-in-up">
            <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-brand-green">
              منصة إدارة أكاديمية متكاملة
            </span>
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white leading-tight tracking-tightest drop-shadow-2xl animate-fade-in-up delay-100">
            جامعة ٦ أكتوبر <br />
            <span className="text-brand-green">التكنولوجية</span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-white/80 font-medium leading-relaxed animate-fade-in-up delay-200">
            نبني جيلاً من القادة والمبتكرين في قلب مصر التكنولوجية. تعليم أكاديمي يجمع بين المعرفة النظرية والخبرة العملية.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-4 animate-fade-in-up delay-300">
            <Link 
              to="/register" 
              className="group flex items-center gap-3 px-8 py-4 bg-brand-green hover:bg-brand-green-dark text-brand-navy font-black rounded-2xl shadow-xl shadow-brand-green/20 transition-all duration-300 transform hover:-translate-y-1"
            >
              <span>ابدأ التسجيل الآن</span>
              <ArrowLeft size={18} className="rtl:-scale-x-100 transition-transform group-hover:-translate-x-1" />
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
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 animate-bounce opacity-50">
          <ChevronDown className="text-white" size={32} />
        </div>

        {/* Stats Bar (Overlapping) */}
        <div className="absolute bottom-0 left-0 w-full translate-y-1/2 z-20">
          <div className="container mx-auto px-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
              {stats.map((stat, i) => (
                <div 
                  key={i} 
                  className="bg-white/95 backdrop-blur-md p-6 md:p-8 rounded-[2rem] shadow-2xl shadow-brand-navy/10 border border-brand-border flex flex-col items-center text-center group hover:-translate-y-2 transition-all duration-500 ring-1 ring-brand-navy/5"
                >
                  <div className="w-12 h-12 rounded-2xl bg-brand-primary-50 text-brand-green flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-brand-green group-hover:text-white transition-all duration-500 shadow-inner">
                    {stat.icon}
                  </div>
                  <h4 className="text-2xl md:text-3xl font-black text-brand-navy mb-1">{stat.value}</h4>
                  <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-brand-text-muted">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. About Section */}
      <section id="about" className="py-48 lg:py-64 bg-brand-bg-page relative overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Image (Left) */}
            <div className="relative group order-2 lg:order-1">
              <div className="absolute -inset-4 bg-brand-green/20 rounded-[3rem] blur-2xl group-hover:bg-brand-green/30 transition-all duration-500" />
              <div className="relative rounded-[2.5rem] overflow-hidden shadow-elevated aspect-[4/3]">
                <ImageWithFallback 
                  src={AERIAL} 
                  alt="University Campus" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                />
              </div>
              <div className="absolute -bottom-8 -right-8 w-48 h-48 bg-brand-navy rounded-3xl p-6 hidden md:flex flex-col justify-center items-center text-center shadow-2xl">
                <p className="text-brand-green font-black text-4xl mb-1">١٠+</p>
                <p className="text-white/80 text-[10px] font-black uppercase tracking-widest">سنوات من التميز</p>
              </div>
            </div>

            {/* Text (Right) */}
            <div className="space-y-8 order-1 lg:order-2">
              <div className="space-y-4">
                <span className="text-xs font-black uppercase tracking-widest text-brand-green">عن جامعتنا</span>
                <h2 className="text-4xl md:text-5xl font-black text-brand-navy leading-tight">
                  ريادة تكنولوجية <br />
                  <span className="text-brand-green">لمستقبل أفضل</span>
                </h2>
                <p className="text-brand-text-secondary text-lg leading-relaxed font-medium">
                  تعد جامعة ٦ أكتوبر التكنولوجية صرحاً أكاديمياً رائداً يسعى لتقديم تعليم تكنولوجي متميز يواكب المعايير العالمية، من خلال برامج دراسية مبتكرة وبيئة تعليمية محفزة للإبداع والبحث العلمي.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {['معتمدة دولياً', 'بحث علمي متقدم', 'شراكات عالمية'].map((pill) => (
                  <span key={pill} className="px-5 py-2 rounded-xl bg-white border border-brand-border text-brand-navy text-xs font-black shadow-soft hover:shadow-md hover:border-brand-green transition-all duration-300">
                    {pill}
                  </span>
                ))}
              </div>

              <div className="pt-4">
                <Link 
                  to="/about" 
                  className="inline-flex items-center gap-3 text-brand-navy font-black text-sm group"
                >
                  <span className="border-b-2 border-brand-green pb-1">اعرف المزيد عن الجامعة</span>
                  <ArrowLeft size={16} className="rtl:-scale-x-100 transition-transform group-hover:-translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Colleges Grid */}
      <section id="colleges" className="py-24 bg-white">
        <div className="container mx-auto px-6 text-center space-y-16">
          <div className="max-w-3xl mx-auto space-y-4">
            <span className="text-xs font-black uppercase tracking-widest text-brand-green">كلياتنا الأكاديمية</span>
            <h2 className="text-4xl md:text-5xl font-black text-brand-navy tracking-tight">برامج دراسية متكاملة</h2>
            <p className="text-brand-text-muted font-medium text-lg">نقدم مجموعة متنوعة من التخصصات التي تلبي احتياجات سوق العمل المحلي والدولي.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {colleges.map((college, i) => (
              <div 
                key={i} 
                className="group relative bg-white p-10 rounded-[2.5rem] border border-brand-border shadow-soft transition-all duration-500 hover:border-brand-green hover:shadow-2xl hover:shadow-brand-navy/5 text-right flex flex-col"
              >
                <div className="text-5xl mb-6 transform transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">{college.icon}</div>
                <h3 className="text-xl font-black text-brand-navy mb-4 group-hover:text-brand-green transition-colors">{college.name}</h3>
                <p className="text-brand-text-secondary text-sm leading-relaxed mb-6 font-medium">{college.desc}</p>
                <div className="mt-auto pt-6 border-t border-brand-border flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted">{college.students}</span>
                  <div className="w-10 h-10 rounded-xl bg-brand-primary-50 text-brand-green flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-x-4 group-hover:translate-x-0">
                    <ArrowLeft size={18} className="rtl:-scale-x-100" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Why Choose Us Section */}
      <section className="py-24 md:py-32 bg-brand-navy relative overflow-hidden">
        {/* Abstract shapes */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-green/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-primary-500/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-12">
              <div className="space-y-4">
                <span className="text-xs font-black uppercase tracking-widest text-brand-green">لماذا تختارنا؟</span>
                <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">التميز هو معيارنا <br />الوحيد في التعليم</h2>
              </div>

              <div className="grid sm:grid-cols-2 gap-8">
                {features.map((feature, i) => (
                  <div key={i} className="space-y-4 group">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 text-brand-green flex items-center justify-center group-hover:bg-brand-green group-hover:text-brand-navy transition-all duration-500">
                      {feature.icon}
                    </div>
                    <h4 className="text-lg font-black text-white">{feature.title}</h4>
                    <p className="text-white/60 text-sm leading-relaxed font-medium">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 bg-brand-green/20 rounded-[3rem] blur-2xl" />
              <div className="relative rounded-[3rem] overflow-hidden shadow-2xl aspect-square border-8 border-white/5">
                <ImageWithFallback 
                  src={HERO_2} 
                  alt="Student Success" 
                  className="w-full h-full object-cover" 
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Campus Gallery */}
      <section className="py-24 bg-brand-bg-page">
        <div className="container mx-auto px-6 space-y-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4 text-right">
              <span className="text-xs font-black uppercase tracking-widest text-brand-green">معرض الصور</span>
              <h2 className="text-4xl md:text-5xl font-black text-brand-navy tracking-tight">استكشف حرمنا الجامعي</h2>
            </div>
            <button className="px-8 py-3 rounded-2xl border border-brand-border text-brand-navy font-black text-sm hover:bg-white hover:border-brand-green transition-all duration-300">
              مشاهدة المعرض الكامل
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-2 md:row-span-2 group overflow-hidden rounded-[2.5rem] shadow-elevated">
              <ImageWithFallback 
                src={BUILDING} 
                alt="Main Building" 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 cursor-pointer" 
              />
            </div>
            <div className="group overflow-hidden rounded-[2rem] shadow-elevated h-64">
              <ImageWithFallback 
                src={ENTRANCE} 
                alt="Entrance" 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 cursor-pointer" 
              />
            </div>
            <div className="group overflow-hidden rounded-[2rem] shadow-elevated h-64">
              <ImageWithFallback 
                src={PORTRAIT_1} 
                alt="Students" 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 cursor-pointer" 
              />
            </div>
            <div className="md:col-span-2 group overflow-hidden rounded-[2rem] shadow-elevated h-80">
              <ImageWithFallback 
                src={WIDE} 
                alt="Wide View" 
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
              <h2 className="text-4xl md:text-6xl font-black text-brand-navy tracking-tight">جاهز لبدء رحلتك الأكاديمية؟</h2>
              <p className="max-w-2xl mx-auto text-lg md:text-xl text-brand-navy/70 font-bold leading-relaxed">
                سجّل الآن وانضم لآلاف الطلاب في منصتنا الرقمية المتقدمة واستفد من أحدث التقنيات التعليمية.
              </p>
              <div className="pt-6">
                <Link 
                  to="/login" 
                  className="inline-flex items-center gap-4 px-10 py-5 bg-brand-navy text-white font-black rounded-2xl shadow-2xl hover:bg-brand-navy-600 transition-all duration-300 transform hover:-translate-y-1"
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
      <footer className="bg-brand-navy pt-24 pb-12 text-white">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 pb-20 border-b border-white/10">
            {/* Brand Col */}
            <div className="space-y-8">
              <ImageWithFallback src={LOGO_WHITE} alt="University Logo" className="h-14 w-auto object-contain" />
              <p className="text-white/60 text-sm leading-relaxed font-medium">
                صرح تعليمي تكنولوجي رائد يسعى للتميز والابتكار في إعداد أجيال قادرة على قيادة المستقبل الرقمي في مصر.
              </p>
              <div className="flex items-center gap-4">
                <a href="#" aria-label="Facebook" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-brand-green hover:text-brand-navy hover:border-brand-green transition-all duration-300 text-sm font-bold">f</a>
                <a href="#" aria-label="Twitter" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-brand-green hover:text-brand-navy hover:border-brand-green transition-all duration-300 text-sm font-bold">𝕏</a>
                <a href="#" aria-label="Instagram" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-brand-green hover:text-brand-navy hover:border-brand-green transition-all duration-300 text-sm font-bold">ig</a>
                <a href="#" aria-label="LinkedIn" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-brand-green hover:text-brand-navy hover:border-brand-green transition-all duration-300 text-sm font-bold">in</a>
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-8">
              <h4 className="text-lg font-black tracking-tight">روابط سريعة</h4>
              <ul className="space-y-4">
                {navLinks.map((link) => (
                  <li key={link.name}>
                    <a href={link.href} className="text-white/60 hover:text-brand-green text-sm font-bold transition-colors">{link.name}</a>
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
                    <a href="#" className="text-white/60 hover:text-brand-green text-sm font-bold transition-colors">{college.name}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div className="space-y-8 text-right">
              <h4 className="text-lg font-black tracking-tight">تواصل معنا</h4>
              <div className="space-y-6">
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-widest text-brand-green">الموقع</p>
                  <p className="text-white/60 text-sm font-bold">مدينة ٦ أكتوبر، الجيزة، مصر</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-widest text-brand-green">البريد الإلكتروني</p>
                  <p className="text-white/60 text-sm font-bold">info@university.edu.eg</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-widest text-brand-green">الهاتف</p>
                  <p className="text-white/60 text-sm font-bold" dir="ltr">+20 123 456 7890</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-12 flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-white/40 text-xs font-black tracking-widest uppercase">
              جميع الحقوق محفوظة © {new Date().getFullYear()} جامعة ٦ أكتوبر التكنولوجية
            </p>
            <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-widest text-white/40">
              <a href="#" className="hover:text-brand-green transition-colors">سياسة الخصوصية</a>
              <a href="#" className="hover:text-brand-green transition-colors">شروط الاستخدام</a>
              <span className="text-white/20">v1.0.0</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Global CSS for animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slow-zoom {
          from { transform: scale(1); }
          to { transform: scale(1.1); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
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
      `}} />

    </div>
  );
};

export default LandingPage;
