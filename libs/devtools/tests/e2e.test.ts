// The panel end to end on the Vite dev server: a copy of the router fixture app (its files are edited
// here, so other suites keep theirs), driven in Chromium. Needs the built UI (`dependsOn: build`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium, type FrameLocator, type Locator, type Page } from "playwright";

const fixture = new URL("../../router/tests/fixture/", import.meta.url).pathname;

async function copyFixture(): Promise<string> {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/devtools-e2e-"));
  await cp(fixture, root, { recursive: true, filter: (path) => !/[/\\](\.rivet|dist)$/.test(path) });
  // A handler that throws: the Errors panel lists it with its source location.
  // Contexts in a plain .ts module (named by the dev transform): a provided signal and a plain value.
  await writeFile(
    resolve(root, "src/theme.ts"),
    'import { createContext } from "@rivetjs/reactivity";\nexport const ThemeContext = createContext<() => string>(() => "light");\nexport const LabelContext = createContext("none");\n',
  );
  const page = resolve(root, "src/routes/items/[id].tsx");
  const source = await readFile(page, "utf8");
  await writeFile(
    page,
    source
      .replace(
        "    </article>",
        '      <button type="button" id="boom" onClick={() => {\n        throw new Error("boom from a handler");\n      }}>\n        Boom\n      </button>\n    </article>',
      )
      // Values to inspect and edit, named signals (a collision), and a computed.
      .replace(
        'import { signal } from "@rivetjs/reactivity";',
        'import { computed, signal, useContext } from "@rivetjs/reactivity";\nimport { Provider, clientEffect } from "@rivetjs/runtime/dom";\nimport { LabelContext, ThemeContext } from "../../theme.ts";\n' +
          SHELF +
          BADGE,
      )
      .replace(
        "  const likes = signal(0);",
        [
          "  const likes = signal(0);",
          '  const settings = signal({ theme: { mode: "dark", size: 2 }, tags: ["a", "b"] });',
          // Filled in the browser: a Cart instance, a cycle and a bigint cannot be serialized for resume.
          // (Starts as an object, so a hot update keeps it: same kind of value.)
          "  const shelf = signal<Partial<ReturnType<typeof shelfValue>>>({});",
          "  clientEffect(() => shelf.set(shelfValue()));",
          "  const doubled = computed(() => likes() * 2);",
          "  const first = { count: signal(1) }, second = { count: signal(2) };",
          "  void first, second;",
          '  const theme = signal("dark");',
        ].join("\n"),
      )
      .replace(
        '<p id="loads">',
        '<p id="mode">{settings().theme.mode}</p>\n      <p id="doubled">{String(doubled())}</p>\n      <p id="cart">{shelf().cart ? String(shelf().cart!.items[0]) : ""}</p>\n      <p id="when">{shelf().when ? shelf().when!.toISOString() : ""}</p>\n' +
          '      <Provider token={ThemeContext} value={theme}><Provider token={LabelContext} value="plain"><Badge label="hi" count={likes} /></Provider></Provider>\n      <p id="loads">',
      ),
  );
  return root;
}
// Module-level helpers for the inspected value: a class with a prototype getter (never invoked by the
// panel), Map, Set, a cycle, a long string, a Date.
const SHELF = `
class Cart {
  items = [1, 2];
  get total() {
    (globalThis as { getterRan?: boolean }).getterRan = true;
    return 0;
  }
}
function shelfValue() {
  const loop: Record<string, unknown> = { name: "loop" };
  loop.self = loop;
  return { map: new Map([["k", 1]]), set: new Set(["s"]), cart: new Cart(), loop, text: "x".repeat(300), when: new Date(0), big: 10n };
}`;
// A context consumer with a value prop and an accessor prop (both overridable).
const BADGE = `
function Badge(props: { label: string; count: () => number }) {
  const theme = useContext(ThemeContext);
  const label = useContext(LabelContext);
  return <span id="badge">{theme()}/{label}/{props.label}/{String(props.count())}</span>;
}`;

const open = async (page: Page): Promise<FrameLocator> => {
  await page.keyboard.press("Alt+Shift+R");
  const panel = page.frameLocator("rivet-devtools iframe");
  await panel.locator(".tabs").waitFor();
  return panel;
};

