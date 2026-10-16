// Per-component CSS split (identity spec 2026-10-11 §3.4.6): the compiled `styles/out/<name>.css` files are current
// (`libs/ui/scripts/build-css.ts --check`) and their union is the single bundle (`styles/index.css` + every component
// file in layer `components`, compiled once) rule for rule: same selectors in the same at-rule context with the same
// declarations. Allowed: `var(--x, fallback)` for `var(--x)` (a file compiles against the theme by reference, so Tailwind
// inlines its defaults) and the order of rules. Every file shares layer `components`, so a cross-file override wins by
// specificity as in the single bundle; only equal-specificity conflicts between files would depend on the order the files
// load in (the JS import graph): the last test finds them (same at-rule context and specificity, a common longhand set
// to different values, a common subject class / `data-slot`) and fails unless the selectors exclude each other (one
// attribute, two values; children of different components), the pair can never match one element (`DISJOINT`, with
// the reason) or the later file's tv module imports the earlier stylesheet first (TWEAKS.md TW-121). An element
// carrying the classes of two components is modelled only for the slots listed in `COMPOSED` (a component rendering
// another one with its slot class: `<CloseButton class="modal__close-trigger">`); others (`.data-grid__checkbox.checkbox`)
// are not, the visual baselines (`tests-components/visual.test.ts`) cover the rendered states.
import { test } from "vitest";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import postcss, { type Container } from "postcss";
import { FOLDS, LAYERS, componentOrder, generateCss, outName, singleBundle } from "../scripts/build-css.ts";

/** Out files in cascade order (a folded child lives in its parent's file, `FOLDS`). */
const outFiles = () => componentOrder().filter((name) => !(name in FOLDS));

const out = new URL("../styles/out/", import.meta.url);

