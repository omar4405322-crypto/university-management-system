import React from 'react';
import { AlignJustify, AlignLeft } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';

const DensityToggle = () => {
  const { isCompact, toggleDensity } = useTheme();
  const { t } = useTranslation();

  return (
    <button
      onClick={toggleDensity}
      className="rounded-xl p-2 text-brand-text-secondary dark:text-brand-text-main hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      aria-label={isCompact ? t('header.densityComfortable') : t('header.densityCompact')}
      title={isCompact ? t('header.densityComfortable') : t('header.densityCompact')}
    >
      {isCompact ? <AlignJustify size={20} /> : <AlignLeft size={20} />}
    </button>
  );
};

export default DensityToggle;
