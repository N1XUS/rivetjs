// Node tests for bidi, platform, id and react-aria utils.
// Ported from angular/components src/cdk/bidi/directionality.spec.ts (MIT, © Google LLC) and
// react-spectrum packages/react-aria/test/utils/{mergeProps,useId}.test.jsx,
// packages/react-stately/test/utils/number.test.ts (Apache-2.0, © Adobe).
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { effect, untrack } from "@rivetjs/reactivity";
import { _resolveDirectionality, createDir, directionValue, documentDirectionality, isRtlLocale, setDir } from "../bidi/index.ts";
import {
  detectPlatform,
  getPlatform,
  getRtlScrollAxisType,
  getSupportedInputTypes,
  isMac,
  isVirtualClick,
  isVirtualPointerEvent,
  RtlScrollAxisType,
  supportsScrollBehavior,
} from "../platform/index.ts";
import { cssEscape } from "../utils/dom.ts";
import { idSignal, mergeIds, useId, useSlotId } from "../utils/id.ts";
import { chain, clamp, mergeProps, mergeRefs, roundToStepPrecision, snapValueToStep, toFixedNumber, updateEffect, useLabels } from "../utils/index.ts";
import { signal } from "@rivetjs/reactivity";

describe("Directionality (service)", () => {
  it("should read dir from the html element if not specified on the body", () => {
    assert.equal(directionValue(documentDirectionality({ body: {}, documentElement: { dir: "rtl" } })), "rtl");
  });
  it("should read dir from the body even it is also specified on the html element", () => {
    assert.equal(directionValue(documentDirectionality({ body: { dir: "rtl" }, documentElement: { dir: "ltr" } })), "rtl");
  });
  it("should default to ltr if nothing is specified on either body or the html element", () => {
    assert.equal(directionValue(documentDirectionality({ body: {}, documentElement: {} })), "ltr");
  });
  it("should default to ltr if an invalid direction is set on the body", () => {
    assert.equal(directionValue(documentDirectionality({ body: { dir: "not-valid" }, documentElement: {} })), "ltr");
  });
  it("server (no document): ltr", () => assert.equal(directionValue(documentDirectionality()), "ltr"));
});

describe("Dir state", () => {
  it("should emit a change when the value changes (signal)", () => {
    const dir = createDir("rtl");
    const seen: string[] = [];
    effect(() => seen.push(dir.valueSignal()));
    assert.equal(setDir(dir, "ltr"), true);
    assert.deepEqual(seen, ["rtl", "ltr"]);
    assert.equal(setDir(dir, "LTR"), false, "same normalized value: no change");
  });
  it("should default to ltr if an invalid value is passed in", () => {
    const dir = createDir("rtl");
    setDir(dir, "not-valid");
    assert.equal(untrack(dir.valueSignal), "ltr");
  });
  it("should preserve the consumer-provided `dir` attribute while normalizing the directive value", () => {
    const dir = createDir("auto");
    assert.equal(untrack(dir.rawDir), "auto");
    assert.equal(untrack(dir.valueSignal), "ltr", "auto without navigator language (node: en) → ltr");
  });
  it("should be case-insensitive", () => assert.equal(untrack(createDir("RTL").valueSignal), "rtl"));
  it("resolves RTL locales", () => {
    for (const l of ["ar", "he-IL", "fa", "ur-PK", "az-Arab", "ckb"]) assert.equal(isRtlLocale(l), true, l);
    for (const l of ["en", "de-DE", "az-Latn", "uz-Arab-Latn", "sr-Cyrl"]) assert.equal(isRtlLocale(l), false, l);
    assert.equal(_resolveDirectionality(null), "ltr");
  });
});

