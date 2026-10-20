// In-page half of the resume fuzz (`./resume-fuzz.ts`): installed with `page.addInitScript(installFuzz)` before any
// page script, so it is self-contained (no imports, no closures over module scope — Playwright sends its source).

/** What the init script exposes as `window.__rivetFuzz`. */
export interface FuzzPage {
  /** `rivet:resume-error` details (the event is cancelled: no reload) and uncaught errors, in order. */
  errors: string[];
  /** Interactive elements in content order: `{ path, tag, role, text, kind, keys }`. */
  discover(skip?: string[]): Discovered[];
  /** Remember the elements at `paths` (indexes = step targets). Returns how many resolved. */
  bind(paths: number[][]): number;
  /** Selector-free handle for Playwright: the bound element `i`, or null when it is gone. */
  element(i: number): Element | null;
  /** Number every content element (re-creation check). */
  stamp(): void;
  /** Stamped elements that left the document since `stamp()`: their stamp indexes. */
  removed(): number[];
  /** Normalised content lines (see `snapshot` in `installFuzz`) + per line the element's tolerance key (0: none). */
  snapshot(): { lines: string[]; keys: number[] };
  /** Give the elements of the last snapshot's lines `[index, key]` a tolerance key (the driver keeps the tolerated values). */
  key(list: [number, number][]): void;
  /** Mark nodes the router adds on a client navigation as ignored and undo the focus it moved. */
  afterNavigation(before: number): void;
  /** Body child count (before a client navigation). */
  bodyChildren(): number;
  /** Bound element `i`'s description for repro logs. */
  describe(i: number): string;
  /** Stamped elements' descriptions (`removed()` indexes). */
  describeStamps(list: number[]): string[];
}

export interface Discovered {
  path: number[];
  tag: string;
  role: string;
  /** "text" (types a string), "toggle" / "control" (clicks), "keys" (focus + keys only). */
  kind: "text" | "click";
  /** Keys to press with the element focused: its `[data-rk]` container's list, else by role. */
  keys: string[];
  label: string;
}

