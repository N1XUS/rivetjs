// T8: resumed pages animate without hydration (Chromium over the runtime resume harness, like kit icon). The motion
// modules are compiled per target as the Vite plugin does (resume mode, module ids `@rivetjs/motion/<file>`); their
// plain `.ts` dependencies are served type-stripped, `motion` / `motion/mini` bundled once with esbuild.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { brotliCompressSync, constants } from "node:zlib";
import { build } from "esbuild";
import { compile } from "@rivetjs/compiler";
import { Provider } from "@rivetjs/runtime/server";
import { resumableToString, type ResumeManifest } from "@rivetjs/runtime/server-resume";
import { ServerData } from "@rivetjs/router/route-context";
import type { HeadSink } from "@rivetjs/router";
import { compileSymbolModule, importServer, type ResumeSymbol } from "../../runtime/tests/resume/compile.ts";
import { rewrite, withPage, type Served } from "../../runtime/tests/resume/harness.ts";
import type { Page } from "playwright";

type Compiled = { code: string; diagnostics: { message: string }[]; symbols?: ResumeSymbol[] };
const run = (src: string, options: object): Compiled => {
  const result = (compile as unknown as (s: string, o: object) => Compiled)(src, options);
  assert.deepEqual(result.diagnostics, []);
  return result;
};
const resume = (src: string, target: "server" | "dom", module: string) => run(src, { target, filename: module, resume: { module } });
const lib = (file: string) => new URL("../" + file, import.meta.url);
const data = (code: string) => "data:text/javascript;base64," + Buffer.from(code).toString("base64");

// Server: compiled modules imported through data URLs (relative imports → file URLs / the other data URLs).
const TS = ["css", "engine", "entrance", "gestures", "layout-hook", "memo", "observe", "observe-load", "server-off", "values", "variants"];
const KIT = new URL("../../kit/transition.tsx", import.meta.url);
const serverOf = async (file: string, links: Record<string, string>, url = lib(file), module = "@rivetjs/motion/" + file) => {
  let code = resume(await readFile(url, "utf8"), "server", module).code;
  for (const name of TS) code = code.replaceAll(`"./${name}.ts"`, JSON.stringify(lib(name + ".ts").href));
  code = code.replaceAll('"#dev"', JSON.stringify(lib("dev-off.ts").href)).replaceAll('"#server"', JSON.stringify(lib("server-on.ts").href));
  for (const [from, to] of Object.entries(links)) code = code.replaceAll(`"${from}"`, JSON.stringify(to));
  code = code.replace(
    /(from |import )"((?:@rivetjs\/|motion)[^"]*)"/g,
    (_, kw: string, specifier: string) => kw + JSON.stringify(import.meta.resolve(specifier)),
  );
  return code;
};
// kit/transition (presence scopes): compiled like the motion modules (a `.tsx` the node loader would build for the DOM).
const kitServer = data(await serverOf("transition.tsx", {}, KIT, "@rivetjs/kit/transition.tsx"));
const elementServer = data(await serverOf("element.tsx", { "@rivetjs/kit/transition": kitServer }));
const tagsServer = data(await serverOf("tags.tsx", { "./element.tsx": elementServer }));
const indexServer = data(await serverOf("index.tsx", { "./tags.tsx": tagsServer, "./element.tsx": elementServer }));
const presenceServer = data(await serverOf("presence.tsx", { "@rivetjs/kit/transition": kitServer }));

// Browser: the same modules compiled for the DOM in resume mode, served under /m/.
const dom: Record<string, Compiled> = {};
const files: Record<string, Served> = {
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
};
const motionBundle = async (contents: string) =>
  (
    await build({
      stdin: { contents, resolveDir: lib(".").pathname },
      bundle: true,
      format: "esm",
      write: false,
      logLevel: "error",
    })
  ).outputFiles[0]!.text;
