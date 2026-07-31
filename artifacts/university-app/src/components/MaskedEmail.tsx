// FIXED: Masked email with click-to-reveal for admin viewers - Phase 3
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { maskEmail } from '../utils/maskEmail';

const MaskedEmail = ({ email, className = '' }: { email: string, className?: string }) => {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);

  if (!email) {
    return <span className={className}>—</span>;
  }

  const handleReveal = () => {
    if (revealed) return;
    const ok = window.confirm(
      t(
        'admins.revealEmailConfirm',
        'Reveal full email address? This action is logged for administrators only.'
      )
    );
    if (ok) setRevealed(true);
  };

  return (
    <button
      type="button"
      onClick={handleReveal}
      title={revealed ? email : t('admins.clickToReveal', 'Click to view full email')}
      className={`text-left font-bold text-xs transition-colors ${revealed ? 'text-brand-text-secondary cursor-default' : 'text-brand-text-secondary hover:text-brand-green cursor-pointer'} ${className}`}
    >
      <span className="inline-flex items-center gap-1.5">
        {revealed ? email : maskEmail(email)}
        {!revealed && <Eye size={12} className="opacity-60" />}
      </span>
    </button>
  );
};

export default MaskedEmail;
