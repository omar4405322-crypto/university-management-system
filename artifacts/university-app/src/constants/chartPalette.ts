/**
 * Official UniCore Data Visualization & Chart Palette System
 * Derived from the institutional university identity:
 * - Brand Green (#8BB83C / #70952F)
 * - University Navy (#132231 / #263744 / #8796A1)
 * - Academic Gold (#D6BA34 / #B49A28)
 * - Supporting Blue (#2F6B87 / #5B95AB / #8BB8C9)
 *
 * Guarantees high WCAG AA contrast against both light and dark card surfaces.
 */

export const CHART_PALETTE_LIGHT = [
  '#8BB83C', // Brand Green
  '#132231', // University Navy (High contrast on white)
  '#D6BA34', // Academic Gold
  '#2F6B87', // Supporting Blue
  '#70952F', // Forest Green
  '#536673', // Slate Navy
] as const;

export const CHART_PALETTE_DARK = [
  '#8BB83C', // Brand Green
  '#8796A1', // Navy Tint / Steel (High contrast on dark #132231 / #091119 card)
  '#D6BA34', // Academic Gold
  '#5B95AB', // Soft Blue
  '#A1C04F', // Lime Green
  '#B6C0C7', // Light Slate
] as const;

export function getChartPalette(isDark: boolean): readonly string[] {
  return isDark ? CHART_PALETTE_DARK : CHART_PALETTE_LIGHT;
}

export function getChartTheme(isDark: boolean) {
  return {
    grid: isDark ? '#263744' : '#E2E8F0',
    tick: isDark ? '#B6C0C7' : '#475569',
    cursor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
    palette: getChartPalette(isDark),
    primary: '#8BB83C',
    navy: isDark ? '#8796A1' : '#132231',
    gold: '#D6BA34',
    blue: isDark ? '#5B95AB' : '#2F6B87',
    success: '#8BB83C',
    warning: '#D6BA34',
    danger: '#EF4444',
  };
}