describe("Platform", () => {
  const chromeMac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
  const safariMac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
  const firefox = "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0";
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  const android = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
  it("server: every flag false", () => {
    assert.deepEqual(getPlatform(), {
      isBrowser: false,
      EDGE: false,
      TRIDENT: false,
      BLINK: false,
      WEBKIT: false,
      IOS: false,
      FIREFOX: false,
      ANDROID: false,
      SAFARI: false,
    });
  });
  it("Blink", () => {
    const p = detectPlatform({ isBrowser: true, userAgent: chromeMac, chrome: true, hasCSS: true });
    assert.equal(p.BLINK, true);
    assert.equal(p.WEBKIT, false, "WebKit must run standalone");
    assert.equal(p.SAFARI, false);
  });
  it("WebKit / Safari", () => {
    const p = detectPlatform({ isBrowser: true, userAgent: safariMac, hasCSS: true });
    assert.equal(p.WEBKIT, true);
    assert.equal(p.SAFARI, true);
    assert.equal(p.BLINK, false);
  });
  it("Firefox, iOS, Android", () => {
    assert.equal(detectPlatform({ isBrowser: true, userAgent: firefox, hasCSS: true }).FIREFOX, true);
    const ios = detectPlatform({ isBrowser: true, userAgent: iphone, hasCSS: true });
    assert.equal(ios.IOS, true);
    assert.equal(ios.SAFARI, true);
    assert.equal(detectPlatform({ isBrowser: true, userAgent: iphone, msStream: true }).IOS, false, "MSStream (IE mobile) is not iOS");
    const a = detectPlatform({ isBrowser: true, userAgent: android, chrome: true, hasCSS: true });
    assert.equal(a.ANDROID, true);
    assert.equal(a.BLINK, true);
  });
  it("Edge / Trident are excluded from Blink and WebKit", () => {
    const edge = detectPlatform({ isBrowser: true, userAgent: chromeMac + " Edge/18.0", chrome: true, hasCSS: true });
    assert.equal(edge.EDGE, true);
    assert.equal(edge.BLINK, false);
    const ie = detectPlatform({ isBrowser: true, userAgent: "Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko Android", hasCSS: true });
    assert.equal(ie.TRIDENT, true);
    assert.equal(ie.ANDROID, false, "Trident on mobile fakes android");
  });
  it("server-safe feature checks", () => {
    assert.equal(supportsScrollBehavior(), false);
    assert.equal(getRtlScrollAxisType(), RtlScrollAxisType.NORMAL);
    assert.equal(getSupportedInputTypes().has("date"), true, "server: every candidate");
    assert.equal(isMac(), undefined);
  });
  it("isVirtualClick / isVirtualPointerEvent", () => {
    const click = (init: Record<string, unknown>) => ({ type: "click", detail: 1, buttons: 0, isTrusted: false, ...init }) as unknown as MouseEvent;
    assert.equal(isVirtualClick(click({ detail: 0 })), true, "keyboard / element.click()");
    assert.equal(isVirtualClick(click({ detail: 1 })), false);
    assert.equal(isVirtualClick(click({ detail: 0, pointerType: "mouse" })), false);
    assert.equal(isVirtualClick(click({ pointerType: "", isTrusted: true })), true, "JAWS/NVDA with Firefox");
    const pointer = (init: Record<string, unknown>) =>
      ({ width: 1, height: 1, pressure: 0.5, detail: 0, pointerType: "mouse", ...init }) as unknown as PointerEvent;
    assert.equal(isVirtualPointerEvent(pointer({ width: 0, height: 0 })), true);
    assert.equal(isVirtualPointerEvent(pointer({})), false);
  });
});

describe("useId / mergeIds", () => {
  it("useId returns the default id or a new one", () => {
    assert.equal(useId("x"), "x");
    const a = useId(),
      b = useId();
    assert.notEqual(a, b);
    assert.match(a, /^rv/);
  });
  it("mergeIds: equal ids", () => assert.equal(mergeIds("a", "a"), "a"));
  it("mergeIds: unregistered ids → idB", () => assert.equal(mergeIds("plain1", "plain2"), "plain2"));
  it("mergeIds: reactive ids holding idA switch to idB", () => {
    const a = idSignal("merge-a");
    assert.equal(mergeIds("merge-a", "merge-b"), "merge-b");
    assert.equal(untrack(a), "merge-b");
  });
  it("mergeIds: reactive ids holding idB switch to idA", () => {
    const b = idSignal("merge-d");
    assert.equal(mergeIds("merge-c", "merge-d"), "merge-c");
    assert.equal(untrack(b), "merge-c");
  });
  it("useSlotId on the server keeps the id", () => assert.equal(useSlotId("slot"), "slot"));
});

