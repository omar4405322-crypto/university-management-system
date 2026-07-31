import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Users } from 'lucide-react';
import ImageWithFallback from './ui/ImageWithFallback';

export interface CollegeKeyItem {
  id: number;
  nameKey: string;
  descKey: string;
  studentsKey: string;
  image: string;
}

export const collegesKeys: CollegeKeyItem[] = [
  {
    id: 1,
    nameKey: 'landing.colleges.industry.name',
    descKey: 'landing.colleges.industry.desc',
    studentsKey: 'landing.colleges.industry.students',
    image: '/assets/university/ne/campus-building.png',
  },
  {
    id: 2,
    nameKey: 'landing.colleges.health.name',
    descKey: 'landing.colleges.health.desc',
    studentsKey: 'landing.colleges.health.students',
    image: '/assets/university/ne/campus-entrance.png',
  },
];

import { PublicCollegeItem } from '../hooks/useUniversityStats';

interface CollegesSectionProps {
  colleges?: PublicCollegeItem[];
  isLoading?: boolean;
}

export const CollegesSection: React.FC<CollegesSectionProps> = ({ colleges, isLoading = false }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');

  const defaultImages = [
    '/assets/university/ne/campus-building.png',
    '/assets/university/ne/campus-entrance.png',
  ];

  const hasDbColleges = colleges && colleges.length > 0;

  return (
    <section id="colleges" className="py-20 md:py-28 bg-slate-50 dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-800/50">
      <div className="max-w-screen-xl mx-auto px-6">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-3">
            <span className="block text-xs font-black uppercase tracking-widest text-brand-green">
              {t('landing.colleges.eyebrow')}
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-brand-navy dark:text-brand-text-main leading-tight tracking-tight m-0">
              {t('landing.colleges.title')}
            </h2>
            <p className="text-brand-text-secondary dark:text-brand-text-sub text-sm md:text-base font-medium leading-relaxed max-w-xl">
              {t('landing.colleges.desc')}
            </p>
          </div>

          <a
            href="#colleges"
            className="group inline-flex items-center gap-2 text-brand-navy dark:text-brand-text-main hover:text-brand-green dark:hover:text-brand-green font-bold text-sm transition-colors flex-shrink-0 pb-1 border-b border-brand-navy/10 hover:border-brand-green"
          >
            {t('landing.colleges.viewAll')}
            {isRTL ? (
              <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
            ) : (
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            )}
          </a>
        </div>

        {/* Colleges Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="skeleton rounded-2xl h-96 w-full" />
            <div className="skeleton rounded-2xl h-96 w-full" />
          </div>
        ) : hasDbColleges ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {colleges.map((college, i) => (
              <a
                key={college.id}
                href={`/colleges/${college.id}`}
                className="group flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-brand-green/30"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                {/* Image Container */}
                <div className="aspect-[16/10] overflow-hidden bg-slate-100 dark:bg-slate-700 relative">
                  <ImageWithFallback
                    src={defaultImages[i % defaultImages.length]}
                    alt={isRTL ? college.nameAr : college.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>

                {/* Content Container */}
                <div className="p-6 flex flex-col flex-grow justify-between">
                  <div className="space-y-2 mb-4">
                    <h3 className="text-lg md:text-xl font-extrabold text-brand-navy dark:text-brand-text-main group-hover:text-brand-green transition-colors m-0">
                      {isRTL ? college.nameAr : college.name}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed">
                      {college.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700/50">
                    <span className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-bold">
                      <Users size={14} className="text-slate-400" />
                      <span className="font-mono">{college.departmentsCount} {isRTL ? 'أقسام أكاديمية' : 'Departments'}</span>
                    </span>
                    <span className="text-brand-green group-hover:translate-x-0.5 transition-transform flex items-center gap-1 text-xs font-bold">
                      {isRTL ? (
                        <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
                      ) : (
                        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                      )}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {collegesKeys.map((college, i) => (
              <a
                key={college.id}
                href={`/colleges/${college.id}`}
                className="group flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-brand-green/30"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                {/* Image Container */}
                <div className="aspect-[16/10] overflow-hidden bg-slate-100 dark:bg-slate-700 relative">
                  <ImageWithFallback
                    src={college.image}
                    alt={t(college.nameKey)}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>

                {/* Content Container */}
                <div className="p-6 flex flex-col flex-grow justify-between">
                  <div className="space-y-2 mb-4">
                    <h3 className="text-lg md:text-xl font-extrabold text-brand-navy dark:text-brand-text-main group-hover:text-brand-green transition-colors m-0">
                      {t(college.nameKey)}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed">
                      {t(college.descKey)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700/50">
                    <span className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-bold">
                      <Users size={14} className="text-slate-400" />
                      <span className="font-mono">{t(college.studentsKey)}</span>
                    </span>
                    <span className="text-brand-green group-hover:translate-x-0.5 transition-transform flex items-center gap-1 text-xs font-bold">
                      {isRTL ? (
                        <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
                      ) : (
                        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                      )}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