/** `var(--x, …)` → `var(--x)`, whitespace collapsed. */
function normalize(value: string): string {
  let previous: string;
  do {
    previous = value;
    value = value.replace(/var\((--[\w-]+),\s*(?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g, "var($1)");
  } while (value !== previous);
  return value.replace(/\s+/g, " ").trim();
}

/** Non-layer at-rule context of a node (`@media … > @supports …`). */
function context(node: postcss.Node): string {
  const path: string[] = [];
  for (let parent = node.parent as Container | undefined; parent && parent.type !== "root"; parent = parent.parent as Container | undefined)
    if (parent.type === "atrule" && (parent as postcss.AtRule).name !== "layer")
      path.unshift(`@${(parent as postcss.AtRule).name} ${(parent as postcss.AtRule).params}`);
  return path.join(" > ");
}

/** Style rules inside layer `components` (or a sub-layer), or outside it: `context | selector` → sorted declarations. */
function styleRules(css: string, components = true): Map<string, string[]> {
  const rules = new Map<string, string[]>();
  postcss.parse(css).walkRules((rule) => {
    let inComponents = false;
    for (let p = rule.parent as Container | undefined; p; p = p.parent as Container | undefined)
      if (p.type === "atrule" && (p as postcss.AtRule).name === "layer" && /^components\b/.test((p as postcss.AtRule).params)) inComponents = true;
    if (inComponents !== components) return;
    if (rule.parent?.type === "atrule" && /keyframes$/.test((rule.parent as postcss.AtRule).name)) return;
    const key = `${context(rule)} | ${rule.selector.replace(/\s+/g, " ")}`;
    const decls: string[] = [];
    rule.each((d) => void (d.type === "decl" && decls.push(`${d.prop}:${normalize(d.value)}${d.important ? "!" : ""}`)));
    rules.set(key, [...(rules.get(key) ?? []), ...decls]);
  });
  for (const [key, decls] of rules) rules.set(key, [...new Set(decls)].sort());
  return rules;
}

test("styles split: out/ files are current (node libs/ui/scripts/build-css.ts)", { timeout: 120_000 }, async () => {
  for (const [file, content] of Object.entries(await generateCss())) assert.equal(readFileSync(new URL(file, out), "utf8"), content, `${file} is stale`);
});

test("styles split: union of the component files = the single bundle's components layer", { timeout: 120_000 }, async () => {
  const single = styleRules(await singleBundle());
  const split = new Map<string, string[]>();
  for (const name of outFiles())
    for (const [key, decls] of styleRules(readFileSync(new URL(`${name}.css`, out), "utf8")))
      split.set(key, [...new Set([...(split.get(key) ?? []), ...decls])].sort());
  const differ = [...single.keys(), ...split.keys()].filter(
    (key, i, all) => all.indexOf(key) === i && JSON.stringify(single.get(key)) !== JSON.stringify(split.get(key)),
  );
  assert.deepEqual(
    differ.slice(0, 20).map((key) => ({ key, single: single.get(key), split: split.get(key) })),
    [],
  );
  assert.ok(single.size > 2000, `${single.size} rules`);
});

test("styles split: base.css = the single bundle outside the components layer (tokens, base, theme variables)", { timeout: 120_000 }, async () => {
  const single = styleRules(await singleBundle(), false);
  const base = styleRules(readFileSync(new URL("base.css", out), "utf8"), false);
  const differ = [...single.keys(), ...base.keys()].filter(
    (key, i, all) => all.indexOf(key) === i && JSON.stringify(single.get(key)) !== JSON.stringify(base.get(key)),
  );
  assert.deepEqual(
    differ.slice(0, 20).map((key) => ({ key, single: single.get(key), base: base.get(key) })),
    [],
  );
});

test("styles split: every component file states Tailwind's layer order and puts its rules in layer `components`", () => {
  for (const name of componentOrder()) {
    const css = readFileSync(new URL(`${outName(name)}.css`, out), "utf8");
    assert.ok(css.includes(`\n${LAYERS}\n`), name);
    assert.deepEqual([...new Set([...css.matchAll(/@layer ([\w.-]+) \{/g)].map((m) => m[1]))], ["components"], name);
    const styles = readFileSync(new URL(`../styles/src/components/${name}/${name}.styles.ts`, import.meta.url), "utf8");
    assert.ok(styles.includes(`import "../../../out/${outName(name)}.css";`), `${name}.styles.ts imports its stylesheet`);
  }
  for (const [child, parent] of Object.entries(FOLDS)) assert.ok(!existsSync(new URL(`${child}.css`, out)), `${child} folded into ${parent}.css`);
});

/** Selector specificity [ids, classes / attributes / pseudo-classes, elements] (`:where` 0, `:is` / `:not` / `:has` = max argument). */
function specificity(selector: string): number[] {
  const add = (a: number[], b: number[]) => a.map((x, i) => x + b[i]!);
  const greater = (a: number[], b: number[]) => (a[0] !== b[0] ? a[0]! > b[0]! : a[1] !== b[1] ? a[1]! > b[1]! : a[2]! > b[2]!);
  const max = (list: number[][]) => list.reduce((m, x) => (greater(x, m) ? x : m), [0, 0, 0]);
  const close = (s: string, open: number) => {
    for (let i = open, depth = 0; i < s.length; i++)
      if (s[i] === "(") depth++;
      else if (s[i] === ")" && --depth === 0) return i;
    return s.length;
  };
  const list = (s: string) => {
    const parts: string[] = [];
    let depth = 0,
      from = 0;
    for (let i = 0; i < s.length; i++)
      if ("([".includes(s[i]!)) depth++;
      else if (")]".includes(s[i]!)) depth--;
      else if (s[i] === "," && !depth) (parts.push(s.slice(from, i)), (from = i + 1));
    return [...parts, s.slice(from)];
  };
  let total = [0, 0, 0],
    rest = "";
  for (let i = 0; i < selector.length;) {
    const fn = /^:(where|is|not|has)\(/.exec(selector.slice(i));
    if (fn) {
      const end = close(selector, i + fn[0].length - 1);
      if (fn[1] !== "where") total = add(total, max(list(selector.slice(i + fn[0].length, end)).map(specificity)));
      ((i = end + 1), (rest += " "));
    } else if (/^::?[\w-]+\(/.test(selector.slice(i))) {
      const pseudo = /^::?[\w-]+\(/.exec(selector.slice(i))![0];
      total = add(total, pseudo.startsWith("::") ? [0, 0, 1] : [0, 1, 0]);
      ((i = close(selector, i + pseudo.length - 1) + 1), (rest += " "));
    } else if (selector[i] === "[") ((total = add(total, [0, 1, 0])), (i = selector.indexOf("]", i) + 1), (rest += " "));
    else rest += selector[i++];
  }
  const elementPseudo = /::[\w-]+|:(before|after|first-line|first-letter)\b/g;
  const classes = (rest.match(/\.(?:\\.|[\w-])+/g) ?? []).length + (rest.replace(elementPseudo, "").match(/:[\w-]+/g) ?? []).length;
  return add(total, [
    (rest.match(/#(?:\\.|[\w-])+/g) ?? []).length,
    classes,
    (rest.match(/(?:^|[\s>+~])[a-zA-Z][\w-]*/g) ?? []).length + (rest.match(elementPseudo) ?? []).length,
  ]);
}

/** Whether declarations of `a` and `b` set a common longhand (`padding` / `padding-inline-start`, `inset` / `top`, …). */
function overlap(a: string, b: string): boolean {
  const covers = (short: string, long: string) =>
    long.startsWith(short + "-") || (short === "inset" && /^(top|right|bottom|left)$/.test(long)) || (short === "grid-area" && /^grid-(row|column)/.test(long));
  return a === b || covers(a, b) || covers(b, a);
}

/** Subject keys of a selector: the classes of its last compound, `[data-slot="x"]` as `.x` (a part carries both:
 *  `class="menu-item" data-slot="menu-item"`). */
function subjectKeys(selector: string): string[] {
  // `:not(…)` / `:has(…)` arguments name other elements (or exclusions), not the subject.
  let from = 0;
  for (let i = 0, depth = 0; i < selector.length; i++) {
    if ("([".includes(selector[i]!)) depth++;
    else if (")]".includes(selector[i]!)) depth--;
    else if (!depth && /[\s>+~]/.test(selector[i]!)) from = i + 1;
  }
  let subject = selector.slice(from);
  for (let at; (at = subject.search(/:(not|has)\(/)) >= 0;) {
    let end = subject.indexOf("(", at);
    for (let depth = 0; end < subject.length; end++)
      if (subject[end] === "(") depth++;
      else if (subject[end] === ")" && --depth === 0) break;
    subject = subject.slice(0, at) + subject.slice(end + 1);
  }
  return [...new Set([...(subject.match(/\.[\w-]+/g) ?? []), ...[...subject.matchAll(/\[data-slot="?([\w-]+)"?\]/g)].map((m) => "." + m[1])])];
}

/** Selectors that never match one element: one attribute with two values (`[data-placement="left"]` / `"right"`), or
 *  children (`P > subject`) of parents of different components (`.checkbox > …` / `.switch > …`). */
function exclusive(a: string, b: string): boolean {
  const attrs = (s: string) => new Map([...s.matchAll(/\[([\w-]+)="([^"]*)"\]/g)].map((m) => [m[1]!, m[2]!]));
  const [x, y] = [attrs(a), attrs(b)];
  for (const [name, value] of x) if (y.has(name) && y.get(name) !== value) return true;
  const parent = (s: string) =>
    /([^\s>+~]+)\s*>\s*[^\s>+~]+$/
      .exec(s)?.[1]
      ?.match(/\.[\w-]+/g)
      ?.map((c) => c.replace(/(__|--).*$/, ""));
  const [p, q] = [parent(a), parent(b)];
  return !!p?.length && !!q?.length && !p.some((c) => q.includes(c));
}

/** Cross-file pairs (`<subject key>|<file>,<file>`, files sorted) checked by hand: their rules never decide one element's value. */
const DISJOINT: Record<string, string> = {
  ".select__popover|cell-select,inline-select":
    "each compound selector names its own component class (`.select__popover.cell-select__popover` / `.inline-select__popover`, CDK-PINS 77cc0729): one popover never carries both",
  ".checkbox__control|checkbox,data-grid":
    "data-grid's unchecked fill excludes `[aria-checked=true]` and (`:where`) the pressed indeterminate box: checkbox.css's checked-invalid / pressed-indeterminate fills never meet it (TW-117)",
  ".label|checkbox-button-group,list-box-item": "a list box item never sits in a checkbox button group",
  ".label|checkbox-button-group,menu-item": "a menu item never sits in a checkbox button group",
  ".label|list-box-item,radio-button-group": "a list box item never sits in a radio button group",
  ".label|menu-item,radio-button-group": "a menu item never sits in a radio button group",
  ".label|checkbox-button-group,color-slider": "a color slider never sits in a checkbox button group",
  ".label|checkbox-button-group,meter": "a meter never sits in a checkbox button group",
  ".label|checkbox-button-group,progress-bar": "a progress bar never sits in a checkbox button group",
  ".label|checkbox-button-group,slider": "a slider never sits in a checkbox button group",
  ".label|color-slider,radio-button-group": "a color slider never sits in a radio button group",
  ".label|meter,radio-button-group": "a meter never sits in a radio button group",
  ".label|progress-bar,radio-button-group": "a progress bar never sits in a radio button group",
  ".label|radio-button-group,slider": "a slider never sits in a radio button group",
  ".description|checkbox,tag-group": "a tag group's description is its own child, never a checkbox's",
  ".description|switch,tag-group": "a tag group's description is its own child, never a switch's",
  ".description|radio,tag-group": "a tag group's description is its own child, never a radio's",
  ".spinner|button,toast": "a toast indicator never sits in a Button",
  ".separator|dropdown,sidebar": "a sidebar separator never sits in a dropdown menu",
  ".separator|menu,sidebar": "a sidebar separator never sits in a menu",
  ".menu-item|dropdown,menu-item": "dropdown's start padding skips items with an indicator (`:where(:not(:has(.menu-item__indicator)))`, TW-120)",
};

/** Slot classes rendered on another component's root (`<CloseButton class={slots.closeTrigger()}>`): the element carries
 *  both classes, so the slot's rules are grouped under the composed root's key too. */
const COMPOSED: Record<string, string> = {
  ".alert-dialog__close-trigger": ".close-button",
  ".chat-attachment__remove": ".close-button",
  ".drawer__close-trigger": ".close-button",
  ".modal__close-trigger": ".close-button",
  ".search-field__clear-button": ".close-button",
  ".sheet__close-trigger": ".close-button",
  ".tag__remove-button": ".close-button",
  ".toast__close-button": ".close-button",
};

/** The out stylesheets a component's tv file imports, in order (`import "../../../out/<name>.css"`). */
const imports = (name: string) =>
  [
    ...readFileSync(new URL(`../styles/src/components/${name}/${name}.styles.ts`, import.meta.url), "utf8").matchAll(
      /^import "\.\.\/\.\.\/\.\.\/out\/([\w-]+)\.css";/gm,
    ),
  ].map((m) => m[1]!);

test("styles split: no equal-specificity conflict between component files (their load order must not matter)", () => {
  // Rules by at-rule context, specificity and subject key: two files' rules in one group that set a common longhand to
  // different values would be decided by the files' load order (the single bundle decided by `components/index.css`).
  // `via`: grouped under a composed root's key (`COMPOSED`); two such slots of different components never meet.
  const groups = new Map<string, { file: string; selector: string; prop: string; value: string; via: boolean }[]>();
  for (const name of outFiles())
    postcss.parse(readFileSync(new URL(`${name}.css`, out), "utf8")).walkDecls((decl) => {
      const rule = decl.parent as postcss.Rule;
      if (rule.type !== "rule" || /keyframes$/.test((rule.parent as postcss.AtRule)?.name ?? "")) return;
      for (const selector of rule.selectors)
        for (const [key, via] of subjectKeys(selector).flatMap((k): [string, boolean][] =>
          k in COMPOSED
            ? [
                [k, false],
                [COMPOSED[k]!, true],
              ]
            : [[k, false]],
        )) {
          const group = `${context(rule.first!)}|${specificity(selector).join()}|${key}`;
          groups.set(group, [
            ...(groups.get(group) ?? []),
            { file: name, selector, prop: decl.prop, value: decl.value + (decl.important ? " !important" : ""), via },
          ]);
        }
    });
  const conflicts = new Set<string>();
  const used = new Set<string>();
  const order = outFiles();
  // A tie is settled when the later file (in `components/index.css` order, the single bundle's winner) loads the
  // earlier one's stylesheet before its own: whichever loads first on a page, the earlier file comes first (TW-121).
  const settled = (earlier: string, later: string) => {
    const list = imports(later);
    return (
      list.includes(earlier) &&
      list.indexOf(earlier) < list.indexOf(later) &&
      imports(earlier).every((dep) => dep === earlier || list.indexOf(dep) < list.indexOf(earlier))
    );
  };
  for (const [group, rules] of groups)
    for (const a of rules)
      for (const b of rules) {
        if (a.file >= b.file || (a.via && b.via) || !overlap(a.prop, b.prop) || (a.prop === b.prop && a.value === b.value) || exclusive(a.selector, b.selector))
          continue;
        const pair = `${group.split("|").pop()}|${a.file},${b.file}`;
        if (pair in DISJOINT) {
          used.add(pair);
          continue;
        }
        const [earlier, later] = order.indexOf(a.file) < order.indexOf(b.file) ? [a.file, b.file] : [b.file, a.file];
        if (settled(earlier, later)) continue;
        conflicts.add(`${group}: ${a.file} ${a.selector} {${a.prop}: ${a.value}} / ${b.file} ${b.selector} {${b.prop}: ${b.value}}`);
      }
  assert.deepEqual([...conflicts], []);
  assert.deepEqual(
    Object.keys(DISJOINT).filter((pair) => !used.has(pair)),
    [],
    "stale DISJOINT entries",
  );
});

test("styles split: every class a component composes is styled where it renders (its stylesheet is imported)", () => {
  // Owner of a BEM block = the out file that styles it (`.table-root` → table.css): the file named after the block, else
  // the one using it most as a selector's first class.
  const names = componentOrder();
  const owners = new Map<string, Map<string, number>>();
  for (const name of outFiles())
    for (const m of readFileSync(new URL(`${name}.css`, out), "utf8").matchAll(/(?:^|[{},]\s*)\.([a-z][\w-]*)/gm)) {
      const block = m[1]!.split(/__|--/)[0]!;
      const count = owners.get(block) ?? new Map<string, number>();
      owners.set(block, count.set(name, (count.get(name) ?? 0) + 1));
    }
  const owner = (block: string) => {
    const count = owners.get(block);
    return !count ? undefined : count.has(block) ? block : [...count].sort((a, b) => b[1] - a[1])[0]![0];
  };
  const missing: string[] = [];
  const dirs = new URL("../src/components/", import.meta.url);
  for (const name of names) {
    const sources = [
      `../styles/src/components/${name}/${name}.styles.ts`,
      // A shared stylesheet with no component of its own (`morph-icon`: classes rendered by other components) has no dir.
      ...(existsSync(new URL(`${name}/`, dirs)) ? readdirSync(new URL(`${name}/`, dirs)) : [])
        .filter((f) => /\.tsx?$/.test(f))
        .map((f) => `../src/components/${name}/${f}`),
    ];
    const own = new Set(imports(name));
    for (const source of sources) {
      const code = readFileSync(new URL(source, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      // Class strings: quoted text with a BEM element / modifier token (`"checkbox checkbox--primary data-grid__checkbox"`);
      // a lone word ("button", "header") is an element type, role or slot name as often as a class.
      for (const m of code.matchAll(/["'`]([a-z][\w -]*)["'`]/g)) {
        const tokens = m[1]!.split(/\s+/).filter(Boolean);
        if (!tokens.some((token) => /[a-z0-9](__|--)[a-z0-9]/.test(token))) continue;
        for (const token of tokens) {
          const block = owner(token.split(/__|--/)[0]!);
          if (block && block !== name && !own.has(block)) missing.push(`${source.split("/").pop()}: ${token} → out/${block}.css`);
        }
      }
    }
  }
  assert.deepEqual([...new Set(missing)], []);
});
