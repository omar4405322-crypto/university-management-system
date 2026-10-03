import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('P8-I18N: Arabic and English dictionaries have identical nonempty translation keys', async () => {
  const dictionaries = await Promise.all(['en', 'ar'].map(async (locale) => JSON.parse(await readFile(new URL(`../src/i18n/${locale}.json`, import.meta.url), 'utf8'))));
  function flatten(value, prefix = '') {
    return Object.entries(value).flatMap(([key, child]) => {
      const name = `${prefix}${key}`;
      if (child && typeof child === 'object') return flatten(child, `${name}.`);
      assert.ok(typeof child === 'string' && child.trim(), `Translation ${name} must be a nonempty string`);
      return [name];
    });
  }
  assert.deepEqual(flatten(dictionaries[1]).sort(), flatten(dictionaries[0]).sort(), 'Arabic and English translation key sets must match');
});

test('P4-02: All required application roles exist in both Arabic and English dictionaries', async () => {
  const [enRaw, arRaw] = await Promise.all([
    readFile(new URL('../src/i18n/en.json', import.meta.url), 'utf8'),
    readFile(new URL('../src/i18n/ar.json', import.meta.url), 'utf8'),
  ]);

  const en = JSON.parse(enRaw);
  const ar = JSON.parse(arRaw);

  const requiredRoles = [
    'ADMIN',
    'SUPER_ADMIN',
    'COLLEGE_ADMIN',
    'DEPARTMENT_ADMIN',
    'DOCTOR',
    'TEACHING_ASSISTANT',
    'STUDENT',
  ];

  for (const role of requiredRoles) {
    assert.ok(
      en.roles && typeof en.roles[role] === 'string' && en.roles[role].trim().length > 0,
      `en.json must contain translation for role "${role}"`
    );
    assert.ok(
      ar.roles && typeof ar.roles[role] === 'string' && ar.roles[role].trim().length > 0,
      `ar.json must contain translation for role "${role}"`
    );
    assert.notEqual(
      ar.roles[role],
      role,
      `Arabic translation for role "${role}" must not be the raw enum`
    );
  }
});

test('P4-02: Verified translation keys exist in both locales', async () => {
  const [enRaw, arRaw] = await Promise.all([
    readFile(new URL('../src/i18n/en.json', import.meta.url), 'utf8'),
    readFile(new URL('../src/i18n/ar.json', import.meta.url), 'utf8'),
  ]);

  const en = JSON.parse(enRaw);
  const ar = JSON.parse(arRaw);

  // Letter Grade
  assert.equal(en.transcript?.letterGrade, 'Letter Grade');
  assert.equal(ar.transcript?.letterGrade, 'التقدير الحرفي');

  // No students enrolled
  assert.equal(en.courses?.noStudentsEnrolled, 'No students enrolled yet.');
  assert.equal(ar.courses?.noStudentsEnrolled, 'لا يوجد طلاب مسجلون حتى الآن.');

  // Department no students
  assert.equal(en.departments?.noStudents, 'No students enrolled in this department.');
  assert.equal(ar.departments?.noStudents, 'لا يوجد طلاب مسجلون في هذا القسم.');

  // Five minutes left warning
  assert.equal(en.quizzes?.fiveMinutesLeft, 'Only 5 minutes left!');
  assert.equal(ar.quizzes?.fiveMinutesLeft, 'متبقي 5 دقائق فقط!');
});

test('P4-02: Header component consumes translated role keys instead of raw enum replacement', async () => {
  const headerSource = await readFile(
    new URL('../src/components/layout/Header.tsx', import.meta.url),
    'utf8'
  );

  assert.match(
    headerSource,
    /t\(`roles\.\$\{user\.role\}`/u,
    'Header must look up roles using translation dictionary'
  );
  assert.doesNotMatch(
    headerSource,
    /<span[^>]*>\s*\{user\?\.role\?\.replace\('_',\s*' '\)\}\s*<\/span>/,
    'Header must not expose unlocalized role enum replacement in UI'
  );
});

test('P4-02: Grade components consume transcript.letterGrade translation key', async () => {
  const [statsSource, recordSource] = await Promise.all([
    readFile(new URL('../src/pages/statistics/StudentStatisticsPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/records/StudentRecord.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(
    statsSource,
    /t\(["']transcript\.letterGrade["']/u,
    'StudentStatisticsPage must consume transcript.letterGrade translation key'
  );
  assert.match(
    recordSource,
    /t\(["']transcript\.letterGrade["']/u,
    'StudentRecord must consume transcript.letterGrade translation key'
  );
});

test('P4-02: Empty enrollment and department state components consume localized keys', async () => {
  const [rosterSource, deptSource] = await Promise.all([
    readFile(new URL('../src/pages/courses/components/CourseRosterTab.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/departments/DepartmentDetails.tsx', import.meta.url), 'utf8'),
  ]);

  // CourseRosterTab consumes courses.noStudentsEnrolled
  assert.match(
    rosterSource,
    /t\(["']courses\.noStudentsEnrolled["']/u,
    'CourseRosterTab must consume courses.noStudentsEnrolled translation key'
  );

  // DepartmentDetails consumes departments.noStudents
  assert.match(
    deptSource,
    /t\(\s*["']departments\.noStudents["']/u,
    'DepartmentDetails must consume departments.noStudents translation key'
  );
});

test('P4-02: TakeQuiz time critical banner uses translation instead of unlocalized string', async () => {
  const takeQuizSource = await readFile(
    new URL('../src/pages/quizzes/TakeQuiz.tsx', import.meta.url),
    'utf8'
  );

  assert.match(
    takeQuizSource,
    /t\('quizzes\.fiveMinutesLeft'/u,
    'TakeQuiz must translate time critical warning banner'
  );
  assert.doesNotMatch(
    takeQuizSource,
    /\?\?\?\? 5 \?\?\?\?\? \?\?\?!/,
    'TakeQuiz must not contain corrupted non-ASCII text'
  );
});

test('P4-02: Document language and direction configuration remains intact', async () => {
  const [indexHtml, langContext] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/context/LanguageContext.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(
    indexHtml,
    /root\.lang\s*=\s*isAr\s*\?\s*['"]ar['"]\s*:\s*['"]en['"]/u,
    'index.html head script must set root.lang dynamically with "ar" default'
  );
  assert.match(
    indexHtml,
    /root\.dir\s*=\s*isAr\s*\?\s*['"]rtl['"]\s*:\s*['"]ltr['"]/u,
    'index.html head script must set root.dir dynamically with "rtl" default'
  );
  assert.match(
    langContext,
    /document\.documentElement\.lang\s*=\s*next/u,
    'LanguageContext must set documentElement.lang dynamically'
  );
  assert.match(
    langContext,
    /document\.documentElement\.dir\s*=\s*next\s*===\s*['"]ar['"]\s*\?\s*['"]rtl['"]\s*:\s*['"]ltr['"]/u,
    'LanguageContext must set documentElement.dir dynamically'
  );
});
