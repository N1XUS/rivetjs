// data-* conventions (cdk-api-audit P0-3 / P1-8): `dataBool`, `globalDOMProps` forwarding of `data-*` +
// `style`, and a lint over the cdk sources failing on empty-string state values (`data-selected={x ? "" : undefined}`).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";
import { dataBool } from "../utils/data-attrs.tsx";
import { globalDOMProps, hostDOMProps } from "../utils/dom-props.ts";

const root = join(import.meta.dirname, "..");

describe("dataBool", () => {
  test('"true" or undefined, never ""', () => {
    expect(dataBool(true)).toBe("true");
    expect(dataBool(1)).toBe("true");
    expect(dataBool(false)).toBeUndefined();
    expect(dataBool(undefined)).toBeUndefined();
    expect(dataBool(0)).toBeUndefined();
    expect(dataBool("")).toBeUndefined();
  });
});

describe("globalDOMProps", () => {
  test("forwards data-* and style (RAC filterDOMProps), not other props", () => {
    const out = globalDOMProps({ "data-testid": "x", "data-foo-bar": 1, style: "color:red", isDisabled: true, className: "c", onPress: () => {} });
    expect(out).toEqual({ "data-testid": "x", "data-foo-bar": 1, style: "color:red" });
  });
  test("owned names are not forwarded (a component resolving a style render prop owns `style`)", () => {
    expect(globalDOMProps({ style: () => ({}), "data-a": "1" }, ["style"])).toEqual({ "data-a": "1" });
  });
});

// `global: true` cases after react-aria test/utils/filterDOMProps.test.ts (Apache-2.0, © Adobe); `id` is a component
// prop here (not forwarded by the helper) and React's `suppressHydrationWarning` has no Rivet equivalent.
describe("globalDOMProps: global attributes", () => {
  test("includes global attributes", () => {
    const props = { dir: "rtl", lang: "en", hidden: true, inert: true, translate: "no" } as const;
    expect(globalDOMProps(props)).toEqual(props);
  });
  test("strips aria-* and role (labelable props are the component's)", () => {
    expect(globalDOMProps({ "aria-label": "x", role: "group", dir: "ltr" })).toEqual({ dir: "ltr" });
  });
});

describe("hostDOMProps (Angular CDK directive hosts: Drag, DragHandle, DropList, DropListGroup)", () => {
  test("forwards global props + every aria-* + role", () => {
    const props = {
      "aria-label": "Task",
      "aria-labelledby": "t",
      "aria-describedby": "d",
      "aria-details": "x",
      "aria-roledescription": "card",
      role: "group",
      dir: "rtl",
      "data-a": "1",
    };
    expect(hostDOMProps(props)).toEqual(props);
  });
  test("forwards keyboard / focus listeners and tabIndex (Angular host listeners)", () => {
    const fn = () => {};
    const props = { onKeyDown: fn, onKeyUp: fn, onFocus: fn, onBlur: fn, onFocusIn: fn, onFocusOut: fn, tabIndex: 0 };
    expect(hostDOMProps(props)).toEqual(props);
    expect(globalDOMProps(props)).toEqual({});
  });
  test("drops non-attribute keys and owned names", () => {
    expect(hostDOMProps({ ariaLabel: "x", roles: "y", lockAxis: "x", style: "a", onMouseDown: () => {} }, ["style", "onMouseDown"])).toEqual({});
  });
});

// Marker attributes (presence-only, Rivet / Angular internals) may be "": data-rv-*, data-cdk-*, data-rivet-*,
// data-slot, data-testid, data-kn, data-key-*, data-rk; value attributes where "" means something (data-download = RA
// synthetic link `download=""`).
const MARKER = /^data-(?:rv-|cdk-|rivet-|slot$|testid$|kn$|key-|rk$|download$)/;
const STATE_EMPTY = [
  // JSX: data-x={cond ? "" : undefined}
  /\b(data-[a-z][\w-]*)=\{[^{}]*\?\s*""\s*:/g,
  // object bags: "data-x": cond ? "" : undefined / "data-x": () => (cond ? "" : undefined)
  /"(data-[a-z][\w-]*)":\s*[^,{}]*\?\s*""\s*:/g,
];
// Files still rendering "" state values (owned by other wave-2 lanes; shrink only). A clean file listed here
// fails the test so the entry gets removed.
const KNOWN: Record<string, string[]> = {};
// Enumerated (not boolean) attributes whose upstream "off" value is the empty string, kept 1:1.
// shadcn Sidebar: `data-collapsible={state === "collapsed" ? collapsible : ""}` (CSS keys on `=offcanvas` / `=icon`).
const VALUED: Record<string, string[]> = { "sidebar/index.tsx": ["data-collapsible"] };

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "tests" || name === "tests-components" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

test('lint: data-* state attributes use "true" (dataBool), never ""', () => {
  const found: Record<string, Set<string>> = {};
  for (const file of sources(root)) {
    const text = readFileSync(file, "utf8");
    for (const re of STATE_EMPTY) for (const m of text.matchAll(re)) if (!MARKER.test(m[1]!)) (found[relative(root, file)] ??= new Set()).add(m[1]!);
  }
  const unexpected: string[] = [];
  for (const [file, names] of Object.entries(found))
    for (const n of names) if (!KNOWN[file]?.includes(n) && !VALUED[file]?.includes(n)) unexpected.push(`${file}: ${n}`);
  expect(unexpected, 'use dataBool(x) (="true") for state attributes').toEqual([]);
  const stale: string[] = [];
  for (const [file, names] of Object.entries(KNOWN)) for (const n of names) if (!found[file]?.has(n)) stale.push(`${file}: ${n}`);
  expect(stale, "fixed: remove from KNOWN").toEqual([]);
});