describe("mergeProps", () => {
  it("handles one argument", () => {
    const onClick = () => {};
    const merged = mergeProps({ onClick, className: "primary", id: "test_id" });
    assert.equal(merged.onClick, onClick);
    assert.equal(merged.className, "primary");
    assert.equal(merged.id, "test_id");
  });
  it("combines callbacks", () => {
    const calls: string[] = [];
    const merged = mergeProps({ onClick: () => calls.push("click1") }, { onClick: () => calls.push("click2") }, { onClick: () => calls.push("click3") });
    merged.onClick();
    assert.deepEqual(calls, ["click1", "click2", "click3"]);
  });
  it("merges props with different keys", () => {
    const calls: string[] = [];
    const merged = mergeProps(
      { onClick: () => calls.push("click1") },
      { onHover: () => calls.push("hover"), styles: { margin: 2 } },
      { onClick: () => calls.push("click2"), onFocus: () => calls.push("focus") },
    );
    merged.onClick();
    merged.onFocus();
    merged.onHover();
    assert.deepEqual(calls, ["click1", "click2", "focus", "hover"]);
    assert.equal(merged.styles.margin, 2);
  });
  it("combines classNames (and Rivet class)", () => {
    assert.equal(mergeProps({ className: "primary" }, { className: "hover" }, { className: "focus" }).className, "primary hover focus");
    assert.equal(mergeProps({ class: "a" }, { class: "" }, { class: "b" }).class, "a b");
  });
  it("combines ids", () => {
    const merged = mergeProps({ id: "id1" }, { id: "id2" }, { id: "id3" });
    assert.equal(merged.id, mergeIds(mergeIds("id1", "id2"), "id3"));
  });
  it("combines ids with aria ids", () => {
    const id2 = idSignal("aria-id2");
    mergeProps({ id: "aria-id1" }, { id: untrack(id2) });
    assert.equal(untrack(id2), "aria-id1", "the reactive id switches like the re-rendered component");
  });
  it("combines reoccuring ids", () => {
    const id1 = untrack(idSignal("re-id1")),
      id2 = untrack(idSignal("re-id2"));
    assert.doesNotThrow(() => mergeProps({ id: id1 }, { id: id2 }, { id: id1 }));
  });
  it("overrides other props (undefined does not override)", () => {
    assert.equal(mergeProps({ data: "id1" }, { data: "id2" }).data, "id2");
    assert.equal((mergeProps({ data: "id1" }, { data: undefined as string | undefined }) as { data?: string }).data, "id1");
  });
  it("merges refs", () => {
    const ref = { current: null as unknown },
      ref1 = { current: null as unknown };
    const merged = mergeProps({ ref }, { ref: ref1 });
    (merged.ref as unknown as (v: unknown) => void)(2);
    assert.equal(ref.current, 2);
    assert.equal(ref1.current, 2);
  });
});

describe("mergeRefs / chain", () => {
  it("returns the single ref as-is", () => {
    const ref = { current: null };
    assert.equal(mergeRefs(ref), ref);
  });
  it("chains cleanups of callback refs and resets object refs", () => {
    const log: string[] = [];
    const obj = { current: null as number | null };
    const merged = mergeRefs<number>((v) => {
      log.push("set " + v);
      return () => log.push("cleanup");
    }, obj) as (v: number | null) => () => void;
    const cleanup = merged(1);
    assert.equal(obj.current, 1);
    cleanup();
    assert.deepEqual(log, ["set 1", "cleanup"]);
    assert.equal(obj.current, null);
  });
  it("chain skips non-functions and keeps order", () => {
    const log: number[] = [];
    chain(
      (n: number) => log.push(n),
      null,
      undefined,
      (n: number) => log.push(n * 10),
    )(2);
    assert.deepEqual(log, [2, 20]);
  });
});

describe("useLabels", () => {
  it("joins aria-label and aria-labelledby through the element id", () => {
    assert.deepEqual(useLabels({ id: "x", "aria-label": "L", "aria-labelledby": " a  b " }), { id: "x", "aria-label": "L", "aria-labelledby": "x a b" });
  });
  it("normalizes aria-labelledby alone", () => assert.equal(useLabels({ id: "x", "aria-labelledby": " a   b" })["aria-labelledby"], "a b"));
  it("uses the default label without labels", () => assert.equal(useLabels({ id: "x" }, "Default")["aria-label"], "Default"));
  it("creates an id", () => assert.ok(useLabels({}).id));
});

describe("updateEffect (useUpdateEffect)", () => {
  it("skips the first run, then runs on changes with cleanup", () => {
    const s = signal(0);
    const log: string[] = [];
    const dispose = updateEffect(
      () => [s()],
      () => {
        log.push("run " + untrack(s));
        return () => log.push("cleanup");
      },
    );
    assert.deepEqual(log, []);
    s.set(1);
    s.set(1);
    s.set(2);
    dispose();
    assert.deepEqual(log, ["run 1", "cleanup", "run 2", "cleanup"]);
  });
});