files["/motion.mjs"] = await motionBundle('export { inView, spring, stagger } from "motion";');
files["/motion-mini.mjs"] = await motionBundle('export { animate } from "motion/mini";');
const at = (code: string) =>
  rewrite(code)
    .replaceAll('"#server"', '"/m/server-off.ts"')
    .replaceAll('"motion/mini"', '"/motion-mini.mjs"')
    .replaceAll('"motion"', '"/motion.mjs"')
    .replaceAll('"@rivetjs/router/route-context"', '"/m/route-context.ts"')
    .replaceAll('"@rivetjs/kit/transition"', '"/k/transition.mjs"')
    .replaceAll('"@rivetjs/motion"', '"/m/index.mjs"')
    .replaceAll('"@rivetjs/motion/presence"', '"/m/presence.mjs"')
    .replaceAll('"./element.tsx"', '"/m/element.mjs"')
    .replaceAll('"./tags.tsx"', '"/m/tags.mjs"');
for (const file of ["element", "tags", "index", "presence"]) {
  dom[file] = resume(await readFile(lib(file + ".tsx"), "utf8"), "dom", "@rivetjs/motion/" + file + ".tsx");
  files["/m/" + file + ".mjs"] = at(dom[file]!.code);
}
dom.kit = resume(await readFile(KIT, "utf8"), "dom", "@rivetjs/kit/transition.tsx");
files["/k/transition.mjs"] = at(dom.kit.code);
for (const name of TS) files["/m/" + name + ".ts"] = at(stripTypeScriptTypes(await readFile(lib(name + ".ts"), "utf8")));
files["/m/route-context.ts"] = at(stripTypeScriptTypes(await readFile(new URL("../../router/client/route-context.ts", import.meta.url), "utf8")));

const PAGE = `import { signal } from "@rivetjs/reactivity";
import { Motion } from "@rivetjs/motion";
export function Page() {
  const x = signal(0), presses = signal(0), on = signal(false);
  return (
    <main>
      <Motion.div id="static" animate={{ opacity: 0.5 }} />
      <Motion.div id="hover" whileHover={{ scale: 1.5 }} transition={{ duration: 0.05 }} style={{ width: "40px", height: "40px" }} />
      <Motion.button id="press" whilePress={{ scale: 0.5 }} transition={{ duration: 0.05 }} onPress={() => presses.set(presses() + 1)}>p</Motion.button>
      <output id="count">{presses()}</output>
      <Motion.div id="enter" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} />
      <Motion.div id="live" animate={{ x: x() }} transition={{ duration: 0.05 }} />
      <button id="move" onClick={() => x.set(100)}>m</button>
      {on() ? <Motion.p id="region" whileHover={{ opacity: 0.25 }} transition={{ duration: 0.05 }}>on</Motion.p> : <Motion.span id="region" whileHover={{ opacity: 0.5 }} transition={{ duration: 0.05 }}>off</Motion.span>}
      <button id="toggle" onClick={() => on.set(!on())}>t</button>
      <div style={{ height: "3000px" }} />
      <Motion.div id="view" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 0.05 }} viewport={{ once: true }}>v</Motion.div>
    </main>
  );
}`;
// Static, entrance and gesture elements only (no live animate, no in-view): nothing boots.
const quietPage = (gestures: number) => `import { Motion } from "@rivetjs/motion";
export function Page() {
  return (
    <main>
      {Array.from({ length: 20 }, (_, i) => <Motion.div class="s" animate={{ opacity: 0.5 }}>{i}</Motion.div>)}
      <Motion.div id="enter" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>e</Motion.div>
      {Array.from({ length: ${gestures} }, (_, i) => <Motion.div class="g" whileHover={{ scale: 1.2 }} transition={{ duration: 0.05 }}>{i}</Motion.div>)}
    </main>
  );
}`;

