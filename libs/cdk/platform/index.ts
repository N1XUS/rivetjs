// Platform and feature detection.
// Ported from angular/components src/cdk/platform (MIT, © Google LLC) and react-spectrum
// packages/react-aria/src/utils/{platform,isVirtualEvent}.ts + shadowdom/DOMFunctions.ts (Apache-2.0, © Adobe).
//
// Server: the Rivet-specific probes (`supports`, `isMac`, …) return `undefined` — never branch markup
// on the user agent (HTML is cached and shared); Angular's `getPlatform()` flags are `false` there,
// as in the original. Browser: lazy (nothing runs at import), memoized where the original memoizes.

/** Browser features with a progressive / fallback path in cdk and aria. */
export type Feature =
  | "field-sizing" // field-sizing: content
  | "base-select"; // customizable <select> (appearance: base-select)

const memo: Partial<Record<Feature, boolean>> = {};

const css = (declaration: string): boolean => typeof CSS !== "undefined" && CSS.supports(declaration);
const detect: Record<Feature, () => boolean> = {
  "field-sizing": () => css("field-sizing: content"),
  "base-select": () => css("appearance: base-select"),
};

/** Whether the browser supports `feature`; `undefined` on the server. */
export function supports(feature: Feature): boolean | undefined {
  if (typeof document === "undefined" && !(feature in memo)) return undefined;
  return (memo[feature] ??= detect[feature]());
}

/** Test hook: force a feature on / off (`undefined` re-detects). */
export function _setSupports(feature: Feature, value: boolean | undefined): void {
  if (value === undefined) delete memo[feature];
  else memo[feature] = value;
}

// --- react-aria platform checks -------------------------------------------------------------------

type UAData = { platform?: string; brands?: { brand: string; version: string }[] };
const nav = (): (Navigator & { userAgentData?: UAData }) | undefined =>
  // `document`, not `navigator`: Node has a global `navigator` too.
  typeof document === "undefined" ? undefined : navigator;

/** react-aria `testPlatform`: `userAgentData.platform`, else `navigator.platform`. */
const testPlatform = (re: RegExp): boolean | undefined => {
  const n = nav();
  return n === undefined ? undefined : re.test(n.userAgentData?.platform || n.platform || "");
};
/** react-aria `testUserAgent`: any `userAgentData` brand, else `navigator.userAgent`. */
const testUserAgent = (re: RegExp): boolean | undefined => {
  const n = nav();
  if (n === undefined) return undefined;
  const brands = n.userAgentData?.brands;
  return (Array.isArray(brands) && brands.some((brand) => re.test(brand.brand))) || re.test(n.userAgent);
};

/** macOS. Server: undefined. */
export const isMac = (): boolean | undefined => testPlatform(/^Mac/i);
/** iPhone. */
export const isIPhone = (): boolean | undefined => testPlatform(/^iPhone/i);
/** iPad, incl. iPadOS 13+ reporting as Mac (told apart by touch support). */
export const isIPad = (): boolean | undefined => {
  const ipad = testPlatform(/^iPad/i);
  if (ipad === undefined) return undefined;
  return ipad || (!!isMac() && navigator.maxTouchPoints > 1);
};
/** iPhone / iPad. */
export const isIOS = (): boolean | undefined => {
  const iphone = isIPhone();
  return iphone === undefined ? undefined : iphone || !!isIPad();
};
/** macOS or iOS. */
export const isAppleDevice = (): boolean | undefined => {
  const mac = isMac();
  return mac === undefined ? undefined : mac || !!isIOS();
};
/** Chrome (incl. Chrome on iOS, `CriOS`). */
export const isChrome = (): boolean | undefined => testUserAgent(/Chrome|CriOS|CrMo/i);
/** WebKit engine: every iOS browser, or AppleWebKit without Chrome. */
export const isWebKit = (): boolean | undefined => {
  const webkit = testUserAgent(/AppleWebKit/i);
  return webkit === undefined ? undefined : webkit && (!!isIOS() || !isChrome());
};
export const isFirefox = (): boolean | undefined => testUserAgent(/(Firefox|FxiOS)/i);
/** Safari: WebKit, not Chrome or Firefox. */
export const isSafari = (): boolean | undefined => {
  const webkit = isWebKit();
  return webkit === undefined ? undefined : webkit && !isChrome() && !isFirefox();
};
export const isAndroid = (): boolean | undefined => testUserAgent(/Android/i);
/** The platform's "command" modifier: Meta on Apple platforms, else Control. */
export const isCtrlKeyPressed = (event: { metaKey: boolean; ctrlKey: boolean }): boolean => (isMac() ? event.metaKey : event.ctrlKey);

