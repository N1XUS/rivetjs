// Ported from embla-carousel (packages/embla-carousel/src/components/utils.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), formatting; the DOM-free math helpers (`isNumber`,
// `mathAbs`, `mathSign`, `deltaAbs`, `factorAbs`) live in `@rivetjs/cdk/motion` (`../../motion/utils.ts`), re-exported.
import type { PointerEventType } from "./DragTracker.ts";

export { isNumber, mathAbs, mathSign, deltaAbs, factorAbs } from "../../motion/utils.ts";

export type WindowType = Window & typeof globalThis;

export function isString(subject: unknown): subject is string {
  return typeof subject === "string";
}

export function isBoolean(subject: unknown): subject is boolean {
  return typeof subject === "boolean";
}

export function isObject(subject: unknown): subject is Record<string, unknown> {
  return Object.prototype.toString.call(subject) === "[object Object]";
}

export function roundToTwoDecimals(num: number): number {
  return Math.round(num * 100) / 100;
}

export function arrayKeys<Type>(array: Type[]): number[] {
  return objectKeys(array).map(Number);
}

export function arrayLast<Type>(array: Type[]): Type {
  return array[arrayLastIndex(array)];
}

export function arrayLastIndex<Type>(array: Type[]): number {
  return Math.max(0, array.length - 1);
}

export function arrayIsLastIndex<Type>(array: Type[], index: number): boolean {
  return index === arrayLastIndex(array);
}

export function arrayFromNumber(n: number, startAt: number = 0): number[] {
  return Array.from(Array(n), (_, i) => startAt + i);
}

export function objectKeys<Type extends object>(object: Type): string[] {
  return Object.keys(object);
}

export function objectsMergeDeep(objectA: Record<string, unknown>, objectB: Record<string, unknown>): Record<string, unknown> {
  return [objectA, objectB].reduce((mergedObjects, currentObject) => {
    objectKeys(currentObject).forEach((key) => {
      const valueA = mergedObjects[key];
      const valueB = currentObject[key];
      const areObjects = isObject(valueA) && isObject(valueB);

      mergedObjects[key] = areObjects ? objectsMergeDeep(valueA, valueB) : valueB;
    });
    return mergedObjects;
  }, {});
}

export function isMouseEvent(evt: PointerEventType, ownerWindow: WindowType): evt is MouseEvent {
  return typeof ownerWindow.MouseEvent !== "undefined" && evt instanceof ownerWindow.MouseEvent;
}
