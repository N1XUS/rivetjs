// Development build (`development` condition). `DEV` is the diagnostics toolkit; in production it is
// `false`, so `DEV ? DEV.x(…) : …` folds away with no helper code left in the bundle.

const paths = new WeakMap<object, { message: string; path: string }>();
/** Why an error happens and what to change, appended to production messages in development. */
const HINTS = {
  function:
    "only functions created in a resume-compiled component (a module in resume.modules) or its module scope resume; pass data, or move the function into such a module; a library object holding functions (a chart, socket, editor): build it with reconstruct(() => …)",
  computed:
    "create it inside a component of a module listed in resume.modules; for reconstruct, call reconstruct(() => …) directly in the component (a `reconstruct` reached through a value or alias is not compiled)",
  content:
    'a resumable binding or handler captures JSX that was already rendered (a local `const x = <…/>`, or eager JSX passed as a prop or children); the browser cannot rebuild it from data. Create it where it is used, or make it a function the browser can call again: `const x = () => <…/>` / `header={() => <…/>}`, a function child `{() => …}`, or `r:slot="header"` on a direct child of the component element',
  manifest: "the client build's .vite/rivet-resume.json has no chunk for it: build client and server from the same sources, with the module in resume.modules",
  drift:
    "the HTML changed between the server render and resume (an HTML minifier or proxy rewrote it, an extension or script edited the DOM); resume needs the data-r attributes and <!--r…--> markers as rendered",
  context:
    "a resumed binding or handler captures a value provided through an identified context; pass it to createResume({ contexts: [[token, value]] }) in the resume entry, or register the token with resumableContext() so its values ship in the page state",
  parser:
    "the HTML parser restructured the server markup (rows directly in a <table> get an implied <tbody>, a block element closes an open <p>, table content is foster-parented); wrap rows in <tbody> and keep the nesting valid (the compiler reports the statically visible cases, RV1005)",
  moduleRef:
    "two installed copies of one package are loaded (their versions share the id), so the browser resumes both as the one its chunk imports; dedupe the package",
  lazy: "the row renders differently in the browser than on the server (Date.now / Math.random / browser globals in the row body, data that changed between render and resume, or a row function whose output depends on more than its item, index and the shipped state); the row was created afresh and swapped in (dev only: production adopts the server markup)",
  skew: "its chunk failed to load or belongs to another build: serve the client assets of the build that rendered the page (keep old assets for a while after a deploy)",
} as const;
const HOOK = Symbol.for("rivet.devtools");
const LOCATE = Symbol.for("rivet.locate");
const SHIPPED = Symbol.for("rivet.store.shipped");
const warned = new Set<string>();
// Module reference id → the current value stamped with it and every module that stamped that value (process-wide: every
// drain, every request). Two importers of one export share a value; a new value from one of them is a re-evaluation (HMR).
const moduleRefs = new Map<string, { value: unknown; modules: Set<string> }>();
// `at file:///x/a.tsx:1:2`, `at f (/x/a.tsx:1:2)` → `/x/a.tsx` (query and position dropped).
const FRAME = /(?:^|[\s(])((?:file:\/\/|\/|[A-Za-z]:[\\/])[^()]*?)(?:\?[^():]*)?(?::\d+){1,2}\)?$/;
const watched = new WeakSet<Promise<unknown>>(); // resume chunk loads already logged on failure
// Resume state size (STATE-WARN): per render (root recorder), the state bytes written so far, the capture sites encoded
// but not yet reported (their warnings need the page total) and every site's bytes (summary).
interface StateCapture {
  key: string;
  site: string;
  shape: string;
  bytes: number;
}
interface StateRender {
  total: number;
  pending: StateCapture[];
  sites: Map<string, { site: string; shape: string; bytes: number; count: number }>;
  summarized: boolean;
}
const states = new WeakMap<object, StateRender>();
const STATE_DOCS = "https://rivetjs.severyn.pro/learn/resuming#large-data-in-resume-state";
const STATE_FIX =
  "\n  fix: 1. do not capture it: read it on the server (route loader, component body) and capture only what the browser code needs (an id, a key, a count)" +
  '\n       2. load it in the browser instead: serve it from an endpoint (onGet) and fetch it in the handler that needs it, or in clientEffect(() => …, { when: "visible" }) into a signal' +
  "\n       3. a list: keyed <For each={…} by={…}> rows; today each row still ships its item and its own handler / binding records (experimental lazy rows — a build with resume: { lazyRows: true } and RIVET_LAZY_ROWS=on on the server — cut a row to its key and ship the items once)" +
  "\n       4. a library object (a chart, an editor, an SDK client): reconstruct(() => …) builds it in the browser, nothing ships" +
  "\n  docs: " +
  STATE_DOCS;