/** Init script. Runs in every document of the fuzz context. */
export function installFuzz(): void {
  const w = window as unknown as { __rivetFuzz?: FuzzPage };
  if (w.__rivetFuzz) return;
  const errors: string[] = [];
  document.addEventListener("rivet:resume-error", (event) => {
    event.preventDefault();
    const detail = (event as CustomEvent).detail as { symbol?: unknown; error?: { message?: string }; message?: string; skew?: string } | undefined;
    const message = detail?.error?.message ?? detail?.message ?? String(detail);
    errors.push("rivet:resume-error " + (detail?.symbol ? String(detail.symbol) + ": " : "") + message + (detail?.skew ? " (skew " + detail.skew + ")" : ""));
  });
  // Chromium's benign "ResizeObserver loop completed with undelivered notifications" is not a page error.
  addEventListener("error", (event) => {
    const message = (event as ErrorEvent).message || String((event as ErrorEvent).error);
    if (!/^ResizeObserver loop/.test(message)) errors.push("error " + message);
  });
  addEventListener("unhandledrejection", (event) =>
    errors.push("unhandledrejection " + String((event as PromiseRejectionEvent).reason?.message ?? (event as PromiseRejectionEvent).reason)),
  );

  const SKIP = new Set(["SCRIPT", "STYLE", "LINK", "NOSCRIPT", "TEMPLATE", "META", "BASE"]);
  // Attributes that only one of the two renders carries by design: resume markers (`data-r` handler ids,
  // `data-rivet-*` loader / outlet bookkeeping on the server side) and the fuzz's own marks.
  const DROP = /^(data-r|data-rivet-[\w-]+|data-fuzz[\w-]*)$/;
  // Generated ids: `createId` scopes (`rv-<scope>-<n>`, `rv<n>`, `rvc` / `rvs`) and lazy row seeds (`rvr<forId>_<k>_<n>`,
  // LAZY-ROWS: a server row's id scope, which a client-rendered row does not use).
  const IDS = /\brvr\d+_\d+_\d+|\brv-[a-z0-9]+-\d+|\brv[cs]?\d+/g;
  const GENERATED = /\brvr\d+_\d+_\d+|\brv-[a-z0-9]+-\d+|\brv[cs]?\d+/;
  const ignored = new WeakSet<Node>();
  const content = (el: Element): Element[] => Array.from(el.children).filter((child) => !SKIP.has(child.tagName) && !ignored.has(child));
  const walk = (el: Element, visit: (el: Element, path: number[]) => void, path: number[] = []): void =>
    content(el).forEach((child, i) => {
      const at = path.concat(i);
      visit(child, at);
      walk(child, visit, at);
    });
  const at = (path: number[]): Element | null => {
    let el: Element | undefined = document.body;
    for (const i of path) el = el && content(el)[i];
    return el ?? null;
  };
  const visible = (el: Element): boolean => {
    if (!(el as HTMLElement).getClientRects?.().length) return false;
    const style = getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none" && !el.closest("[inert],[aria-hidden=true]");
  };
  const ROLE_KEYS: Record<string, string[]> = {
    listbox: ["ArrowDown", "ArrowUp", "Home", "End", "Enter"],
    option: ["ArrowDown", "ArrowUp", "Home", "End", " "],
    menu: ["ArrowDown", "ArrowUp", "Home", "End"],
    menuitem: ["ArrowDown", "ArrowUp", "Enter"],
    menuitemcheckbox: ["ArrowDown", " "],
    menuitemradio: ["ArrowDown", " "],
    tab: ["ArrowRight", "ArrowLeft", "Home", "End"],
    radio: ["ArrowDown", "ArrowUp", " "],
    checkbox: [" "],
    switch: [" "],
    slider: ["ArrowRight", "ArrowUp", "PageUp", "Home", "End"],
    spinbutton: ["ArrowUp", "ArrowDown", "PageUp", "Home"],
    combobox: ["ArrowDown", "ArrowUp", "Enter", "Escape"],
    gridcell: ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"],
    row: ["ArrowDown", "ArrowUp", " "],
    treeitem: ["ArrowDown", "ArrowRight", "ArrowLeft", "ArrowUp"],
    button: ["Enter", " "],
  };
  const INTERACTIVE =
    "a[href^='#'],button,input,select,textarea,summary,[tabindex],[contenteditable=''],[contenteditable=true],[role=button],[role=checkbox],[role=radio],[role=switch],[role=tab],[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio],[role=option],[role=slider],[role=spinbutton],[role=combobox],[role=gridcell],[role=row],[role=treeitem],[role=textbox],[role=searchbox],[data-rk] *";
  const TEXT_INPUTS = /^(text|search|email|url|tel|password|number|)$/;
  const roleOf = (el: Element): string =>
    el.getAttribute("role") ??
    ({ BUTTON: "button", SUMMARY: "button", SELECT: "combobox", TEXTAREA: "textbox" } as Record<string, string>)[el.tagName] ??
    (el.tagName === "INPUT"
      ? (({ checkbox: "checkbox", radio: "radio", range: "slider", number: "spinbutton" } as Record<string, string>)[(el as HTMLInputElement).type] ??
        "textbox")
      : "");
  // A style attribute as the browser parsed it (server markup `a:b;c:d` vs CSSOM writes `a: b; c: d;`).
  const style = (el: HTMLElement): string => {
    const decl = el.style;
    if (!decl) return el.getAttribute("style") ?? "";
    return Array.from(decl)
      .sort()
      .map((name) => name + ":" + decl.getPropertyValue(name) + (decl.getPropertyPriority(name) ? "!important" : ""))
      .join(";");
  };
  const stamps: Element[] = [];
  const lines: string[] = [];
  const lineEls: (Element | null)[] = [];
  // Tolerance keys (`key()`): the driver tolerates exact (attribute, resumed value, CSR value) triples per key.
  const keyed = new WeakMap<Element, number>();
  // Focus history: the element focused before the current one (the router's focus move is undone to it).
  let focused: Element | null = null,
    previous: Element | null = null;
  document.addEventListener(
    "focusin",
    (event) => {
      if (event.target === focused) return;
      previous = focused;
      focused = event.target as Element;
    },
    true,
  );
  const IDREFS = new Set([
    "aria-labelledby",
    "aria-describedby",
    "aria-controls",
    "aria-owns",
    "aria-activedescendant",
    "aria-details",
    "aria-errormessage",
    "aria-flowto",
    "for",
    "headers",
    "list",
    "form",
  ]);
  const tagOf = (el: Element): string =>
    el.tagName.toLowerCase() +
    (el.id && !GENERATED.test(el.id) ? "#" + el.id : "") +
    (el.classList.length ? "." + Array.from(el.classList).slice(0, 2).join(".") : "");
  const bound: (Element | null)[] = [];

  w.__rivetFuzz = {
    errors,
    discover(skip = []) {
      const found: Discovered[] = [];
      walk(document.body, (el, path) => {
        if (!el.matches(INTERACTIVE) || !visible(el)) return;
        if (skip.some((selector) => el.closest(selector))) return;
        // Links that load another page and file pickers leave the fuzz's control; nav to other stories is noise.
        if (el.closest("a[href]:not([href^='#'])") || (el as HTMLInputElement).type === "file" || (el as HTMLInputElement).type === "hidden") return;
        if (el.matches("[data-rk]") && !el.matches(INTERACTIVE.replace(",[data-rk] *", ""))) return;
        const role = roleOf(el);
        const rk = el.closest("[data-rk]")?.getAttribute("data-rk");
        const text =
          el.matches("textarea,[contenteditable=''],[contenteditable=true],[role=textbox],[role=searchbox]") ||
          (el.tagName === "INPUT" && TEXT_INPUTS.test((el as HTMLInputElement).type)) ||
          (role === "combobox" && el.tagName === "INPUT");
        found.push({
          path,
          tag: el.tagName.toLowerCase(),
          role,
          kind: text ? "text" : "click",
          keys: rk ? rk.split(/\s+/).filter(Boolean) : (ROLE_KEYS[role] ?? []),
          label: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40),
        });
      });
      return found;
    },
    bind(paths) {
      bound.length = 0;
      for (const path of paths) bound.push(at(path));
      return bound.filter(Boolean).length;
    },
    element: (i) => (bound[i]?.isConnected ? bound[i] : null),
    stamp() {
      stamps.length = 0;
      walk(document.body, (el) => stamps.push(el));
    },
    removed: () => stamps.flatMap((el, i) => (el.isConnected ? [] : [i])),
    snapshot() {
      // One line per element / text run: tag, sorted attributes (generated ids renumbered by first appearance, so
      // server `rv3` and browser `rvc0` compare equal when they name the same element), live `:value` / `:checked` /
      // `:focus` pseudo-attributes. Comments (resume markers, anchors) and whitespace-only text are dropped. Normalised
      // away (same meaning, different markup): an empty `class`, the `value` attribute of inputs / textareas (the live
      // `:value` is compared), style text (compared as parsed), IDREF tokens naming no element (server ids of slots
      // with no element — cdk createSlotId, UI-COLD 2026-10-08). Values are quoted with `"` / `\` escaped.
      const ids = new Map<string, string>();
      const id = (value: string) => value.replace(IDS, (m) => ids.get(m) ?? (ids.set(m, "#" + ids.size), ids.get(m)!));
      lineEls.length = 0;
      lines.length = 0;
      const quote = (v: string) => '"' + v.replace(/[\\"]/g, "\\$&") + '"';
      const active = document.activeElement;
      const value = (el: Element, a: Attr): string | null => {
        if (a.name === "style") return style(el as HTMLElement);
        if (a.name === "class") return a.value.trim() ? a.value.trim().split(/\s+/).join(" ") : null;
        if (a.name === "value" && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return null;
        if (IDREFS.has(a.name)) {
          const kept = a.value.split(/\s+/).filter((token) => token && document.getElementById(token));
          return kept.length ? kept.join(" ") : null;
        }
        return a.value;
      };
      const line = (el: Element, depth: number) => {
        const attrs: string[] = [];
        // By name: generated ids are numbered in this order, so the order the attributes were set in must not matter.
        for (const a of Array.from(el.attributes).sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0))) {
          if (DROP.test(a.name)) continue;
          const v = value(el, a);
          if (v !== null) attrs.push(a.name + "=" + quote(id(v)));
        }
        attrs.sort();
        if (el === active && el !== document.body) attrs.push(":focus");
        const input = el as HTMLInputElement;
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") {
          attrs.push(":value=" + quote(input.value));
          if (input.type === "checkbox" || input.type === "radio") attrs.push(":checked=" + input.checked);
        }
        lines.push("  ".repeat(depth) + "<" + el.tagName.toLowerCase() + (attrs.length ? " " + attrs.join(" ") : "") + ">");
        lineEls.push(el);
        let text = "";
        const flush = () => {
          const t = text.replace(/\s+/g, " ").trim();
          if (t) (lines.push("  ".repeat(depth + 1) + JSON.stringify(id(t))), lineEls.push(null));
          text = "";
        };
        for (const child of Array.from(el.childNodes)) {
          if (child.nodeType === 3) text += child.nodeValue;
          else if (child.nodeType === 1 && !SKIP.has((child as Element).tagName) && !ignored.has(child)) {
            flush();
            line(child as Element, depth + 1);
          }
        }
        flush();
      };
      lines.push(location.pathname + location.search + location.hash);
      lineEls.push(null);
      // Body level: the router's announcer (a live region the first client navigation appends) is skipped; global live
      // announcers (cdk LiveAnnouncer, created on first use, prepended or appended) go last, in a stable order.
      const top = content(document.body).filter((child) => !child.hasAttribute("aria-live"));
      const late = (el: Element) => (el.hasAttribute("data-live-announcer") ? 1 : 0);
      for (const child of top.sort((a, b) => late(a) - late(b))) line(child, 0);
      return { lines: lines.slice(), keys: lineEls.map((el) => (el && keyed.get(el)) || 0) };
    },
    key(list) {
      for (const [index, k] of list) {
        const el = lineEls[index];
        if (el) keyed.set(el, k);
      }
    },
    bodyChildren: () => document.body.children.length,
    afterNavigation(before) {
      // The router's announcer (appended to body on the first client navigation; also skipped by `snapshot`) and the
      // `tabindex="-1"` + focus it puts on the new page's heading: a resumed document load has neither.
      for (const child of Array.from(document.body.children).slice(before)) if (child.getAttribute("aria-live")) ignored.add(child);
      // Router focus target: the first h1, else `main` (client/index.ts). Focus goes back to where it was before the
      // router moved it (an autofocused element of the new page), else nowhere — a document load has no such move.
      for (const el of [document.querySelector("h1"), document.querySelector("main")])
        if (el?.getAttribute("tabindex") === "-1") {
          el.removeAttribute("tabindex");
          if (document.activeElement !== el) continue;
          const back = previous;
          if (back && back !== el && back.isConnected && back.id !== "rivet-fuzz-nav") (back as HTMLElement).focus({ preventScroll: true });
          else (el as HTMLElement).blur();
        }
    },
    describeStamps: (list) => list.map((i) => (stamps[i] ? tagOf(stamps[i]) : "?")),
    describe(i) {
      const el = bound[i];
      if (!el) return "(gone)";
      const idAttr = el.id && !GENERATED.test(el.id) ? "#" + el.id : "";
      const role = el.getAttribute("role");
      return (
        el.tagName.toLowerCase() +
        idAttr +
        (role ? "[role=" + role + "]" : "") +
        ' "' +
        (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30) +
        '"'
      );
    },
  };
}

/**
 * Init script for the resumed page (`context.addInitScript(dropPreloads)`): removes every `modulepreload` link added after
 * parsing (the resume loader's preload queue, idle / `visible` preloads, hover-dwell prefetch), so a handler chunk loads
 * only when its event needs it and an element's first interaction is cold on every run (deterministic: no race with
 * background preloads). Idle boot and mount work still run as on a real page (they import, not preload).
 */
export function dropPreloads(): void {
  const w = window as unknown as { __rivetFuzzPreloads?: 1 };
  if (w.__rivetFuzzPreloads) return;
  w.__rivetFuzzPreloads = 1;
  new MutationObserver((records) => {
    if (document.readyState === "loading") return;
    for (const record of records)
      for (const node of Array.from(record.addedNodes))
        if ((node as Element).localName === "link" && (node as HTMLLinkElement).rel === "modulepreload") (node as Element).remove();
  }).observe(document, { childList: true, subtree: true });
}
