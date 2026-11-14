import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

/*
Verified API routes & envelopes from artifacts/api-server/src:
- Mount: artifacts/api-server/src/app.ts:313 -> app.use('/api/submission-integrity', submissionIntegrityRoutes)
- GET /api/submission-integrity/policy (artifacts/api-server/src/routes/submissionIntegrity.routes.ts:7-12, SUPER_ADMIN only)
  - Default 200: { success: true, data: { exactDuplicateBlock: true, similarityThreshold: null, isDefault: true } }
  - Persisted 200: { success: true, data: { id: 1, exactDuplicateBlock, similarityThreshold, isDefault: false, updatedById, createdAt, updatedAt } }
- PUT /api/submission-integrity/policy (artifacts/api-server/src/routes/submissionIntegrity.routes.ts:14-19, SUPER_ADMIN only)
  - Body: { exactDuplicateBlock?: boolean, similarityThreshold?: number | null }
  - 200: { success: true, data: { id: 1, exactDuplicateBlock, similarityThreshold, isDefault: false, updatedById, createdAt, updatedAt } }
  - 422 / 403 / 401: { success: false, status: 'fail', message, errorId }
*/

const POLICY_PATH = '/api/submission-integrity/policy';

const DEFAULT_POLICY = {
  exactDuplicateBlock: true,
  similarityThreshold: null,
  isDefault: true,
};

function makePersistedPolicy(overrides = {}) {
  return {
    id: 1,
    exactDuplicateBlock: true,
    similarityThreshold: 0.75,
    isDefault: false,
    updatedById: 1,
    createdAt: '2026-11-14T10:00:00.000Z',
    updatedAt: '2026-11-14T10:00:00.000Z',
    ...overrides,
  };
}

