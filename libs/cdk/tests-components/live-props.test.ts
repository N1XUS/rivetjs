// Live props (P5, docs/design/specs/2026-10-07-live-props-design.md §8) on a resumed page: value-form props of cdk
// parts update in place (same element, no region re-creation) on every change. Route `app/src/routes/live-props.tsx`;
// client renders: ../tests/live-props.browser.test.tsx.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const attrs = (page: Page, selector: string, names: string[]) =>
  page.evaluate(
    ([selector, names]) => {
      const el = document.querySelector(selector as string)!;
      return Object.fromEntries((names as string[]).map((n) => [n, el.getAttribute(n)]));
    },
    [selector, names] as const,
  );
const mark = (page: Page, selector: string) =>
  page.evaluate((selector) => ((document.querySelector(selector) as unknown as { __lp: number }).__lp = 1), selector);
const kept = (page: Page, selector: string) =>
  page.evaluate((selector) => (document.querySelector(selector) as unknown as { __lp?: number } | null)?.__lp === 1, selector);
const flip = async (page: Page) => {
  const before = await page.getAttribute("#lp-button", "aria-pressed");
  await page.click("#lp-flip");
  // First trusted click of a document flushes one task later (docs/guides/resumability.md "First mouse click"); the
  // first change also loads the parts' chunks: wait for the button, then let the other bindings settle.
  await page.waitForFunction((b) => document.querySelector("#lp-button")!.getAttribute("aria-pressed") !== b, before);
  await page.waitForTimeout(50);
};

test("live props: Button aria-pressed / isDisabled / class / aria-label update in place", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/live-props");
  const names = ["aria-pressed", "disabled", "class", "aria-label", "data-disabled"];
  assert.deepEqual(await attrs(page, "#lp-button", names), {
    "aria-pressed": "false",
    disabled: null,
    class: "b-off",
    "aria-label": "Like",
    "data-disabled": null,
  });
  await mark(page, "#lp-button");
  await flip(page);
  assert.deepEqual(await attrs(page, "#lp-button", names), {
    "aria-pressed": "true",
    disabled: "",
    class: "b-on",
    "aria-label": "Unlike",
    "data-disabled": "true",
  });
  assert.ok(await kept(page, "#lp-button"), "button kept (no re-creation)");
  await flip(page);
  assert.deepEqual(await attrs(page, "#lp-button", names), {
    "aria-pressed": "false",
    disabled: null,
    class: "b-off",
    "aria-label": "Like",
    "data-disabled": null,
  });
  assert.ok(await kept(page, "#lp-button"));
  assert.deepEqual(seen.errors, []);
  await page.close();
});

