/**
 * slotType.ts
 *
 * Frontend helper for mapping slotType values to the unified translation keys ('schedule.lecture' | 'schedule.lab').
 */

export type SlotTypeTranslationKey = 'schedule.lecture' | 'schedule.lab';

export function getSlotTypeTranslationKey(slotType?: string | null): SlotTypeTranslationKey {
  const norm = String(slotType || '').trim().toUpperCase();
  return norm === 'LECTURE' ? 'schedule.lecture' : 'schedule.lab';
}

export function formatSlotType(
  slotType: string | null | undefined,
  t: (key: any, ...args: any[]) => any
): string {
  const key = getSlotTypeTranslationKey(slotType);
  return String(t(key));
}
