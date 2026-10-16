// Ported from react-spectrum (packages/@react-aria/test-utils/src/testSetup.ts), Apache-2.0, © Adobe.
import {afterAll, beforeAll} from 'vitest';

// Rivet: `globalThis` for upstream's `global` (Node / jsdom only), so the helpers also run in Vitest browser mode.

/**
 * Enables reading pageX/pageY from fireEvent.mouse*(..., {pageX: ..., pageY: ...}).
 */
export function installMouseEvent(): void {
  let oldMouseEvent = MouseEvent;
  beforeAll(() => {
    globalThis.MouseEvent = class FakeMouseEvent extends MouseEvent {
      _init: {pageX: number; pageY: number};
      constructor(name: string, init: any) {
        super(name, init);
        this._init = init;
      }
      override get pageX() {
        return this._init.pageX;
      }
      override get pageY() {
        return this._init.pageY;
      }
    };
  });
  afterAll(() => {
    globalThis.MouseEvent = oldMouseEvent;
  });
}

export function definePointerEvent(): void {
  // @ts-ignore
  globalThis.PointerEvent = class FakePointerEvent extends MouseEvent {
    _init: {
      pageX: number;
      pageY: number;
      pointerType: string;
      pointerId: number;
      width: number;
      height: number;
    };
    constructor(name: string, init: any) {
      super(name, init);
      this._init = init;
    }
    get pointerType() {
      return this._init.pointerType ?? 'mouse';
    }
    get pointerId() {
      return this._init.pointerId;
    }
    override get pageX() {
      return this._init.pageX;
    }
    override get pageY() {
      return this._init.pageY;
    }
    get width() {
      return this._init.width;
    }
    get height() {
      return this._init.height;
    }
  };
}

export function installPointerEvent(): void {
  // Rivet: save / restore the environment's own PointerEvent (upstream deletes it, which removes
  // Chromium's native constructor for every later suite in the same browser context).
  let oldPointerEvent: typeof globalThis.PointerEvent | undefined;
  let hadPointerEvent = false;
  beforeAll(() => {
    hadPointerEvent = Object.prototype.hasOwnProperty.call(globalThis, 'PointerEvent');
    oldPointerEvent = globalThis.PointerEvent;
    definePointerEvent();
  });
  afterAll(() => {
    if (hadPointerEvent) {
      globalThis.PointerEvent = oldPointerEvent!;
    } else {
      // @ts-ignore
      delete globalThis.PointerEvent;
    }
  });
}
