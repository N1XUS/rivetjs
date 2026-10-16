// Ported from react-spectrum (packages/@react-aria/test-utils/src/utils.ts), Apache-2.0, © Adobe.
import {act} from './act.ts';
import {fireEvent} from '@testing-library/dom';
import type {UserOpts} from './types.ts';

export const DEFAULT_LONG_PRESS_TIME = 500;
function testPlatform(re: RegExp) {
  return typeof window !== 'undefined' && window.navigator != null
    ? re.test((window.navigator as any)['userAgentData']?.platform || window.navigator.platform)
    : false;
}

function cached(fn: () => boolean) {
  // Rivet: upstream caches outside NODE_ENV === 'test'. This package only runs under tests (and
  // `@rivetjs/testing/node-env` clears NODE_ENV; browser mode has no `process`), so never cache.
  return fn;
}

const isMac = cached(function () {
  return testPlatform(/^Mac/i);
});

// Rivet: upstream returns 'Alt'; user-event's keyMap has no code "Alt", so `[Alt>]` sends key
// "Unknown" with altKey=false in real browsers on macOS (upstream only runs jsdom, non-mac). 'AltLeft' is mapped.
export function getAltKey(): 'AltLeft' | 'ControlLeft' {
  return isMac() ? 'AltLeft' : 'ControlLeft';
}

export function getMetaKey(): 'MetaLeft' | 'ControlLeft' {
  return isMac() ? 'MetaLeft' : 'ControlLeft';
}

export function formatTargetNode(value: number | string | HTMLElement): string {
  if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) {
    return (value.cloneNode(false) as HTMLElement).outerHTML;
  }
  return String(value);
}

/**
 * Simulates a "long press" event on a element.
 *
 * @param opts - Options for the long press.
 * @param opts.element - Element to long press.
 * @param opts.advanceTimer - Function that when called advances the timers in your test suite by a
 *   specific amount of time(ms).
 * @param opts.pointeropts - Options to pass to the simulated event. Defaults to mouse. See
 *   https://testing-library.com/docs/dom-testing-library/api-events/#fireevent for more info.
 */
export async function triggerLongPress(opts: {
  element: HTMLElement;
  advanceTimer: (time: number) => unknown | Promise<unknown>;
  pointerOpts?: Record<string, any>;
}): Promise<void> {
  let {element, advanceTimer, pointerOpts = {}} = opts;
  let pointerType = pointerOpts.pointerType ?? 'mouse';
  let shouldFireCompatibilityEvents = false;
  act(() => {
    shouldFireCompatibilityEvents = fireEvent.pointerDown(element, {pointerType, ...pointerOpts});
  });
  let shouldFocus = true;
  if (shouldFireCompatibilityEvents) {
    if (pointerType === 'touch') {
      act(() => {
        shouldFocus = shouldFireCompatibilityEvents = fireEvent.touchStart(element, {
          targetTouches: [
            {
              identifier: pointerOpts.pointerId,
              clientX: pointerOpts.clientX,
              clientY: pointerOpts.clientY
            }
          ]
        });
      });
    } else if (pointerType === 'mouse') {
      act(() => {
        shouldFocus = fireEvent.mouseDown(element, pointerOpts);
      });
      if (shouldFocus) {
        act(() => element.focus());
      }
    }
  }
  await act(async () => await advanceTimer(DEFAULT_LONG_PRESS_TIME));
  act(() => {
    fireEvent.pointerUp(element, {pointerType, ...pointerOpts});
  });
  if (shouldFireCompatibilityEvents) {
    if (pointerType === 'touch') {
      act(() => {
        shouldFocus = fireEvent.touchEnd(element, {
          targetTouches: [
            {
              identifier: pointerOpts.pointerId,
              clientX: pointerOpts.clientX,
              clientY: pointerOpts.clientY
            }
          ]
        });
        shouldFocus = fireEvent.mouseDown(element, pointerOpts);
      });
      if (shouldFocus) {
        act(() => element.focus());
      }
      act(() => {
        fireEvent.mouseUp(element, pointerOpts);
      });
    } else if (pointerType === 'mouse') {
      act(() => {
        fireEvent.mouseUp(element, pointerOpts);
      });
    }
  }
  act(() => {
    fireEvent.click(element, {detail: 1, ...pointerOpts});
  });
}

// Docs cannot handle the types that userEvent actually declares, so hopefully this sub set is okay
export async function pressElement(
  user: {
    click: (element: Element) => Promise<void>;
    keyboard: (keys: string) => Promise<void>;
    pointer: (opts: {target: Element; keys: string; coords?: any}) => Promise<void>;
  },
  element: HTMLElement,
  interactionType: UserOpts['interactionType']
): Promise<void> {
  if (interactionType === 'mouse') {
    // Add coords with pressure so this isn't detected as a virtual click
    await user.pointer({target: element, keys: '[MouseLeft]'});
  } else if (interactionType === 'keyboard') {
    act(() => element.focus());
    await user.keyboard('[Space]');
  } else if (interactionType === 'touch') {
    await user.pointer({target: element, keys: '[TouchA]'});
  }
}
