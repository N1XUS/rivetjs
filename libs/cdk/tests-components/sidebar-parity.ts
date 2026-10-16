// Sidebar parity comparator: a reference page (shadcn/ui React build) vs a Rivet page, same probes, real Chromium
// mouse / keyboard. Every interactable part of the Sidebar: structure + ARIA per `data-slot`, trigger click + collapse
// animation, transitions, trigger keys + focus ring, rail (hover, cursor, click), Cmd/Ctrl+B cold and warm (body,
// input, sidebar input), collapsed icon mode (sizes, label, tooltip on hover / focus), menu button states (idle,
// hover, pressed, active, focus-visible), menu actions (showOnHover, menu, focus return), collapsible sub menus
// (chevron, height animation, Enter / Space), header / footer dropdowns, Tab order, the mobile sheet at 500 px
// (overlay, scroll lock, focus on open, Tab containment, Escape + focus restore, underlay click, link click), swipe
// to dismiss (time to unmount) and the cold first toggle. Not a test: it prints / writes the measurements; `--diff`
// prints the differing leaves of a written result.
//
//   node libs/cdk/tests-components/sidebar-parity.ts --ref <url> --ours <url> [--out <dir>] [--probes a,b]
//   node libs/cdk/tests-components/sidebar-parity.ts --diff <dir>/result.json
//
// Both pages must render a shadcn-shaped sidebar (`data-slot` / `data-sidebar` attributes; Radix `asChild` replaces
// `data-slot` on dropdown / collapsible triggers, so probes select by `data-sidebar`). The reference app is not in
// the repo (React deps): build one with the exact shadcn pins (see `CLAUDE.md` (`sidebar-parity.ts` bullet)) and serve it next to
// built docs examples (`node libs/docs-kit/cli.ts examples apps/<app> <id>`). One Chromium; each probe gets a fresh
// context per side (desktop 1280 × 800, mobile probes 500 × 800); screenshots `<probe>.<side>.png` in `--out`.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, type Page } from "playwright";

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf("--" + name);
  return i > 0 ? process.argv[i + 1] : undefined;
};

const ROOT = '[data-slot="sidebar"][data-state]';
const S = {
  trigger: '[data-sidebar="trigger"]',
  rail: '[data-sidebar="rail"]',
  gap: '[data-slot="sidebar-gap"]',
  container: '[data-slot="sidebar-container"]',
  button: '[data-sidebar="menu-button"]',
  action: '[data-sidebar="menu-action"]',
  sub: '[data-sidebar="menu-sub-button"]',
  label: '[data-sidebar="group-label"]',
};
const TIP = '[role="tooltip"], [data-slot="tooltip-content"]';

type Json = unknown;
type Probe = (page: Page) => Promise<Json>;

// ---------------------------------------------------------------------------------------------- page helpers
// Serialized into the page (no closures): describes an element as `tag[slot](role):label`.
const DESCRIBE = `(e) => {
  if (!e || e === document.body) return "body";
  const slot = e.getAttribute("data-slot") ?? e.getAttribute("data-sidebar");
  return e.tagName.toLowerCase() + (slot ? "[" + slot + "]" : "") + (e.getAttribute("role") ? "(" + e.getAttribute("role") + ")" : "") + ":" + (e.getAttribute("aria-label") ?? e.textContent ?? "").trim().slice(0, 24);
}`;
const focusDesc = (page: Page): Promise<string> => page.evaluate(`(${DESCRIBE})(document.activeElement)`);

const snap = (page: Page) =>
  page.evaluate(
    ({ ROOT, S, DESCRIBE }) => {
      const q = (s: string) => document.querySelector(s);
      const root = q(ROOT);
      const box = (s: string) => {
        const r = q(s)?.getBoundingClientRect();
        return r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null;
      };
      return {
        state: root?.getAttribute("data-state") ?? null,
        collapsible: root?.getAttribute("data-collapsible") ?? null,
        variant: root?.getAttribute("data-variant") ?? null,
        side: root?.getAttribute("data-side") ?? null,
        gap: box(S.gap),
        container: box(S.container),
        cookie: document.cookie.split("; ").find((c) => c.startsWith("sidebar_state")) ?? null,
        dialog: !!q('[role="dialog"]'),
        focus: (0, eval)(DESCRIBE)(document.activeElement) as string,
      };
    },
    { ROOT, S, DESCRIBE },
  );

