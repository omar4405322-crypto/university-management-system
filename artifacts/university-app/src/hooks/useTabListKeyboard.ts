import React, { useCallback } from 'react';

interface UseTabListKeyboardOptions {
  isRTL?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

/**
 * Reusable hook providing WAI-ARIA compliant keyboard navigation for horizontal/vertical tablists.
 * Supports:
 * - ArrowRight / ArrowLeft (adapting directionality under RTL)
 * - Home (first enabled tab) / End (last enabled tab)
 * - Automatic activation pattern (focused tab is clicked/selected immediately)
 */
export function useTabListKeyboard(options: UseTabListKeyboardOptions = {}) {
  const { isRTL = false, orientation = 'horizontal' } = options;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const target = e.target as HTMLElement;
      if (!target || target.getAttribute('role') !== 'tab') return;

      const container = e.currentTarget;
      const tabs = Array.from(
        container.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled]):not([aria-disabled="true"])')
      );

      if (tabs.length <= 1) return;

      const currentIndex = tabs.indexOf(target);
      if (currentIndex === -1) return;

      let nextIndex = -1;

      if (orientation === 'horizontal') {
        const nextKey = isRTL ? 'ArrowLeft' : 'ArrowRight';
        const prevKey = isRTL ? 'ArrowRight' : 'ArrowLeft';

        if (e.key === nextKey) {
          nextIndex = (currentIndex + 1) % tabs.length;
        } else if (e.key === prevKey) {
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        }
      } else {
        if (e.key === 'ArrowDown') {
          nextIndex = (currentIndex + 1) % tabs.length;
        } else if (e.key === 'ArrowUp') {
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        }
      }

      if (e.key === 'Home') {
        nextIndex = 0;
      } else if (e.key === 'End') {
        nextIndex = tabs.length - 1;
      }

      if (nextIndex !== -1) {
        e.preventDefault();
        const nextTab = tabs[nextIndex];
        nextTab.focus();
        nextTab.click();
      }
    },
    [isRTL, orientation]
  );

  return { handleKeyDown };
}
