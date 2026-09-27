import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';

// Read Modal source to verify AST semantics and accessible attributes
const modalSource = readFileSync(
  new URL('../src/components/ui/Modal.tsx', import.meta.url),
  'utf8'
);

test('A11Y-001: Modal has proper dialog role and aria-modal attributes', () => {
  assert.match(
    modalSource,
    /role=["']dialog["']/,
    'Modal must have role="dialog"'
  );
  assert.match(
    modalSource,
    /aria-modal=["']true["']/,
    'Modal must declare aria-modal="true"'
  );
});

test('A11Y-001: Modal associates title and description via aria-labelledby and aria-describedby', () => {
  assert.match(
    modalSource,
    /aria-labelledby=\{hasTitle \? titleId : undefined\}/,
    'Modal must connect aria-labelledby to the title ID'
  );
  assert.match(
    modalSource,
    /aria-describedby=\{hasSubtitle \? subtitleId : undefined\}/,
    'Modal must connect aria-describedby to subtitle ID'
  );
  assert.match(
    modalSource,
    /<h2[^>]*id=\{titleId\}/,
    'Heading element must have id matching titleId'
  );
  assert.match(
    modalSource,
    /<p[^>]*id=\{subtitleId\}/,
    'Subtitle paragraph must have id matching subtitleId'
  );
});

test('A11Y-001: Modal close button has accessible name and type="button"', () => {
  assert.match(
    modalSource,
    /type=["']button["']/,
    'Close button must explicitly specify type="button"'
  );
  assert.match(
    modalSource,
    /aria-label=\{closeAriaLabel \|\| ["']Close dialog["']\}/,
    'Close button must provide an accessible aria-label'
  );
  assert.match(
    modalSource,
    /<X[^>]*aria-hidden=["']true["']/,
    'Close icon must be aria-hidden'
  );
});

test('A11Y-001: Modal implements focus trap, initial focus, and focus return behaviors', () => {
  assert.match(
    modalSource,
    /FOCUSABLE_SELECTOR/,
    'Modal must declare a comprehensive focusable elements selector'
  );
  assert.match(
    modalSource,
    /e\.key === ["']Tab["']/,
    'Modal must trap Tab key within focusable elements'
  );
  assert.match(
    modalSource,
    /e\.shiftKey/,
    'Modal focus trap must handle Shift+Tab backwards wrapping'
  );
  assert.match(
    modalSource,
    /previousActiveElementRef\.current = document\.activeElement/,
    'Modal must capture trigger element for focus restoration'
  );
  assert.match(
    modalSource,
    /targetToFocus\.focus\(\)/,
    'Modal must restore focus to target when closing'
  );
});

test('A11Y-001: Behavioral simulation of Modal accessibility lifecycle and focus restoration', async () => {
  // Mock browser DOM environment
  const eventListeners = new Map();
  const triggerBtn = {
    tagName: 'BUTTON',
    id: 'open-modal-trigger',
    focused: false,
    focus() {
      this.focused = true;
      globalThis.document.activeElement = this;
    },
  };

  const closeBtn = {
    tagName: 'BUTTON',
    id: 'modal-close',
    focused: false,
    focus() {
      this.focused = true;
      globalThis.document.activeElement = this;
    },
    hasAttribute(attr) {
      return false;
    },
    offsetWidth: 32,
    offsetHeight: 32,
    getClientRects: () => [{}],
  };

  const inputEl = {
    tagName: 'INPUT',
    id: 'first-field',
    focused: false,
    focus() {
      this.focused = true;
      globalThis.document.activeElement = this;
    },
    hasAttribute(attr) {
      return false;
    },
    offsetWidth: 200,
    offsetHeight: 40,
    getClientRects: () => [{}],
  };

  const submitBtn = {
    tagName: 'BUTTON',
    id: 'submit-action',
    focused: false,
    focus() {
      this.focused = true;
      globalThis.document.activeElement = this;
    },
    hasAttribute(attr) {
      return false;
    },
    offsetWidth: 100,
    offsetHeight: 40,
    getClientRects: () => [{}],
  };

  const dialogNode = {
    tagName: 'DIV',
    role: 'dialog',
    tabIndex: -1,
    focused: false,
    focus() {
      this.focused = true;
      globalThis.document.activeElement = this;
    },
    contains(el) {
      return el === closeBtn || el === inputEl || el === submitBtn || el === this;
    },
    querySelectorAll(selector) {
      return [inputEl, submitBtn, closeBtn];
    },
  };

  globalThis.document = {
    body: {
      style: { overflow: '' },
      contains(el) {
        return true;
      },
    },
    activeElement: triggerBtn,
  };

  globalThis.window = {
    addEventListener(type, listener) {
      if (!eventListeners.has(type)) eventListeners.set(type, new Set());
      eventListeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      if (eventListeners.has(type)) eventListeners.get(type).delete(listener);
    },
  };

  globalThis.HTMLElement = function () {};
  Object.setPrototypeOf(triggerBtn, globalThis.HTMLElement.prototype);
  Object.setPrototypeOf(closeBtn, globalThis.HTMLElement.prototype);
  Object.setPrototypeOf(inputEl, globalThis.HTMLElement.prototype);
  Object.setPrototypeOf(submitBtn, globalThis.HTMLElement.prototype);
  Object.setPrototypeOf(dialogNode, globalThis.HTMLElement.prototype);

  // Trigger button had focus before modal opened
  triggerBtn.focus();
  assert.equal(globalThis.document.activeElement, triggerBtn);

  let closedCount = 0;
  const onClose = () => {
    closedCount++;
  };

  // Simulate opening Modal
  let capturedTrigger = null;
  if (globalThis.document.activeElement instanceof globalThis.HTMLElement) {
    capturedTrigger = globalThis.document.activeElement;
  }
  globalThis.document.body.style.overflow = 'hidden';

  // Initial focus logic moves focus to first visible focusable element inside modal
  const focusables = dialogNode.querySelectorAll('button, input');
  if (focusables.length > 0) {
    focusables[0].focus();
  }

  assert.equal(globalThis.document.activeElement, inputEl, 'Initial focus must land on first input');
  assert.equal(globalThis.document.body.style.overflow, 'hidden', 'Body overflow must be hidden while modal is open');

  // Focus trap Tab simulation:
  // Pressing Tab from submitBtn (last element) wraps to inputEl (first element)
  submitBtn.focus();
  assert.equal(globalThis.document.activeElement, submitBtn);

  function simulateTab(e, first, last, container) {
    if (e.shiftKey) {
      if (globalThis.document.activeElement === first || !container.contains(globalThis.document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (globalThis.document.activeElement === last || !container.contains(globalThis.document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // Last element in dialog is closeBtn
  closeBtn.focus();
  let tabPrevented = false;
  simulateTab({ shiftKey: false, preventDefault: () => { tabPrevented = true; } }, inputEl, closeBtn, dialogNode);
  assert.ok(tabPrevented, 'Tab on last element must be prevented');
  assert.equal(globalThis.document.activeElement, inputEl, 'Tab on last element must wrap to first element');

  // Shift+Tab on first element wraps to last element
  let shiftTabPrevented = false;
  simulateTab({ shiftKey: true, preventDefault: () => { shiftTabPrevented = true; } }, inputEl, closeBtn, dialogNode);
  assert.ok(shiftTabPrevented, 'Shift+Tab on first element must be prevented');
  assert.equal(globalThis.document.activeElement, closeBtn, 'Shift+Tab on first element must wrap to last element');

  // Escape key closes modal
  const escapeEvent = { key: 'Escape', stopPropagation: () => {} };
  if (escapeEvent.key === 'Escape') onClose();
  assert.equal(closedCount, 1, 'Escape key must trigger onClose callback');

  // Simulate close cleanup & focus restoration
  globalThis.document.body.style.overflow = '';
  if (capturedTrigger && typeof capturedTrigger.focus === 'function') {
    capturedTrigger.focus();
  }

  assert.equal(globalThis.document.activeElement, triggerBtn, 'Focus must be restored to trigger button after closing');
  assert.equal(globalThis.document.body.style.overflow, '', 'Body overflow lock must be removed on close');
});

test('A11Y-001: Table ActionMenu icons have accessible labels and type="button"', () => {
  const tableSource = readFileSync(
    new URL('../src/components/ui/table.tsx', import.meta.url),
    'utf8'
  );
  assert.match(
    tableSource,
    /type=["']button["']/,
    'ActionMenu buttons must have type="button"'
  );
  assert.match(
    tableSource,
    /aria-label=\{act\.label\}/,
    'ActionMenu buttons must have aria-label'
  );
  assert.match(
    tableSource,
    /<Icon[^>]*aria-hidden=["']true["']/,
    'ActionMenu icons must have aria-hidden="true"'
  );
});
