// Ported from Angular Components (src/cdk/coercion/element.ts), MIT, © Google LLC.
// Rivet: no `ElementRef` class — any `{nativeElement}` object is accepted.

/** An element or an `ElementRef`-like wrapper. */
export type ElementLike<T extends Element = HTMLElement> = T | {nativeElement: T};

/** Coerces an `ElementRef`-like or an element into an element. */
export function coerceElement<T extends Element = HTMLElement>(elementOrRef: ElementLike<T>): T {
  return elementOrRef && typeof elementOrRef === 'object' && 'nativeElement' in elementOrRef
    ? elementOrRef.nativeElement
    : (elementOrRef as T);
}
