// Development build (`development` condition). `DEV` is the diagnostics toolkit; in production it is
// `false`, so `DEV ? DEV.x(…) : …` folds away with no helper code left in the bundle.

const paths = new WeakMap<object, { message: string; path: string }>();
/** Why an error happens and what to change, appended to production messages in development. */
const HINTS = {
  function:
    "only data resumes (route payloads, boundary props, keyed state); pass plain data and create functions, class instances and library objects (a chart, socket, editor) in the component that uses them",
  drift:
    "the HTML changed between the server render and resume (an HTML minifier or proxy rewrote it, an extension or script edited the DOM); resume needs the boundary attributes and comment markers as rendered",
  manifest: "the client build's .vite/rivet-resume.json names no chunk for it: build client and server from the same sources",
  lazy: "the row renders differently in the browser than on the server (Date.now / Math.random / browser globals in the row body, data that changed between render and resume, or a row function whose output depends on more than its item and index); the row was created afresh and swapped in (dev only: production adopts the server markup)",
  adopt:
    "the boundary renders differently in the browser than on the server (browser globals, Date.now / Math.random, data that changed between render and resume, or a component whose output depends on more than its props and keyed state); it was rendered afresh in the browser in place of the server markup",
} as const;
const HOOK = Symbol.for("rivet.devtools");
const LOCATE = Symbol.for("rivet.locate");
const warned = new Set<string>();
export const DEV = {
  /** Report to the devtools hook, if a devtools host installed one (`@rivetjs/devtools`). */
  emit(type: string, data: object): void {
    (globalThis as { [HOOK]?: { emit(type: string, data: object): void } })[HOOK]?.emit(type, data);
  },
  /** clientEvent `match`: an invalid CSS selector throws at registration (else `closest` would throw on every event). */
  selector(match: string): void {
    try {
      document.createDocumentFragment().querySelector(match);
    } catch (error) {
      throw new SyntaxError(`clientEvent match: ${JSON.stringify(match)} is not a valid CSS selector` + DEV.locate(), { cause: error });
    }
  },
  /** `message — hint` for a known failure (also reported to the devtools hook). */
  hint(message: string, key: keyof typeof HINTS): string {
    const text = message + " — " + HINTS[key];
    DEV.emit("error.hint", { key, message: text });
    return text;
  },
  /**
   * Where the running dev code is, as an indented line (`\n  in <Card> (src/card.tsx:3:17) ← <Page> (…)` in the browser,
   * `\n  at Page (src/routes/index.tsx:12:7)` on the dev server), from `globalThis[Symbol.for("rivet.locate")]` — installed
   * by `dev/where.ts` (browser) and the compiler's Vite plugin (dev server); "" without one.
   */
  locate(): string {
    const locate = (globalThis as { [LOCATE]?: () => string })[LOCATE];
    let text = "";
    try {
      text = typeof locate === "function" ? locate() : "";
    } catch {
      // A locator never breaks the warning it decorates.
    }
    return text ? "\n  " + text : "";
  },
  /** Run `encode`; an error thrown inside gains `path` as a prefix (`.items[2].onClick: …`). */
  at<T>(path: string, encode: () => T): T {
    try {
      return encode();
    } catch (error) {
      if (error instanceof Error) {
        let info = paths.get(error);
        if (!info) paths.set(error, (info = { message: error.message, path: "" }));
        info.path = path + info.path;
        error.message = info.path + ": " + info.message;
      }
      throw error;
    }
  },
  /** Warn once per attribute and scheme that an unsafe URL was neutralized (production: silent). */
  unsafeUrl(name: string, scheme: string, where = ""): void {
    scheme = scheme.toLowerCase();
    const key = name + " " + scheme + where;
    if (warned.has(key)) return;
    warned.add(key);
    console.warn(
      "Rivet: unsafe " +
        scheme +
        ": URL in " +
        name +
        where +
        " rendered as about:invalid#rivet — javascript:, vbscript: and (outside img/source/video/audio sources) data: URLs are neutralized" +
        (where ? "" : DEV.locate()),
    );
  },
  /** Warn once per property that an unsafe style value was dropped (production: silent). */
  unsafeStyle(property: string, value: string): void {
    const key = "style " + property + " " + value;
    if (warned.has(key)) return;
    warned.add(key);
    console.warn(
      "Rivet: unsafe style value for " +
        property +
        " dropped (" +
        JSON.stringify(value.slice(0, 80)) +
        ") — url(), src(), image-set(), expression(), javascript: and \\ ; { } /* are not allowed in style values; set images from CSS (a class, or a custom property holding a plain value)" +
        DEV.locate(),
    );
  },
  /** Warn once that a class object / array reached a plain class binding (it stringifies). */
  classObject(): void {
    if (warned.has("class object")) return;
    warned.add("class object");
    console.warn(
      'Rivet: a class object or array that is not written in the JSX attribute renders as its string ([object Object]); write it literally (class={{ active: on }}, class={["a", on && "b"]}) or pass it through cx() from @rivetjs/runtime/css' +
        DEV.locate(),
    );
  },
  /**
   * Derived model adopt verifier (`dom-derived.ts`): a boundary's server markup differs from its browser render (`first`
   * = the first difference). Warns once per boundary name; the unit is rendered in the browser instead.
   */
  adopt(boundary: string, first: string): void {
    DEV.emit("resume.adopt", { boundary, first });
    const name = boundary.replace(/ \(b\d+\)$/, "");
    if (warned.has("adopt " + name)) return;
    warned.add("adopt " + name);
    console.warn("Rivet resume: boundary " + boundary + " did not adopt its server markup: " + first + " — " + HINTS.adopt);
  },
  /** Property access segment: `.name` or `["a-b"]`. */
  key: (key: string): string => (/^[A-Za-z_$][\w$]*$/.test(key) ? "." + key : "[" + JSON.stringify(key) + "]"),
};
export type DevTools = typeof DEV;
