import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test, describe } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

describe('TASK T-7c: Grade Structure Editor Service, Validation, Error Mapping & Role Gating', () => {
  // 1. PIN CONSTANTS FROM BACKEND SOURCE
  test('Constants: MAX_POINTS_TECHNICAL_CEILING (10000), MAX_COMPONENT_NAME_LENGTH (100), and MAX_DECIMAL_PLACES (2) match backend gradeStructure.validation.ts', () => {
    const backendValPath = path.join(
      rootDir,
      'artifacts/api-server/src/validations/gradeStructure.validation.ts'
    );
    assert.ok(existsSync(backendValPath), 'Backend gradeStructure.validation.ts must exist');
    const backendContent = readFileSync(backendValPath, 'utf8');

    const ceilingMatch = backendContent.match(
      /export\s+const\s+MAX_POINTS_TECHNICAL_CEILING\s*=\s*(\d+);/
    );
    assert.ok(ceilingMatch, 'Backend must export MAX_POINTS_TECHNICAL_CEILING');
    const backendCeiling = parseInt(ceilingMatch[1], 10);
    assert.equal(backendCeiling, 10000, 'Backend MAX_POINTS_TECHNICAL_CEILING must be 10000');

    assert.ok(
      backendContent.includes('trimmedName.length > 100'),
      'Backend must enforce 100 character limit on component name'
    );
    assert.ok(
      backendContent.includes('Math.round(points * 100) !== points * 100'),
      'Backend must enforce at most 2 decimal places on component maxPoints'
    );
    assert.ok(
      backendContent.includes("['AUTO_QUIZ', 'AUTO_ATTENDANCE', 'MANUAL']"),
      'Backend must enforce allowed GradeComponentSource values'
    );

    const webUtilsPath = path.join(rootDir, 'artifacts/university-app/src/utils/gradebook.utils.ts');
    assert.ok(existsSync(webUtilsPath), 'Web gradebook.utils.ts must exist');
    const webUtilsContent = readFileSync(webUtilsPath, 'utf8');

    const webCeilingMatch = webUtilsContent.match(
      /export\s+const\s+MAX_POINTS_TECHNICAL_CEILING\s*=\s*(\d+);/
    );
    assert.ok(webCeilingMatch, 'Web gradebook.utils.ts must export MAX_POINTS_TECHNICAL_CEILING');
    assert.equal(parseInt(webCeilingMatch[1], 10), backendCeiling);

    const webNameLenMatch = webUtilsContent.match(
      /export\s+const\s+MAX_COMPONENT_NAME_LENGTH\s*=\s*(\d+);/
    );
    assert.ok(webNameLenMatch, 'Web gradebook.utils.ts must export MAX_COMPONENT_NAME_LENGTH');
    assert.equal(parseInt(webNameLenMatch[1], 10), 100);
  });

  // 2. PIN BACKEND ERROR STRINGS FROM gradeStructure.service.ts & gradeStructure.validation.ts
  test('Backend error string parity: pins real error messages in gradeStructure.service.ts and gradeStructure.validation.ts', () => {
    const servicePath = path.join(
      rootDir,
      'artifacts/api-server/src/services/gradeStructure.service.ts'
    );
    const valPath = path.join(
      rootDir,
      'artifacts/api-server/src/validations/gradeStructure.validation.ts'
    );
    const errMiddlewarePath = path.join(
      rootDir,
      'artifacts/api-server/src/middleware/error.middleware.ts'
    );

    const serviceSrc = readFileSync(servicePath, 'utf8');
    const valSrc = readFileSync(valPath, 'utf8');
    const errSrc = readFileSync(errMiddlewarePath, 'utf8');

    assert.ok(
      serviceSrc.includes(
        'Cannot modify grade structure: published grades exist for this course in this term'
      )
    );
    assert.ok(serviceSrc.includes('Cannot modify grade structure: academic term is in the past'));
    assert.ok(serviceSrc.includes('Cannot modify grade structure: academic term is locked'));
    assert.ok(serviceSrc.includes('Cannot remove component'));
    assert.ok(serviceSrc.includes('Cannot change source of component'));
    assert.ok(serviceSrc.includes('Cannot reduce maxPoints below existing draft score'));
    assert.ok(serviceSrc.includes('Transaction conflict during grade structure update. Please retry.'));
    assert.ok(serviceSrc.includes('Course is outside your administrative scope'));
    assert.ok(serviceSrc.includes('Doctors are not permitted to modify course grade structures'));
    assert.ok(
      serviceSrc.includes('Teaching assistants are not permitted to modify course grade structures')
    );
    assert.ok(valSrc.includes('Duplicate component name:'));
    assert.ok(valSrc.includes('At most one component with source AUTO_QUIZ is permitted per course'));
    assert.ok(
      valSrc.includes('At most one component with source AUTO_ATTENDANCE is permitted per course')
    );
    assert.ok(valSrc.includes('cannot exceed total course points'));
    assert.ok(errSrc.includes('Duplicate value for'));
  });

  // 3. ERROR MAPPING FOR GRADE STRUCTURE
  test('Error mapping: mapGradeStructureError maps every real 409/422/403/404 backend message to i18n keys', async () => {
    const webUtilsPath = path.join(rootDir, 'artifacts/university-app/src/utils/gradebook.utils.ts');
    const webSrc = readFileSync(webUtilsPath, 'utf8');
    const transpiled = ts.transpileModule(webSrc, {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    }).outputText;
    const dataUri = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
    const { mapGradeStructureError } = await import(dataUri);

    assert.equal(typeof mapGradeStructureError, 'function');

    // 409 published grades lock
    assert.equal(
      mapGradeStructureError(
        'Cannot modify grade structure: published grades exist for this course in this term',
        409
      ),
      'gradeStructure.errors.publishedGradesExist'
    );

    // 409 past term & locked term
    assert.equal(
      mapGradeStructureError('Cannot modify grade structure: academic term is in the past', 409),
      'gradeStructure.errors.pastTerm'
    );
    assert.equal(
      mapGradeStructureError('Cannot modify grade structure: academic term is locked', 409),
      'gradeStructure.errors.lockedTerm'
    );

    // 409 draft entries invariants
    assert.equal(
      mapGradeStructureError('Cannot remove component "Midterm": grade entries exist', 409),
      'gradeStructure.errors.cannotRemoveWithEntries'
    );
    assert.equal(
      mapGradeStructureError('Cannot change source of component "Midterm": grade entries exist', 409),
      'gradeStructure.errors.cannotChangeSourceWithEntries'
    );
    assert.equal(
      mapGradeStructureError('Cannot reduce maxPoints below existing draft score 22', 409),
      'gradeStructure.errors.cannotReduceMaxPointsBelowDraft'
    );

    // 409 P2002 duplicate component name & 422 validator duplicate name
    assert.equal(
      mapGradeStructureError('Duplicate value for name. Please use another value!', 409),
      'gradeStructure.errors.duplicateComponentName'
    );
    assert.equal(
      mapGradeStructureError(
        'Duplicate component name: "Midterm". Names must be unique within course',
        422
      ),
      'gradeStructure.errors.duplicateComponentName'
    );

    // 409 transaction conflict
    assert.equal(
      mapGradeStructureError('Transaction conflict during grade structure update. Please retry.', 409),
      'gradeStructure.errors.transactionConflict'
    );

    // 403 scope & role restrictions
    assert.equal(
      mapGradeStructureError('Course is outside your administrative scope', 403),
      'gradeStructure.errors.outsideAdminScope'
    );
    assert.equal(
      mapGradeStructureError('Doctors are not permitted to modify course grade structures', 403),
      'gradeStructure.errors.forbidden'
    );
    assert.equal(
      mapGradeStructureError(
        'Teaching assistants are not permitted to modify course grade structures',
        403
      ),
      'gradeStructure.errors.forbidden'
    );

    // 422 validation errors
    assert.equal(
      mapGradeStructureError(
        'At most one component with source AUTO_QUIZ is permitted per course',
        422
      ),
      'gradeStructure.errors.duplicateAutoQuiz'
    );
    assert.equal(
      mapGradeStructureError(
        'At most one component with source AUTO_ATTENDANCE is permitted per course',
        422
      ),
      'gradeStructure.errors.duplicateAutoAttendance'
    );
    assert.equal(
      mapGradeStructureError('passMark (120) cannot exceed total course points (100)', 422),
      'gradeStructure.errors.passMarkExceedsTotal'
    );
    assert.equal(
      mapGradeStructureError('Component id 999 does not belong to this course grade structure', 422),
      'gradeStructure.errors.componentNotBelong'
    );

    // Fallback
    assert.equal(
      mapGradeStructureError('Unexpected failure', 500),
      'gradeStructure.errors.generic'
    );
  });

  // 4. LIVE TOTAL & STRUCTURE VALIDATION
  test('Validation: computeLiveTotalPoints and validateGradeStructureDraft enforce all backend rules', async () => {
    const webUtilsPath = path.join(rootDir, 'artifacts/university-app/src/utils/gradebook.utils.ts');
    const webSrc = readFileSync(webUtilsPath, 'utf8');
    const transpiled = ts.transpileModule(webSrc, {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    }).outputText;
    const dataUri = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
    const { computeLiveTotalPoints, validateGradeStructureDraft } = await import(dataUri);

    assert.equal(typeof computeLiveTotalPoints, 'function');
    assert.equal(typeof validateGradeStructureDraft, 'function');

    // Empty rows -> total 0, invalid
    assert.equal(computeLiveTotalPoints([]), 0);
    const emptyRes = validateGradeStructureDraft('', []);
    assert.equal(emptyRes.valid, false);
    assert.equal(emptyRes.formErrorKey, 'gradeStructure.validation.minOneComponent');

    // Valid structure with nullable passMark and decimal points
    const validRows = [
      { name: 'Attendance', nameAr: 'الحضور', maxPointsInput: '10.25', source: 'AUTO_ATTENDANCE' },
      { name: 'Quiz 1', nameAr: 'اختبار 1', maxPointsInput: '14.75', source: 'AUTO_QUIZ' },
      { name: 'Final Exam', nameAr: '', maxPointsInput: '75', source: 'MANUAL' },
    ];
    assert.equal(computeLiveTotalPoints(validRows), 100);
    const validRes = validateGradeStructureDraft('50', validRows);
    assert.equal(validRes.valid, true);
    assert.equal(validRes.totalPoints, 100);
    assert.equal(validRes.passMarkErrorKey, null);

    // Null/empty passMark is valid
    const nullPassRes = validateGradeStructureDraft('', validRows);
    assert.equal(nullPassRes.valid, true);
    assert.equal(nullPassRes.passMarkErrorKey, null);

    // Invalid: negative maxPoints, 3 decimals, empty name, duplicate name (case-insensitive), passMark > total
    const invalidRows = [
      { name: '', nameAr: '', maxPointsInput: '-5', source: 'MANUAL' },
      { name: 'Midterm', nameAr: '', maxPointsInput: '12.345', source: 'MANUAL' },
      { name: 'midterm', nameAr: '', maxPointsInput: '30', source: 'MANUAL' },
    ];
    const invRes = validateGradeStructureDraft('50', invalidRows);
    assert.equal(invRes.valid, false);
    assert.equal(invRes.rowErrors[0].nameErrorKey, 'gradeStructure.validation.nameRequired');
    assert.equal(invRes.rowErrors[0].maxPointsErrorKey, 'gradeStructure.validation.negativePoints');
    assert.equal(invRes.rowErrors[1].maxPointsErrorKey, 'gradeStructure.validation.maxDecimals');
    assert.equal(invRes.rowErrors[1].nameErrorKey, 'gradeStructure.validation.duplicateName');
    assert.equal(invRes.rowErrors[2].nameErrorKey, 'gradeStructure.validation.duplicateName');
    assert.equal(invRes.passMarkErrorKey, 'gradeStructure.validation.passMarkExceedsTotal');
  });

  // 5. DIRTY CHECK & PUT PAYLOAD BUILDER
  test('Payload & Dirty Check: isGradeStructureDirty and buildGradeStructurePutPayload match backend schema', async () => {
    const webUtilsPath = path.join(rootDir, 'artifacts/university-app/src/utils/gradebook.utils.ts');
    const webSrc = readFileSync(webUtilsPath, 'utf8');
    const transpiled = ts.transpileModule(webSrc, {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    }).outputText;
    const dataUri = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
    const { isGradeStructureDirty, buildGradeStructurePutPayload } = await import(dataUri);

    const original = {
      courseId: 1,
      termId: 1,
      termName: 'Fall 2026',
      totalPoints: 100,
      passMark: 50,
      isLocked: false,
      components: [
        { id: 101, name: 'Midterm', nameAr: 'ميدتيرم', maxPoints: 40, source: 'MANUAL', displayOrder: 1 },
        { id: 102, name: 'Final', nameAr: null, maxPoints: 60, source: 'MANUAL', displayOrder: 2 },
      ],
    };

    const unchangedRows = [
      { id: 101, name: 'Midterm', nameAr: 'ميدتيرم', maxPointsInput: '40', source: 'MANUAL' },
      { id: 102, name: 'Final', nameAr: '', maxPointsInput: '60', source: 'MANUAL' },
    ];
    assert.equal(isGradeStructureDirty(original, '50', unchangedRows), false);

    // Reorder makes it dirty
    const reorderedRows = [unchangedRows[1], unchangedRows[0]];
    assert.equal(isGradeStructureDirty(original, '50', reorderedRows), true);

    // Build payload preserves existing id and assigns 1-based displayOrder, omits id for new rows
    const rowsWithNew = [
      ...reorderedRows,
      { name: 'Quiz 1', nameAr: 'كويز 1', maxPointsInput: '10', source: 'AUTO_QUIZ' },
    ];
    const payload = buildGradeStructurePutPayload('55', rowsWithNew);
    assert.equal(payload.passMark, 55);
    assert.equal(payload.components.length, 3);
    assert.deepEqual(payload.components[0], {
      id: 102,
      name: 'Final',
      nameAr: null,
      maxPoints: 60,
      source: 'MANUAL',
      displayOrder: 1,
    });
    assert.deepEqual(payload.components[1], {
      id: 101,
      name: 'Midterm',
      nameAr: 'ميدتيرم',
      maxPoints: 40,
      source: 'MANUAL',
      displayOrder: 2,
    });
    assert.deepEqual(payload.components[2], {
      name: 'Quiz 1',
      nameAr: 'كويز 1',
      maxPoints: 10,
      source: 'AUTO_QUIZ',
      displayOrder: 3,
    });
    assert.equal('id' in payload.components[2], false);
  });

  // 6. CAPABILITIES & ROLE GATING
  test('Capabilities: gradeStructure.view and gradeStructure.edit role assignments and route guard', async () => {
    const capPath = path.join(rootDir, 'artifacts/university-app/src/config/capabilities.ts');
    const capSrc = readFileSync(capPath, 'utf8');
    const transpiled = ts.transpileModule(capSrc, {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    }).outputText;
    const dataUri = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
    const { hasCapability, canAccessRoute } = await import(dataUri);

    const editRoles = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'];
    for (const role of editRoles) {
      assert.equal(hasCapability(role, 'gradeStructure.edit'), true, `${role} must have gradeStructure.edit`);
      assert.equal(hasCapability(role, 'gradeStructure.view'), true, `${role} must have gradeStructure.view`);
      assert.equal(canAccessRoute(role, '/courses/1/grade-structure'), true);
    }

    const readOnlyRoles = ['DOCTOR', 'TEACHING_ASSISTANT'];
    for (const role of readOnlyRoles) {
      assert.equal(hasCapability(role, 'gradeStructure.edit'), false, `${role} must NOT have gradeStructure.edit`);
      assert.equal(hasCapability(role, 'gradeStructure.view'), true, `${role} must have gradeStructure.view`);
      assert.equal(canAccessRoute(role, '/courses/1/grade-structure'), true);
    }

    assert.equal(hasCapability('STUDENT', 'gradeStructure.edit'), false);
    assert.equal(hasCapability('STUDENT', 'gradeStructure.view'), false);
    assert.equal(canAccessRoute('STUDENT', '/courses/1/grade-structure'), false);
  });

  // 7. i18n SYMMETRY & PAGE CONSTRAINTS (NO isRTL, NO KPI HEADER, NO LETTER GRADES)
  test('i18n symmetry & UI rules: gradeStructure.* keys symmetric in ar/en, CourseGradeStructure.tsx has no isRTL ternaries', () => {
    const enPath = path.join(rootDir, 'artifacts/university-app/src/i18n/en.json');
    const arPath = path.join(rootDir, 'artifacts/university-app/src/i18n/ar.json');
    const en = JSON.parse(readFileSync(enPath, 'utf8'));
    const ar = JSON.parse(readFileSync(arPath, 'utf8'));

    assert.ok(en.gradeStructure, 'en.json must define gradeStructure namespace');
    assert.ok(ar.gradeStructure, 'ar.json must define gradeStructure namespace');

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

    const enKeys = getKeys(en.gradeStructure, 'gradeStructure');
    const arKeys = getKeys(ar.gradeStructure, 'gradeStructure');

    assert.deepEqual(
      enKeys.filter((k) => !arKeys.includes(k)),
      [],
      'All en gradeStructure keys must exist in ar.json'
    );
    assert.deepEqual(
      arKeys.filter((k) => !enKeys.includes(k)),
      [],
      'All ar gradeStructure keys must exist in en.json'
    );

    const pagePath = path.join(
      rootDir,
      'artifacts/university-app/src/pages/courses/CourseGradeStructure.tsx'
    );
    assert.ok(existsSync(pagePath), 'CourseGradeStructure.tsx must exist');
    const pageSrc = readFileSync(pagePath, 'utf8');
    assert.equal(
      pageSrc.includes('isRTL'),
      false,
      'CourseGradeStructure.tsx must not contain any isRTL ternaries or references'
    );
  });
});