const styles = (page: Page, sel: string, props: string[], index = 0) =>
  page.evaluate(
    ({ sel, props, index }) => {
      const e = document.querySelectorAll(sel)[index];
      if (!e) return null;
      const cs = getComputedStyle(e);
      return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]));
    },
    { sel, props, index },
  );

const ariaOf = (page: Page, sel: string, index = 0) =>
  page.evaluate(
    ({ sel, index }) => {
      const e = document.querySelectorAll(sel)[index];
      if (!e) return null;
      const o: Record<string, string> = { tag: e.tagName.toLowerCase() };
      for (const a of e.attributes)
        if (/^(aria-|role$|data-|tabindex$|type$|href$|disabled$|title$)/.test(a.name) && a.name !== "data-rk" && a.name !== "data-r") o[a.name] = a.value;
      return o;
    },
    { sel, index },
  );

/** Samples an element's x or width every frame for `ms`. */
const sample = (page: Page, sel: string, prop: "x" | "w", ms: number) =>
  page.evaluate(
    ({ sel, prop, ms }) =>
      new Promise<[number, number][]>((done) => {
        const out: [number, number][] = [];
        const t0 = performance.now();
        const tick = () => {
          const e = document.querySelector(sel);
          const t = Math.round(performance.now() - t0);
          if (e) out.push([t, Math.round(prop === "x" ? e.getBoundingClientRect().x : e.getBoundingClientRect().width)]);
          if (t < ms) requestAnimationFrame(tick);
          else done(out);
        };
        tick();
      }),
    { sel, prop, ms },
  );

/** A sampled transition: duration between the first and last changed frame, value a third in. */
const span = (samples: [number, number][]) => {
  const first = samples[0]?.[1];
  const last = samples.at(-1)?.[1];
  const moving = samples.filter(([, v], i) => i > 0 && v !== samples[i - 1]![1]);
  if (!moving.length) return { from: first, to: last, ms: 0 };
  const start = samples[samples.indexOf(moving[0]!) - 1]?.[0] ?? 0;
  return { from: first, to: last, ms: moving.at(-1)![0] - start, mid: samples[Math.floor(samples.length / 3)]?.[1] };
};

const center = async (page: Page, sel: string, index = 0): Promise<[number, number]> => {
  const box = await page.locator(sel).nth(index).boundingBox();
  if (!box) throw new Error(`no box: ${sel}`);
  return [box.x + box.width / 2, box.y + box.height / 2];
};
const state = (page: Page) => page.evaluate((r) => document.querySelector(r)?.getAttribute("data-state") ?? null, ROOT);