/** Serve `src` resumed at `path`; returns the server HTML and the head CSS the Motion elements pushed. */
async function site(src: string, path: string, module: string): Promise<{ html: string; state: string; css: string }> {
  const pageDom = resume(src, "dom", module);
  const symbols = [...Object.values(dom).flatMap((c) => c.symbols ?? []), ...(pageDom.symbols ?? [])];
  const server = await importServer<{ Page(): never }>(
    resume(src, "server", module)
      .code.replaceAll('"@rivetjs/motion"', JSON.stringify(indexServer))
      .replaceAll('"@rivetjs/motion/presence"', JSON.stringify(presenceServer)),
  );
  const chunk = (s: ResumeSymbol) => path + "c/" + s.id.split("#")[0]!.replace(/\W/g, "_") + "-" + s.component + ".js";
  const manifest: ResumeManifest = { hash: "motion", runtime: "/rt.js", symbols: Object.fromEntries(symbols.map((s) => [s.id, chunk(s)])) };
  const styles: string[] = [];
  const headSink: HeadSink = {
    nonce: undefined,
    push: (_level, head) => (styles.push(...(head.styles ?? []).map((s) => s.css)), undefined),
  };
  const html = await resumableToString(
    () =>
      Provider({ token: ServerData, value: { url: new URL("http://rivet.test" + path), data: undefined, headSink } as never, children: () => server.Page() }),
    { manifest },
  );
  const css = styles.join("");
  files[path + "page.mjs"] = at(pageDom.code);
  const byChunk: Record<string, ResumeSymbol[]> = {};
  for (const symbol of symbols) (byChunk[chunk(symbol)] ??= []).push(symbol);
  for (const [file, list] of Object.entries(byChunk)) {
    const id = list[0]!.id;
    const from = id.startsWith("@rivetjs/kit/")
      ? "/k/transition.mjs"
      : id.startsWith("@rivetjs/motion/")
        ? "/m/" + id.split("#")[0]!.slice(16).replace(".tsx", ".mjs")
        : path + "page.mjs";
    files[file] = at(compileSymbolModule(list, from));
  }
  files[path] = `<!doctype html><html><head><style>${css}</style></head><body>${html}</body></html>`;
  const state = html.split('<script type="rivet/state"')[1]?.split("</script>")[0] ?? "";
  return { html, state, css };
}
// Presence opened on the server: closing it on the resumed page plays the exit before the unmount.
const PRESENCE = `import { signal } from "@rivetjs/reactivity";
import { Motion } from "@rivetjs/motion";
import { Presence } from "@rivetjs/motion/presence";
export function Page() {
  const open = signal(true);
  return (
    <main>
      <button id="close" onClick={() => open.set(!open())}>c</button>
      <Presence show={open}>{() => <Motion.div id="box" animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: "linear" }}>b</Motion.div>}</Presence>
    </main>
  );
}`;
// PresenceFor rows rendered on the server: removing one on the resumed page keeps it at its index while it exits;
// re-adding it during the exit restores the same row.
const PRESENCE_FOR = `import { signal } from "@rivetjs/reactivity";
import { Motion } from "@rivetjs/motion";
import { PresenceFor } from "@rivetjs/motion/presence";
export function Page() {
  const items = signal(["a", "b", "c"]);
  return (
    <main>
      <button id="drop" onClick={() => items.set(["a", "c"])}>d</button>
      <button id="back" onClick={() => items.set(["a", "b", "c"])}>b</button>
      <ul id="list">
        <PresenceFor each={items} by={(x) => x}>
          {(x) => <Motion.li id={x()} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: "linear" }}>{x()}</Motion.li>}
        </PresenceFor>
      </ul>
    </main>
  );
}`;
// Notification stack (ui-docs motion-toast-stack): server rows with an entrance, add at the top, dismiss per row.
const PRESENCE_STACK = `import { signal } from "@rivetjs/reactivity";
import { Motion } from "@rivetjs/motion";
import { PresenceFor } from "@rivetjs/motion/presence";
export function Page() {
  const items = signal(["a", "b", "c"]);
  return (
    <main>
      <button id="add" onClick={() => items.update((list) => ["n" + list.length, ...list])}>add</button>
      <ul id="list">
        <PresenceFor each={items} by={(x) => x}>
          {(x) => (
            <Motion.li id={x()} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 48 }} transition={{ duration: 0.4, ease: "linear" }}>
              {x()}
              <button id={"dismiss-" + x()} onClick={() => items.update((list) => list.filter((y) => y !== x()))}>x</button>
            </Motion.li>
          )}
        </PresenceFor>
      </ul>
    </main>
  );
}`;
const main = await site(PAGE, "/", "src/page.tsx");
await site(PRESENCE, "/presence/", "src/presence.tsx");
await site(PRESENCE_FOR, "/presence-for/", "src/presence-for.tsx");
await site(PRESENCE_STACK, "/presence-stack/", "src/presence-stack.tsx");
const quiet = await site(quietPage(20), "/quiet/", "src/quiet.tsx");
const quiet40 = await site(quietPage(40), "/quiet40/", "src/quiet.tsx");
const br = (text: string) => brotliCompressSync(Buffer.from(text), { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;

const chunks = (requests: string[]) => requests.filter((r) => r.includes("/c/") || r.startsWith("/m/") || r.startsWith("/motion"));
const listen = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
};
const computed = (page: Page, selector: string, property: string) =>
  page.evaluate(([selector, property]) => getComputedStyle(document.querySelector(selector!)!).getPropertyValue(property!), [selector, property] as const);

test("server: final state inline (visible without JS), entrance rule in the head, in-view starts at initial", () => {
  assert.match(main.html, /<div id="static" style="opacity:0.5"[^>]*><\/div>/);
  assert.match(main.html, /<div id="enter" style="opacity:1;translate:0px 0px" data-mve="\w+"/);
  assert.match(main.css, /@keyframes rv-mve-\w+-1\{0%\{opacity:0;translate:0px 20px\}100%\{opacity:1;translate:0px 0px\}\}/);
  assert.match(main.html, /<div id="view" style="opacity:0"/);
});

test("resume: static, entrance and gesture elements boot nothing and load no chunk before input; gesture state bytes", async () => {
  const head = quiet.state.split(">")[0]!;
  assert.doesNotMatch(head, /data-boot/);
  // Only the handlers' recipes are state (per gesture element: its props recipe + the group flag).
  const perElement = (br(quiet40.state) - br(quiet.state)) / 20;
  assert.ok(perElement <= 12, `${perElement} B br per gesture element`);
  console.log(`gesture state: ${perElement} B br per element; 20 elements: ${br(quiet.state)} B br`);
  await withPage(files, async (page, requests) => {
    const errors = listen(page);
    await page.goto("http://rivet.test/quiet/");
    // The entrance plays from CSS alone.
    assert.match(await computed(page, "#enter", "animation-name"), /^rv-mve-/);
    await page.waitForLoadState("load");
    const early = chunks(requests);
    assert.ok(
      early.every((r) => /tags_tsx-div|element_tsx/.test(r)),
      "before input only the planned gesture chunks: " + early.join(" "),
    );
    // First hover after idle (chunks preloaded): the animation starts within a frame of pointerenter.
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const el = document.querySelector(".g")!;
      el.addEventListener(
        "pointerenter",
        () => {
          const start = performance.now();
          const check = () =>
            el.getAnimations().length ? ((window as never as { latency: number }).latency = performance.now() - start) : requestAnimationFrame(check);
          queueMicrotask(check);
        },
        { once: true, capture: true },
      );
    });
    await page.hover(".g");
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".g")!).scale === "1.2");
    const latency = await page.evaluate(() => (window as never as { latency: number }).latency);
    console.log(`first hover (preloaded): animation after ${latency.toFixed(1)} ms; requests ${chunks(requests).join(" ")}`);
    // A frame budget: enforced off CI (CI's runners: 175–360 ms; root vitest.config.ts PERF_BUDGETS).
    if (!process.env.CI || process.env.RIVET_PERF_BUDGETS === "1") assert.ok(latency <= 17, `${latency} ms`);
    assert.ok(!requests.some((r) => r.includes("animate")), "no hybrid / animate chunk");
    assert.deepEqual(errors, []);
  });
});