test("DevTools panel: tree, named live signals, value tree, editing, update highlight, HMR, errors, open in editor, pop-out", async () => {
  const root = await copyFixture();
  const server = await createServer({ root, configFile: resolve(root, "vite.config.ts"), logLevel: "silent", server: { port: 0 } });
  await server.listen();
  const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch({ headless: true });
  try {
    // Tall enough that page controls stay above the docked panel (the fixture page grew with the edit fixtures).
    const context = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const editorRequests: string[] = [];
    await page.route("**/__open-in-editor*", async (route) => {
      editorRequests.push(new URL(route.request().url()).searchParams.get("file") ?? "");
      await route.fulfill({ status: 200, body: "" });
    });
    await page.goto(origin + "/items/1");
    await page.getByRole("button", { name: "Layout clicks 0" }).waitFor();
    // The toggle button lives in the overlay's shadow root, outside the app's containers. (The page
    // resumes: its server HTML is live before the agent module has loaded.)
    await page.locator("rivet-devtools button.toggle").waitFor({ state: "attached" });
    assert.equal(await page.locator("rivet-devtools button.toggle").count(), 1);

    // Components: mount root → layout → page, named by their hot ids' implementations.
    const panel = await open(page);
    const row = (name: string) => panel.locator(`.row[data-name="${name}"]`);
    await row("Layout").waitFor();
    await row("ItemPage").waitFor();
    // Collapse hides a subtree; the name filter keeps matches and their ancestors.
    await row("App").locator("button.toggle").click();
    await row("ItemPage").waitFor({ state: "detached" });
    await row("Layout").waitFor({ state: "detached" });
    assert.equal(await row("App").locator("button.toggle").getAttribute("aria-expanded"), "false");
    await row("App").locator("button.toggle").click();
    await row("ItemPage").waitFor();
    const all = await panel.locator(".row").count();
    await panel.locator(".tree-filter").fill("itempage");
    await panel
      .locator(".tree-rows .branch[data-rows]")
      .and(panel.locator(":not([data-rows='" + all + "'])"))
      .waitFor();
    assert.ok((await panel.locator(".row").count()) < all);
    await row("App").waitFor();
    await row("ItemPage").waitFor();
    // The page renders inside the layout (its Router level is the layout's children): kept as an ancestor; the layout's
    // other child is not.
    assert.equal(await row("Layout").count(), 1);
    assert.equal(await row("Note").count(), 0);
    await panel.locator(".tree-filter").fill("");
    await panel.locator(".tree-rows .branch[data-rows='" + all + "']").waitFor();

    // Owner pane: the layout's `clicks` signal, named after its binding, live.
    await row("Layout").locator(".tag").click();
    const owner = panel.locator('[data-owner="Layout"]');
    const clicks = owner.locator("li.signal").first();
    assert.equal(await clicks.getAttribute("data-name"), "Layout › clicks");
    // Under the component header, names drop the component prefix (the full name stays the title).
    assert.equal(await clicks.locator(".name").first().textContent(), "clicks");
    assert.equal(await clicks.locator(".name").first().getAttribute("title"), "Layout › clicks (#" + (await clicks.getAttribute("data-id")) + ")");
    await clicks.locator(".value", { hasText: "0" }).waitFor();
    await page.getByRole("button", { name: "Layout clicks 0" }).click();
    await clicks.locator(".value", { hasText: "1" }).waitFor();

    // Edit the signal as JSON: the page updates through `.set`.
    await clicks.locator("button.edit-toggle").click();
    await clicks.locator("input.json").fill("5");
    await clicks.locator("button.set").click();
    await page.getByRole("button", { name: "Layout clicks 5" }).waitFor();
    await clicks.locator(".value", { hasText: "5" }).waitFor();
    // Not JSON: rejected in the panel, the page keeps its value.
    await clicks.locator("button.edit-toggle").click();
    await clicks.locator("input.json").fill("{nope");
    await clicks.locator("button.set").click();
    await clicks.locator(".error").waitFor();
    assert.equal(await page.textContent("#layout-clicks"), "Layout clicks 5");

    // Hovering a row outlines the component's region in the page.
    await row("ItemPage").hover();
    await page.locator("rivet-devtools .box:not([hidden])").waitFor();
    // Picker: clicking a page element selects its component (the click does not reach the page).
    await panel.locator("button.pick").click();
    await page.locator("#likes").click();
    await panel.locator('[data-owner="ItemPage"]').waitFor();
    assert.equal(await page.textContent("#likes"), "Likes 0");
    // Isolation: the panel's own Rivet app has no hook, so its signals never reach the page's stream.
    assert.equal(await page.frame({ url: /__rivet\/devtools\// })!.evaluate(() => Symbol.for("rivet.devtools") in globalThis), false);

    // Names: bindings and object properties, scoped by component; a repeated name is numbered.
    const item = panel.locator('[data-owner="ItemPage"]');
    assert.deepEqual(await item.locator("li.signal").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-name"))), [
      "ItemPage › likes",
      "ItemPage › settings",
      "ItemPage › shelf",
      "ItemPage › count",
      "ItemPage › count#2",
      "ItemPage › theme",
    ]);
    await item.locator('li.computed[data-name="ItemPage › doubled"]').waitFor();
    assert.equal(await item.locator('li.computed[data-name="ItemPage › doubled"] .name').first().textContent(), "doubled");

    // Value tree: lazy expansion of Map, Set, class instance (prototype getter listed, not run), a cycle,
    // a long string and a Date.
    const vnode = (scope: Locator, key: string) => scope.locator(`li.vnode[data-key='${key}']`).first();
    const expand = (node: Locator) => node.locator(":scope > .vline > button.toggle").click();
    const shelf = item.locator('li.signal[data-name="ItemPage › shelf"] ul.vtree > li.vnode');
    await expand(shelf);
    const map = vnode(shelf, "map");
    await expand(map);
    await vnode(map, '"k"').locator(".value", { hasText: /^1$/ }).waitFor();
    const set = vnode(shelf, "set");
    await expand(set);
    await vnode(set, "0").locator(".value", { hasText: '"s"' }).waitFor();
    const cart = vnode(shelf, "cart");
    assert.equal(await cart.locator(":scope > .vline > .value").textContent(), "Cart {items}");
    await expand(cart);
    await vnode(cart, "items").locator(".value", { hasText: "Array(2)" }).waitFor();
    const total = vnode(cart, "total");
    await total.locator(".vkey.proto").waitFor();
    assert.equal(await total.locator(".value").textContent(), "(getter)");
    assert.equal(await page.evaluate(() => (globalThis as { getterRan?: boolean }).getterRan), undefined);
    const loop = vnode(shelf, "loop");
    await expand(loop);
    await vnode(loop, "self").locator(".value", { hasText: "[circular]" }).waitFor();
    await vnode(shelf, "when").locator(".value", { hasText: "1970-01-01T00:00:00.000Z" }).waitFor();
    const text = vnode(shelf, "text");
    assert.ok(((await text.locator(".value").textContent()) ?? "").length < 130);
    await text.locator("button.more-text").click();
    await text.locator(".value", { hasText: "x".repeat(300) }).waitFor();

    // Leaf edit at a path: settings.theme.mode, through the signal's `.set`; expansion survives the write.
    const settings = item.locator('li.signal[data-name="ItemPage › settings"] ul.vtree > li.vnode');
    await expand(settings);
    const theme = vnode(settings, "theme");
    await expand(theme);
    const mode = vnode(theme, "mode");
    await mode.locator(".value").dblclick();
    await mode.locator("input.json.leaf").fill("light");
    await mode.locator("input.json.leaf").press("Enter");
    await page.locator("#mode", { hasText: "light" }).waitFor();
    await vnode(vnode(settings, "theme"), "mode").locator(".value", { hasText: '"light"' }).waitFor();

    // Signals panel: same names; the dependency view names the computed that reads `likes`.
    await panel.locator('[data-tab="signals"]').click();
    await panel.locator('.signals li.signal[data-name="ItemPage › count#2"]').waitFor();
    await panel.locator('.signals li.signal[data-name="ItemPage › likes"]').click();
    await panel.locator("h2.selected-name", { hasText: "ItemPage › likes" }).waitFor();
    // Elsewhere (Signals list, graph) names keep their scope.
    assert.equal(await panel.locator('.signals li.signal[data-name="ItemPage › likes"] .name').first().textContent(), "ItemPage › likes");
    await panel.locator('.deps li[data-name="ItemPage › doubled"]').waitFor();
    await panel.locator("input.search").fill("count#2");
    await panel.locator(".signals li.signal").first().waitFor();
    assert.deepEqual(await panel.locator(".signals li.signal").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-name"))), ["ItemPage › count#2"]);

    // Updates: highlighting flashes the updated node; the page component's count goes up.
    await panel.locator('[data-tab="updates"]').click();
    await panel.locator("input.flash-toggle").check();
    await page.getByRole("button", { name: "Likes 0" }).click();
    await page.locator("rivet-devtools .flash").first().waitFor({ state: "attached" });
    await panel.locator('tr[data-name="ItemPage"] td.n', { hasText: /^[1-9]/ }).waitFor();

    // HMR: editing the page hot-replaces it, state kept, and the log says so.
    const pageFile = resolve(root, "src/routes/items/[id].tsx");
    const source = await readFile(pageFile, "utf8");
    await writeFile(pageFile, source.replace('<p id="item-id">', '<p id="edited">edited</p>\n      <p id="item-id">'));
    await page.waitForSelector("#edited", { timeout: 10_000 });
    assert.equal(await page.textContent("#likes"), "Likes 1");
    await panel.locator('[data-tab="hmr"]').click();
    await panel.locator('li.hmr[data-kind="component"][data-state="kept"]', { hasText: "items/[id].tsx" }).waitFor();
    await panel.locator('li.hmr[data-kind="update"]').first().waitFor();

    // Errors: a throwing handler is listed with its message and app source location.
    await page.getByRole("button", { name: "Boom" }).click();
    await panel.locator('[data-tab="errors"]').click();
    const entry = panel.locator('li.error-entry[data-kind="runtime"]', { hasText: "boom from a handler" });
    await entry.waitFor();
    const location = entry.locator("button.location");
    await location.waitFor({ timeout: 10_000 });
    await location.click();
    for (let i = 0; i < 100 && !editorRequests.length; i++) await page.waitForTimeout(50);
    assert.match(editorRequests[0] ?? "", /src\/routes\/items\/\[id\]\.tsx:\d+:\d+$/);
    assert.deepEqual(pageErrors, ["boom from a handler"]);
    assert.equal(await panel.locator('li.error-entry[data-kind="agent"]').count(), 0);

    // Pop-out: the docked panel goes away; a window connects over the BroadcastChannel.
    const [popup] = await Promise.all([context.waitForEvent("page"), panel.locator("button.popout").click()]);
    // (The panel keeps its last tab, Errors here.)
    await popup.locator('[data-tab="components"]').click();
    await popup.locator('.row[data-name="Layout"]').waitFor();
    assert.equal(await page.locator("rivet-devtools iframe").count(), 0);
    await popup.locator('.row[data-name="Layout"]').click();
    await popup.locator('[data-owner="Layout"] li.signal .value', { hasText: "5" }).waitFor();
    await page.getByRole("button", { name: "Layout clicks 5" }).click();
    await popup.locator('[data-owner="Layout"] li.signal .value', { hasText: "6" }).waitFor();
  } finally {
    await browser.close();
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

/** Dev server on a fresh fixture copy, a Chromium page at `path`, the docked panel open. */
async function session(path: string) {
  const root = await copyFixture();
  const server = await createServer({ root, configFile: resolve(root, "vite.config.ts"), logLevel: "silent", server: { port: 0 } });
  await server.listen();
  const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(origin + path);
  const panel = await open(page);
  const close = async () => {
    await browser.close();
    await server.close();
    await rm(root, { recursive: true, force: true });
  };
  return { root, page, panel, pageErrors, close };
}
const vnode = (scope: Locator, key: string) => scope.locator(`li.vnode[data-key='${key}']`).first();
const expand = (node: Locator) => node.locator(":scope > .vline > button.toggle").click();
/** Double-click a tree value, type into its editor and press Enter. */
async function editLeaf(node: Locator, text: string, type?: string): Promise<void> {
  await node.locator(":scope > .vline > .value").dblclick();
  if (type) await node.locator(":scope > .vline select.type").selectOption(type);
  await node.locator(":scope > .vline input.json.leaf").fill(text);
  await node.locator(":scope > .vline input.json.leaf").press("Enter");
}
const shot = (page: Page, name: string) => page.screenshot({ path: `.artifacts/devtools-${name}.png` });

test("DevTools edits: typed leaves in Map / Set / Date / bigint / class instances, contexts, overrides, why it updated", async () => {
  const { page, panel, pageErrors, close } = await session("/items/1");
  try {
    const row = (name: string) => panel.locator(`.row[data-name="${name}"]`);
    await row("ItemPage").locator(".tag").click();
    const item = panel.locator('[data-owner="ItemPage"]');
    const shelf = item.locator('li.signal[data-name="ItemPage › shelf"] ul.vtree > li.vnode');
    await expand(shelf);

    // Map: leaf edit inside an entry, then a new entry with a typed key.
    const map = vnode(shelf, "map");
    await expand(map);
    await editLeaf(vnode(map, '"k"'), "5");
    await vnode(vnode(vnode(shelf, "map"), '"k"'), '"k"')
      .waitFor({ state: "detached" })
      .catch(() => {});
    await vnode(vnode(shelf, "map"), '"k"').locator(".value", { hasText: /^5$/ }).waitFor();
    const mapNode = vnode(shelf, "map");
    await mapNode.locator("button.add").click();
    await mapNode.locator(".add-row .map-key input").fill("z");
    await mapNode.locator(".add-row .typed:not(.map-key) select.type").selectOption("n");
    await mapNode.locator(".add-row .typed:not(.map-key) input").fill("2");
    await mapNode.locator(".add-row button.set").click();
    await vnode(vnode(shelf, "map"), '"z"').locator(".value", { hasText: /^2$/ }).waitFor();
    // Set: add a member, remove the old one.
    const set = vnode(shelf, "set");
    await expand(set);
    await set.locator("button.add").click();
    await set.locator(".add-row input.json").fill("t");
    await set.locator(".add-row button.set").click();
    await vnode(vnode(shelf, "set"), "1").locator(".value", { hasText: '"t"' }).waitFor();
    await vnode(vnode(shelf, "set"), "0").hover();
    await vnode(vnode(shelf, "set"), "0").locator(":scope > .vline > button.remove").click();
    await vnode(vnode(shelf, "set"), "0").locator(".value", { hasText: '"t"' }).waitFor();
    // Date and bigint: typed inputs.
    await editLeaf(vnode(shelf, "when"), "2020-01-02T03:04:05.000Z");
    await page.locator("#when", { hasText: "2020-01-02T03:04:05.000Z" }).waitFor();
    await editLeaf(vnode(shelf, "big"), "11");
    await vnode(shelf, "big").locator(".value", { hasText: "11n" }).waitFor();
    assert.equal(await panel.locator(".error").count(), 0);
    // A class instance below a plain root: edited in place, the page re-renders.
    const cart = vnode(shelf, "cart");
    await expand(cart);
    const items = vnode(cart, "items");
    await expand(items);
    await editLeaf(vnode(items, "0"), "9");
    await page.locator("#cart", { hasText: "9" }).waitFor();
    // Bad input stays in the panel.
    await editLeaf(vnode(shelf, "big"), "1.5");
    await vnode(shelf, "big").locator(".error", { hasText: "not an integer" }).waitFor();
    await vnode(shelf, "big").locator("input.json.leaf").press("Escape");
    await shot(page, "edit-tree");

    // Context provided: a provided signal edits in place (the consumer updates); a plain value is read-only.
    const provided = item.locator('.provided li[data-context="ThemeContext"]');
    await provided.waitFor();
    await editLeaf(provided.locator("ul.vtree > li.vnode").first(), "sepia");
    await page.locator("#badge", { hasText: "sepia/plain/hi/0" }).waitFor();
    const plain = item.locator('.provided li[data-context="LabelContext"]');
    await plain.locator(".badge.readonly").waitFor();
    assert.match((await plain.locator("p.reason").textContent()) ?? "", /plain snapshot/);
    assert.deepEqual(await plain.locator(".consumers .comp-link").allTextContents(), ["<Badge>"]);

    // Why it last updated: the devtools write (flagged), then a page write.
    await row("Badge").locator(".tag").click();
    const badge = panel.locator('[data-owner="Badge"]');
    await badge.locator('.why li.cause[data-name="ItemPage › theme"] .badge.devtools').waitFor();
    await shot(page, "why-updated");
    await page.getByRole("button", { name: "Likes 0" }).click();
    await row("ItemPage").locator(".tag").click();
    await row("Badge").locator(".tag").click();
    await badge.locator('.why li.cause[data-name="ItemPage › likes"]').waitFor();
    assert.equal(await badge.locator(".why .badge.devtools").count(), 0);
    // Owner chain and contexts read, with the providing component.
    // (The owner tree: the page is rendered by the App's router, not inside the layout.)
    assert.deepEqual((await badge.locator("nav.chain .comp-link").allTextContents()).slice(-2), ["<Router>", "<ItemPage>"]);
    const read = badge.locator('.consumed li[data-context="ThemeContext"]');
    await read.locator(".value", { hasText: '"sepia"' }).waitFor();
    assert.equal(await read.locator(".from .comp-link").textContent(), "<ItemPage>");
    await shot(page, "contexts-read");

    // Props: override a value prop, then reset; override an accessor prop until its next real change.
    const label = badge.locator('li.prop[data-key="label"]');
    await editLeaf(label.locator("ul.vtree > li.vnode").first(), "yo");
    await page.locator("#badge", { hasText: "sepia/plain/yo/1" }).waitFor();
    await badge.locator('li.prop.overridden[data-key="label"] .badge.override').waitFor();
    await shot(page, "prop-override");
    await badge.locator('li.prop[data-key="label"] button.reset').click();
    await page.locator("#badge", { hasText: "sepia/plain/hi/1" }).waitFor();
    await editLeaf(badge.locator('li.prop[data-key="count"] ul.vtree > li.vnode').first(), "42");
    await page.locator("#badge", { hasText: "/42" }).waitFor();
    assert.equal(await page.textContent("#likes"), "Likes 1", "an override never writes the signal");
    await page.getByRole("button", { name: "Likes 1" }).click();
    await page.locator("#badge", { hasText: "sepia/plain/hi/2" }).waitFor();

    // Jump from the consumer to its provider: the provider row is focused.
    await read.locator(".from .comp-link").click();
    await panel.locator('[data-owner="ItemPage"] .provided li.focused[data-context="ThemeContext"]').waitFor();

    // Computed override: consumers see the pinned value until reset.
    const doubled = panel.locator('[data-owner="ItemPage"] li.computed[data-name="ItemPage › doubled"]');
    await editLeaf(doubled.locator("ul.vtree > li.vnode").first(), "100");
    await page.locator("#doubled", { hasText: "100" }).waitFor();
    await panel.locator('[data-owner="ItemPage"] li.computed.overridden .badge.override').waitFor();
    await shot(page, "computed-override");
    await panel.locator('[data-owner="ItemPage"] li.computed.overridden button.reset').click();
    await page.locator("#doubled", { hasText: /^4$/ }).waitFor();

    // Contexts tab: provider instances with their consumers; jump to a consumer.
    await panel.locator('[data-tab="contexts"]').click();
    const theme = panel.locator('tr.provider[data-context="ThemeContext"]');
    await theme.waitFor();
    assert.equal(await theme.locator("td .comp-link").first().textContent(), "<ItemPage>");
    await panel.locator('tr.provider[data-context="LabelContext"] .badge.readonly').waitFor();
    await shot(page, "contexts-tab");
    await theme.locator(".consumers .comp-link", { hasText: "<Badge>" }).click();
    await panel.locator('[data-owner="Badge"]').waitFor();
    assert.deepEqual(pageErrors, []);
    assert.equal(await panel.locator('li.error-entry[data-kind="agent"]').count(), 0);
  } finally {
    await close();
  }
});

test("DevTools a11y entries: rule, element and component; hovering highlights the element", async () => {
  const { page, panel, pageErrors, close } = await session("/items/1");
  try {
    // The Components tab switches the resumed page to client render (re-rendering it): settle first.
    await panel.locator('.row[data-name="ItemPage"]').waitFor();
    // An image without alt, added after the first audit (dev a11y checks watch added subtrees).
    await page.evaluate(() => {
      const img = document.createElement("img");
      img.className = "no-alt";
      // Sized: a src-less image has no box otherwise (nothing to highlight).
      img.style.cssText = "display: inline-block; width: 40px; height: 40px";
      document.querySelector("#item-id")!.after(img);
    });
    await panel.locator('[data-tab="errors"]').click();
    const entry = panel.locator('li.error-entry[data-kind="a11y"]', { has: panel.locator(".badge.rule", { hasText: "img-alt" }) });
    await entry.waitFor();
    assert.equal(await entry.locator("code.element-tag").textContent(), '<img class="no-alt">');
    assert.doesNotMatch((await entry.locator(".message").textContent()) ?? "", /^Rivet a11y/);
    await entry.hover();
    await page.waitForFunction(() => document.querySelector("rivet-devtools")?.shadowRoot?.querySelector<HTMLElement>(".box")?.hidden === false);
    assert.equal(
      await page.evaluate(() => document.querySelector("rivet-devtools")!.shadowRoot!.querySelector(".box .label")!.textContent),
      '<img class="no-alt">',
    );
    assert.deepEqual(pageErrors, []);
    assert.equal(await panel.locator('li.error-entry[data-kind="agent"]').count(), 0);
  } finally {
    await close();
  }
});
