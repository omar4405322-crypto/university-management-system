// FIXED: Masked email with click-to-reveal for admin viewers - Phase 3
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { maskEmail } from '../utils/maskEmail';
import ConfirmDeleteModal from './ui/ConfirmDeleteModal';

const MaskedEmail = ({ email, className = '' }: { email: string; className?: string }) => {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!email) {
    return <span className={className}>-</span>;
  }

  const handleReveal = () => {
    if (revealed) return;
    setShowConfirm(true);
  };

  const confirmReveal = () => {
    setRevealed(true);
    setShowConfirm(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleReveal}
        title={revealed ? email : t('admins.clickToReveal', 'Click to view full email')}
        className={`text-left font-bold text-xs transition-colors ${
          revealed
            ? 'text-brand-text-secondary cursor-default'
            : 'text-brand-text-secondary hover:text-brand-green cursor-pointer'
        } ${className}`}
      >
        <span className="inline-flex items-center gap-1.5">
          {revealed ? email : maskEmail(email)}
          {!revealed && <Eye size={12} className="opacity-60" />}
        </span>
      </button>

      <ConfirmDeleteModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmReveal}
        title={t('admins.revealEmailTitle', 'Confirm Reveal Email')}
        message={t(
          'admins.revealEmailConfirm',
          'Reveal full email address? This action is logged for administrators only.'
        )}
        confirmLabel={t('common.confirm', 'Reveal')}
        cancelLabel={t('common.cancel', 'Cancel')}
        variant="warning"
      />
    </>
  );
};

export default MaskedEmail;
