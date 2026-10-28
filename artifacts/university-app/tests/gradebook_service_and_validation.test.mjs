import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test, describe } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

describe('TASK T-7a-1: Gradebook Service, Validation, Error Mapping & Role Gating', () => {

  // 1. PIN CONSTANTS FROM BACKEND SOURCE
  test('Constants: MAX_DECIMAL_PLACES matches backend validation constant (2)', async () => {
    const backendValPath = path.join(rootDir, 'artifacts/api-server/src/validations/gradebook.validation.ts');
    assert.ok(existsSync(backendValPath), 'Backend validation file must exist');
    const backendContent = readFileSync(backendValPath, 'utf8');
    const match = backendContent.match(/export\s+const\s+MAX_DECIMAL_PLACES\s*=\s*(\d+);/);
    assert.ok(match, 'Backend must export MAX_DECIMAL_PLACES');
    const backendMaxDecimals = parseInt(match[1], 10);
    assert.equal(backendMaxDecimals, 2, 'Backend MAX_DECIMAL_PLACES must be 2');

    // Web source must export identical MAX_DECIMAL_PLACES constant
    const webServicePath = path.join(rootDir, 'artifacts/university-app/src/services/gradebook.service.ts');
    assert.ok(existsSync(webServicePath), 'Web gradebook.service.ts must exist');
    const webContent = readFileSync(webServicePath, 'utf8');
    const webMatch = webContent.match(/export\s+const\s+MAX_DECIMAL_PLACES\s*=\s*(\d+);/);
    assert.ok(webMatch, 'Web gradebook.service.ts must export MAX_DECIMAL_PLACES');
    const webMaxDecimals = parseInt(webMatch[1], 10);
    assert.equal(webMaxDecimals, backendMaxDecimals, 'Web MAX_DECIMAL_PLACES must equal backend constant');
  });

  // 2. PIN BACKEND ERROR STRINGS FROM BACKEND SERVICE
  test('Backend error string parity: pins that required error messages exist in gradebook.service.ts', () => {
    const backendServicePath = path.join(rootDir, 'artifacts/api-server/src/services/gradebook.service.ts');
    assert.ok(existsSync(backendServicePath), 'Backend gradebook.service.ts must exist');
    const backendSrc = readFileSync(backendServicePath, 'utf8');

    // Expected exact substrings thrown by backend
    assert.ok(
      backendSrc.includes('Optimistic lock failure'),
      'Backend must contain "Optimistic lock failure" error message'
    );
    assert.ok(
      backendSrc.includes('Cannot modify gradebook draft for past or locked academic term'),
      'Backend must contain past/locked term error message'
    );
    assert.ok(
      backendSrc.includes('is PUBLISHED and cannot be modified as a draft'),
      'Backend must contain PUBLISHED entry draft protection error message'
    );
    assert.ok(
      backendSrc.includes('Grade structure has not been defined for this course and term'),
      'Backend must contain missing grade structure error message'
    );
    assert.ok(
      backendSrc.includes('Teaching Assistant is not authorized to grade enrollment'),
      'Backend must contain TA out-of-group authorization error message'
    );
    assert.ok(
      backendSrc.includes('has status WITHDRAWN and cannot be graded'),
      'Backend must contain WITHDRAWN enrollment error message'
    );
  });

  // 3. ERROR MAPPING UTILITY
  test('Error mapping: maps backend messages and status codes to i18n keys', async () => {
    const webUtilsPath = path.join(rootDir, 'artifacts/university-app/src/utils/gradebook.utils.ts');
    assert.ok(existsSync(webUtilsPath), 'Web gradebook.utils.ts must exist');
    const webSrc = readFileSync(webUtilsPath, 'utf8');

    const transpiled = ts.transpileModule(webSrc, {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    }).outputText;
    const dataUri = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
    const { mapGradebookError } = await import(dataUri);
    assert.equal(typeof mapGradebookError, 'function', 'mapGradebookError must be exported as a function');

    // Test optimistic lock
    assert.equal(
      mapGradebookError('Optimistic lock failure: grade entry was modified by another user', 409),
      'gradebook.errors.optimisticLock'
    );

    // Test past term
    assert.equal(
      mapGradebookError('Cannot modify gradebook draft for past or locked academic term', 409),
      'gradebook.errors.pastTerm'
    );

    // Test PUBLISHED entry
    assert.equal(
      mapGradebookError('Grade entry for enrollment 5 and component 2 is PUBLISHED and cannot be modified as a draft', 409),
      'gradebook.errors.publishedCell'
    );

    // Test missing structure
    assert.equal(
      mapGradebookError('Grade structure has not been defined for this course and term', 409),
      'gradebook.errors.structureUndefined'
    );

    // Test TA out of group
    assert.equal(
      mapGradebookError('Teaching Assistant is not authorized to grade enrollment 12 outside assigned student group', 403),
      'gradebook.errors.taOutOfGroup'
    );

    // Test WITHDRAWN
    assert.equal(
      mapGradebookError('Enrollment ID 15 has status WITHDRAWN and cannot be graded', 422),
      'gradebook.errors.withdrawn'
    );

    // Test unknown / unexpected fallback
    assert.equal(
      mapGradebookError('Some totally unexpected server crash', 500),
      'gradebook.errors.generic'
    );
  });

  // 4. SCORE VALIDATION LOGIC
  test('Validation: validateGradeScore enforces finite, >= 0, <= maxPoints, and <= 2 decimals', async () => {
    const webUtilsPath = path.join(rootDir, 'artifacts/university-app/src/utils/gradebook.utils.ts');
    assert.ok(existsSync(webUtilsPath), 'Web gradebook.utils.ts must exist');
    const webSrc = readFileSync(webUtilsPath, 'utf8');

    const transpiled = ts.transpileModule(webSrc, {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    }).outputText;
    const dataUri = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
    const { validateGradeScore } = await import(dataUri);
    assert.equal(typeof validateGradeScore, 'function', 'validateGradeScore must be exported');

    const maxPoints = 25;

    // Valid cases
    assert.deepEqual(validateGradeScore(null, maxPoints, false), { valid: true, errorKey: null });
    assert.deepEqual(validateGradeScore(0, maxPoints, false), { valid: true, errorKey: null });
    assert.deepEqual(validateGradeScore(15, maxPoints, false), { valid: true, errorKey: null });
    assert.deepEqual(validateGradeScore(25, maxPoints, false), { valid: true, errorKey: null });
    assert.deepEqual(validateGradeScore(12.5, maxPoints, false), { valid: true, errorKey: null });
    assert.deepEqual(validateGradeScore(12.75, maxPoints, false), { valid: true, errorKey: null });

    // When isAbsent is true, score must be null (valid)
    assert.deepEqual(validateGradeScore(null, maxPoints, true), { valid: true, errorKey: null });

    // Invalid: negative
    assert.deepEqual(validateGradeScore(-1, maxPoints, false), {
      valid: false,
      errorKey: 'gradebook.validation.negativeScore',
    });

    // Invalid: exceeds max points
    assert.deepEqual(validateGradeScore(25.01, maxPoints, false), {
      valid: false,
      errorKey: 'gradebook.validation.exceedsMaxPoints',
    });

    // Invalid: more than 2 decimal places
    assert.deepEqual(validateGradeScore(12.345, maxPoints, false), {
      valid: false,
      errorKey: 'gradebook.validation.maxDecimals',
    });

    // Invalid: NaN or Infinity
    assert.deepEqual(validateGradeScore(NaN, maxPoints, false), {
      valid: false,
      errorKey: 'gradebook.validation.invalidNumber',
    });
    assert.deepEqual(validateGradeScore(Infinity, maxPoints, false), {
      valid: false,
      errorKey: 'gradebook.validation.invalidNumber',
    });
  });

  // 5. EXTRACT CHANGED CELLS FOR SAVE
  test('Changed cells: extractChangedDraftEntries extracts only modified cells and includes version', async () => {
    const webUtilsPath = path.join(rootDir, 'artifacts/university-app/src/utils/gradebook.utils.ts');
    assert.ok(existsSync(webUtilsPath), 'Web gradebook.utils.ts must exist');
    const webSrc = readFileSync(webUtilsPath, 'utf8');

    const transpiled = ts.transpileModule(webSrc, {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    }).outputText;
    const dataUri = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
    const { extractChangedDraftEntries } = await import(dataUri);
    assert.equal(typeof extractChangedDraftEntries, 'function', 'extractChangedDraftEntries must be exported');

    const originalCells = [
      { enrollmentId: 1, componentId: 10, score: 20, isAbsent: false, version: 1, source: 'MANUAL', status: 'DRAFT' },
      { enrollmentId: 1, componentId: 20, score: null, isAbsent: false, version: null, source: 'MANUAL', status: null },
      { enrollmentId: 2, componentId: 10, score: 15, isAbsent: false, version: 2, source: 'MANUAL', status: 'DRAFT' },
      { enrollmentId: 2, componentId: 30, score: 10, isAbsent: false, version: 1, source: 'AUTO_QUIZ', status: 'PUBLISHED' }, // AUTO - should never be modified
    ];

    const currentEdits = {
      // Cell 1: unchanged (score 20 -> 20)
      '1:10': { score: 20, isAbsent: false },
      // Cell 2: changed from null to 18
      '1:20': { score: 18, isAbsent: false },
      // Cell 3: changed to absent
      '2:10': { score: null, isAbsent: true },
    };

    const changed = extractChangedDraftEntries(originalCells, currentEdits);
    assert.equal(changed.length, 2, 'Only the 2 modified cells must be returned');

    // First changed cell (1:20) - new entry so version undefined
    const c1 = changed.find((c) => c.enrollmentId === 1 && c.componentId === 20);
    assert.ok(c1, 'Cell 1:20 must be included');
    assert.equal(c1.score, 18);
    assert.equal(c1.isAbsent, false);
    assert.equal(c1.version, undefined);

    // Second changed cell (2:10) - updated entry so version 2 must be included
    const c2 = changed.find((c) => c.enrollmentId === 2 && c.componentId === 10);
    assert.ok(c2, 'Cell 2:10 must be included');
    assert.equal(c2.score, null);
    assert.equal(c2.isAbsent, true);
    assert.equal(c2.version, 2);
  });

  // 6. ROLE CAPABILITY & GATING MATRIX
  test('Capability & Roles: gradebook.view capability matrix and route access', async () => {
    const capPath = path.join(rootDir, 'artifacts/university-app/src/config/capabilities.ts');
    assert.ok(existsSync(capPath), 'capabilities.ts must exist');
    const capSrc = readFileSync(capPath, 'utf8');

    const transpiled = ts.transpileModule(capSrc, {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    }).outputText;
    const dataUri = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
    const { hasCapability, ROLE_CAPABILITY_MATRIX, ROUTE_CAPABILITY_MAP } = await import(dataUri);

    // Capability must be granted to Doctor, TA, and the 3 admin roles (plus Super Admin)
    const allowedRoles = ['DOCTOR', 'TEACHING_ASSISTANT', 'SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'];
    for (const role of allowedRoles) {
      assert.equal(
        hasCapability(role, 'gradebook.view'),
        true,
        `Role ${role} must have 'gradebook.view' capability`
      );
    }

    // STUDENT must NOT have gradebook.view
    assert.equal(
      hasCapability('STUDENT', 'gradebook.view'),
      false,
      'STUDENT role must NOT have gradebook.view capability'
    );

    // Route capability mapping
    assert.ok(
      ROUTE_CAPABILITY_MAP['/courses'] !== undefined,
      'Route /courses must be mapped in ROUTE_CAPABILITY_MAP'
    );
  });

  // 7. i18n SYMMETRY FOR gradebook.* KEYS
  test('i18n symmetry: all gradebook.* keys in en.json exist symmetrically in ar.json without dummy fallbacks', () => {
    const enPath = path.join(rootDir, 'artifacts/university-app/src/i18n/en.json');
    const arPath = path.join(rootDir, 'artifacts/university-app/src/i18n/ar.json');
    assert.ok(existsSync(enPath), 'en.json must exist');
    assert.ok(existsSync(arPath), 'ar.json must exist');

    const en = JSON.parse(readFileSync(enPath, 'utf8'));
    const ar = JSON.parse(readFileSync(arPath, 'utf8'));

    assert.ok(en.gradebook, 'en.json must define gradebook namespace');
    assert.ok(ar.gradebook, 'ar.json must define gradebook namespace');

    const getKeys = (obj, prefix = '') => {
      let keys = [];
      for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          keys = keys.concat(getKeys(v, fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      return keys;
    };

    const enKeys = getKeys(en.gradebook, 'gradebook');
    const arKeys = getKeys(ar.gradebook, 'gradebook');

    const missingInAr = enKeys.filter((k) => !arKeys.includes(k));
    const missingInEn = arKeys.filter((k) => !enKeys.includes(k));

    assert.deepEqual(missingInAr, [], `Keys missing in ar.json: ${missingInAr.join(', ')}`);
    assert.deepEqual(missingInEn, [], `Keys missing in en.json: ${missingInEn.join(', ')}`);

    // Required functional keys
    const requiredKeys = [
      'gradebook.title',
      'gradebook.entryButton',
      'gradebook.saveDraft',
      'gradebook.saving',
      'gradebook.savedSuccess',
      'gradebook.unsavedChanges',
      'gradebook.reloadLatest',
      'gradebook.sourceAuto',
      'gradebook.published',
      'gradebook.absent',
      'gradebook.searchPlaceholder',
      'gradebook.noStudentsFound',
      'gradebook.noStructureTitle',
      'gradebook.noStructureDesc',
      'gradebook.passMarkNotSet',
      'gradebook.errors.optimisticLock',
      'gradebook.errors.pastTerm',
      'gradebook.errors.publishedCell',
      'gradebook.errors.structureUndefined',
      'gradebook.errors.taOutOfGroup',
      'gradebook.errors.withdrawn',
      'gradebook.errors.generic',
      'gradebook.validation.negativeScore',
      'gradebook.validation.exceedsMaxPoints',
      'gradebook.validation.maxDecimals',
      'gradebook.validation.invalidNumber',
    ];

    for (const key of requiredKeys) {
      assert.ok(enKeys.includes(key), `en.json must contain required key "${key}"`);
      assert.ok(arKeys.includes(key), `ar.json must contain required key "${key}"`);
    }
  });

  // 10. ITEM 3: APICLIENT DEFAULT VS OPT-IN ERROR MESSAGE PRESERVATION
  test('Item 3: apiClient apiRequest respects preferRawMessage option and preserves localized default', async () => {
    const apiClientPath = path.join(rootDir, 'artifacts/university-app/src/lib/apiClient.ts');
    assert.ok(existsSync(apiClientPath), 'apiClient.ts must exist');
    let clientSrc = readFileSync(apiClientPath, 'utf8');
    // Strip relative import of api to allow isolated evaluation
    clientSrc = clientSrc.replace(/import\s+api\s+from\s+['"][^'"]+['"];?/g, 'const api = null;');

    const transpiled = ts.transpileModule(clientSrc, {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    }).outputText;
    const dataUri = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
    const { apiRequest } = await import(dataUri);

    const mockRejectedInterceptorError = {
      message: 'Localized conflict error from i18n',
      rawMessage: 'Optimistic lock conflict: version mismatch',
      status: 409,
    };

    // (a) Default call without options MUST keep the old localized message
    const defaultRes = await apiRequest(async () => {
      throw mockRejectedInterceptorError;
    });
    assert.equal(
      defaultRes.message,
      'Localized conflict error from i18n',
      'Default call must preserve localized message for existing callers'
    );

    // (b) Call with preferRawMessage: true MUST receive the raw backend message
    const optInRes = await apiRequest(async () => {
      throw mockRejectedInterceptorError;
    }, { preferRawMessage: true });
    assert.equal(
      optInRes.message,
      'Optimistic lock conflict: version mismatch',
      'Opt-in call must receive raw backend message'
    );
  });

  // 10b. ITEM 1: APICLIENT STATUS FALLBACK SCOPED STRICTLY TO PREFERRAWMESSAGE
  test('Item 1: apiClient status fallback is scoped strictly to preferRawMessage', async () => {
    const apiClientPath = path.join(rootDir, 'artifacts/university-app/src/lib/apiClient.ts');
    assert.ok(existsSync(apiClientPath), 'apiClient.ts must exist');
    let clientSrc = readFileSync(apiClientPath, 'utf8');
    clientSrc = clientSrc.replace(/import\s+api\s+from\s+['"][^'"]+['"];?/g, 'const api = null;');

    const transpiled = ts.transpileModule(clientSrc, {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    }).outputText;
    const dataUri = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
    const { apiRequest } = await import(dataUri);

    const errorWithResponseStatusOnly = {
      message: 'Network or HTTP error',
      response: {
        status: 409,
        data: { message: 'Conflict from response body' },
      },
    };

    // Called WITHOUT options: must return status undefined (exact HEAD behavior)
    const defaultRes = await apiRequest(async () => {
      throw errorWithResponseStatusOnly;
    });
    assert.strictEqual(
      defaultRes.status,
      undefined,
      'Default call without options must return status undefined when top-level status is absent'
    );

    // Called WITH preferRawMessage: must return 409 (opt-in fallback)
    const optInRes = await apiRequest(async () => {
      throw errorWithResponseStatusOnly;
    }, { preferRawMessage: true });
    assert.strictEqual(
      optInRes.status,
      409,
      'Call with preferRawMessage must fall back to response.status 409'
    );
  });

  // 11. T-7a-2: PIN CORRECTION REASON CONSTANTS & SOURCE PARITY
  test('T-7a-2 Constants: MIN/MAX_CORRECTION_REASON_LENGTH matches backend source (5, 500)', () => {
    const backendValPath = path.join(rootDir, 'artifacts/api-server/src/validations/gradebook.validation.ts');
    assert.ok(existsSync(backendValPath), 'Backend validation file must exist');
    const backendContent = readFileSync(backendValPath, 'utf8');

    const minMatch = backendContent.match(/export\s+const\s+MIN_CORRECTION_REASON_LENGTH\s*=\s*(\d+);/);
    assert.ok(minMatch, 'Backend must export MIN_CORRECTION_REASON_LENGTH');
    assert.equal(parseInt(minMatch[1], 10), 5, 'Backend MIN_CORRECTION_REASON_LENGTH must be 5');

    const maxMatch = backendContent.match(/export\s+const\s+MAX_CORRECTION_REASON_LENGTH\s*=\s*(\d+);/);
    assert.ok(maxMatch, 'Backend must export MAX_CORRECTION_REASON_LENGTH');
    assert.equal(parseInt(maxMatch[1], 10), 500, 'Backend MAX_CORRECTION_REASON_LENGTH must be 500');

    // Angle bracket and control character guards
    assert.ok(backendContent.includes('/[<>]/.test'), 'Backend must reject angle brackets');
    assert.ok(backendContent.includes('/[\\x00-\\x1F\\x7F]/.test'), 'Backend must reject control characters');

    // Web utils must also export identical constants
    const webUtilsPath = path.join(rootDir, 'artifacts/university-app/src/utils/gradebook.utils.ts');
    assert.ok(existsSync(webUtilsPath), 'Web gradebook.utils.ts must exist');
    const webContent = readFileSync(webUtilsPath, 'utf8');

    const webMinMatch = webContent.match(/export\s+const\s+MIN_CORRECTION_REASON_LENGTH\s*=\s*(\d+);/);
    assert.ok(webMinMatch, 'Web gradebook.utils.ts must export MIN_CORRECTION_REASON_LENGTH');
    assert.equal(parseInt(webMinMatch[1], 10), 5, 'Web MIN_CORRECTION_REASON_LENGTH must be 5');

    const webMaxMatch = webContent.match(/export\s+const\s+MAX_CORRECTION_REASON_LENGTH\s*=\s*(\d+);/);
    assert.ok(webMaxMatch, 'Web gradebook.utils.ts must export MAX_CORRECTION_REASON_LENGTH');
    assert.equal(parseInt(webMaxMatch[1], 10), 500, 'Web MAX_CORRECTION_REASON_LENGTH must be 500');
  });

  // 12. T-7a-2: PURE VALIDATE CORRECTION REASON
  test('T-7a-2 Validation: validateCorrectionReason enforces 5-500 chars, no angle brackets, no control characters', async () => {
    const webUtilsPath = path.join(rootDir, 'artifacts/university-app/src/utils/gradebook.utils.ts');
    const webSrc = readFileSync(webUtilsPath, 'utf8');

    const transpiled = ts.transpileModule(webSrc, {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    }).outputText;
    const dataUri = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
    const { validateCorrectionReason } = await import(dataUri);
    assert.equal(typeof validateCorrectionReason, 'function', 'validateCorrectionReason must be exported as a function');

    // Too short (< 5)
    assert.deepEqual(validateCorrectionReason('abc'), {
      valid: false,
      errorKey: 'gradebook.validation.reasonMinLength',
    });
    assert.deepEqual(validateCorrectionReason('   '), {
      valid: false,
      errorKey: 'gradebook.validation.reasonMinLength',
    });

    // Too long (> 500)
    const longReason = 'x'.repeat(501);
    assert.deepEqual(validateCorrectionReason(longReason), {
      valid: false,
      errorKey: 'gradebook.validation.reasonMaxLength',
    });

    // Angle brackets forbidden
    assert.deepEqual(validateCorrectionReason('Review <exam score>'), {
      valid: false,
      errorKey: 'gradebook.validation.reasonNoAngleBrackets',
    });
    assert.deepEqual(validateCorrectionReason('Updated mark > previous'), {
      valid: false,
      errorKey: 'gradebook.validation.reasonNoAngleBrackets',
    });

    // Control characters forbidden
    assert.deepEqual(validateCorrectionReason('Valid reason\x00with null byte'), {
      valid: false,
      errorKey: 'gradebook.validation.reasonNoControlChars',
    });

    // Valid reasons (5-500 chars without angle brackets)
    assert.deepEqual(validateCorrectionReason('Paper re-evaluation after student appeal'), {
      valid: true,
      errorKey: null,
    });
    assert.deepEqual(validateCorrectionReason('12345'), {
      valid: true,
      errorKey: null,
    });
  });

  // 13. T-7a-2: SERVICE PUBLISH & CORRECT EXPORTS
  test('T-7a-2 Services: gradebook.service.ts exports publishGradebook and correctGradebook', async () => {
    const webServicePath = path.join(rootDir, 'artifacts/university-app/src/services/gradebook.service.ts');
    assert.ok(existsSync(webServicePath), 'gradebook.service.ts must exist');
    let serviceSrc = readFileSync(webServicePath, 'utf8');
    serviceSrc = serviceSrc.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
    serviceSrc = serviceSrc.replace(/export\s+\{[\s\S]*?\}\s+from\s+['"][^'"]+['"];?/g, '');
    const stubs = `
const apiRequest = (fn, opts) => Promise.resolve({ success: true, data: {} });
const api = { get: () => Promise.resolve({ data: {} }), post: () => Promise.resolve({ data: {} }) };
const mapGradebookError = () => '';
const validateGradeScore = () => ({});
const validateCorrectionReason = () => ({});
const extractChangedDraftEntries = () => [];
const MAX_DECIMAL_PLACES = 2;
const MIN_CORRECTION_REASON_LENGTH = 5;
const MAX_CORRECTION_REASON_LENGTH = 500;
`;
    serviceSrc = stubs + '\n' + serviceSrc;

    const transpiled = ts.transpileModule(serviceSrc, {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    }).outputText;
    const dataUri = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
    try {
      const module = await import(dataUri);
      assert.equal(typeof module.publishGradebook, 'function', 'publishGradebook must be exported as a function');
      assert.equal(typeof module.correctGradebook, 'function', 'correctGradebook must be exported as a function');
    } catch (err) {
      console.log('IMPORT ERROR DETAILS:', {
        message: err.message,
        code: err.code,
        causeMessage: err.cause?.message,
        causeInput: err.cause?.input,
        causeCode: err.cause?.code,
      });
      throw err;
    }
  });

  // 14. T-7a-2: EXTENDED ERROR MAPPINGS
  test('T-7a-2 Error Mapping: mapGradebookError maps all STEP 0 409 codes and conflict messages', async () => {
    const webUtilsPath = path.join(rootDir, 'artifacts/university-app/src/utils/gradebook.utils.ts');
    const webSrc = readFileSync(webUtilsPath, 'utf8');

    const transpiled = ts.transpileModule(webSrc, {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    }).outputText;
    const dataUri = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
    const { mapGradebookError } = await import(dataUri);

    // 1. PASSMARK_NOT_SET
    assert.equal(
      mapGradebookError('PASSMARK_NOT_SET: Grade structure passMark must be defined before completing enrollments', 409),
      'gradebook.errors.passMarkNotSet'
    );

    // 2. AUTO_CALCULATOR_UNAVAILABLE
    assert.equal(
      mapGradebookError('AUTO_CALCULATOR_UNAVAILABLE: No calculator registered for source AUTO_ATTENDANCE', 409),
      'gradebook.errors.autoCalculatorUnavailable'
    );

    // 3. AUTO_CALCULATOR_INVALID_RESULT
    assert.equal(
      mapGradebookError('AUTO_CALCULATOR_INVALID_RESULT: Calculator for source AUTO_QUIZ returned invalid score 15.555', 409),
      'gradebook.errors.autoCalculatorInvalidResult'
    );

    // 4. Concurrent modification conflict
    assert.equal(
      mapGradebookError('Concurrent modification conflict during gradebook operation. Please try again.', 409),
      'gradebook.errors.concurrentConflict'
    );

    // 5. Past / locked term on publish & correct
    assert.equal(
      mapGradebookError('Cannot publish gradebook for past or locked academic term', 409),
      'gradebook.errors.pastTerm'
    );
    assert.equal(
      mapGradebookError('Cannot correct grades for past or locked academic term', 409),
      'gradebook.errors.pastTerm'
    );

    // 6. Manual only correction
    assert.equal(
      mapGradebookError('Only MANUAL components can be corrected directly. Component 101 (Attendance) has source AUTO_ATTENDANCE', 409),
      'gradebook.errors.manualOnlyCorrection'
    );

    // 7. Published only correction
    assert.equal(
      mapGradebookError('Only PUBLISHED grade entries can be corrected. Entry for component 102 is in status DRAFT', 409),
      'gradebook.errors.publishedOnlyCorrection'
    );

    // 8. Withdrawn or blocked correction
    assert.equal(
      mapGradebookError('Cannot correct grade for WITHDRAWN enrollment 1001', 409),
      'gradebook.errors.withdrawnOrBlocked'
    );
  });

  // 15. T-7a-2: I18N SYMMETRY FOR ALL PUBLISH & CORRECT KEYS
  test('T-7a-2 i18n symmetry: all publish and correct keys exist in en.json and ar.json', () => {
    const enPath = path.join(rootDir, 'artifacts/university-app/src/i18n/en.json');
    const arPath = path.join(rootDir, 'artifacts/university-app/src/i18n/ar.json');
    const enData = JSON.parse(readFileSync(enPath, 'utf8'));
    const arData = JSON.parse(readFileSync(arPath, 'utf8'));

    function getLeafKeys(obj, prefix = '') {
      let keys = [];
      for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          keys = keys.concat(getLeafKeys(v, fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      return keys;
    }

    const enKeys = getLeafKeys(enData);
    const arKeys = getLeafKeys(arData);

    const requiredKeys = [
      'gradebook.publish',
      'gradebook.publishing',
      'gradebook.publishModalTitle',
      'gradebook.publishModalDesc',
      'gradebook.publishSuccess',
      'gradebook.publishSummaryTitle',
      'gradebook.completedCount',
      'gradebook.incompleteCount',
      'gradebook.skippedCount',
      'gradebook.confirmPublish',
      'gradebook.cancel',
      'gradebook.close',
      'gradebook.unsavedDraftWarning',
      'gradebook.correctCell',
      'gradebook.correctModalTitle',
      'gradebook.correctModalDesc',
      'gradebook.reasonLabel',
      'gradebook.reasonPlaceholder',
      'gradebook.currentScore',
      'gradebook.newScore',
      'gradebook.saveCorrection',
      'gradebook.savingCorrection',
      'gradebook.correctionSuccess',
      'gradebook.correctionSummaryTitle',
      'gradebook.before',
      'gradebook.after',
      'gradebook.finalTotal',
      'gradebook.finalGrade',
      'gradebook.errors.passMarkNotSet',
      'gradebook.errors.autoCalculatorUnavailable',
      'gradebook.errors.autoCalculatorInvalidResult',
      'gradebook.errors.concurrentConflict',
      'gradebook.errors.manualOnlyCorrection',
      'gradebook.errors.publishedOnlyCorrection',
      'gradebook.errors.withdrawnOrBlocked',
      'gradebook.validation.reasonMinLength',
      'gradebook.validation.reasonMaxLength',
      'gradebook.validation.reasonNoAngleBrackets',
      'gradebook.validation.reasonNoControlChars',
    ];

    for (const key of requiredKeys) {
      assert.ok(enKeys.includes(key), `en.json must contain required key "${key}"`);
      assert.ok(arKeys.includes(key), `ar.json must contain required key "${key}"`);
    }
  });
});