// ---------------------------------------------------------------------------------------------- probes
const probes: Record<string, Probe> = {
  async structure(page) {
    const parts = [
      "sidebar-wrapper",
      "sidebar",
      "sidebar-gap",
      "sidebar-container",
      "sidebar-inner",
      "sidebar-header",
      "sidebar-content",
      "sidebar-footer",
      "sidebar-group",
      "sidebar-group-label",
      "sidebar-menu",
      "sidebar-menu-item",
      "sidebar-menu-button",
      "sidebar-menu-action",
      "sidebar-menu-sub",
      "sidebar-menu-sub-button",
      "sidebar-rail",
      "sidebar-trigger",
      "sidebar-inset",
    ];
    const out: Record<string, Json> = {};
    for (const p of parts) out[p] = await ariaOf(page, `[data-slot="${p}"]`);
    return out;
  },

  async triggerClick(page) {
    const before = await snap(page);
    const samples = sample(page, S.gap, "w", 450);
    const t0 = Date.now();
    await page.mouse.click(...(await center(page, S.trigger)));
    const gapAnim = span(await samples);
    const after = await snap(page);
    // The trigger may move (offcanvas: the inset shifts): aim again.
    await page.mouse.click(...(await center(page, S.trigger)));
    await page.waitForTimeout(400);
    return { before, after, back: await snap(page), gapAnim, clickToStateMs: Date.now() - t0 };
  },

  async transition(page) {
    const props = ["transition-property", "transition-duration", "transition-timing-function"];
    return { gap: await styles(page, S.gap, props), container: await styles(page, S.container, props), button: await styles(page, S.button, props) };
  },

  async triggerKeys(page) {
    await page.focus(S.trigger);
    const focusVisible = await styles(page, S.trigger, ["outline-style", "outline-width", "box-shadow"]);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(350);
    const enter = await state(page);
    await page.keyboard.press("Space");
    await page.waitForTimeout(350);
    return { enter, space: await state(page), focusAfter: await focusDesc(page), focusVisible };
  },

  async rail(page) {
    if (!(await page.$(S.rail))) return { rail: false };
    const aria = await ariaOf(page, S.rail);
    const box = (await page.locator(S.rail).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 200);
    await page.waitForTimeout(250);
    const hover = await styles(page, S.rail, ["cursor", "width"]);
    const afterBg = await page.evaluate((s) => getComputedStyle(document.querySelector(s)!, "::after").backgroundColor, S.rail);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(400);
    const collapsed = await snap(page);
    const box2 = (await page.locator(S.rail).boundingBox())!;
    await page.mouse.move(box2.x + box2.width / 2, box2.y + 200);
    await page.waitForTimeout(100);
    const cursorCollapsed = (await styles(page, S.rail, ["cursor"]))?.cursor;
    return { aria, box: [Math.round(box.x), Math.round(box.width)], hover, afterBg, collapsed: collapsed.state, focus: collapsed.focus, cursorCollapsed };
  },

  async shortcutCold(page) {
    // Straight after load, nothing touched, focus on body.
    await page.keyboard.press("Control+b");
    await page.waitForTimeout(400);
    const ctrlB = await state(page);
    await page.keyboard.press("Meta+b");
    await page.waitForTimeout(400);
    return { ctrlB, metaB: await state(page), cookie: (await snap(page)).cookie };
  },

  async shortcutWarm(page) {
    const seq = [await state(page)];
    await page.mouse.click(1000, 790);
    for (const key of ["Control+b", "Meta+b"]) {
      await page.keyboard.press(key);
      await page.waitForTimeout(300);
      seq.push(await state(page));
    }
    await page.evaluate(() => {
      const i = document.createElement("input");
      i.id = "__probe_input";
      document.querySelector('[data-slot="sidebar-inset"]')?.prepend(i);
    });
    await page.focus("#__probe_input");
    await page.keyboard.press("Control+b");
    await page.waitForTimeout(300);
    seq.push("input:" + (await state(page)));
    if (await page.$('[data-sidebar="input"]')) {
      await page.focus('[data-sidebar="input"]');
      await page.keyboard.press("Control+b");
      await page.waitForTimeout(300);
      seq.push("sidebar-input:" + (await state(page)));
    }
    // Not compared: Playwright's "Control+Shift+b" sends key "b" (a real Shift+B sends "B", which shadcn ignores).
    return { seq, focusAfter: await focusDesc(page) };
  },

  async iconTooltips(page) {
    await page.mouse.click(...(await center(page, S.trigger)));
    await page.waitForTimeout(400);
    const s = await snap(page);
    const first = await page.evaluate((sel) => [...document.querySelectorAll(sel)].findIndex((b) => b.closest('[data-sidebar="content"]')), S.button);
    const b = (await page.locator(S.button).nth(first).boundingBox())!;
    const labelStyle = await styles(page, S.label, ["opacity", "margin-top"]);
    const btnStyle = await styles(page, S.button, ["width", "height", "padding-left", "overflow"], first);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    const t0 = Date.now();
    let tip: Json = null;
    while (Date.now() - t0 < 1500 && !tip) {
      tip = await page.evaluate((TIP) => {
        const t = document.querySelector(TIP);
        const r = t?.getBoundingClientRect();
        return t && r ? { text: t.textContent!.trim(), x: Math.round(r.x), y: Math.round(r.y + r.height / 2), w: Math.round(r.width) } : null;
      }, TIP);
      if (!tip) await page.waitForTimeout(16);
    }
    const tipMs = Date.now() - t0;
    await page.mouse.move(700, 700);
    await page.waitForTimeout(400);
    const gone = await page.evaluate((TIP) => !document.querySelector(TIP), TIP);
    await page.focus(S.trigger);
    let focusTip: string | null = null;
    for (let i = 0; i < 9 && !focusTip; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(150);
      focusTip = await page.evaluate((TIP) => document.querySelector(TIP)?.textContent?.trim() ?? null, TIP);
    }
    return {
      collapsible: s.collapsible,
      containerW: s.container?.[2],
      btnBox: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)],
      labelStyle,
      btnStyle,
      tip,
      tipMs,
      gone,
      focusTip,
      focusAt: await focusDesc(page),
    };
  },

  async buttonStates(page) {
    const idx = await page.evaluate(
      (sel) =>
        [...document.querySelectorAll(sel)].findIndex(
          (b) =>
            b.closest('[data-sidebar="content"]') &&
            b.getAttribute("data-active") !== "true" &&
            !b.hasAttribute("aria-expanded") &&
            !b.hasAttribute("aria-haspopup"),
        ),
      S.button,
    );
    const props = [
      "background-color",
      "color",
      "outline-style",
      "outline-width",
      "box-shadow",
      "font-weight",
      "height",
      "border-radius",
      "cursor",
      "transform",
    ];
    const idle = await styles(page, S.button, props, idx);
    const box = (await page.locator(S.button).nth(idx).boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + box.height / 2);
    await page.waitForTimeout(250);
    const hover = await styles(page, S.button, props, idx);
    await page.mouse.down();
    await page.waitForTimeout(120);
    const active = await styles(page, S.button, props, idx);
    await page.mouse.up();
    await page.mouse.move(700, 700);
    await page.waitForTimeout(250);
    const activeIdx = await page.evaluate((sel) => [...document.querySelectorAll(sel)].findIndex((b) => b.getAttribute("data-active") === "true"), S.button);
    const isActive = activeIdx >= 0 ? await styles(page, S.button, props, activeIdx) : null;
    await page.focus(S.trigger);
    let focusVisible: Json = null;
    for (let i = 0; i < 12 && !focusVisible; i++) {
      await page.keyboard.press("Tab");
      if (await page.evaluate((sel) => !!document.activeElement?.matches(sel), S.button)) {
        await page.waitForTimeout(150);
        focusVisible = await page.evaluate((props) => {
          const cs = getComputedStyle(document.activeElement!);
          return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]));
        }, props);
      }
    }
    return { idle, hover, active, isActive, focusVisible };
  },

  async menuAction(page) {
    const n = await page.locator(S.action).count();
    if (!n) return { actions: 0 };
    const aria = await ariaOf(page, S.action);
    const before = await styles(page, S.action, ["opacity", "visibility"]);
    const item = (await page.locator(S.action).first().locator("xpath=..").boundingBox())!;
    await page.mouse.move(item.x + 30, item.y + item.height / 2);
    await page.waitForTimeout(250);
    const hovered = await styles(page, S.action, ["opacity", "background-color"]);
    const box = (await page.locator(S.action).first().boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
    const menu = await page.evaluate(() => {
      const m = document.querySelector('[role="menu"]');
      const r = m?.getBoundingClientRect();
      return m && r ? { x: Math.round(r.x), y: Math.round(r.y), items: [...m.querySelectorAll('[role="menuitem"]')].map((i) => i.textContent!.trim()) } : null;
    });
    const openOpacity = await styles(page, S.action, ["opacity"]);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    return {
      actions: n,
      aria,
      before,
      hovered,
      actionBox: [Math.round(box.x - item.x), Math.round(box.y - item.y), Math.round(box.width)],
      menu,
      openOpacity,
      focusAfter: await focusDesc(page),
    };
  },

  async collapsibleSub(page) {
    const sel = '[data-sidebar="content"] [data-sidebar="menu-button"][aria-expanded]:not([aria-haspopup])';
    const idx = await page.evaluate((sel) => [...document.querySelectorAll(sel)].findIndex((b) => b.getAttribute("aria-expanded") === "false"), sel);
    if (idx < 0) return { closedTrigger: false };
    const aria = await ariaOf(page, sel, idx);
    // The chevron: the last svg's own or its wrapper's rotation.
    const chevron = () =>
      page.evaluate(
        ({ sel, idx }) => {
          const b = document.querySelectorAll(sel)[idx]!;
          const svg = [...b.querySelectorAll("svg")].at(-1);
          if (!svg) return null;
          const own = getComputedStyle(svg);
          const wrap = svg.parentElement !== b ? getComputedStyle(svg.parentElement!) : null;
          return {
            rotate: own.rotate !== "none" ? own.rotate : (wrap?.rotate ?? "none"),
            transform: own.transform !== "none" ? own.transform : (wrap?.transform ?? "none"),
          };
        },
        { sel, idx },
      );
    const chevron0 = await chevron();
    const box = (await page.locator(sel).nth(idx).boundingBox())!;
    await page.mouse.click(box.x + 30, box.y + box.height / 2);
    const heights = await page.evaluate(
      ({ sel, idx }) =>
        new Promise<[number, number][]>((done) => {
          const li = document.querySelectorAll(sel)[idx]!.closest("li")!;
          const out: [number, number][] = [];
          const t0 = performance.now();
          const tick = () => {
            out.push([Math.round(performance.now() - t0), Math.round(li.getBoundingClientRect().height)]);
            if (performance.now() - t0 < 500) requestAnimationFrame(tick);
            else done(out);
          };
          tick();
        }),
      { sel, idx },
    );
    const chevron1 = await chevron();
    const expanded = (await ariaOf(page, sel, idx))?.["aria-expanded"];
    const focus = await focusDesc(page);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    const enter = (await ariaOf(page, sel, idx))?.["aria-expanded"];
    await page.keyboard.press("Space");
    await page.waitForTimeout(400);
    const space = (await ariaOf(page, sel, idx))?.["aria-expanded"];
    return { aria, chevron0, chevron1, expanded, heightAnim: span(heights), focus, enter, space };
  },

  async dropdowns(page) {
    const out: Record<string, Json> = {};
    for (const [name, scope] of [
      ["header", '[data-sidebar="header"]'],
      ["footer", '[data-sidebar="footer"]'],
    ] as const) {
      const sel = `${scope} ${S.button}`;
      if (!(await page.$(sel))) continue;
      const aria = await ariaOf(page, sel);
      const b = (await page.locator(sel).first().boundingBox())!;
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await page.waitForTimeout(350);
      // The popover box (Radix: the menu itself; cdk: the Popover around the menu).
      const menu = await page.evaluate(() => {
        const m = document.querySelector('[role="menu"]');
        const box = m?.closest('[data-slot="popover"], .rv-Popover, [data-radix-popper-content-wrapper] > *') ?? m;
        const r = box?.getBoundingClientRect();
        return r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), focus: document.activeElement?.getAttribute("role") } : null;
      });
      const expanded = (await ariaOf(page, sel))?.["aria-expanded"];
      await page.keyboard.press("ArrowDown");
      const focus2 = await focusDesc(page);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(350);
      out[name] = { aria, expanded, trigger: [Math.round(b.x), Math.round(b.y), Math.round(b.width)], menu, focus2, focusAfter: await focusDesc(page) };
    }
    return out;
  },

  async focusOrder(page) {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const seq: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const d = await focusDesc(page);
      if (d === seq[0]) break;
      seq.push(d);
    }
    return seq;
  },

  async mobile(page) {
    const out: Record<string, Json> = {};
    const [x, y] = await center(page, S.trigger);
    const t0 = Date.now();
    await page.mouse.click(x, y);
    await page.waitForSelector('[data-mobile="true"]', { timeout: 3000 }).catch(() => {});
    out.openMs = Date.now() - t0;
    await page.waitForTimeout(600);
    out.sheet = await page.evaluate(() => {
      const s = document.querySelector('[data-mobile="true"]');
      if (!s) return null;
      const r = s.getBoundingClientRect();
      const d = s.closest('[role="dialog"]') ?? s.querySelector('[role="dialog"]');
      const html = getComputedStyle(document.documentElement).overflow;
      return {
        x: Math.round(r.x),
        w: Math.round(r.width),
        dialog: d ? { labelledby: !!d.getAttribute("aria-labelledby"), describedby: !!d.getAttribute("aria-describedby") } : null,
        // Scroll lock on html (React Aria) or body (Radix): either counts.
        scrollLocked: html === "hidden" || getComputedStyle(document.body).overflow === "hidden",
      };
    });
    out.focusOnOpen = await focusDesc(page);
    const leaks: string[] = [];
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      if (!(await page.evaluate(() => !!document.activeElement?.closest('[data-mobile="true"], [role="dialog"]')))) leaks.push(await focusDesc(page));
    }
    out.trapLeaks = leaks;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(450);
    out.afterEscape = await page.evaluate(() => !!document.querySelector('[data-mobile="true"]'));
    out.focusAfterEscape = await focusDesc(page);
    await page.mouse.click(x, y);
    await page.waitForTimeout(450);
    await page.mouse.click(page.viewportSize()!.width - 10, 400);
    await page.waitForTimeout(450);
    out.afterUnderlay = await page.evaluate(() => !!document.querySelector('[data-mobile="true"]'));
    await page.mouse.click(x, y);
    await page.waitForTimeout(450);
    const link = await page.evaluate(() => {
      const s = document.querySelector('[data-mobile="true"]');
      const b =
        s &&
        [...s.querySelectorAll('[data-sidebar="menu-button"], [data-sidebar="menu-sub-button"]')].find(
          (e) => e.tagName === "A" && e.getBoundingClientRect().height > 0,
        );
      const r = b?.getBoundingClientRect();
      return b && r ? ([r.x + 30, r.y + r.height / 2, b.textContent!.trim()] as const) : null;
    });
    if (link) {
      await page.mouse.click(link[0], link[1]);
      await page.waitForTimeout(450);
      out.afterLink = { link: link[2], open: await page.evaluate(() => !!document.querySelector('[data-mobile="true"]')) };
    }
    return out;
  },

  async swipe(page) {
    await page.mouse.click(...(await center(page, S.trigger)));
    await page.waitForTimeout(600);
    const s = await page.locator('[data-mobile="true"]').boundingBox();
    if (!s) return { sheet: false };
    // A flick towards the closed edge from the sheet's middle (60 px in 3 moves after a 20 px start).
    const y = s.y + s.height / 2;
    await page.mouse.move(s.x + s.width - 20, y);
    await page.mouse.down();
    await page.mouse.move(s.x + s.width - 40, y, { steps: 2 });
    await page.waitForTimeout(50);
    await page.mouse.move(s.x + s.width - 100, y, { steps: 3 });
    const t0 = Date.now();
    await page.mouse.up();
    const closed = await page
      .waitForFunction(() => !document.querySelector('[data-mobile="true"]'), undefined, { timeout: 3000 })
      .then(
        () => true,
        () => false,
      );
    return { closedAfterFlick: closed, unmountMs: closed ? Date.now() - t0 : null };
  },

  async coldClick(page) {
    const t0 = Date.now();
    await page.mouse.click(...(await center(page, S.trigger)));
    let st: string | null = null;
    while (Date.now() - t0 < 3000 && st !== "collapsed") {
      st = await state(page);
      if (st !== "collapsed") await page.waitForTimeout(5);
    }
    return { state: st, firstToggleMs: Date.now() - t0 };
  },
};

