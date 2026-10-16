// Pure cdk helpers: key managers, typeahead, selection, positioning, attribute merging, server-safe
// platform probes.
import { test } from "vitest";
import assert from "node:assert/strict";
import { effect, signal, untrack } from "@rivetjs/reactivity";
import { navigationKeys, nextIndex, typeahead, _resetTypeahead } from "../keys/index.ts";
import { createSelection, extendTo, firstSelected, isSelected, keyId, sameKey, selectAll, selectKey, toggleKey, clearSelection } from "../collections/index.ts";
import { compute } from "../overlay/position.ts";
import { controllable } from "../interactions/index.ts";
import { mergeProps } from "../interactions/merge-props.tsx";
import { supports, isMac } from "../platform/index.ts";

test("nextIndex: vertical arrows, edges, wrap, Home/End, disabled skip", () => {
  assert.equal(nextIndex(4, 0, "ArrowDown"), 1);
  assert.equal(nextIndex(4, 3, "ArrowDown"), 3, "edge without wrap stays");
  assert.equal(nextIndex(4, 3, "ArrowDown", { wrap: true }), 0);
  assert.equal(nextIndex(4, 0, "ArrowUp", { wrap: true }), 3);
  assert.equal(nextIndex(4, -1, "ArrowDown"), 0, "nothing focused: first");
  assert.equal(nextIndex(4, -1, "ArrowUp"), 3, "nothing focused: last");
  assert.equal(nextIndex(4, 2, "Home"), 0);
  assert.equal(nextIndex(4, 0, "End"), 3);
  assert.equal(nextIndex(4, 0, "Home", { homeEnd: false }), null);
  assert.equal(nextIndex(4, 0, "ArrowRight"), null, "horizontal key in vertical list passes through");
  assert.equal(nextIndex(4, 0, "a"), null);
  const isDisabled = (i: number) => i === 1 || i === 3;
  assert.equal(nextIndex(4, 0, "ArrowDown", { isDisabled }), 2);
  assert.equal(nextIndex(4, 2, "ArrowDown", { isDisabled, wrap: true }), 0);
  assert.equal(nextIndex(4, 0, "End", { isDisabled }), 2);
  assert.equal(nextIndex(0, -1, "ArrowDown"), -1, "empty: handled, no move");
});

test("nextIndex: horizontal + RTL, both, paging", () => {
  assert.equal(nextIndex(3, 0, "ArrowRight", { orientation: "horizontal" }), 1);
  assert.equal(nextIndex(3, 0, "ArrowDown", { orientation: "horizontal" }), null);
  assert.equal(nextIndex(3, 0, "ArrowLeft", { orientation: "horizontal", dir: "rtl" }), 1, "RTL: left moves forward");
  assert.equal(nextIndex(3, 1, "ArrowRight", { orientation: "horizontal", dir: "rtl" }), 0);
  assert.equal(nextIndex(3, 0, "ArrowRight", { orientation: "both" }), 1);
  assert.equal(nextIndex(3, 0, "ArrowDown", { orientation: "both" }), 1);
  assert.equal(nextIndex(20, 0, "PageDown", { pageSize: 5 }), 5);
  assert.equal(nextIndex(20, 18, "PageDown", { pageSize: 5 }), 19);
  assert.equal(nextIndex(20, 3, "PageUp", { pageSize: 5 }), 0);
  assert.equal(nextIndex(20, 0, "PageDown", { pageSize: 5, isDisabled: (i) => i === 5 }), 6);
  assert.equal(nextIndex(20, 0, "PageDown"), null, "paging off by default");
});

test("navigationKeys lists the handled keys for data-rk", () => {
  assert.equal(navigationKeys(), "ArrowDown ArrowUp Home End");
  assert.equal(navigationKeys({ orientation: "horizontal", homeEnd: false }), "ArrowLeft ArrowRight");
  assert.equal(navigationKeys({ orientation: "both", pageSize: 10 }), "ArrowDown ArrowUp ArrowLeft ArrowRight Home End PageUp PageDown");
});

test("typeahead: prefix buffer, timeout, cycling, accents/case, disabled", () => {
  const owner = {};
  const texts = ["Apple", "Banana", "Blueberry", "Cherry", "Éclair"];
  assert.equal(typeahead(owner, texts, -1, "b", 1000), 1);
  assert.equal(typeahead(owner, texts, 1, "l", 1100), 2, "buffer 'bl'");
  assert.equal(typeahead(owner, texts, 2, "x", 3000), -1, "buffer reset after timeout, no 'x'");
  _resetTypeahead(owner);
  assert.equal(typeahead(owner, texts, 1, "b", 5000), 2, "single char cycles past current");
  assert.equal(typeahead(owner, texts, 2, "b", 5100), 1, "repeated char cycles and wraps");
  _resetTypeahead(owner);
  assert.equal(typeahead(owner, texts, -1, "E", 7000), 4, "accent-insensitive, case-insensitive");
  _resetTypeahead(owner);
  assert.equal(
    typeahead(owner, texts, -1, "b", 9000, (i) => i === 1),
    2,
    "disabled skipped",
  );
  assert.equal(typeahead(owner, texts, -1, "Enter", 9100), -1, "non-printable ignored");
  _resetTypeahead(owner);
  assert.equal(typeahead(owner, texts, -1, " ", 9200), -1, "leading space is not typeahead (Space selects)");
});