/** Element state as plain data (attributes + input properties; memory-light). */
const snap = (page: Page) =>
  page.evaluate(() => {
    const q = (sel: string) => document.querySelector(sel) as HTMLElement;
    const input = (sel: string) => q(sel).querySelector("input") as HTMLInputElement;
    return {
      toggle: [q("#lp-toggle").getAttribute("aria-pressed"), q("#lp-toggle").hasAttribute("disabled"), q("#lp-toggle").className],
      check: [input("[data-testid=lp-check]").checked, q("[data-testid=lp-check]").getAttribute("data-invalid"), q("[data-testid=lp-check]").className],
      switch: [input("[data-testid=lp-switch]").checked, input("[data-testid=lp-switch]").disabled, q("[data-testid=lp-switch]").className],
      field: [
        (q("#lp-input") as HTMLInputElement).value,
        (q("#lp-input") as HTMLInputElement).disabled,
        q("#lp-input").getAttribute("placeholder"),
        q("#lp-input").getAttribute("aria-invalid"),
      ],
      slider: [input("[data-testid=lp-slider]").value, q("[data-testid=lp-slider]").getAttribute("data-disabled"), q("[data-testid=lp-slider]").className],
      item: [
        q("#lp-list [data-key=lp-cat]").className,
        q("#lp-list [data-key=lp-cat]").getAttribute("aria-disabled"),
        q("#lp-list [data-key=lp-cat]").hasAttribute("data-rv-disabled"),
      ],
      tabs: [
        q("[data-testid=lp-tabs] [data-key=one]").className,
        q("[data-testid=lp-tabs] [data-key=two]").getAttribute("aria-selected"),
        q("[data-testid=lp-tabs] [data-key=three]").getAttribute("aria-disabled"),
        q("[data-testid=lp-tabs] [role=tabpanel]").textContent,
        q("[data-testid=lp-tp1]").className,
      ],
      radio: [
        q("[data-testid=lp-radio]").className,
        q("[data-testid=lp-radio]").getAttribute("aria-readonly"),
        q("[data-testid=lp-radio-s]").className,
        q("[data-testid=lp-radio-s]").getAttribute("data-readonly"),
        input("[data-testid=lp-radio-l]").disabled,
        q("[data-testid=lp-radio-l]").className,
      ],
      text: [
        q("[data-testid=lp-text]").className,
        q("[data-testid=lp-text]").textContent,
        q("[data-testid=lp-link]").className,
        q("[data-testid=lp-link]").textContent,
      ],
      wave3: [
        q("[data-testid=lp-search]").className,
        q("[data-testid=lp-search]").getAttribute("data-disabled"),
        input("[data-testid=lp-search]").disabled,
        q("[data-testid=lp-disclosure]").className,
        q("[data-testid=lp-disclosure]").getAttribute("data-disabled"),
        (q("[data-testid=lp-disclosure] button") as HTMLButtonElement).disabled,
        q("[data-testid=lp-meter]").className,
        q("[data-testid=lp-meter]").getAttribute("aria-valuenow"),
        q("[data-testid=lp-progress]").className,
        q("[data-testid=lp-progress]").getAttribute("aria-valuenow"),
        q("[data-testid=lp-number]").className,
        input("[data-testid=lp-number]").disabled,
        q("[data-testid=lp-crumbs]").className,
        q("[data-testid=lp-crumb]").getAttribute("data-disabled"),
        q("[data-testid=lp-swatch]").className,
        q("[data-testid=lp-swatch]").style.backgroundColor,
        q("[data-testid=lp-group]").className,
        q("[data-testid=lp-group]").getAttribute("data-disabled"),
      ],
      select: [q("#lp-select-button").textContent, (q("#lp-select-button") as HTMLButtonElement).disabled, q("[data-testid=lp-select]").className],
    };
  });

// The parts' bindings follow the flip once their units adopted (the first change adopts them, their chunks may still be
// loading): wait for the state, then compare.
const untilSnap = async (page: Page, want: unknown) => {
  let got = await snap(page);
  for (const end = Date.now() + 5000; !isDeepStrictEqual(got, want) && Date.now() < end; got = await snap(page)) await page.waitForTimeout(25);
  assert.deepEqual(got, want);
};

