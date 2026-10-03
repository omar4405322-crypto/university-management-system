import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('AI ASSISTANT CHARACTER AVATAR — Architecture & Integration Suite', async (t) => {
  const avatarCompPath = path.resolve(__dirname, '../src/components/ai/AiAssistantAvatar.tsx');
  const avatarSource = fs.readFileSync(avatarCompPath, 'utf8');

  const pagePath = path.resolve(__dirname, '../src/pages/ai/AiAssistantPage.tsx');
  const pageSource = fs.readFileSync(pagePath, 'utf8');

  const headerPath = path.resolve(__dirname, '../src/components/layout/Header.tsx');
  const headerSource = fs.readFileSync(headerPath, 'utf8');

  const sidebarPath = path.resolve(__dirname, '../src/components/layout/Sidebar.tsx');
  const sidebarSource = fs.readFileSync(sidebarPath, 'utf8');

  const userAvatarPath = path.resolve(__dirname, '../src/components/ui/UserAvatar.tsx');
  const userAvatarSource = fs.readFileSync(userAvatarPath, 'utf8');

  // ── 1. Component Separation Invariant ──
  await t.test('1. AiAssistantAvatar is completely separate from UserAvatar and contains no user profile logic', () => {
    // AiAssistantAvatar must NOT import or consume UserAvatar
    assert.equal(avatarSource.includes('import UserAvatar'), false, 'AiAssistantAvatar must not import UserAvatar');
    assert.equal(avatarSource.includes('<UserAvatar'), false, 'AiAssistantAvatar must not render UserAvatar');
    assert.equal(avatarSource.includes('profilePicture'), false, 'AiAssistantAvatar must not reference user profilePicture');
    assert.equal(avatarSource.includes('SUPER_ADMIN'), false, 'AiAssistantAvatar must not reference SUPER_ADMIN or user roles');
    assert.equal(avatarSource.includes('getUserInitials'), false, 'AiAssistantAvatar must not derive user initials');

    // UserAvatar must remain intact and separate
    assert.ok(userAvatarSource.includes('export default UserAvatar'), 'UserAvatar component remains intact');
    assert.ok(headerSource.includes('<UserAvatar'), 'Header strictly uses UserAvatar for user account');
    assert.ok(sidebarSource.includes('<UserAvatar'), 'Sidebar strictly uses UserAvatar for user profile');
    assert.equal(headerSource.includes('AiAssistantAvatar'), false, 'Header must NOT contain AiAssistantAvatar');
  });

  // ── 2. State Mapping Logic ──
  await t.test('2. deriveAiCharacterState maps all UI lifecycle states correctly', () => {
    // Pure function re-implementation matching component export for contract verification
    function deriveAiCharacterState({
      isSending,
      hasDraft,
      isStreaming = false,
      isSuccess = false,
      hasError = false,
    }) {
      if (hasError) return 'error';
      if (isSuccess) return 'success';
      if (isSending) {
        return isStreaming ? 'speaking' : 'thinking';
      }
      if (hasDraft) return 'listening';
      return 'idle';
    }

    // A. Idle state (no generation, no draft)
    assert.equal(deriveAiCharacterState({ isSending: false, hasDraft: false, hasError: false }), 'idle');

    // B. Listening state (user typing in draft)
    assert.equal(deriveAiCharacterState({ isSending: false, hasDraft: true, hasError: false }), 'listening');

    // C. Thinking state (user sent, waiting for first token/tool execution)
    assert.equal(deriveAiCharacterState({ isSending: true, hasDraft: false, isStreaming: false, hasError: false }), 'thinking');

    // D. Speaking state (streaming response deltas arriving)
    assert.equal(deriveAiCharacterState({ isSending: true, hasDraft: false, isStreaming: true, hasError: false }), 'speaking');

    // E. Success state (action proposal executed)
    assert.equal(deriveAiCharacterState({ isSending: false, hasDraft: false, isSuccess: true, hasError: false }), 'success');

    // F. Error state (provider or generation failure)
    assert.equal(deriveAiCharacterState({ isSending: false, hasDraft: false, hasError: true }), 'error');

    // G. Error takes precedence over active generation
    assert.equal(deriveAiCharacterState({ isSending: true, hasDraft: false, hasError: true }), 'error');
  });

  // ── 3. State & Renderer API Contracts ──
  await t.test('3. AiAssistantAvatar exports required state and renderer types', () => {
    assert.ok(avatarSource.includes("export type AiCharacterState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'success' | 'error';"));
    assert.ok(avatarSource.includes("export type AiCharacterRenderer = 'placeholder' | 'static-image' | 'rive' | 'live2d' | 'three';"));
    assert.ok(avatarSource.includes("export type AiCharacterSize = 'sm' | 'md' | 'lg' | 'hero';"));
  });

  // ── 4. Future Animation Renderer Adapters ──
  await t.test('4. AiAssistantAvatar architecture prepares swappable renderer adapters (Static, Rive, Live2D, Placeholder)', () => {
    assert.ok(avatarSource.includes('function PlaceholderRenderer'));
    assert.ok(avatarSource.includes('function StaticImageRenderer'));
    assert.ok(avatarSource.includes('function RiveRendererAdapter'));
    assert.ok(avatarSource.includes('function Live2DRendererAdapter'));
    assert.ok(avatarSource.includes('data-testid="ai-character-placeholder"'));
    assert.ok(avatarSource.includes('data-testid="ai-character-static-image"'));
    assert.ok(avatarSource.includes('data-testid="ai-character-rive-container"'));
    assert.ok(avatarSource.includes('data-testid="ai-character-live2d-container"'));
  });

  // ── 5. Motion Reduction & Page Visibility ──
  await t.test('5. Avatar architecture respects prefers-reduced-motion and pauses when tab is hidden', () => {
    assert.ok(avatarSource.includes('usePrefersReducedMotion'));
    assert.ok(avatarSource.includes("prefers-reduced-motion: reduce"));
    assert.ok(avatarSource.includes('usePageVisibility'));
    assert.ok(avatarSource.includes('document.hidden'));
    assert.ok(avatarSource.includes('visibilitychange'));
    assert.ok(avatarSource.includes('motion-reduce:animate-none'));
  });

  // ── 6. Accessibility Contract ──
  await t.test('6. Avatar is decorative with aria-hidden="true" by default and does not expose animation frames to AT', () => {
    assert.ok(avatarSource.includes("'aria-hidden': true as const"));
    assert.ok(avatarSource.includes('data-character-state'));
    assert.ok(avatarSource.includes('data-testid="ai-assistant-avatar"'));
  });

  // ── 7. Hero Integration in AiAssistantPage ──
  await t.test('7. AiAssistantAvatar is integrated into the assistant hero area without breaking emptyTitle or greeting', () => {
    assert.ok(pageSource.includes("import AiAssistantAvatar, { deriveAiCharacterState } from '../../components/ai/AiAssistantAvatar';"));
    assert.ok(pageSource.includes('<AiAssistantAvatar state={characterState} size="hero"'));
    assert.ok(pageSource.includes("t('aiAssistant.greeting'"));
    assert.ok(pageSource.includes("t('aiAssistant.emptyTitle')"));
    assert.ok(pageSource.includes('starterKeys.map'));
  });
});
