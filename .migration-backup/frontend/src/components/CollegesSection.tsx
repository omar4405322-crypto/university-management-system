import React from 'react';
import { Monitor, Cog, Pill, BarChart2, PenTool, Zap, ArrowLeft } from 'lucide-react';

export const colleges = [
  {
    name: 'كلية الحاسبات والمعلومات',
    desc: 'إعداد كوادر تقنية متخصصة في هندسة البرمجيات والذكاء الاصطناعي.',
    students: '١٢٠٠ طالب',
    icon: <Monitor size={24} strokeWidth={2} />,
  },
  {
    name: 'كلية الهندسة والتكنولوجيا',
    desc: 'دراسات هندسية متطورة تلبي احتياجات الثورة الصناعية الرابعة.',
    students: '١٥٠٠ طالب',
    icon: <Cog size={24} strokeWidth={2} />,
  },
  {
    name: 'كلية الصيدلة والعلوم الطبية',
    desc: 'تميز في الأبحاث الدوائية والعلوم الطبية الحديثة.',
    students: '٨٠٠ طالب',
    icon: <Pill size={24} strokeWidth={2} />,
  },
  {
    name: 'كلية إدارة الأعمال',
    desc: 'تخريج قادة أعمال قادرين على المنافسة في السوق العالمي.',
    students: '٩٠٠ طالب',
    icon: <BarChart2 size={24} strokeWidth={2} />,
  },
  {
    name: 'كلية التصميم والفنون التطبيقية',
    desc: 'دمج الفن بالتكنولوجيا لخلق حلول إبداعية مبتكرة.',
    students: '٤٠٠ طالب',
    icon: <PenTool size={24} strokeWidth={2} />,
  },
  {
    name: 'كلية الهندسة الكهربائية',
    desc: 'تخصصات دقيقة في الطاقة المتجددة وأنظمة الطاقة الذكية.',
    students: '٦٠٠ طالب',
    icon: <Zap size={24} strokeWidth={2} />,
  },
];

interface CollegesSectionProps {
  isLoading?: boolean;
}

export const CollegesSection: React.FC<CollegesSectionProps> = ({ isLoading = false }) => {
  return (
    <section id="colleges" className="py-24 bg-white">
      <div className="container mx-auto px-6 text-center space-y-16">
        <div className="max-w-3xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <span className="text-xs font-black uppercase tracking-widest text-brand-navy-500">
            كلياتنا الأكاديمية
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-brand-navy-500 tracking-tight">
            برامج دراسية متكاملة
          </h2>
          <p className="text-brand-text-muted font-medium text-lg">
            نقدم مجموعة متنوعة من التخصصات التي تلبي احتياجات سوق العمل المحلي والدولي.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="skeleton h-64 rounded-[2.5rem]" />
            ))
          ) : (
            colleges.map((college, i) => (
              <a
                href="#colleges"
                key={i}
                className="group relative bg-white p-10 rounded-[2.5rem] border border-brand-border shadow-soft transition-all duration-500 hover:border-brand-green hover:-translate-y-2 hover:shadow-2xl hover:shadow-brand-navy-500/10 text-right flex flex-col focus:outline-none focus:ring-4 focus:ring-brand-green/30 cursor-pointer block"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="text-5xl mb-6 transform transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6 text-brand-navy-500">
                  {college.icon}
                </div>
                <h3 className="text-xl font-black text-brand-navy-500 mb-4 group-hover:text-brand-green transition-colors">
                  {college.name}
                </h3>
                <p className="text-brand-text-secondary text-sm leading-relaxed mb-6 font-medium">
                  {college.desc}
                </p>
                <div className="mt-auto pt-6 border-t border-brand-border flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted">
                    {college.students}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-brand-green opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                      اعرف المزيد
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-brand-primary-50 text-brand-green flex items-center justify-center group-hover:bg-brand-green group-hover:text-white transition-all duration-500 transform translate-x-4 group-hover:translate-x-0">
                      <ArrowLeft size={18} className="rtl:-scale-x-100" />
                    </div>
                  </div>
                </div>
              </a>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
