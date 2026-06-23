// FIXED: Mask admin emails in list views - Phase 3
export const maskEmail = (email: string) => {
  if (!email || !email.includes('@')) return '—';
  const [local, domain] = email.split('@');
  if (!local?.length) return `***@${domain}`;
  return `${local[0]}***@${domain}`;
};

export default maskEmail;