test("selection: single, toggleSingle, multiple, ranges, select all", () => {
  const single = createSelection({ defaultSelected: ["a"] });
  assert.equal(
    untrack(() => firstSelected(single)),
    "a",
  );
  selectKey(single, "b");
  assert.deepEqual([...untrack(single.selected)], ["b"]);
  selectKey(single, "b");
  assert.deepEqual([...untrack(single.selected)], ["b"], "reselect keeps without toggleSingle");
  const toggling = createSelection({ toggleSingle: true, defaultSelected: [1] });
  selectKey(toggling, "1");
  assert.equal(untrack(toggling.selected).size, 0, "number and string keys compare equal");

  const multi = createSelection({ mode: "multiple" });
  selectKey(multi, "a");
  toggleKey(multi, "a");
  selectKey(multi, "c");
  assert.deepEqual([...untrack(multi.selected)], ["c"]);
  const keys = ["a", "b", "c", "d", "e"];
  extendTo(multi, keys, "e");
  assert.deepEqual([...untrack(multi.selected)].sort(), ["c", "d", "e"], "range from anchor c");
  selectAll(multi, keys);
  assert.equal(untrack(multi.selected).size, 5);
  clearSelection(multi);
  assert.equal(untrack(multi.selected).size, 0);

  const none = createSelection({ mode: "none" });
  selectKey(none, "a");
  assert.equal(untrack(none.selected).size, 0);

  // Mixed key types (Set `has` fast path + cross-type String compare): toggles keep insertion order.
  const mixed = createSelection({ mode: "multiple", defaultSelected: [1, "b", 0] });
  assert.deepEqual(
    untrack(() => [isSelected(mixed, "1"), isSelected(mixed, 1), isSelected(mixed, "0"), isSelected(mixed, -0), isSelected(mixed, 2), isSelected(mixed, "B")]),
    [true, true, true, true, false, false],
  );
  toggleKey(mixed, "1");
  assert.deepEqual([...untrack(mixed.selected)], ["b", 0], "string key removes the number key");
  toggleKey(mixed, 7);
  assert.deepEqual([...untrack(mixed.selected)], ["b", 0, 7]);
});

test("selection is reactive and controllable", () => {
  const external = signal(new Set<string | number>(["x"]));
  const selection = createSelection({ selected: external });
  const seen: boolean[] = [];
  const stop = effect(() => void seen.push(isSelected(selection, "y")));
  selectKey(selection, "y");
  assert.deepEqual(seen, [false, true]);
  assert.ok(external().has("y"), "two-way: caller's signal updated");
  stop?.();
});

test("keyId and sameKey", () => {
  assert.equal(keyId("list", "a b/c"), "list-a_20b_2fc");
  assert.equal(keyId("list", 7), "list-7");
  assert.ok(sameKey(1, "1"));
  assert.ok(!sameKey(null, null));
});

test("compute: preferred side, flip, shift, RTL alignment", () => {
  const viewport = { width: 400, height: 300 };
  const box = { width: 100, height: 50 };
  const below = compute({ top: 10, left: 10, width: 80, height: 20 }, box, viewport, "bottom start");
  assert.deepEqual([below.side, below.top, below.left], ["bottom", 34, 10]);
  const flipped = compute({ top: 260, left: 10, width: 80, height: 20 }, box, viewport, "bottom start");
  assert.equal(flipped.side, "top");
  assert.equal(flipped.top, 260 - 4 - 50);
  const shifted = compute({ top: 10, left: 370, width: 20, height: 20 }, box, viewport, "bottom start");
  assert.equal(shifted.left, 400 - 100 - 4, "shifted into the viewport");
  const rtl = compute({ top: 10, left: 200, width: 80, height: 20 }, box, viewport, "bottom start", true);
  assert.equal(rtl.left, 200 + 80 - 100, "RTL start aligns right edges");
  const end = compute({ top: 10, left: 200, width: 80, height: 20 }, box, viewport, "bottom end");
  assert.equal(end.left, 180);
  assert.equal(below.availableHeight, 300 - 34 - 4);
});

test("mergeProps (resumable module): class joined, handlers chained, later wins otherwise", () => {
  const calls: string[] = [];
  const merged = mergeProps({ class: "a", "aria-describedby": "d1", onClick: () => calls.push("first") }, null, {
    class: "b",
    "aria-describedby": "d2",
    onClick: () => calls.push("second"),
  });
  assert.equal(merged.class, "a b");
  assert.equal(merged["aria-describedby"], "d2", "react-aria: aria id lists are not joined, later wins");
  (merged.onClick as () => void)();
  assert.deepEqual(calls, ["first", "second"]);
  const reactive = mergeProps({ class: () => "x" }, { class: "y" });
  assert.equal((reactive.class as () => string)(), "x y", "accessor classes stay accessors");
  assert.equal(mergeProps({ title: "t" }, { title: undefined as string | undefined }).title, "t", "undefined does not erase");
});

test("controllable: caller signal or internal default", () => {
  const own = signal(3);
  assert.equal(controllable(own, 0), own);
  assert.equal(untrack(controllable<number>(undefined, 5)), 5);
});

test("platform probes are undefined on the server", () => {
  assert.equal(supports("field-sizing"), undefined);
  assert.equal(supports("base-select"), undefined);
  assert.equal(isMac(), undefined);
});