// ---------------------------------------------------------------------------------------------- diff
const flat = (o: Json, p = "", out: Record<string, Json> = {}) => {
  if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) flat(v, p ? `${p}.${k}` : k, out);
  else out[p] = o;
  return out;
};

/** Differing leaves per probe: `path: ref | ours`. */
export function diffResult(result: Record<string, Record<string, Json>>): string {
  const lines: string[] = [];
  for (const [probe, sides] of Object.entries(result)) {
    const a = flat(sides.ref),
      b = flat(sides.ours);
    lines.push(
      `== ${probe}${sides.refErrors ? " REF-ERRORS " + JSON.stringify(sides.refErrors) : ""}${sides.oursErrors ? " OURS-ERRORS " + JSON.stringify(sides.oursErrors) : ""}`,
    );
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])]) {
      if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) lines.push(`  ${k}: ${JSON.stringify(a[k])}  |  ${JSON.stringify(b[k])}`);
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------------------------- runner
async function main(): Promise<void> {
  const diff = arg("diff");
  if (diff) return void console.log(diffResult(JSON.parse(readFileSync(diff, "utf8"))));
  const urls = { ref: arg("ref"), ours: arg("ours") };
  if (!urls.ref || !urls.ours) throw new Error("usage: sidebar-parity.ts --ref <url> --ours <url> [--out <dir>] [--probes a,b] | --diff <result.json>");
  const out = arg("out") ?? "sidebar-parity-out";
  const only = arg("probes")?.split(",") ?? [];
  mkdirSync(out, { recursive: true });
  const MOBILE = new Set(["mobile", "swipe"]);
  const browser = await chromium.launch({ args: ["--use-mock-keychain", "--password-store=basic"] });
  const result: Record<string, Record<string, Json>> = {};
  try {
    for (const [name, probe] of Object.entries(probes)) {
      if (only.length && !only.includes(name)) continue;
      const entry: Record<string, Json> = (result[name] = {});
      for (const side of ["ref", "ours"] as const) {
        const context = await browser.newContext({ viewport: MOBILE.has(name) ? { width: 500, height: 800 } : { width: 1280, height: 800 } });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("console", (m) => void (m.type() === "error" && errors.push(m.text())));
        await page.goto(urls[side]!);
        await page.waitForSelector('[data-slot="sidebar-wrapper"]', { timeout: 5000 }).catch(() => errors.push("no wrapper"));
        await page.waitForTimeout(300);
        try {
          entry[side] = await probe(page);
        } catch (e) {
          entry[side] = { error: String((e as Error).message).split("\n")[0] };
        }
        if (errors.length) entry[side + "Errors"] = errors;
        await page.screenshot({ path: `${out}/${name}.${side}.png` });
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  writeFileSync(`${out}/result.json`, JSON.stringify(result, null, 1));
  console.log(diffResult(result));
}

if (import.meta.main) await main();