/**
 * A "virtual" click: produced by a keyboard, assistive technology or `element.click()` rather than a
 * pointer (JAWS/NVDA + Firefox: empty `pointerType`; Android TalkBack: `buttons === 1`; else `detail === 0`).
 */
export function isVirtualClick(event: MouseEvent | PointerEvent): boolean {
  if ((event as PointerEvent).pointerType === "" && event.isTrusted) return true;
  if (isAndroid() && (event as PointerEvent).pointerType) return event.type === "click" && event.buttons === 1;
  return event.detail === 0 && !(event as PointerEvent).pointerType;
}

/** A pointer event from a screen reader (zero-size pointer; TalkBack's 1×1 mouse with no pressure). */
export function isVirtualPointerEvent(event: PointerEvent): boolean {
  return (
    (!isAndroid() && event.width === 0 && event.height === 0) ||
    (!!isAndroid() && event.width === 1 && event.height === 1 && event.pressure === 0 && event.detail === 0 && event.pointerType === "mouse")
  );
}

// --- Angular CDK Platform -------------------------------------------------------------------------

/** Angular CDK `Platform`: engine / browser flags (all `false` on the server, `isBrowser` false). */
export interface Platform {
  /** Whether the code runs in a browser. */
  readonly isBrowser: boolean;
  /** Microsoft Edge (EdgeHTML). */
  readonly EDGE: boolean;
  /** Microsoft Trident. */
  readonly TRIDENT: boolean;
  /** Blink. */
  readonly BLINK: boolean;
  /** WebKit (standalone: not Blink, EdgeHTML or Trident). */
  readonly WEBKIT: boolean;
  /** Apple iOS. */
  readonly IOS: boolean;
  /** Firefox. */
  readonly FIREFOX: boolean;
  /** Android. */
  readonly ANDROID: boolean;
  /** Safari. */
  readonly SAFARI: boolean;
}

let platformMemo: Platform | undefined;

/** Compute the `Platform` flags for a user agent (pure; `getPlatform()` uses the browser's). */
export function detectPlatform(env: {
  isBrowser: boolean;
  userAgent?: string;
  chrome?: boolean;
  v8BreakIterator?: boolean;
  hasCSS?: boolean;
  msStream?: boolean;
}): Platform {
  const ua = env.userAgent ?? "";
  const isBrowser = env.isBrowser;
  const EDGE = isBrowser && /(edge)/i.test(ua);
  const TRIDENT = isBrowser && /(msie|trident)/i.test(ua);
  // EdgeHTML and Trident mock Blink specific things and need to be excluded from this check.
  const BLINK = isBrowser && !!(env.chrome || env.v8BreakIterator) && !!env.hasCSS && !EDGE && !TRIDENT;
  // Webkit is part of the userAgent in EdgeHTML, Blink and Trident: it must run standalone.
  const WEBKIT = isBrowser && /AppleWebKit/i.test(ua) && !BLINK && !EDGE && !TRIDENT;
  const IOS = isBrowser && /iPad|iPhone|iPod/.test(ua) && !env.msStream;
  const FIREFOX = isBrowser && /(firefox|minefield)/i.test(ua);
  // Trident on mobile adds the android platform to the userAgent to trick detections.
  const ANDROID = isBrowser && /android/i.test(ua) && !TRIDENT;
  // Every Safari browser should also use WebKit as its layout engine.
  const SAFARI = isBrowser && /safari/i.test(ua) && WEBKIT;
  return { isBrowser, EDGE, TRIDENT, BLINK, WEBKIT, IOS, FIREFOX, ANDROID, SAFARI };
}

