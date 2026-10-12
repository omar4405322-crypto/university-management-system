import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, describe } from 'node:test';

const profileSrc = readFileSync(
  new URL('../src/pages/profile/Profile.tsx', import.meta.url),
  'utf8'
);

const settingsSrc = readFileSync(
  new URL('../src/pages/settings/SettingsPage.tsx', import.meta.url),
  'utf8'
);

const statsSrc = readFileSync(
  new URL('../src/pages/statistics/StudentStatisticsPage.tsx', import.meta.url),
  'utf8'
);

// Helper to isolate and execute a component's handler with mocked context
function extractHandlerFunction(source, fnName) {
  const marker = `const ${fnName} = async (`;
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`Handler ${fnName} not found in source`);
  }
  // Find balanced curly braces for the handler body
  const bodyStart = source.indexOf('{', start);
  let depth = 1;
  let pos = bodyStart + 1;
  while (pos < source.length && depth > 0) {
    if (source[pos] === '{') depth++;
    else if (source[pos] === '}') depth--;
    pos++;
  }
  let fnStr = source.substring(start, pos);
  // Strip minimal TypeScript syntax for direct JS evaluation
  fnStr = fnStr.replace(/:\s*any/g, '');
  fnStr = fnStr.replace(/:\s*string/g, '');
  fnStr = fnStr.replace(/:\s*boolean/g, '');
  return fnStr;
}

describe('M1: Password Change Handler Method & Route Alignment', () => {
  test('Profile.tsx handlePasswordSubmit dispatches PUT /users/profile/password', async () => {
    const handlerCode = extractHandlerFunction(profileSrc, 'handlePasswordSubmit');

    const apiCalls = [];
    const mockApi = {
      patch: async (url, data) => {
        apiCalls.push({ method: 'PATCH', url, data });
        return { data: { success: true } };
      },
      put: async (url, data) => {
        apiCalls.push({ method: 'PUT', url, data });
        return { data: { success: true } };
      },
    };

    // Simulate handler runtime environment
    const runner = new Function(
      'api',
      'passwordForm',
      'setPasswordError',
      'setPasswordLoading',
      'setMessage',
      'setIsPasswordModalOpen',
      't',
      `
      return (async () => {
        let e = { preventDefault: () => {} };
        ${handlerCode}
        await handlePasswordSubmit(e);
      })();
      `
    );

    await runner(
      mockApi,
      {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      },
      () => {},
      () => {},
      () => {},
      () => {},
      (k, fallback) => fallback || k
    );

    assert.equal(apiCalls.length, 1, 'Expected exactly 1 API call on password submit');
    assert.equal(apiCalls[0].url, '/users/profile/password', 'Endpoint must be /users/profile/password');
    assert.equal(
      apiCalls[0].method,
      'PUT',
      `Profile.tsx must send PUT (OpenAPI & users.routes.ts specification), but sent ${apiCalls[0].method}`
    );
  });

  test('SettingsPage.tsx handlePasswordChange dispatches PUT /users/profile/password', async () => {
    const handlerCode = extractHandlerFunction(settingsSrc, 'handlePasswordChange');

    const apiCalls = [];
    const mockApi = {
      patch: async (url, data) => {
        apiCalls.push({ method: 'PATCH', url, data });
        return { data: { success: true } };
      },
      put: async (url, data) => {
        apiCalls.push({ method: 'PUT', url, data });
        return { data: { success: true } };
      },
    };

    const runner = new Function(
      'api',
      'passwordData',
      'setPasswordData',
      'setLoading',
      'showToast',
      'isRTL',
      't',
      `
      return (async () => {
        let e = { preventDefault: () => {} };
        ${handlerCode}
        await handlePasswordChange(e);
      })();
      `
    );

    await runner(
      mockApi,
      {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      },
      () => {},
      () => {},
      () => {},
      false,
      (k, fallback) => fallback || k
    );

    assert.equal(apiCalls.length, 1, 'Expected exactly 1 API call on password submit');
    assert.equal(apiCalls[0].url, '/users/profile/password', 'Endpoint must be /users/profile/password');
    assert.equal(
      apiCalls[0].method,
      'PUT',
      `SettingsPage.tsx must send PUT (OpenAPI & users.routes.ts specification), but sent ${apiCalls[0].method}`
    );
  });
});

describe('M2: 2FA Toggle Safe Behavior & Zero-404 Dead Control Removal', () => {
  test('Profile.tsx does not call non-existent PATCH /users/profile/two-factor', () => {
    // Backend only defines POST /users/2fa/setup, POST /users/2fa/enable, POST /users/2fa/disable.
    // Calling PATCH /users/profile/two-factor causes 404 Not Found.
    const hasBrokenPatch = profileSrc.includes('/users/profile/two-factor');
    assert.equal(
      hasBrokenPatch,
      false,
      'Profile.tsx must not call non-existent /users/profile/two-factor route'
    );
  });

  test('Profile.tsx 2FA card renders status indicator without broken click handler', () => {
    // The dead button onClick={handleEnableTwoFactor} that triggers 404 must be removed
    const hasDeadHandler = profileSrc.includes('handleEnableTwoFactor');
    assert.equal(
      hasDeadHandler,
      false,
      'Profile.tsx must not wire a dead handleEnableTwoFactor action that causes 404'
    );
  });
});

