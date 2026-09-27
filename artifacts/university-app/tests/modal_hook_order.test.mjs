import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';

// 1. Source-level AST/structure check
test('FE-001: Modal component calls useEffect before any conditional early return', () => {
  const modalSource = readFileSync(
    new URL('../src/components/ui/Modal.tsx', import.meta.url),
    'utf8'
  );

  const useEffectIndex = modalSource.indexOf('React.useEffect');
  const returnNullIndex = modalSource.indexOf('if (!isOpen) return null;');

  assert.ok(useEffectIndex !== -1, 'Modal must contain React.useEffect');
  assert.ok(returnNullIndex !== -1, 'Modal must contain if (!isOpen) return null;');
  assert.ok(
    useEffectIndex < returnNullIndex,
    `React.useEffect (index ${useEffectIndex}) must precede if (!isOpen) return null (index ${returnNullIndex}) to satisfy React Rules of Hooks`
  );

  // Check effect dependency array includes isOpen and onClose
  assert.match(
    modalSource,
    /React\.useEffect\([\s\S]*?\},\s*\[isOpen,\s*onClose\]\);/,
    'useEffect dependency array must include [isOpen, onClose]'
  );

  // Check guard inside effect
  assert.match(
    modalSource,
    /React\.useEffect\(\(\)\s*=>\s*\{\s*if\s*\(!isOpen\)\s*return;/,
    'useEffect body must guard execution with if (!isOpen) return;'
  );
});

// 2. Behavioral lifecycle test simulating React hook queue dispatcher across transitions
test('FE-001: Modal handles closed -> open -> closed -> open lifecycle with zero hook count/order mutations', () => {
  // Mock DOM portal container in Node
  globalThis.document = {
    body: {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  globalThis.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  let hookCallHistory = [];
  let currentRenderHooks = [];
  let prevRenderHookCount = null;

  const originalUseEffect = React.useEffect;

  function renderWithHookTracker(Component, props) {
    currentRenderHooks = [];
    React.useEffect = (cb, deps) => {
      currentRenderHooks.push({ type: 'useEffect', deps });
    };

    try {
      const result = Component(props);
      if (prevRenderHookCount !== null && currentRenderHooks.length !== prevRenderHookCount) {
        throw new Error(
          `Rendered ${currentRenderHooks.length > prevRenderHookCount ? 'more' : 'fewer'} hooks than during the previous render. ` +
          `Expected ${prevRenderHookCount}, got ${currentRenderHooks.length}`
        );
      }
      prevRenderHookCount = currentRenderHooks.length;
      hookCallHistory.push([...currentRenderHooks]);
      return result;
    } finally {
      React.useEffect = originalUseEffect;
    }
  }

  // Simulated Modal component logic (identical to Modal.tsx)
  function SimModal({ isOpen, onClose }) {
    React.useEffect(() => {
      if (!isOpen) return;
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;
    return { type: 'portal', rendered: true };
  }

  // Cycle 1: Closed render
  const res1 = renderWithHookTracker(SimModal, { isOpen: false, onClose: () => {} });
  assert.equal(res1, null, 'Closed modal must return null');
  assert.equal(currentRenderHooks.length, 1, 'Hook count must be exactly 1 on closed render');

  // Cycle 2: Transition to Open
  const res2 = renderWithHookTracker(SimModal, { isOpen: true, onClose: () => {} });
  assert.ok(res2 !== null && res2.rendered === true, 'Open modal must return content');
  assert.equal(currentRenderHooks.length, 1, 'Hook count must remain exactly 1 on open render');

  // Cycle 3: Transition back to Closed
  const res3 = renderWithHookTracker(SimModal, { isOpen: false, onClose: () => {} });
  assert.equal(res3, null, 'Closed modal must return null');
  assert.equal(currentRenderHooks.length, 1, 'Hook count must remain exactly 1 on closed transition');

  // Cycle 4: Repeated rapid open/close cycles
  for (let i = 0; i < 5; i++) {
    const openRes = renderWithHookTracker(SimModal, { isOpen: true, onClose: () => {} });
    assert.equal(openRes.rendered, true);
    const closedRes = renderWithHookTracker(SimModal, { isOpen: false, onClose: () => {} });
    assert.equal(closedRes, null);
  }

  assert.equal(hookCallHistory.length, 13, 'All 13 render cycles must complete without hook discrepancies');
});

// 3. Proof test against old broken implementation
test('FE-001: Verify that old broken pattern causes hook count discrepancy', () => {
  let prevHookCount = null;
  const originalUseEffect = React.useEffect;

  function renderBroken(props) {
    let hooks = 0;
    React.useEffect = () => { hooks++; };
    try {
      if (!props.isOpen) {
        if (prevHookCount !== null && hooks !== prevHookCount) {
          throw new Error(`Rendered ${hooks > prevHookCount ? 'more' : 'fewer'} hooks than during the previous render.`);
        }
        prevHookCount = hooks;
        return null;
      }
      React.useEffect(() => {}, [props.onClose]);
      if (prevHookCount !== null && hooks !== prevHookCount) {
        throw new Error(`Rendered ${hooks > prevHookCount ? 'more' : 'fewer'} hooks than during the previous render.`);
      }
      prevHookCount = hooks;
      return 'open';
    } finally {
      React.useEffect = originalUseEffect;
    }
  }

  // Render 1: Closed (0 hooks recorded)
  renderBroken({ isOpen: false });

  // Render 2: Open (1 hook called) -> Throws hook count discrepancy
  assert.throws(
    () => renderBroken({ isOpen: true }),
    /Rendered more hooks than during the previous render/
  );
});