// `RIVET_STATE_WARN_BYTES` / `RIVET_STATE_BUDGET_BYTES` (server env): a byte count, `0` / `off` = no warning.
const stateLimit = (name: string, fallback: number): number => {
  const value = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
  if (value === undefined || value === "") return fallback;
  const n = value === "off" ? 0 : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
const kb = (bytes: number): string => (bytes < 1024 ? bytes + " B" : (bytes / 1024).toFixed(1) + " KB");
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
  /** The module calling `fn` (first stack frame below it; "" when the stack names no file). */
  stamper(fn: Function): string {
    const holder: { stack?: string } = {};
    (Error as { captureStackTrace?: (target: object, below: Function) => void }).captureStackTrace?.(holder, fn);
    const line = holder.stack?.split("\n")[1]?.trim() ?? "";
    return FRAME.exec(line)?.[1] ?? "";
  },
  /**
   * Module references: same value → record the stamping module; a new value from a module that stamped this id before →
   * re-evaluation (replace the value, keep the known modules); a new value from any other module → warn once per id (two
   * installed copies).
   */
  moduleRef(id: string, value: unknown, module: string): void {
    const known = moduleRefs.get(id);
    // Same value: one more importer. A module that stamped an earlier value re-stamping: re-evaluation (HMR) — every module
    // known so far stays known, so a stale importer that re-evaluates first after later edits is not a second copy.
    if (known && (known.value === value || known.modules.has(module))) {
      known.value = value;
      known.modules.add(module);
      return;
    }
    moduleRefs.set(id, { value, modules: new Set([module]) });
    if (!known || warned.has("ref " + id)) return;
    warned.add("ref " + id);
    const other = [...known.modules].join(", ");
    console.warn("Rivet: " + DEV.hint("resume module reference " + id + " is stamped with two different values, by " + other + " and " + module, "moduleRef"));
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
   * Resume: a region's server content was replaced by its client creation (`recreated`), or its keyed
   * rows / Show branch were adopted (`adopted`). Devtools event `resume.region`; a re-creation also
   * logs once per symbol (the component ran in the browser, its locals started fresh).
   */
  resumeRegion(region: number, symbol: string, mode: "recreated" | "adopted", cause: string): void {
    const component = symbol.slice(symbol.indexOf("#") + 1).replace(/\$[^$]*$/, "");
    DEV.emit("resume.region", { region, symbol, component, mode, cause });
    if (mode !== "recreated" || warned.has("region " + symbol)) return;
    warned.add("region " + symbol);
    console.info(
      "Rivet resume: " +
        component +
        " re-created region " +
        region +
        " (" +
        symbol +
        ") in the browser on " +
        cause +
        " — its server HTML was replaced by a client render and the locals it creates start fresh. Expected for Show / Switch / ternary content; for a whole component, give the structural root an element of its own or keep its state with _regionState() (docs/guides/resumability.md)",
    );
  },
  /** Resume: warn once per id that two elements carry one `data-r` (injected markup; the first keeps it). */
  resumeDuplicate(id: string): void {
    if (warned.has("data-r " + id)) return;
    warned.add("data-r " + id);
    console.warn(
      'Rivet resume: two elements carry data-r="' +
        id +
        '" — the first in document order resumes. Server output never repeats an id: HTML inserted from user content must strip data-r / data-rk attributes (DOMPurify keeps data-* by default)',
    );
  },
  /**
   * Resume: a narrowed store (`{k:"store"}`, Function Bridge T12) shipped only `kept` paths. Installs the check the
   * reactivity store façade (`store-dev.ts` `read` / `write`) calls through `store[Symbol.for("rivet.store.shipped")]`:
   * a read of a path no kept path covers (itself or an ancestor; a write covers what it wrote) warns once per store and
   * path, with where it was read, and emits `resume.store { path, kept }`.
   */
  resumeStore(store: object, kept: readonly string[]): void {
    const covered = [...kept],
      reported = new Set<string>();
    const covers = (path: string): boolean => covered.some((k) => k === "" || k === path || path.startsWith(k + "."));
    (store as { [key: symbol]: unknown })[SHIPPED] = (path: string, write?: true): void => {
      if (write) {
        if (!covers(path)) covered.push(path);
        return;
      }
      if (covers(path) || reported.has(path)) return;
      reported.add(path);
      DEV.emit("resume.store", { path, kept: [...covered] });
      console.warn(
        'Rivet resume: store path "' +
          path +
          '" was not shipped with the page (the server render did not read it and no resumed code names it), so it reads ' +
          (path === "" ? "only the shipped paths" : "undefined") +
          " here; shipped: " +
          (covered.join(", ") || "none") +
          DEV.locate() +
          '\n  fix: read it during the server render, or read it by a literal path (read(store, "' +
          (path || "path") +
          '")) in the resumed code' +
          "\n  docs: https://rivetjs.severyn.pro/guides/state/stores#in-a-resumed-page",
      );
    };
  },
  /** Resume: the value of a signal ref, short, for `cause` texts. */
  resumeValue(value: unknown): string {
    let text: string;
    try {
      text = typeof value === "function" ? "function" : (JSON.stringify(value) ?? String(value));
    } catch {
      text = Object.prototype.toString.call(value);
    }
    return text.length > 60 ? text.slice(0, 57) + "…" : text;
  },
  /**
   * Resume: log chunk loads that fail (the loader's idle warm-up swallows them; a later use reports
   * through `rivet:resume-error`). `loading`: the loader's chunk index → promise record; already
   * started loads are watched at once, later ones through accessors installed per chunk index.
   */
  resumeChunks(loading: Record<number, Promise<unknown> | undefined>, urls: readonly string[]): void {
    const watch = (i: number, promise: Promise<unknown>): void => {
      if (watched.has(promise)) return;
      watched.add(promise);
      promise.catch((error: unknown) => console.warn("Rivet resume: chunk " + urls[i] + " failed to load or evaluate — " + HINTS.skew, error));
    };
    // Called again after streamed patches (new chunk indices): indices already watched keep their accessor.
    for (let i = 0; i < urls.length; i++) {
      if (Object.getOwnPropertyDescriptor(loading, i)?.set) continue;
      if (loading[i]) {
        watch(i, loading[i]!);
        continue;
      }
      let value: Promise<unknown> | undefined;
      Object.defineProperty(loading, i, {
        configurable: true,
        enumerable: true,
        get: () => value,
        set: (next: Promise<unknown>) => {
          value = next;
          watch(i, next);
        },
      });
    }
  },
  /**
   * Resume state size: the capture sites one encoded segment wrote (`server-resume.ts` `devStateSites`: site label,
   * value shape, wire bytes the site added first), reported by the next `stateBytes` call of the same render.
   */
  stateCaptures(root: object, captures: StateCapture[]): void {
    let state = states.get(root);
    if (!state) states.set(root, (state = { total: 0, pending: [], sites: new Map(), summarized: false }));
    for (const capture of captures) {
      state.pending.push(capture);
      const known = state.sites.get(capture.key);
      if (known) ((known.bytes += capture.bytes), known.count++);
      else state.sites.set(capture.key, { site: capture.site, shape: capture.shape, bytes: capture.bytes, count: 1 });
    }
  },
  /**
   * Resume state size: one segment's `rivet/state` JSON (`bytes`) was written. Warns once per capture site and process
   * when one captured value took ≥ `RIVET_STATE_WARN_BYTES` (default 8 KiB), and once per render when the page's state
   * passes `RIVET_STATE_BUDGET_BYTES` (default 64 KiB): its 3 largest sites (deduplicated per process by those sites).
   */
  stateBytes(root: object, bytes: number): void {
    const state = states.get(root);
    if (!state) return;
    state.total += bytes;
    const limit = stateLimit("RIVET_STATE_WARN_BYTES", 8192),
      budget = stateLimit("RIVET_STATE_BUDGET_BYTES", 65536);
    const pending = state.pending;
    state.pending = [];
    if (limit > 0)
      for (const capture of pending) {
        if (capture.bytes < limit) continue;
        DEV.emit("resume.state", { site: capture.site, shape: capture.shape, bytes: capture.bytes, total: state.total });
        if (warned.has("state " + capture.key)) continue;
        warned.add("state " + capture.key);
        console.warn(
          "Rivet resume: " +
            capture.site +
            ": " +
            capture.shape +
            ", " +
            kb(capture.bytes) +
            " of rivet/state (warning threshold " +
            kb(limit) +
            "; this page's state so far " +
            kb(state.total) +
            ") — every captured value is written into the page as data and parsed before the first interaction" +
            STATE_FIX,
        );
      }
    if (budget <= 0 || state.summarized || state.total < budget) return;
    state.summarized = true;
    // Captured bytes only: a state of lazy row records (no capture sites) and table structure has nothing to point at.
    const sites = [...state.sites.values()].sort((a, b) => b.bytes - a.bytes);
    if (!sites.length) return;
    let captured = 0;
    for (const site of sites) captured += site.bytes;
    const top = sites.slice(0, 3);
    const signature = "state budget " + top.map((site) => site.site).join("\n");
    if (warned.has(signature)) return;
    warned.add(signature);
    DEV.emit("resume.stateBudget", { total: state.total, budget, top: top.map(({ site, bytes, count }) => ({ site, bytes, count })) });
    console.warn(
      "Rivet resume: this page's rivet/state is " +
        kb(state.total) +
        " (budget " +
        kb(budget) +
        "), " +
        kb(captured) +
        " of it captured values; largest captures:" +
        top
          .map(
            (site, i) =>
              "\n  " +
              (i + 1) +
              ". " +
              kb(site.bytes) +
              "  " +
              site.site +
              ": " +
              site.shape +
              (site.count > 1 ? " (×" + site.count.toLocaleString("en-US") + ")" : ""),
          )
          .join("") +
        STATE_FIX,
    );
  },
  /** Property access segment: `.name` or `["a-b"]`. */
  key: (key: string): string => (/^[A-Za-z_$][\w$]*$/.test(key) ? "." + key : "[" + JSON.stringify(key) + "]"),
};
export type DevTools = typeof DEV;