// REDS-CDK 2026-10-28 (order / load dependent red): a unit adopted after the first write (its chunks loaded late) put
// the pre-adopt `checked` back over its binding's current value — `dirtyOf` counted every checkbox / radio without a
// `value` attribute as user-changed (`value` "on" against `defaultValue` ""). Slow script responses make it every time.
test("live props: a first change while the parts' chunks load late — controlled Checkbox / Switch inputs follow", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.route(/\/assets\/.*\.js$/, async (route) => {
    await new Promise((done) => setTimeout(done, 150));
    await route.continue();
  });
  await page.goto(s.origin + "/live-props");
  await page.click("#lp-flip");
  await page.waitForFunction(() => document.querySelector("[data-testid=lp-check]")!.className === "c-on", undefined, { timeout: 10000 });
  await page.waitForFunction(() => document.querySelector("[data-testid=lp-switch]")!.className === "s-on", undefined, { timeout: 10000 });
  // Settled: the class bindings ran in the same adopt runs as the inputs' `checked`.
  assert.equal(await page.evaluate(() => document.querySelector<HTMLInputElement>("[data-testid=lp-check] input")!.checked), true);
  assert.equal(await page.evaluate(() => document.querySelector<HTMLInputElement>("[data-testid=lp-switch] input")!.checked), true);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("live props: ToggleButton / Checkbox / Switch / TextField / Slider / Select / ListBoxItem / Tabs / RadioGroup / Text / Link / wave-3 parts value forms update in place", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/live-props");
  const off = {
    toggle: ["false", false, "t-off"],
    check: [false, null, "c-off"],
    switch: [false, false, "s-off"],
    field: ["no", false, "P-off", null],
    slider: ["20", null, "r-off"],
    select: ["Cat", false, "sel-off"],
    item: ["li-off", null, false],
    tabs: ["tb-off", "false", null, "Panel one", "tp-off"],
    radio: ["rg-off", null, "rf-off", null, false, "ra-off"],
    text: ["tx-off", "Text off", "lk-off", "Link off"],
    wave3: [
      "sf-off",
      null,
      false,
      "dc-off",
      null,
      false,
      "me-off",
      "20",
      "pb-off",
      "10",
      "nf-off",
      false,
      "bc-off",
      null,
      "cw-off",
      "rgb(0, 0, 255)",
      "gr-off",
      null,
    ],
  };
  const on = {
    toggle: ["true", true, "t-on"],
    check: [true, "true", "c-on"],
    switch: [true, true, "s-on"],
    field: ["yes", true, "P-on", "true"],
    slider: ["60", "true", "r-on"],
    select: ["Dog", true, "sel-on"],
    item: ["li-on", "true", true],
    tabs: ["tb-on", "true", "true", "Panel two", "tp-on"],
    radio: ["rg-on", "true", "rf-on", "true", true, "ra-on"],
    text: ["tx-on", "Text on", "lk-on", "Link on"],
    wave3: [
      "sf-on",
      "true",
      true,
      "dc-on",
      "true",
      true,
      "me-on",
      "80",
      "pb-on",
      "70",
      "nf-on",
      true,
      "bc-on",
      "true",
      "cw-on",
      "rgb(255, 0, 0)",
      "gr-on",
      "true",
    ],
  };
  assert.deepEqual(await snap(page), off);
  const sels = [
    "#lp-toggle",
    "[data-testid=lp-check]",
    "[data-testid=lp-switch]",
    "#lp-input",
    "[data-testid=lp-slider]",
    "[data-testid=lp-select]",
    "#lp-select-button",
    "[data-testid=lp-tabs] [data-key=one]",
    "[data-testid=lp-tp1]",
    "[data-testid=lp-radio]",
    "[data-testid=lp-radio-l]",
    "[data-testid=lp-text]",
    "[data-testid=lp-link]",
    "[data-testid=lp-search]",
    "[data-testid=lp-disclosure]",
    "[data-testid=lp-meter]",
    "[data-testid=lp-progress]",
    "[data-testid=lp-number]",
    "[data-testid=lp-crumbs]",
    "[data-testid=lp-crumb]",
    "[data-testid=lp-swatch]",
    "[data-testid=lp-group]",
  ];
  for (const sel of sels) await mark(page, sel);
  await flip(page);
  await untilSnap(page, on);
  await flip(page);
  await untilSnap(page, off);
  for (const sel of sels) assert.ok(await kept(page, sel), sel + " kept (no re-creation)");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("live props: Modal isOpen value form opens / closes on a resumed page; class + isKeyboardDismissDisabled live", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/live-props");
  assert.equal(await page.locator("[role=dialog]").count(), 0);
  await page.click("#lp-modal-flip");
  await page.waitForSelector(".lm-off [role=dialog]");
  // Escape is disabled while `on` is false (isKeyboardDismissDisabled={!on()}).
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  assert.equal(await page.locator("[role=dialog]").count(), 1);
  // Flip `on` behind the modal (programmatic click: the underlay covers the page).
  await page.evaluate(() => (document.querySelector("#lp-flip") as HTMLButtonElement).click());
  await page.waitForSelector(".lm-on [role=dialog]");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("[role=dialog]"));
  assert.deepEqual(seen.errors, []);
  await page.close();
});