/** The current platform (Angular CDK `inject(Platform)`), memoized in the browser. */
export function getPlatform(): Platform {
  if (typeof document !== "object" || !document) return detectPlatform({ isBrowser: false });
  if (platformMemo) return platformMemo;
  let v8BreakIterator = false;
  try {
    v8BreakIterator = typeof Intl !== "undefined" && !!(Intl as unknown as { v8BreakIterator?: unknown }).v8BreakIterator;
  } catch {}
  return (platformMemo = detectPlatform({
    isBrowser: true,
    userAgent: navigator.userAgent,
    chrome: !!(window as unknown as { chrome?: unknown }).chrome,
    v8BreakIterator,
    hasCSS: typeof CSS !== "undefined",
    msStream: "MSStream" in window,
  }));
}

// --- features: passive listeners, scroll behaviour, RTL scroll axis, input types ------------------

let passive: boolean | undefined;

/** Whether the browser supports passive event listeners (always true in Baseline browsers). */
export function supportsPassiveEventListeners(): boolean {
  if (passive == null && typeof window !== "undefined") {
    try {
      window.addEventListener("test", null as unknown as EventListener, Object.defineProperty({}, "passive", { get: () => (passive = true) }));
    } finally {
      passive = passive || false;
    }
  }
  return !!passive;
}

/** Listener options as-is where options objects work, else only the capture flag. */
export function normalizePassiveListenerOptions(options: AddEventListenerOptions): AddEventListenerOptions | boolean {
  return supportsPassiveEventListeners() ? options : !!options.capture;
}

let scrollBehavior: boolean | undefined;

/** Whether `scrollTo({ behavior })` is supported (or polyfilled). False on the server. */
export function supportsScrollBehavior(): boolean {
  if (scrollBehavior == null) {
    if (typeof document !== "object" || !document || typeof Element !== "function" || !Element) return (scrollBehavior = false);
    if (document.documentElement?.style && "scrollBehavior" in document.documentElement.style) scrollBehavior = true;
    else {
      // `scrollTo` missing, native without behaviour, or polyfilled (non-native source counts as support).
      const scrollTo: Function | undefined = Element.prototype.scrollTo;
      scrollBehavior = scrollTo ? !/\{\s*\[native code\]\s*\}/.test(scrollTo.toString()) : false;
    }
  }
  return scrollBehavior;
}

/** Test hook: forget memoized feature checks (scroll behaviour, RTL axis, input types, shadow DOM, platform). */
export function _resetPlatformMemo(): void {
  scrollBehavior = rtlAxis = supportedInputTypes = shadowDom = platformMemo = undefined;
}

/** How the browser reports `scrollLeft` in RTL containers. */
export const RtlScrollAxisType = {
  /** 0 at the far left, (scrollWidth - clientWidth) at the far right. */
  NORMAL: 0,
  /** -(scrollWidth - clientWidth) at the far left, 0 at the far right. Current spec, all Baseline browsers. */
  NEGATED: 1,
  /** (scrollWidth - clientWidth) at the far left, 0 at the far right (old IE / Edge). */
  INVERTED: 2,
} as const;
export type RtlScrollAxisType = (typeof RtlScrollAxisType)[keyof typeof RtlScrollAxisType];

let rtlAxis: RtlScrollAxisType | undefined;