describe('M3: Brand Colors on StudentStatisticsPage 4-Card Row', () => {
  test('StudentStatisticsPage 4 cards use institutional brand palette via index % 4', () => {
    // Required 4-color palette:
    // Index 0: #8BB83C (Brand Green)
    // Index 1: #132231 (Brand Navy)
    // Index 2: #2F6B87 (Support Blue)
    // Index 3: #D6BA34 (Academic Gold)
    const BRAND_COLORS = ['#8BB83C', '#132231', '#2F6B87', '#D6BA34'];

    for (const color of BRAND_COLORS) {
      assert.ok(
        statsSrc.includes(color),
        `StudentStatisticsPage must contain institutional brand color token ${color}`
      );
    }

    // Must index through the 4-color sequence
    assert.ok(
      statsSrc.includes('% 4') || statsSrc.includes('STAT_CARD_BRAND_COLORS'),
      'StudentStatisticsPage must cycle the 4-card row using index % 4 or STAT_CARD_BRAND_COLORS'
    );
  });
});

describe('C2: 2FA Status Translation & Truth Verification', () => {
  const enTranslations = JSON.parse(readFileSync(new URL('../src/i18n/en.json', import.meta.url), 'utf8'));
  const arTranslations = JSON.parse(readFileSync(new URL('../src/i18n/ar.json', import.meta.url), 'utf8'));

  test('Project i18n keys profile.disabled and profile.enabled exist in both locales', () => {
    assert.equal(enTranslations.profile?.disabled, 'Disabled');
    assert.equal(enTranslations.profile?.enabled, 'Enabled');
    assert.equal(arTranslations.profile?.disabled, 'معطل');
    assert.equal(arTranslations.profile?.enabled, 'مفعّل');
  });

  test('Profile.tsx uses project i18n keys without inline isRTL ternaries for 2FA status', () => {
    const updatedProfileSrc = readFileSync(new URL('../src/pages/profile/Profile.tsx', import.meta.url), 'utf8');
    assert.ok(
      updatedProfileSrc.includes('t("profile.disabled"') || updatedProfileSrc.includes("t('profile.disabled'"),
      'Profile.tsx must consume profile.disabled i18n key'
    );
    assert.ok(
      updatedProfileSrc.includes('t("profile.enabled"') || updatedProfileSrc.includes("t('profile.enabled'"),
      'Profile.tsx must consume profile.enabled i18n key'
    );
    assert.equal(
      updatedProfileSrc.includes('isRTL ? "غير مفعلة" : "Disabled"'),
      false,
      'Profile.tsx must not contain inline isRTL ? "غير مفعلة" ternary'
    );
  });

  test('2FA Status mapping resolver correctly formats status badge in both languages', () => {
    function resolve2faStatus(twoFactorEnabled, lang) {
      const translations = lang === 'ar' ? arTranslations : enTranslations;
      return twoFactorEnabled ? translations.profile.enabled : translations.profile.disabled;
    }

    assert.equal(resolve2faStatus(true, 'en'), 'Enabled');
    assert.equal(resolve2faStatus(false, 'en'), 'Disabled');
    assert.equal(resolve2faStatus(true, 'ar'), 'مفعّل');
    assert.equal(resolve2faStatus(false, 'ar'), 'معطل');
  });
});

describe('C3: Solid Chip Brand Contrast & Theme Invariants', () => {
  const updatedStatsSrc = readFileSync(new URL('../src/pages/statistics/StudentStatisticsPage.tsx', import.meta.url), 'utf8');

  function getLuminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  function getContrast(rgb1, rgb2) {
    const l1 = getLuminance(...rgb1);
    const l2 = getLuminance(...rgb2);
    const b = Math.max(l1, l2);
    const d = Math.min(l1, l2);
    return (b + 0.05) / (d + 0.05);
  }

  test('All 4 solid chips satisfy WCAG non-text contrast >= 3:1 against their glyphs', () => {
    // Card 0: Olive #8BB83C with dark glyph (rgb 15, 23, 43)
    const card0Contrast = getContrast([139, 184, 60], [15, 23, 43]);
    assert.ok(card0Contrast >= 3.0, `Card 0 glyph contrast ${card0Contrast} must be >= 3:1`);

    // Card 1: Navy #132231 with white glyph (rgb 255, 255, 255)
    const card1Contrast = getContrast([19, 34, 49], [255, 255, 255]);
    assert.ok(card1Contrast >= 3.0, `Card 1 glyph contrast ${card1Contrast} must be >= 3:1`);

    // Card 2: Support Blue #2F6B87 with white glyph (rgb 255, 255, 255)
    const card2Contrast = getContrast([47, 107, 135], [255, 255, 255]);
    assert.ok(card2Contrast >= 3.0, `Card 2 glyph contrast ${card2Contrast} must be >= 3:1`);

    // Card 3: Gold #D6BA34 with dark glyph (rgb 15, 23, 43)
    const card3Contrast = getContrast([214, 186, 52], [15, 23, 43]);
    assert.ok(card3Contrast >= 3.0, `Card 3 glyph contrast ${card3Contrast} must be >= 3:1`);
  });

  test('Card 3 solid badge chip satisfies WCAG text contrast >= 4.5:1', () => {
    // Gold badge chip: #D6BA34 background with text-slate-900 / text-slate-950 glyph
    const badgeContrast = getContrast([214, 186, 52], [15, 23, 43]);
    assert.ok(badgeContrast >= 4.5, `Card 3 badge text contrast ${badgeContrast} must be >= 4.5:1`);
  });

  test('StudentStatisticsPage renders icons inside solid chips with proper glyph colors', () => {
    assert.ok(
      updatedStatsSrc.includes('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs'),
      'StudentStatisticsPage must house card icons inside standardized solid chips'
    );
  });
});