// Per-key live views (LIVEVIEW 2026-10-09): parts whose children capture a class instance next to a live class / style
// render resumably (before: the server render threw "capture #N Tag instance is not serializable"). Limit (runtime /
// compiler follow-up): the page's props recipe of such a part captures the instance with the class getter, so on the
// resumed page class / style keep their server values; the rest of the page stays live and nothing re-creates.
test("live props: per-key live views — children capturing a class instance next to a live class / style resume", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/live-props");
  const ids = ["lv-link", "lv-check", "lv-group", "lv-text", "lv-meter"];
  const read = () =>
    page.evaluate(
      (ids) =>
        ids.map((id) => [document.querySelector(`[data-testid=${id}]`)!.className, (document.querySelector(`[data-testid=${id}]`) as HTMLElement).style.color]),
      ids,
    );
  const styled = (id: string) => id !== "lv-text";
  assert.deepEqual(
    await read(),
    ids.map((id) => ["lv-off", styled(id) ? "blue" : ""]),
  );
  for (const id of ids) assert.equal(await page.textContent(`[data-testid=${id}] b`), "tag");
  for (const id of ids) await mark(page, `[data-testid=${id}]`);
  await flip(page);
  for (const id of ids) assert.ok(await kept(page, `[data-testid=${id}]`), id + " kept (no re-creation)");
  for (const id of ids) assert.equal(await page.textContent(`[data-testid=${id}] b`), "tag");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

// Controlled values (`#lc-*`): a value-form controlled prop (`value={on() ? 5 : 1}`, `selectedKeys={…}`,
// `expandedKeys={…}`) is read live by the part's state (never written): on the resumed page it follows the flip in
// place. Client renders: ../tests/live-controlled.browser.test.tsx.
test("live props: controlled values (NumberField / RadioGroup / CheckboxGroup / ComboBox / ColorField / DateField / ToggleButtonGroup / DisclosureGroup / ListBox / Tree) follow the prop in place", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/live-props");
  const read = () =>
    page.evaluate(() => {
      const q = (id: string) => document.querySelector(`[data-testid=${id}]`)!;
      const checked = (id: string) => [...q(id).querySelectorAll("input")].map((i) => (i as HTMLInputElement).checked);
      return {
        number: (q("lc-number").querySelector("input") as HTMLInputElement).value,
        radio: checked("lc-radio"),
        checks: checked("lc-checks"),
        combo: (q("lc-combo").querySelector("input") as HTMLInputElement).value,
        color: (q("lc-color").querySelector("input") as HTMLInputElement).value.toLowerCase(),
        year: /2025/.test(q("lc-date").textContent!) ? 2025 : /2024/.test(q("lc-date").textContent!) ? 2024 : 0,
        toggles: [...q("lc-toggles").querySelectorAll("button")].map((b) => b.getAttribute("aria-checked")),
        disclosures: [...q("lc-disclosures").querySelectorAll("button")].map((b) => b.getAttribute("aria-expanded")),
        list: [...q("lc-list").querySelectorAll("[role=option]")].map((o) => o.getAttribute("aria-selected")),
        tree: q("lc-tree").querySelectorAll("[role=row]").length,
      };
    });
  const off = {
    number: "1",
    radio: [true, false],
    checks: [true, false],
    combo: "Cat",
    color: "#ff0000",
    year: 2024,
    toggles: ["true", "false"],
    disclosures: ["true", "false"],
    list: ["true", "false"],
    tree: 1,
  };
  assert.deepEqual(await read(), off);
  const ids = ["lc-number", "lc-radio", "lc-checks", "lc-combo", "lc-color", "lc-date", "lc-toggles", "lc-disclosures", "lc-list", "lc-tree"];
  for (const id of ids) await mark(page, `[data-testid=${id}]`);
  await mark(page, "[data-testid=lc-combo] input");
  await flip(page);
  // The parts' chunks load on the first change (cold resumed page): wait for the last one to settle.
  await page.waitForFunction(() => document.querySelectorAll("[data-testid=lc-tree] [role=row]").length === 2);
  await page.waitForFunction(() => /2025/.test(document.querySelector("[data-testid=lc-date]")!.textContent!));
  assert.deepEqual(await read(), {
    number: "5",
    radio: [false, true],
    checks: [false, true],
    combo: "Dog",
    color: "#00ff00",
    year: 2025,
    toggles: ["false", "true"],
    disclosures: ["false", "true"],
    list: ["false", "true"],
    tree: 2,
  });
  // ComboBox: the input's value binding re-syncs the text (`comboInputText`), the input node is kept.
  for (const id of ids) assert.ok(await kept(page, `[data-testid=${id}]`), id + " kept (no re-creation)");
  assert.ok(await kept(page, "[data-testid=lc-combo] input"), "combobox input kept");
  await flip(page);
  await page.waitForFunction(() => document.querySelectorAll("[data-testid=lc-tree] [role=row]").length === 1);
  assert.deepEqual(await read(), off);
  assert.ok(await kept(page, "[data-testid=lc-combo] input"), "combobox input kept");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

// State flags (`#lf-*`): `isDisabled` / `isReadOnly` / `isRequired` value forms of CheckboxGroup / ComboBox follow
// the flip in place on the resumed page (same group / input nodes; attributes + native state). Client renders:
// ../tests/live-controlled.browser.test.tsx ("live flags").
test("live props: CheckboxGroup / ComboBox isDisabled / isReadOnly / isRequired follow the prop in place", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/live-props");
  const read = () =>
    page.evaluate(() => {
      const q = (id: string) => document.querySelector(`[data-testid=${id}]`)!;
      const input = (id: string) => q(id).querySelector("input") as HTMLInputElement;
      const group = (id: string) => (q(id).matches("[role=group]") ? q(id) : q(id).querySelector("[role=group]")!);
      return {
        checks: [
          group("lf-checks").getAttribute("data-disabled"),
          group("lf-checks").getAttribute("data-required"),
          input("lf-checks").disabled,
          input("lf-checks").required,
        ],
        checksRo: [group("lf-checks-ro").getAttribute("data-readonly"), q("lf-checks-ro").querySelector("label")!.getAttribute("data-readonly")],
        combo: [
          q("lf-combo").getAttribute("data-disabled"),
          input("lf-combo").disabled,
          input("lf-combo").required,
          (q("lf-combo").querySelector("button") as HTMLButtonElement).disabled,
        ],
        comboRo: [q("lf-combo-ro").getAttribute("data-readonly"), input("lf-combo-ro").readOnly],
      };
    });
  const off = { checks: [null, null, false, false], checksRo: [null, null], combo: [null, false, false, false], comboRo: [null, false] };
  assert.deepEqual(await read(), off);
  const nodes = [
    "[data-testid=lf-checks]",
    "[data-testid=lf-checks] input",
    "[data-testid=lf-checks-ro]",
    "[data-testid=lf-combo]",
    "[data-testid=lf-combo] input",
    "[data-testid=lf-combo-ro] input",
  ];
  for (const sel of nodes) await mark(page, sel);
  await flip(page);
  await page.waitForFunction(() => (document.querySelector("[data-testid=lf-combo-ro] input") as HTMLInputElement).readOnly);
  await page.waitForFunction(() => (document.querySelector("[data-testid=lf-checks] input") as HTMLInputElement).disabled);
  assert.deepEqual(await read(), {
    checks: ["true", "true", true, true],
    checksRo: ["true", "true"],
    combo: ["true", true, true, true],
    comboRo: ["true", true],
  });
  for (const sel of nodes) assert.ok(await kept(page, sel), sel + " kept (no re-creation)");
  await flip(page);
  await page.waitForFunction(() => !(document.querySelector("[data-testid=lf-combo-ro] input") as HTMLInputElement).readOnly);
  assert.deepEqual(await read(), off);
  for (const sel of nodes) assert.ok(await kept(page, sel), sel + " kept");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

// Color parts (`#lf-color-*`): a live `isDisabled` / `isReadOnly` / `isRequired` follows the flip in place on the
// resumed page (same root / thumb / input nodes; data attributes + native input state). Client renders:
// ../tests/live-controlled.browser.test.tsx ("live flags: color parts").
test("live props: ColorField / ColorSlider / ColorArea / ColorWheel isDisabled / isReadOnly / isRequired follow the prop in place", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/live-props");
  const read = () =>
    page.evaluate(() => {
      const q = (id: string) => document.querySelector(`[data-testid=${id}]`)!;
      const input = (id: string) => q(id).querySelector("input") as HTMLInputElement;
      const thumb = (id: string) => q(id).querySelector(".rv-ColorThumb")!.getAttribute("data-disabled");
      return {
        field: [
          q("lf-color-field").getAttribute("data-disabled"),
          q("lf-color-field").getAttribute("data-required"),
          input("lf-color-field").disabled,
          input("lf-color-field").required,
        ],
        fieldRo: [q("lf-color-field-ro").getAttribute("data-readonly"), input("lf-color-field-ro").readOnly],
        channel: [q("lf-color-channel").getAttribute("data-disabled"), input("lf-color-channel").disabled],
        slider: [q("lf-color-slider").getAttribute("data-disabled"), thumb("lf-color-slider"), input("lf-color-slider").disabled],
        area: [q("lf-color-area").getAttribute("data-disabled"), thumb("lf-color-area"), input("lf-color-area").disabled],
        wheel: [
          q("lf-color-wheel").getAttribute("data-disabled"),
          q("lf-color-wheel").querySelector(".rv-ColorWheelTrack")!.getAttribute("data-disabled"),
          thumb("lf-color-wheel"),
          input("lf-color-wheel").disabled,
        ],
      };
    });
  const off = {
    field: [null, null, false, false],
    fieldRo: [null, false],
    channel: [null, false],
    slider: [null, null, false],
    area: [null, null, false],
    wheel: [null, null, null, false],
  };
  assert.deepEqual(await read(), off);
  const ids = ["lf-color-field", "lf-color-field-ro", "lf-color-channel", "lf-color-slider", "lf-color-area", "lf-color-wheel"];
  const nodes = [...ids.map((id) => `[data-testid=${id}]`), ...ids.map((id) => `[data-testid=${id}] input`)];
  for (const sel of nodes) await mark(page, sel);
  await flip(page);
  await page.waitForFunction(() => (document.querySelector("[data-testid=lf-color-wheel] input") as HTMLInputElement).disabled);
  await page.waitForFunction(() => (document.querySelector("[data-testid=lf-color-field-ro] input") as HTMLInputElement).readOnly);
  assert.deepEqual(await read(), {
    field: ["true", "true", true, true],
    fieldRo: ["true", true],
    channel: ["true", true],
    slider: ["true", "true", true],
    area: ["true", "true", true],
    wheel: ["true", "true", "true", true],
  });
  for (const sel of nodes) assert.ok(await kept(page, sel), sel + " kept (no re-creation)");
  await flip(page);
  await page.waitForFunction(() => !(document.querySelector("[data-testid=lf-color-wheel] input") as HTMLInputElement).disabled);
  assert.deepEqual(await read(), off);
  for (const sel of nodes) assert.ok(await kept(page, sel), sel + " kept");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

// Date parts (`#lf-date-*`): a live `isDisabled` / `isReadOnly` follows the flip in place on the resumed page (same
// root / segment / cell / button nodes; ARIA + data attributes, contenteditable, native disabled); a segment key is
// ignored while read-only and steps after re-enabling. Client renders: ../tests/live-controlled.browser.test.tsx
// ("live flags: date parts").
test("live props: DateField / TimeField / DatePicker / DateRangePicker / Calendar / RangeCalendar isDisabled / isReadOnly follow the prop in place", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/live-props");
  const read = () =>
    page.evaluate(() => {
      const q = (id: string) => document.querySelector(`[data-testid=${id}]`)!;
      const seg = (id: string, type: string, i = 0) => q(id).querySelectorAll(`[data-rv-segment][data-type=${type}]`)[i]!;
      const button = (id: string) => (q(id).querySelector("button") as HTMLButtonElement).disabled;
      const hidden = (id: string) =>
        (document.querySelector(`[data-testid=${id}] ~ [data-testid=hidden-dateinput-container] input`) as HTMLInputElement).disabled;
      const grid = (id: string) => q(id).querySelector("[role=grid]")!;
      return {
        field: [
          q("lf-date-field").getAttribute("data-disabled"),
          seg("lf-date-field", "month").getAttribute("aria-disabled"),
          seg("lf-date-field", "month").getAttribute("contenteditable"),
          hidden("lf-date-field"),
        ],
        fieldRo: [
          q("lf-date-field-ro").getAttribute("data-readonly"),
          seg("lf-date-field-ro", "month").getAttribute("aria-readonly"),
          seg("lf-date-field-ro", "month").getAttribute("contenteditable"),
        ],
        time: [q("lf-date-time").getAttribute("data-disabled"), seg("lf-date-time", "hour").getAttribute("aria-disabled")],
        picker: [
          q("lf-date-picker").getAttribute("data-disabled"),
          q("lf-date-picker").querySelector("[role=group]")!.getAttribute("aria-disabled"),
          button("lf-date-picker"),
          seg("lf-date-picker", "month").getAttribute("aria-disabled"),
        ],
        range: [q("lf-date-range").getAttribute("data-readonly"), button("lf-date-range"), seg("lf-date-range", "month", 1).getAttribute("aria-readonly")],
        calendar: [
          q("lf-date-calendar").getAttribute("data-disabled"),
          grid("lf-date-calendar").getAttribute("aria-disabled"),
          q("lf-date-calendar").querySelector('[data-date$="-03-12"]')!.getAttribute("data-disabled"),
        ],
        rangeCalendar: [grid("lf-date-range-calendar").getAttribute("aria-readonly")],
      };
    });
  const off = {
    field: [null, null, "true", false],
    fieldRo: [null, null, "true"],
    time: [null, null],
    picker: [null, null, false, null],
    range: [null, false, null],
    calendar: [null, null, null],
    rangeCalendar: [null],
  };
  assert.deepEqual(await read(), off);
  const ids = ["lf-date-field", "lf-date-field-ro", "lf-date-time", "lf-date-picker", "lf-date-range", "lf-date-calendar", "lf-date-range-calendar"];
  const nodes = [
    ...ids.map((id) => `[data-testid=${id}]`),
    "[data-testid=lf-date-field] [data-type=month]",
    "[data-testid=lf-date-field-ro] [data-type=month]",
    "[data-testid=lf-date-time] [data-type=hour]",
    "[data-testid=lf-date-picker] [data-type=month]",
    "[data-testid=lf-date-picker] button",
    "[data-testid=lf-date-range] button",
    '[data-testid=lf-date-calendar] [data-date$="-03-12"]',
    '[data-testid=lf-date-range-calendar] [data-date$="-03-12"]',
  ];
  for (const sel of nodes) await mark(page, sel);
  await flip(page);
  await page.waitForFunction(() => document.querySelector("[data-testid=lf-date-range-calendar] [role=grid]")!.getAttribute("aria-readonly") === "true");
  assert.deepEqual(await read(), {
    field: ["true", "true", null, true],
    fieldRo: ["true", "true", null],
    time: ["true", "true"],
    picker: ["true", "true", true, "true"],
    range: ["true", true, "true"],
    calendar: ["true", "true", "true"],
    rangeCalendar: ["true"],
  });
  for (const sel of nodes) assert.ok(await kept(page, sel), sel + " kept (no re-creation)");
  // Read-only at event time: ArrowUp on the focused month segment is ignored.
  const month = "[data-testid=lf-date-field-ro] [data-type=month]";
  await page.focus(month);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(50);
  assert.equal(await page.textContent(month), "3");
  await flip(page);
  await page.waitForFunction(() => document.querySelector("[data-testid=lf-date-range-calendar] [role=grid]")!.getAttribute("aria-readonly") === null);
  assert.deepEqual(await read(), off);
  for (const sel of nodes) assert.ok(await kept(page, sel), sel + " kept");
  await page.focus(month);
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction((sel) => document.querySelector(sel)!.textContent === "4", month);
  assert.ok(await kept(page, month), "segment kept after the edit");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