/** Measures the browser's RTL scroll axis type (1px container, 2px content). NORMAL on the server. */
export function getRtlScrollAxisType(): RtlScrollAxisType {
  if (typeof document !== "object" || !document) return RtlScrollAxisType.NORMAL;
  if (rtlAxis == null) {
    const container = document.createElement("div");
    const s = container.style;
    container.dir = "rtl";
    s.width = "1px";
    s.overflow = "auto";
    s.visibility = "hidden";
    s.pointerEvents = "none";
    s.position = "absolute";
    const content = document.createElement("div");
    content.style.width = "2px";
    content.style.height = "1px";
    container.appendChild(content);
    document.body.appendChild(container);
    rtlAxis = RtlScrollAxisType.NORMAL;
    // A NORMAL browser starts an RTL container scrolled fully right (scrollLeft 1); 0 means NEGATED
    // or INVERTED: setting 1 is past the max of a NEGATED one, which reads back 0.
    if (container.scrollLeft === 0) {
      container.scrollLeft = 1;
      rtlAxis = container.scrollLeft === 0 ? RtlScrollAxisType.NEGATED : RtlScrollAxisType.INVERTED;
    }
    container.remove();
  }
  return rtlAxis;
}

let supportedInputTypes: Set<string> | undefined;
const candidateInputTypes = [
  // `color` must come first (Chrome warns when switching to `color` after another type).
  "color",
  "button",
  "checkbox",
  "date",
  "datetime-local",
  "email",
  "file",
  "hidden",
  "image",
  "month",
  "number",
  "password",
  "radio",
  "range",
  "reset",
  "search",
  "submit",
  "tel",
  "text",
  "time",
  "url",
  "week",
];

/** The `<input type>` values this browser supports (all candidates on the server). */
export function getSupportedInputTypes(): Set<string> {
  if (supportedInputTypes) return supportedInputTypes;
  if (typeof document !== "object" || !document) return (supportedInputTypes = new Set(candidateInputTypes));
  const input = document.createElement("input");
  return (supportedInputTypes = new Set(
    candidateInputTypes.filter((value) => {
      input.setAttribute("type", value);
      return input.type === value;
    }),
  ));
}

// --- shadow DOM ----------------------------------------------------------------------------------

let shadowDom: boolean | undefined;

/** Whether the browser supports Shadow DOM. */
export function _supportsShadowDom(): boolean {
  if (shadowDom == null) {
    const head = typeof document !== "undefined" ? document.head : null;
    shadowDom = !!(head && ((head as unknown as { createShadowRoot?: unknown }).createShadowRoot || head.attachShadow));
  }
  return shadowDom;
}

/** The shadow root `element` is in, or null (light DOM / unsupported). */
export function _getShadowRoot(element: Node): ShadowRoot | null {
  if (_supportsShadowDom()) {
    const root = element.getRootNode ? element.getRootNode() : null;
    if (typeof ShadowRoot !== "undefined" && ShadowRoot && root instanceof ShadowRoot) return root;
  }
  return null;
}

/** The focused element, piercing open shadow roots. Null on the server. */
export function _getFocusedElementPierceShadowDom(doc?: Document): HTMLElement | null {
  let active = doc
    ? (doc.activeElement as HTMLElement | null)
    : typeof document !== "undefined" && document
      ? (document.activeElement as HTMLElement | null)
      : null;
  while (active && active.shadowRoot) {
    const next = active.shadowRoot.activeElement as HTMLElement | null;
    if (next === active || !next) break;
    active = next;
  }
  return active;
}

/** An event's real target (first `composedPath()` entry: the node inside a shadow root). */
export function _getEventTarget<T extends EventTarget>(event: Event): T | null {
  // `composedPath` can throw during event replay.
  if (event.composedPath) {
    try {
      return event.composedPath()[0] as T | null;
    } catch {}
  }
  return event.target as T | null;
}

/** Whether the code runs under a known JS test runner (karma, jasmine, jest, mocha, Vitest) or `node --test`. */
export function _isTestEnvironment(): boolean {
  const g = globalThis as Record<string, unknown>;
  return !!(
    g.__karma__ ||
    g.jasmine ||
    g.jest ||
    g.Mocha ||
    g.__vitest_worker__ ||
    (typeof process !== "undefined" && (process.env?.NODE_TEST_CONTEXT || process.env?.VITEST))
  );
}
