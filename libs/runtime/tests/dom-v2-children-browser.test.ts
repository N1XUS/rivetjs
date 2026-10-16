import { test } from "vitest";
import assert from "node:assert/strict";
import { withPage } from "./resume/harness.ts";

// DOM v2 arrays holding accessors (fragment / lazy children `[() => cond ? <a/> : null, <div/>]`, V2-FIX R4 / R5):
// an accessor's update re-runs only that item — the lazy-children function that built the array is not re-read
// (its other nodes, e.g. a popover's container or a tree row's checkbox, keep their identity), and sibling
// accessors keep their nodes (v1: one range per part); an item returning an accessor binds it in a cell of its own.
const unit = `
import { mount, _tpl, _t, _fx, _insert, _scoped } from "/dom.ts";
import { signal, computed } from "/reactivity.mjs";
const check = (condition, message) => { if (!condition) throw Error(message); };
const host = () => { const node = document.createElement("div"); document.body.append(node); return node; };
const el = (tag) => _tpl("<" + tag + "></" + tag + ">")();
export function slotArray() {
  // A sole child bound to a lazy-children slot (FocusScope \`{props.children}\` → \`_t(el, slot)\`).
  const target = host(), open = signal(true);
  let built = 0, kept = null;
  mount(() => {
    const scope = el("div");
    const slot = () => (built++, [() => (open() ? el("i") : null), (kept = el("section"))]);
    _fx(() => _t(scope, slot));
    return scope;
  }, target);
  const section = kept;
  open.set(false);
  check(built === 1, "slot read once: " + built);
  check(target.querySelector("section") === section && !target.querySelector("i"), "container kept, item removed");
  open.set(true);
  check(built === 1 && target.firstChild.firstChild.localName === "i" && target.querySelector("section") === section, "item back first, container kept");
  return "passed";
}
export function insertedSlotArray() {
  // The same through \`_insert(parent, accessor)\`: the accessor's array is bound in a nested effect.
  const target = host(), open = signal(true);
  let built = 0;
  mount(() => {
    const root = el("div");
    _insert(root, () => (built++, [() => (open() ? "a" : null), el("b")]));
    return root;
  }, target);
  const b = target.querySelector("b");
  open.set(false);
  open.set(true);
  check(built === 1 && target.firstChild.textContent === "a" && target.querySelector("b") === b, "read once, sibling kept: " + built);
  return "passed";
}
export function siblingItems() {
  // A fragment of two dynamic children (\`<>{a() ? <X/> : null}{b() ? <Y/> : null}</>\` → \`_scoped\` items): an update
  // of one re-creates only its own content.
  const target = host(), a = signal(true), b = signal(1);
  let runsA = 0, runsB = 0;
  mount(() => {
    const root = el("div");
    _insert(root, [_scoped(() => (runsA++, a() ? el("u") : null)), _scoped(() => (runsB++, b() ? el("s") : null))]);
    return root;
  }, target);
  const u = target.querySelector("u");
  b.set(2);
  check(runsA === 1 && runsB === 2 && target.querySelector("u") === u, "sibling kept: " + runsA + "/" + runsB);
  a.set(false);
  check(runsA === 2 && runsB === 2 && !target.querySelector("u") && target.querySelector("s"), "own item only");
  return "passed";
}
export function throwingItem() {
  // A throwing item empties only itself, then rethrows (v1 \`bindChild\` clears its own range).
  const target = host(), bad = signal(false);
  mount(() => {
    const root = el("div");
    _insert(root, [() => { if (bad()) throw Error("boom"); return el("u"); }, el("s")]);
    return root;
  }, target);
  let thrown = null;
  try { bad.set(true); } catch (error) { thrown = error; }
  check(thrown && thrown.message === "boom", "rethrown");
  check(!target.querySelector("u") && target.querySelector("s"), "item emptied, sibling kept: " + target.innerHTML);
  return "passed";
}
export function itemReturnsSlot() {
  // An item whose read returns a lazy-children slot (a call child \`{fresh(() => props.children)}\` next to a function
  // child, ui AvatarGroup): the slot binds in its own cell, so an update of an accessor it built (a Show per child)
  // does not re-read the slot (re-creating every child).
  const target = host(), on = signal(true);
  let built = 0;
  mount(() => {
    const root = el("div");
    const slot = () => (built++, [() => (on() ? el("i") : null), el("b")]);
    _insert(root, () => [() => slot, () => "tail"]);
    return root;
  }, target);
  const b = target.querySelector("b");
  on.set(false);
  on.set(true);
  check(built === 1 && target.querySelector("b") === b && target.querySelector("i") && target.textContent === "tail", "slot read once: " + built);
  return "passed";
}
export function underComputed() {
  // Content built while a computed evaluates (cdk \`buildCollectionFrom\`: a ComboBox's collection build pass renders the
  // non-hideable parts of its children, e.g. a Group around \`[<Input/>, <Trigger/>]\`): creating an array's cells
  // writes no signal ("Signal writes are not allowed during computed evaluation" before), and the cells stay live.
  const on = signal(true);
  let root = null;
  const built = computed(() => {
    root = el("div");
    _insert(root, [() => (on() ? el("i") : el("u")), el("b")]);
    return root;
  });
  built();
  check(root.innerHTML === "<i></i><b></b>", "built under a computed: " + root.innerHTML);
  on.set(false);
  check(root.innerHTML === "<u></u><b></b>", "cell updates after the build: " + root.innerHTML);
  return "passed";
}
export function movedParent() {
  // Nested accessors (a slot returning a user slot returning a component's \`<Show>\`: \`{props.children ?? <Default/>}\`
  // inside a Provider output) first bound in a detached fragment before \`marker\`: their nodes move with the marker into
  // the element, and an inner update inserts next to the marker where it is now (was: the fragment, "insertBefore … not a child").
  const on = signal(true), frag = document.createDocumentFragment(), end = document.createTextNode("");
  frag.append(end);
  _insert(null, () => () => () => (on() ? el("i") : el("b")), end);
  const target = host();
  target.append(frag);
  on.set(false);
  check(target.innerHTML === "<b></b>" && target.lastChild === end, "updated in place: " + target.innerHTML);
  return "passed";
}
`;

for (const scenario of ["slotArray", "insertedSlotArray", "siblingItems", "throwingItem", "itemReturnsSlot", "underComputed", "movedParent"]) {
  test("dom v2 children: " + scenario, async () => {
    await withPage({ "/": "<!doctype html><body></body>", "/unit.mjs": unit }, async (page) => {
      await page.goto("http://rivet.test/");
      assert.equal(await page.evaluate(async (name) => ((await import("/unit.mjs" as string)) as Record<string, () => string>)[name]!(), scenario), "passed");
    });
  });
}
