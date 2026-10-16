// Ported from react-resizable-panels (lib/utils/test/mockGetComputedStyle.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: upstream helper kept as is; import specifiers point at libs/cdk/resizable/engine (`.ts`); EventEmitter from `./events.ts` (browser).
import { EventEmitter } from "./events.ts";

const elementToStyle = new Map<Element, CSSStyleDeclaration>();

const originalGetComputedStyle = window.getComputedStyle;

let defaultStyle: CSSStyleDeclaration | undefined = undefined;

const emptyStyle = {} as CSSStyleDeclaration;

export const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export function mockGetComputedStyle() {
  window.getComputedStyle = function getComputedStyle(element: Element) {
    return new Proxy(emptyStyle, {
      get(_, name) {
        const key = name as keyof CSSStyleDeclaration;

        const mockedStyle = elementToStyle.get(element) ?? defaultStyle ?? emptyStyle;

        const actualStyle = originalGetComputedStyle(element);

        return name in mockedStyle ? mockedStyle[key] : actualStyle[key];
      },
    });
  };
}

export function setDefaultElementStyle(style: CSSStyleDeclaration) {
  defaultStyle = style;

  emitter.emit("change");
}

export function setElementStyle(element: Element, style: CSSStyleDeclaration) {
  elementToStyle.set(element, style);

  emitter.emit("change", element);
}

export function unmockGetComputedStyle() {
  window.getComputedStyle = originalGetComputedStyle;
}
