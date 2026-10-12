import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('StudentStatisticsPage: 4-card row strictly adheres to 4-color institutional brand palette via index % 4', () => {
  const fileContent = readFileSync(
    new URL('../src/pages/statistics/StudentStatisticsPage.tsx', import.meta.url),
    'utf8'
  );

  // Official brand colors:
  // Card 0: #8BB83C (Institutional Green)
  // Card 1: #132231 (University Navy)
  // Card 2: #2F6B87 (Deep Support Blue)
  // Card 3: #D6BA34 (Academic Gold)
  const EXPECTED_BRAND_COLORS = ['#8BB83C', '#132231', '#2F6B87', '#D6BA34'];

  for (const color of EXPECTED_BRAND_COLORS) {
    assert.ok(
      fileContent.includes(color),
      `StudentStatisticsPage must contain institutional brand color token ${color}`
    );
  }

  // Must declare STAT_CARD_BRAND_COLORS and cycle with index % 4
  assert.ok(
    fileContent.includes('STAT_CARD_BRAND_COLORS'),
    'StudentStatisticsPage must declare STAT_CARD_BRAND_COLORS palette'
  );
  assert.ok(
    fileContent.includes('STAT_CARD_BRAND_COLORS[0 % 4]'),
    'StudentStatisticsPage Card 0 must use STAT_CARD_BRAND_COLORS[0 % 4]'
  );
  assert.ok(
    fileContent.includes('STAT_CARD_BRAND_COLORS[1 % 4]'),
    'StudentStatisticsPage Card 1 must use STAT_CARD_BRAND_COLORS[1 % 4]'
  );
  assert.ok(
    fileContent.includes('STAT_CARD_BRAND_COLORS[2 % 4]'),
    'StudentStatisticsPage Card 2 must use STAT_CARD_BRAND_COLORS[2 % 4]'
  );
  assert.ok(
    fileContent.includes('STAT_CARD_BRAND_COLORS[3 % 4]'),
    'StudentStatisticsPage Card 3 must use STAT_CARD_BRAND_COLORS[3 % 4]'
  );
});