test("resume: cold hover (chunks held) animates once they arrive, the pointer still inside", async () => {
  const delays = Object.fromEntries(
    Object.keys(files)
      .filter((f) => f.startsWith("/quiet/c/") || f.startsWith("/m/"))
      .map((f) => [f, 400]),
  );
  await withPage(
    files,
    async (page) => {
      const errors = listen(page);
      await page.goto("http://rivet.test/quiet/");
      await page.hover(".g");
      await page.waitForFunction(() => getComputedStyle(document.querySelector(".g")!).scale === "1.2", null, { timeout: 5000 });
      assert.deepEqual(errors, []);
    },
    { delays },
  );
});

test("resume: press, live animate (same element, no re-creation), region re-creation, in-view", async () => {
  await withPage(files, async (page, requests) => {
    const errors = listen(page);
    await page.goto("http://rivet.test/");
    assert.deepEqual(
      chunks(requests).filter((r) => !r.includes("/c/")),
      [],
      "no motion module before input",
    );
    // Hover: scale animates, returns on leave (moved outside the 1.5 × 40 px box).
    await page.hover("#hover");
    await page.waitForFunction(() => getComputedStyle(document.getElementById("hover")!).scale === "1.5");
    await page.mouse.move(400, 10);
    await page.waitForFunction(() => getComputedStyle(document.getElementById("hover")!).scale === "1");
    // Press (cold pointerdown replayed after the release): onPress runs once.
    await page.click("#press");
    await page.waitForFunction(() => document.getElementById("count")!.textContent === "1");
    await page.waitForTimeout(100);
    assert.equal(await page.textContent("#count"), "1");
    // Live animate: the server element animates (no re-creation).
    await page.evaluate(() => ((window as never as { live: Element }).live = document.getElementById("live")!));
    await page.click("#move");
    await page.waitForFunction(() => getComputedStyle(document.getElementById("live")!).translate === "100px");
    assert.ok(await page.evaluate(() => (window as never as { live: Element }).live === document.getElementById("live")));
    // A region re-created on its first change: the new branch's Motion element hovers.
    await page.click("#toggle");
    await page.waitForFunction(() => document.getElementById("region")?.localName === "p");
    await page.hover("#region");
    await page.waitForFunction(() => getComputedStyle(document.getElementById("region")!).opacity === "0.25");
    // In view: nothing until scrolled into view, then the in-view target.
    assert.equal(await computed(page, "#view", "opacity"), "0");
    await page.evaluate(() => document.getElementById("view")!.scrollIntoView());
    await page.waitForFunction(() => getComputedStyle(document.getElementById("view")!).opacity === "1");
    assert.ok(!requests.some((r) => r.includes("animate")), "no hybrid / animate chunk");
    assert.deepEqual(errors, []);
  });
});