describe('WP5-T6c-1 Browser Suite: Super Admin Submission Integrity Policy UI', () => {
  let appServer;
  let browser;

  before(async () => {
    appServer = await serveBuiltApp();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  });

  after(async () => {
    if (browser) await browser.close();
    if (appServer) await appServer.close();
  });

  async function openSettingsSession({
    role = 'SUPER_ADMIN',
    language = 'en',
    theme = 'light',
    viewport = { width: 1280, height: 800 },
  } = {}) {
    const { context, page } = await mockSessionPage(browser, { role, language });
    await page.setViewportSize(viewport);
    await page.addInitScript(
      ({ theme, language }) => {
        localStorage.setItem('theme', theme);
        localStorage.setItem('language', language);
      },
      { theme, language }
    );
    return { context, page };
  }

  async function openIntegrityTab(page) {
    const tab = page.locator('#settings-tab-integrity');
    await tab.waitFor({ state: 'visible', timeout: 8000 });
    await tab.click();
    const panel = page.locator('#settings-tab-panel-integrity');
    await panel.waitFor({ state: 'visible', timeout: 8000 });
    return { tab, panel };
  }

  it('P1: SUPER_ADMIN default load shows integrity tab, switch on, threshold empty, and defaults notice', async () => {
    const { context, page } = await openSettingsSession({ role: 'SUPER_ADMIN', language: 'en', theme: 'light' });
    try {
      let getCount = 0;
      await page.route((url) => url.pathname === POLICY_PATH, async (route) => {
        if (route.request().method() === 'GET') {
          getCount += 1;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: DEFAULT_POLICY }),
          });
          return;
        }
        await route.abort();
      });

      await page.goto(`${appServer.origin}/settings`, { waitUntil: 'networkidle' });
      const { tab, panel } = await openIntegrityTab(page);

      assert.equal(await tab.getAttribute('aria-selected'), 'true');
      assert.equal(await tab.getAttribute('aria-controls'), 'settings-tab-panel-integrity');

      const switchEl = panel.getByRole('switch');
      await switchEl.waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(await switchEl.getAttribute('aria-checked'), 'true');

      const inputEl = panel.locator('#submission-integrity-threshold-input');
      await inputEl.waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(await inputEl.inputValue(), '');
      assert.equal(await inputEl.getAttribute('inputmode'), 'decimal');
      assert.equal(await inputEl.getAttribute('dir'), 'ltr');
      assert.equal(await inputEl.getAttribute('placeholder'), null);

      const defaultNotice = panel.getByTestId('submission-integrity-default-notice');
      await defaultNotice.waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(getCount, 1);
    } finally {
      await context.close();
    }
  });

  it('P2: Save 0.75 sends exact PUT body, updates UI from response, clears dirty, and shows success toast', async () => {
    const { context, page } = await openSettingsSession({ role: 'SUPER_ADMIN', language: 'en', theme: 'light' });
    try {
      const putBodies = [];
      await page.route((url) => url.pathname === POLICY_PATH, async (route) => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: DEFAULT_POLICY }),
          });
          return;
        }
        if (method === 'PUT') {
          const body = JSON.parse(route.request().postData() || '{}');
          putBodies.push(body);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: makePersistedPolicy({ exactDuplicateBlock: true, similarityThreshold: 0.75 }),
            }),
          });
          return;
        }
        await route.abort();
      });

      await page.goto(`${appServer.origin}/settings`, { waitUntil: 'networkidle' });
      const { panel } = await openIntegrityTab(page);

      const inputEl = panel.locator('#submission-integrity-threshold-input');
      const saveBtn = panel.getByTestId('submission-integrity-save-button');
      await inputEl.waitFor({ state: 'visible', timeout: 5000 });
      await inputEl.fill('0.7500');
      assert.equal(await saveBtn.isDisabled(), false);

      await saveBtn.click();

      const toast = page.locator('[role="status"]').first();
      await toast.waitFor({ state: 'visible', timeout: 5000 });

      assert.equal(putBodies.length, 1);
      assert.deepEqual(Object.keys(putBodies[0]).sort(), ['exactDuplicateBlock', 'similarityThreshold']);
      assert.strictEqual(putBodies[0].exactDuplicateBlock, true);
      assert.strictEqual(putBodies[0].similarityThreshold, 0.75);
      assert.equal(typeof putBodies[0].similarityThreshold, 'number');

      // Hydrated from server response (0.75, not '0.7500') and defaults notice removed
      assert.equal(await inputEl.inputValue(), '0.75');
      assert.equal(await panel.getByTestId('submission-integrity-default-notice').count(), 0);
      assert.equal(await saveBtn.isDisabled(), true);
    } finally {
      await context.close();
    }
  });

  it('P3: Clearing threshold and toggling switch off sends similarityThreshold === null and exactDuplicateBlock === false', async () => {
    const { context, page } = await openSettingsSession({ role: 'SUPER_ADMIN', language: 'en', theme: 'light' });
    try {
      const putBodies = [];
      await page.route((url) => url.pathname === POLICY_PATH, async (route) => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: makePersistedPolicy({ exactDuplicateBlock: true, similarityThreshold: 0.75 }),
            }),
          });
          return;
        }
        if (method === 'PUT') {
          const body = JSON.parse(route.request().postData() || '{}');
          putBodies.push(body);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: makePersistedPolicy({ exactDuplicateBlock: false, similarityThreshold: null }),
            }),
          });
          return;
        }
        await route.abort();
      });

      await page.goto(`${appServer.origin}/settings`, { waitUntil: 'networkidle' });
      const { panel } = await openIntegrityTab(page);

      const switchEl = panel.getByRole('switch');
      const inputEl = panel.locator('#submission-integrity-threshold-input');
      const saveBtn = panel.getByTestId('submission-integrity-save-button');

      await inputEl.waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(await switchEl.getAttribute('aria-checked'), 'true');
      assert.equal(await inputEl.inputValue(), '0.75');

      await switchEl.click();
      assert.equal(await switchEl.getAttribute('aria-checked'), 'false');

      await inputEl.fill('');
      await saveBtn.click();

      const toast = page.locator('[role="status"]').first();
      await toast.waitFor({ state: 'visible', timeout: 5000 });

      assert.equal(putBodies.length, 1);
      assert.deepEqual(putBodies[0], {
        exactDuplicateBlock: false,
        similarityThreshold: null,
      });
      assert.strictEqual(putBodies[0].similarityThreshold, null);
      assert.equal(await switchEl.getAttribute('aria-checked'), 'false');
      assert.equal(await inputEl.inputValue(), '');
    } finally {
      await context.close();
    }
  });

  it('P4: Invalid threshold vectors show aria-invalid + role="alert" via aria-describedby and send 0 PUT requests', async () => {
    const { context, page } = await openSettingsSession({ role: 'SUPER_ADMIN', language: 'en', theme: 'light' });
    try {
      let putCount = 0;
      await page.route((url) => url.pathname === POLICY_PATH, async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: DEFAULT_POLICY }),
          });
          return;
        }
        if (route.request().method() === 'PUT') {
          putCount += 1;
        }
        await route.abort();
      });

      await page.goto(`${appServer.origin}/settings`, { waitUntil: 'networkidle' });
      const { panel } = await openIntegrityTab(page);

      const inputEl = panel.locator('#submission-integrity-threshold-input');
      const saveBtn = panel.getByTestId('submission-integrity-save-button');
      await inputEl.waitFor({ state: 'visible', timeout: 5000 });

      const invalidVectors = ['0', '0.0', '1.0001', '1.5', '-0.5', '0.12345', 'abc', '1e-1', '0.5%', 'NaN'];
      for (const vec of invalidVectors) {
        await inputEl.fill(vec);
        assert.equal(await inputEl.getAttribute('aria-invalid'), 'true', `Expected aria-invalid="true" for "${vec}"`);
        const describedBy = (await inputEl.getAttribute('aria-describedby')) || '';
        assert.ok(describedBy.includes('submission-integrity-threshold-error'), `Expected aria-describedby to reference error for "${vec}"`);
        const errorEl = panel.locator('#submission-integrity-threshold-error');
        assert.equal(await errorEl.getAttribute('role'), 'alert', `Expected role="alert" for "${vec}"`);
        assert.ok((await errorEl.textContent() || '').trim().length > 0, `Expected non-empty error text for "${vec}"`);
        assert.equal(await saveBtn.isDisabled(), true, `Expected Save disabled for "${vec}"`);
      }

      const validVectors = ['0.75', '.5', '1', '1.0', '0.0001', '0.1234', '٠٫٧٥'];
      for (const vec of validVectors) {
        await inputEl.fill(vec);
        assert.notEqual(await inputEl.getAttribute('aria-invalid'), 'true', `Expected valid vector "${vec}" not to set aria-invalid`);
        assert.equal(await panel.locator('#submission-integrity-threshold-error').count(), 0, `Expected no error alert for valid vector "${vec}"`);
        assert.equal(await saveBtn.isDisabled(), false, `Expected Save enabled for valid vector "${vec}"`);
      }

      assert.equal(putCount, 0);
    } finally {
      await context.close();
    }
  });

  it('P5: Arabic-Indic input "٠٫٧٥" saves as Western number 0.75', async () => {
    const { context, page } = await openSettingsSession({ role: 'SUPER_ADMIN', language: 'ar', theme: 'light' });
    try {
      const putBodies = [];
      await page.route((url) => url.pathname === POLICY_PATH, async (route) => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: DEFAULT_POLICY }),
          });
          return;
        }
        if (method === 'PUT') {
          const body = JSON.parse(route.request().postData() || '{}');
          putBodies.push(body);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: makePersistedPolicy({ exactDuplicateBlock: true, similarityThreshold: body.similarityThreshold }),
            }),
          });
          return;
        }
        await route.abort();
      });

      await page.goto(`${appServer.origin}/settings`, { waitUntil: 'networkidle' });
      const { panel } = await openIntegrityTab(page);

      const inputEl = panel.locator('#submission-integrity-threshold-input');
      const saveBtn = panel.getByTestId('submission-integrity-save-button');
      await inputEl.waitFor({ state: 'visible', timeout: 5000 });

      await inputEl.fill('٠٫٧٥');
      assert.equal(await saveBtn.isDisabled(), false);
      await saveBtn.click();

      const toast = page.locator('[role="status"]').first();
      await toast.waitFor({ state: 'visible', timeout: 5000 });

      assert.equal(putBodies.length, 1);
      assert.strictEqual(putBodies[0].similarityThreshold, 0.75);
      assert.equal(typeof putBodies[0].similarityThreshold, 'number');
      assert.equal(await inputEl.inputValue(), '0.75');
    } finally {
      await context.close();
    }
  });

  it('P6: PUT 422 displays raw server message inline (role="alert"), preserves draft, and sends 1 PUT request', async () => {
    const { context, page } = await openSettingsSession({ role: 'SUPER_ADMIN', language: 'en', theme: 'light' });
    try {
      let putCount = 0;
      const serverMsg = 'similarityThreshold must have at most 4 decimal places';
      await page.route((url) => url.pathname === POLICY_PATH, async (route) => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: DEFAULT_POLICY }),
          });
          return;
        }
        if (method === 'PUT') {
          putCount += 1;
          await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              status: 'fail',
              message: serverMsg,
              errorId: 'err-422-test',
            }),
          });
          return;
        }
        await route.abort();
      });

      await page.goto(`${appServer.origin}/settings`, { waitUntil: 'networkidle' });
      const { panel } = await openIntegrityTab(page);

      const switchEl = panel.getByRole('switch');
      const inputEl = panel.locator('#submission-integrity-threshold-input');
      const saveBtn = panel.getByTestId('submission-integrity-save-button');
      await inputEl.waitFor({ state: 'visible', timeout: 5000 });

      await switchEl.click();
      await inputEl.fill('0.85');
      await saveBtn.click();

      const saveErr = panel.getByTestId('submission-integrity-save-error');
      await saveErr.waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(await saveErr.getAttribute('role'), 'alert');
      assert.ok((await saveErr.textContent() || '').includes(serverMsg));

      // Draft preserved
      assert.equal(await switchEl.getAttribute('aria-checked'), 'false');
      assert.equal(await inputEl.inputValue(), '0.85');
      assert.equal(putCount, 1);
    } finally {
      await context.close();
    }
  });

  it('P7: GET 403 and GET 500 show inline alert + Retry with Save disabled, and Retry succeeds', async () => {
    const { context, page } = await openSettingsSession({ role: 'SUPER_ADMIN', language: 'en', theme: 'light' });
    try {
      let attempt = 0;
      await page.route((url) => url.pathname === POLICY_PATH, async (route) => {
        if (route.request().method() === 'GET') {
          attempt += 1;
          if (attempt === 1) {
            await route.fulfill({
              status: 403,
              contentType: 'application/json',
              body: JSON.stringify({
                success: false,
                status: 'fail',
                message: 'Forbidden: Your role does not have permission for this action.',
                errorId: 'err-403-test',
              }),
            });
            return;
          }
          if (attempt === 2) {
            await route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({
                success: false,
                status: 'error',
                message: 'Internal server error',
                errorId: 'err-500-test',
              }),
            });
            return;
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: makePersistedPolicy({ exactDuplicateBlock: false, similarityThreshold: 0.6 }),
            }),
          });
          return;
        }
        await route.abort();
      });

      await page.goto(`${appServer.origin}/settings`, { waitUntil: 'networkidle' });
      const { panel } = await openIntegrityTab(page);

      // Attempt 1: 403 -> localized forbidden alert + Retry + Save disabled
      const loadErr = panel.getByTestId('submission-integrity-load-error');
      await loadErr.waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(await loadErr.getAttribute('role'), 'alert');
      assert.ok((await loadErr.textContent() || '').includes('You do not have permission to perform this action.'));
      const saveBtn = panel.getByTestId('submission-integrity-save-button');
      assert.equal(await saveBtn.isDisabled(), true);

      // Attempt 2: Retry -> 500 -> alert + Retry + Save disabled
      const retryBtn = panel.getByTestId('submission-integrity-retry-button');
      await retryBtn.click();
      await loadErr.waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(await loadErr.getAttribute('role'), 'alert');
      assert.equal(await saveBtn.isDisabled(), true);

      // Attempt 3: Retry -> 200 -> policy rendered
      await retryBtn.click();
      const inputEl = panel.locator('#submission-integrity-threshold-input');
      await inputEl.waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(await inputEl.inputValue(), '0.6');
      assert.equal(await panel.getByRole('switch').getAttribute('aria-checked'), 'false');
      assert.equal(attempt, 3);
    } finally {
      await context.close();
    }
  });

  it('P8: Double-click on Save while PUT is held by a promise gate sends exactly 1 PUT request', async () => {
    const { context, page } = await openSettingsSession({ role: 'SUPER_ADMIN', language: 'en', theme: 'light' });
    try {
      let putCount = 0;
      let releasePut;
      const putGate = new Promise((resolve) => {
        releasePut = resolve;
      });
      let markPutArrived;
      const putArrived = new Promise((resolve) => {
        markPutArrived = resolve;
      });

      await page.route((url) => url.pathname === POLICY_PATH, async (route) => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: DEFAULT_POLICY }),
          });
          return;
        }
        if (method === 'PUT') {
          putCount += 1;
          markPutArrived();
          await putGate;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: makePersistedPolicy({ exactDuplicateBlock: true, similarityThreshold: 0.8 }),
            }),
          });
          return;
        }
        await route.abort();
      });

      await page.goto(`${appServer.origin}/settings`, { waitUntil: 'networkidle' });
      const { panel } = await openIntegrityTab(page);

      const inputEl = panel.locator('#submission-integrity-threshold-input');
      const saveBtn = panel.getByTestId('submission-integrity-save-button');
      await inputEl.waitFor({ state: 'visible', timeout: 5000 });
      await inputEl.fill('0.8');

      await saveBtn.dblclick();
      await putArrived;
      assert.equal(await saveBtn.isDisabled(), true);
      assert.equal(putCount, 1);

      releasePut();
      const toast = page.locator('[role="status"]').first();
      await toast.waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(putCount, 1);
    } finally {
      await context.close();
    }
  });

  it('P9: No-op (not dirty) keeps Save disabled', async () => {
    const { context, page } = await openSettingsSession({ role: 'SUPER_ADMIN', language: 'en', theme: 'light' });
    try {
      await page.route((url) => url.pathname === POLICY_PATH, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: makePersistedPolicy({ exactDuplicateBlock: true, similarityThreshold: 0.75 }),
          }),
        });
      });

      await page.goto(`${appServer.origin}/settings`, { waitUntil: 'networkidle' });
      const { panel } = await openIntegrityTab(page);

      const inputEl = panel.locator('#submission-integrity-threshold-input');
      const saveBtn = panel.getByTestId('submission-integrity-save-button');
      await inputEl.waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(await saveBtn.isDisabled(), true);

      // Edit and revert back to original value -> not dirty -> Save still disabled
      await inputEl.fill('0.8');
      assert.equal(await saveBtn.isDisabled(), false);
      await inputEl.fill('0.75');
      assert.equal(await saveBtn.isDisabled(), true);
    } finally {
      await context.close();
    }
  });

  for (const role of ['ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'DOCTOR', 'TEACHING_ASSISTANT', 'STUDENT']) {
    it(`P10 [${role}]: /settings loads, integrity tab is absent, and 0 requests are made to ${POLICY_PATH}`, async () => {
      const { context, page } = await openSettingsSession({ role, language: 'en', theme: 'light' });
      try {
        let policyRequests = 0;
        await page.route((url) => url.pathname === POLICY_PATH, async (route) => {
          policyRequests += 1;
          await route.fulfill({ status: 403, contentType: 'application/json', body: '{}' });
        });

        await page.goto(`${appServer.origin}/settings`, { waitUntil: 'networkidle' });
        await page.locator('[role="tablist"]').waitFor({ state: 'visible', timeout: 8000 });

        assert.equal(await page.locator('#settings-tab-integrity').count(), 0);
        assert.equal(await page.locator('#settings-tab-panel-integrity').count(), 0);
        assert.equal(policyRequests, 0);
      } finally {
        await context.close();
      }
    });
  }

  it('P11: SUPER_ADMIN on other tabs makes 0 policy requests until integrity tab is selected', async () => {
    const { context, page } = await openSettingsSession({ role: 'SUPER_ADMIN', language: 'en', theme: 'light' });
    try {
      let policyRequests = 0;
      await page.route((url) => url.pathname === POLICY_PATH, async (route) => {
        policyRequests += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: DEFAULT_POLICY }),
        });
      });

      await page.goto(`${appServer.origin}/settings`, { waitUntil: 'networkidle' });
      await page.locator('#settings-tab-account').waitFor({ state: 'visible', timeout: 8000 });
      assert.equal(policyRequests, 0);

      await page.locator('#settings-tab-security').click();
      await page.locator('#settings-tab-panel-security').waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(policyRequests, 0);

      await page.locator('#settings-tab-appearance').click();
      await page.locator('#settings-tab-panel-appearance').waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(policyRequests, 0);

      await page.locator('#settings-tab-system').click();
      await page.locator('#settings-tab-panel-system').waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(policyRequests, 0);

      const { panel } = await openIntegrityTab(page);
      await panel.locator('#submission-integrity-threshold-input').waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(policyRequests, 1);
    } finally {
      await context.close();
    }
  });

  it('P12: Keyboard tablist ArrowRight/ArrowLeft navigation works in EN (LTR) and AR (RTL) and label->input accessible names are bound', async () => {
    // EN (LTR)
    {
      const { context, page } = await openSettingsSession({ role: 'SUPER_ADMIN', language: 'en', theme: 'light' });
      try {
        await page.route((url) => url.pathname === POLICY_PATH, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: DEFAULT_POLICY }),
          });
        });

        await page.goto(`${appServer.origin}/settings`, { waitUntil: 'networkidle' });
        const systemTab = page.locator('#settings-tab-system');
        await systemTab.waitFor({ state: 'visible', timeout: 8000 });
        await systemTab.focus();
        await page.keyboard.press('ArrowRight');

        const integrityTab = page.locator('#settings-tab-integrity');
        assert.equal(await integrityTab.getAttribute('aria-selected'), 'true');

        const panel = page.locator('#settings-tab-panel-integrity');
        await panel.locator('#submission-integrity-threshold-input').waitFor({ state: 'visible', timeout: 5000 });

        const labelInfo = await page.evaluate(() => {
          const input = document.getElementById('submission-integrity-threshold-input');
          const sw = document.querySelector('#settings-tab-panel-integrity [role="switch"]');
          const inputLabel = input?.labels?.[0]?.textContent?.trim() || '';
          const switchLabelId = sw?.getAttribute('aria-labelledby');
          const switchLabel = switchLabelId ? document.getElementById(switchLabelId)?.textContent?.trim() || '' : (sw?.getAttribute('aria-label') || '');
          return { inputLabel, switchLabel };
        });
        assert.ok(labelInfo.inputLabel.length > 0, 'Threshold input must have a bound label');
        assert.ok(labelInfo.switchLabel.length > 0, 'Switch must have an accessible name');

        await integrityTab.focus();
        await page.keyboard.press('ArrowLeft');
        assert.equal(await systemTab.getAttribute('aria-selected'), 'true');
      } finally {
        await context.close();
      }
    }

    // AR (RTL)
    {
      const { context, page } = await openSettingsSession({ role: 'SUPER_ADMIN', language: 'ar', theme: 'light' });
      try {
        await page.route((url) => url.pathname === POLICY_PATH, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: DEFAULT_POLICY }),
          });
        });

        await page.goto(`${appServer.origin}/settings`, { waitUntil: 'networkidle' });
        const systemTab = page.locator('#settings-tab-system');
        await systemTab.waitFor({ state: 'visible', timeout: 8000 });
        await systemTab.focus();
        // In RTL, ArrowLeft advances to the next tab
        await page.keyboard.press('ArrowLeft');

        const integrityTab = page.locator('#settings-tab-integrity');
        assert.equal(await integrityTab.getAttribute('aria-selected'), 'true');
        await page.locator('#settings-tab-panel-integrity #submission-integrity-threshold-input').waitFor({ state: 'visible', timeout: 5000 });

        await integrityTab.focus();
        // In RTL, ArrowRight returns to the previous tab
        await page.keyboard.press('ArrowRight');
        assert.equal(await systemTab.getAttribute('aria-selected'), 'true');
      } finally {
        await context.close();
      }
    }
  });

  // P13: 24-Config Matrix (1440/1024/768/430/390/360 x ar/en x light/dark)
  const matrixWidths = [1440, 1024, 768, 430, 390, 360];
  for (const width of matrixWidths) {
    for (const language of ['ar', 'en']) {
      for (const theme of ['light', 'dark']) {
        it(`P13 Matrix [${width}px ${language.toUpperCase()} ${theme.toUpperCase()}]: html lang/dir, dark class, scrollWidth <= innerWidth, control bounds`, async () => {
          const viewport = { width, height: width <= 430 ? 844 : 800 };
          const { context, page } = await openSettingsSession({
            role: 'SUPER_ADMIN',
            language,
            theme,
            viewport,
          });
          try {
            await page.route((url) => url.pathname === POLICY_PATH, async (route) => {
              await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, data: DEFAULT_POLICY }),
              });
            });

            await page.goto(`${appServer.origin}/settings`, { waitUntil: 'networkidle' });
            const { panel } = await openIntegrityTab(page);

            const switchEl = panel.getByRole('switch');
            const inputEl = panel.locator('#submission-integrity-threshold-input');
            const saveBtn = panel.getByTestId('submission-integrity-save-button');
            await switchEl.waitFor({ state: 'visible', timeout: 5000 });
            await inputEl.waitFor({ state: 'visible', timeout: 5000 });
            await saveBtn.waitFor({ state: 'visible', timeout: 5000 });

            const htmlLang = await page.getAttribute('html', 'lang');
            const htmlDir = await page.getAttribute('html', 'dir');
            const htmlClass = (await page.getAttribute('html', 'class')) || '';
            assert.equal(htmlLang, language);
            assert.equal(htmlDir, language === 'ar' ? 'rtl' : 'ltr');
            if (theme === 'dark') {
              assert.ok(htmlClass.includes('dark'), 'Expected dark class on html in dark theme');
            } else {
              assert.ok(!htmlClass.includes('dark'), 'Expected dark class absent on html in light theme');
            }

            const metrics = await page.evaluate(() => ({
              scrollWidth: document.documentElement.scrollWidth,
              innerWidth: window.innerWidth,
            }));
            assert.ok(
              metrics.scrollWidth <= metrics.innerWidth,
              `scrollWidth (${metrics.scrollWidth}) must be <= innerWidth (${metrics.innerWidth})`
            );

            for (const [name, locator] of [
              ['switch', switchEl],
              ['input', inputEl],
              ['saveButton', saveBtn],
            ]) {
              await locator.scrollIntoViewIfNeeded();
              const box = await locator.boundingBox();
              assert.ok(box, `Expected boundingBox for ${name}`);
              assert.ok(box.width > 0 && box.height > 0, `Expected non-zero size for ${name}`);
              assert.ok(box.x >= 0, `${name} left bound (${box.x}) must be >= 0`);
              assert.ok(
                box.x + box.width <= viewport.width,
                `${name} right bound (${box.x + box.width}) must be <= viewport width (${viewport.width})`
              );
              assert.ok(box.y >= 0, `${name} top bound (${box.y}) must be >= 0`);
              assert.ok(
                box.y + box.height <= viewport.height,
                `${name} bottom bound (${box.y + box.height}) must be <= viewport height (${viewport.height})`
              );
            }
          } finally {
            await context.close();
          }
        });
      }
    }
  }
});
