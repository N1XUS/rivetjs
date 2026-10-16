// Ported from Angular Components (src/cdk/platform/features/scrolling.ts), MIT, © Google LLC.
// Rivet: test hook `_setRtlScrollAxisType`; server → NORMAL.

/** How `scrollLeft` behaves in right-to-left scroll containers (browser-dependent). */
// (A const object instead of Angular's `enum`: Node type stripping has no enums.)
export const RtlScrollAxisType = {
  /** scrollLeft is 0 when scrolled all the way left and (scrollWidth - clientWidth) all the way right. */
  NORMAL: 0,
  /** scrollLeft is -(scrollWidth - clientWidth) all the way left and 0 all the way right. */
  NEGATED: 1,
  /** scrollLeft is (scrollWidth - clientWidth) all the way left and 0 all the way right. */
  INVERTED: 2,
} as const;
export type RtlScrollAxisType = (typeof RtlScrollAxisType)[keyof typeof RtlScrollAxisType];

let rtlScrollAxisType: RtlScrollAxisType | undefined;
let scrollBehaviorSupported: boolean | undefined;

/** Whether `element.scrollTo({behavior})` is supported (smooth scrolling). */
export function supportsScrollBehavior(): boolean {
  if (scrollBehaviorSupported == null) {
    if (typeof document !== "object" || !document || typeof Element !== "function" || !Element) return (scrollBehaviorSupported = false);
    if (document.documentElement?.style && "scrollBehavior" in document.documentElement.style) scrollBehaviorSupported = true;
    else {
      const scrollToFunction: Function | undefined = Element.prototype.scrollTo;
      // Polyfills (e.g. smoothscroll) patch scrollTo: the native one is "[native code]".
      scrollBehaviorSupported = !!scrollToFunction && !/\{\s*\[native code\]\s*\}/.test(scrollToFunction.toString());
    }
  }
  return scrollBehaviorSupported;
}

/** The RTL scrollLeft behaviour of this browser (measured once with a 1px probe). Server: NORMAL. */
export function getRtlScrollAxisType(): RtlScrollAxisType {
  if (typeof document !== "object" || !document) return RtlScrollAxisType.NORMAL;
  if (rtlScrollAxisType == null) {
    const scrollContainer = document.createElement("div");
    const containerStyle = scrollContainer.style;
    scrollContainer.dir = "rtl";
    containerStyle.width = "1px";
    containerStyle.overflow = "auto";
    containerStyle.visibility = "hidden";
    containerStyle.pointerEvents = "none";
    containerStyle.position = "absolute";
    const content = document.createElement("div");
    const contentStyle = content.style;
    contentStyle.width = "2px";
    contentStyle.height = "1px";
    scrollContainer.appendChild(content);
    document.body.appendChild(scrollContainer);
    rtlScrollAxisType = RtlScrollAxisType.NORMAL;
    // NORMAL browsers start an RTL container scrolled to the right (scrollLeft 1). Otherwise set 1:
    // past the max for NEGATED (reads back 0), valid for INVERTED.
    if (scrollContainer.scrollLeft === 0) {
      scrollContainer.scrollLeft = 1;
      rtlScrollAxisType = scrollContainer.scrollLeft === 0 ? RtlScrollAxisType.NEGATED : RtlScrollAxisType.INVERTED;
    }
    scrollContainer.remove();
  }
  return rtlScrollAxisType;
}

/** Test hook: force the RTL axis type / scroll-behavior support (`undefined` re-detects). */
export function _setRtlScrollAxisType(type: RtlScrollAxisType | undefined, behavior?: boolean): void {
  rtlScrollAxisType = type;
  scrollBehaviorSupported = behavior;
}