describe("number utils", () => {
  it("clamp", () => {
    assert.equal(clamp(5, 0, 3), 3);
    assert.equal(clamp(-1, 0, 3), 0);
    assert.equal(clamp(2), 2);
  });
  it("roundToStepPrecision: integer steps unchanged", () => {
    assert.equal(roundToStepPrecision(7.123, 1), 7.123);
    assert.equal(roundToStepPrecision(5, 10), 5);
  });
  it("roundToStepPrecision: decimal steps", () => {
    assert.equal(roundToStepPrecision(1.24, 0.1), 1.24);
    assert.equal(roundToStepPrecision(1.456, 0.01), 1.456);
    assert.equal(roundToStepPrecision(1.2345, 0.015), 1.2345);
    assert.equal(roundToStepPrecision(1.2345, 0.25), 1.235);
    assert.equal(roundToStepPrecision(2.349, 0.1), 2.35);
    assert.equal(roundToStepPrecision(2.35, 0.1), 2.35);
    assert.equal(roundToStepPrecision(-1.456, 0.01), -1.456);
    assert.equal(roundToStepPrecision(0, 0.01), 0);
  });
  it("roundToStepPrecision: exponential steps", () => {
    assert.equal(roundToStepPrecision(0.123456789, 1e-3), 0.1235);
    assert.equal(roundToStepPrecision(0.123456789, 1e-7), 0.12345679);
    assert.equal(roundToStepPrecision(0.123456789, 1.5e-7), 0.123456789);
    assert.equal(roundToStepPrecision(0.123456789, 2.5e-6), 0.12345679);
    assert.equal(roundToStepPrecision(0.123456789, 1e-8), 0.123456789);
  });
  it("snapValueToStep: nearest step based on min and max", () => {
    assert.equal(snapValueToStep(2, -0.5, 100, 3), 2.5);
    assert.equal(snapValueToStep(-6.2, -2.5, 100, 3), -2.5);
    assert.equal(snapValueToStep(106.2, -2.5, 100, 3), 99.5);
    assert.equal(snapValueToStep(-0.009999, -0.5, 0.5, 0.01), -0.01);
    assert.equal(snapValueToStep(-8, -100, 100, 5), -10);
    assert.equal(snapValueToStep(-6, -100, 100, 5), -5);
    assert.equal(snapValueToStep(3, -100, 100, 5), 5);
    assert.equal(snapValueToStep(2, -100, 100, 5), 0);
  });
  it("snapValueToStep: min or max undefined", () => {
    assert.equal(snapValueToStep(2, undefined, undefined, 3), 3);
    assert.equal(snapValueToStep(6, undefined, 5, 3), 3);
    assert.equal(snapValueToStep(4, undefined, 5, 3), 3);
    assert.equal(snapValueToStep(1, 3, undefined, 3), 3);
  });
  it("toFixedNumber", () => assert.equal(toFixedNumber(1.23456, 2), 1.23));
});

describe("cssEscape (CSS.escape fallback)", () => {
  // Vectors from the CSSOM "serialize an identifier" algorithm (the CSS.escape polyfill / WPT cases).
  const cases: [string, string][] = [
    ["", ""],
    ["\0", "\uFFFD"],
    ["a\0", "a\uFFFD"],
    ["\x01\x02\x1E\x1F", "\\1 \\2 \\1e \\1f "],
    ["0a", "\\30 a"],
    ["1a", "\\31 a"],
    ["9a", "\\39 a"],
    ["a0b", "a0b"],
    ["-", "\\-"],
    ["-a", "-a"],
    ["-0a", "-\\30 a"],
    ["--a", "--a"],
    ["\x80\x2D\x5F\xA9", "\x80\x2D\x5F\xA9"],
    ["\x7F\x80\x81", "\\7f \x80\x81"],
    ["\uD834\uDF06", "\uD834\uDF06"],
    [" !xy", "\\ \\!xy"],
    ['a"b\\c', 'a\\"b\\\\c'],
    ["row:1.2", "row\\:1\\.2"],
  ];
  it("serializes identifiers like CSS.escape without the global", () => {
    const saved = (globalThis as Record<string, unknown>).CSS;
    delete (globalThis as Record<string, unknown>).CSS;
    try {
      for (const [input, expected] of cases) assert.equal(cssEscape(input), expected, JSON.stringify(input));
    } finally {
      if (saved !== undefined) (globalThis as Record<string, unknown>).CSS = saved;
    }
  });
  it("uses the native CSS.escape when present", () => {
    const saved = (globalThis as Record<string, unknown>).CSS;
    (globalThis as Record<string, unknown>).CSS = { escape: (v: string) => `native(${v})` };
    try {
      assert.equal(cssEscape("a b"), "native(a b)");
    } finally {
      if (saved === undefined) delete (globalThis as Record<string, unknown>).CSS;
      else (globalThis as Record<string, unknown>).CSS = saved;
    }
  });
});
