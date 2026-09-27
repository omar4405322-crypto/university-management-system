import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/pages/tasks/TasksList.tsx', import.meta.url), 'utf8');

assert.match(source, /const \[searchInput, setSearchInput\] = useState\(searchParam\)/);
assert.match(source, /window\.setTimeout\(\(\) => \{[\s\S]*next\.set\('search', searchInput\)[\s\S]*\}, 300\)/);
assert.match(source, /return \(\) => window\.clearTimeout\(timeoutId\)/);
assert.match(source, /onChange=\{\(e\) => setSearchInput\(e\.target\.value\)\}/);
assert.doesNotMatch(source, /onChange=\{\(e\) => updateParam\('search', e\.target\.value\)\}/);

console.log('F3 task-search debounce regression checks passed');
