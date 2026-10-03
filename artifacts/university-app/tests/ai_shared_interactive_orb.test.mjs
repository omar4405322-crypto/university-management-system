import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('AI hero and canonical preview use one shared Interactive3DOrb component and renderer', async () => {
  const avatar = await readFile(new URL('../src/components/ai/AiAssistantAvatar.tsx', import.meta.url), 'utf8');
  const preview = await readFile(new URL('../motion-preview-3d/motion.tsx', import.meta.url), 'utf8');
  assert.match(avatar, /lazy\(\(\) => import\('\.\/interactive-orb\/Interactive3DOrb'\)\)/);
  assert.match(preview, /import Interactive3DOrb from ['"]\.\.\/src\/components\/ai\/interactive-orb\/Interactive3DOrb['"]/);
  assert.doesNotMatch(avatar, /AiHeroModel|aiOrbShaders/);
  const legacy = await readFile(new URL('../motion-preview-3d/orb.js', import.meta.url), 'utf8');
  assert.match(legacy, /export \{ createOrb \} from/);
  assert.doesNotMatch(legacy, /const fragmentShader|SphereGeometry/);
});