test("resume + reduced motion: the CSS entrance keeps opacity only; gestures jump transforms", async () => {
  await withPage(files, async (page) => {
    const errors = listen(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("http://rivet.test/quiet/");
    assert.match(await computed(page, "#enter", "animation-name"), /^rv-mve-\w+-1r$/);
    await page.hover(".g");
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".g")!).scale === "1.2");
    assert.equal(await page.evaluate(() => document.querySelector(".g")!.getAnimations().length), 0, "transform jumped");
    assert.deepEqual(errors, []);
  });
});

test("resume: a server-open Presence plays its exit on the resumed page, then unmounts", async () => {
  await withPage(files, async (page) => {
    const errors = listen(page);
    await page.goto("http://rivet.test/presence/");
    assert.equal(await computed(page, "#box", "opacity"), "1");
    const started = Date.now();
    await page.click("#close");
    await page.waitForFunction(() => document.getElementById("box")?.hasAttribute("data-exiting") === true);
    await page.waitForFunction(() => Number(getComputedStyle(document.getElementById("box")!).opacity) < 1);
    await page.waitForFunction(() => document.getElementById("box") === null);
    assert.ok(Date.now() - started >= 250, "unmount held by the exit");
    assert.deepEqual(errors, []);
  });
});

test("resume: PresenceFor server rows never replay their entrance; the first add / dismiss animates only that row", async () => {
  await withPage(files, async (page) => {
    const errors = listen(page);
    // Element id → animation kinds running on it (`enter` = a CSS entrance, `waapi` = JS); rows without any omitted.
    const animating = () =>
      page.evaluate(() =>
        [...document.getElementById("list")!.children]
          .map(
            (li) => [li.id + (li.hasAttribute("data-exiting") ? "*" : ""), li.getAnimations().map((a) => ("animationName" in a ? "enter" : "waapi"))] as const,
          )
          .filter(([, kinds]) => kinds.length)
          .map(([id, kinds]) => id + ":" + [...new Set(kinds)].join("+"))
          .join(),
      );
    const ids = () => page.evaluate(() => [...document.getElementById("list")!.children].map((li) => li.id).join());
    // First interaction = add (the region is re-created): only the new row enters.
    await page.goto("http://rivet.test/presence-stack/");
    assert.equal(await ids(), "a,b,c");
    await page.waitForTimeout(500);
    assert.equal(await animating(), "");
    await page.click("#add");
    await page.waitForFunction(() => document.getElementById("n3") !== null);
    assert.equal(await ids(), "n3,a,b,c");
    assert.equal(await animating(), "n3:enter");
    // First interaction = dismiss: one exit on that row, the others stay still; then an add enters once.
    await page.goto("http://rivet.test/presence-stack/");
    await page.waitForTimeout(500);
    await page.click("#dismiss-b");
    await page.waitForFunction(() => document.getElementById("b")?.hasAttribute("data-exiting") === true);
    assert.equal(await animating(), "b*:waapi");
    await page.waitForFunction(() => document.getElementById("b") === null);
    assert.equal(await ids(), "a,c");
    assert.equal(await animating(), "");
    await page.click("#add");
    await page.waitForFunction(() => document.getElementById("n2") !== null);
    assert.equal(await animating(), "n2:enter");
    assert.deepEqual(errors, []);
  });
});

test("resume: PresenceFor removal exits in place (index kept, data-exiting); re-adding during the exit restores the row", async () => {
  await withPage(files, async (page) => {
    const errors = listen(page);
    await page.goto("http://rivet.test/presence-for/");
    const ids = () =>
      page.evaluate(() => [...document.getElementById("list")!.children].map((li) => li.id + (li.hasAttribute("data-exiting") ? "*" : "")).join());
    assert.equal(await ids(), "a,b,c");
    await page.click("#drop");
    await page.waitForFunction(() => document.getElementById("b")?.hasAttribute("data-exiting") === true);
    assert.equal(await ids(), "a,b*,c");
    await page.evaluate(() => ((window as never as { b: Element }).b = document.getElementById("b")!));
    await page.click("#back");
    await page.waitForFunction(() => document.getElementById("b")?.hasAttribute("data-exiting") === false);
    assert.equal(await ids(), "a,b,c");
    assert.ok(await page.evaluate(() => document.getElementById("b") === (window as never as { b: Element }).b), "the same row");
    await page.click("#drop");
    await page.waitForFunction(() => document.getElementById("b") === null);
    assert.equal(await ids(), "a,c");
    assert.deepEqual(errors, []);
  });
});
