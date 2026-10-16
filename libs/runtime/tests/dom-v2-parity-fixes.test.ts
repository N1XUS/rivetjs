import { test } from "vitest";
import assert from "node:assert/strict";
import { withPage } from "./resume/harness.ts";

// Round-2 v1 ⇄ v2 parity fixes (libs/compiler/tests/v2-parity), checked in Chromium: delegated dispatch
// matches native listeners, a controlled spread `checked` / `value` is re-asserted, a throwing sole
// child empties its slot, and an accessor returned under a binding gets its own effect.
const unit = `
import { mount, _tpl, _fx, _t, _textValue, _on, _insert, _for } from "/dom.ts";
import { _spread } from "/dom-v2.ts";
import { signal } from "/reactivity.mjs";
const check = (condition, message) => { if (!condition) throw Error(message); };
const host = () => { const node = document.createElement("div"); document.body.append(node); return node; };
export function disabledTargets() {
  // No \`disabled\` skip: a synthetic pointer event on a disabled button reaches its handler, as a native listener would.
  const target = host(), log = [];
  mount(() => {
    const b = _tpl("<button disabled>b</button>")();
    _on(b, "pointerdown", () => log.push("down"));
    return b;
  }, target);
  target.firstChild.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  check(log.join() === "down", "disabled target handler ran: " + log.join());
  return "passed";
}
export function fixedPath() {
  // A handler that detaches its node (a re-render) does not cut the bubbling short: the path is the one
  // fixed at dispatch start. currentTarget is the document again for later document listeners.
  const target = host(), log = [], show = signal(true);
  mount(() => {
    const row = _tpl("<div><span></span></div>")();
    _on(row, "click", (e) => log.push("row:" + (e.currentTarget === row)));
    _insert(row.firstChild, () => {
      if (!show()) return null;
      const b = _tpl("<button>x</button>")();
      _on(b, "click", () => { log.push("button"); show.set(false); });
      return b;
    });
    return row;
  }, target);
  let seen = null;
  const late = (e) => (seen = e.currentTarget);
  document.addEventListener("click", late);
  target.querySelector("button").click();
  document.removeEventListener("click", late);
  check(log.join() === "button,row:true", "bubbled past the detached node: " + log.join());
  check(seen === document, "currentTarget restored for later document listeners");
  check(target.querySelector("button") === null, "re-rendered");
  return "passed";
}
export function stopBelowDocument() {
  // stopPropagation in a delegated handler also skips document listeners registered after the dispatcher
  // (react-aria usePress global pointerup / click listeners), as native propagation would.
  const target = host(), log = [];
  mount(() => {
    const b = _tpl("<button>b</button>")();
    _on(b, "click", (e) => { log.push("button"); e.stopPropagation(); });
    return b;
  }, target);
  const late = () => log.push("document");
  document.addEventListener("click", late);
  target.firstChild.click();
  document.removeEventListener("click", late);
  check(log.join() === "button", "later document listener skipped: " + log.join());
  return "passed";
}
export function controlledSpread() {
  // An accessor-bound \`checked\` is re-asserted on every spread run although unchanged (v1's per-key
  // binding re-runs on its own reads); a static one is not, and the \`value\` attribute is left alone.
  const target = host(), on = signal(false), other = signal(0);
  mount(() => {
    const t = _tpl("<div><input type=checkbox><input type=checkbox></div>")(), live = t.firstChild, fixed = live.nextSibling;
    _spread(live, () => ({ checked: () => on(), "data-n": other(), value: "v" }));
    _spread(fixed, () => ({ checked: false, "data-n": other() }));
    return t;
  }, target);
  const [live, fixed] = target.querySelectorAll("input");
  live.checked = true; fixed.checked = true;
  other.set(1);
  check(live.checked === false, "controlled checked restored");
  check(fixed.checked === true, "static checked untouched");
  check(live.getAttribute("value") === "v", "value attribute kept: " + live.getAttribute("value"));
  return "passed";
}
export function throwingChild() {
  // A throwing read empties the slot (v1 clears its range) and the error still reaches the caller.
  const target = host(), fail = signal(false), errors = [];
  const onError = (e) => { errors.push(e.message); e.preventDefault(); };
  window.addEventListener("error", onError);
  mount(() => {
    const t = _tpl("<div><p></p><i></i></div>")(), p = t.firstChild, i = p.nextSibling;
    _textValue(p, () => { if (fail()) throw Error("boom"); return "text"; });
    _insert(i, () => { if (fail()) throw Error("boom2"); return "inserted"; });
    return t;
  }, target);
  check(target.textContent === "textinserted", "initial: " + target.textContent);
  try { fail.set(true); } catch (e) { errors.push(e.message); }
  window.removeEventListener("error", onError);
  check(target.textContent === "", "slots emptied: " + JSON.stringify(target.textContent));
  check(errors.length > 0, "error reported");
  return "passed";
}
export function nestedAccessor() {
  // An accessor (a list) under a component-children binding binds in its own effect: list updates do not
  // re-run the binding, so the rows (and focus) are kept.
  const target = host(), keys = signal(["a", "b"]), version = signal(0);
  let created = 0;
  mount(() => {
    const d = _tpl("<div></div>")();
    _fx(() => _t(d, (created++, _for({ each: () => keys(), by: (k) => k, children: (k) => { const b = _tpl("<button></button>")(); _fx(() => _t(b, k() + version())); return b; } }))));
    return d;
  }, target);
  const first = target.querySelector("button");
  first.focus();
  keys.set(["a", "b", "c"]);
  version.set(1);
  check(created === 1, "binding not re-run: " + created);
  check(target.querySelector("button") === first && document.activeElement === first, "row kept, focus kept");
  check(target.textContent === "a1b1c1", "rows updated: " + target.textContent);
  // \`_insert\` whose read returns an accessor (a component returning a \`<For>\`, cdk VirtualizerChildren).
  const shown = signal(true), third = host();
  let reads = 0;
  mount(() => {
    const d = _tpl("<div></div>")();
    _insert(d, () => (reads++, shown() ? _for({ each: () => keys(), by: (k) => k, children: (k) => { const b = _tpl("<i></i>")(); _fx(() => _t(b, k())); return b; } }) : null));
    return d;
  }, third);
  const row = third.querySelector("i");
  keys.set(["a", "b", "c", "d"]);
  check(reads === 1 && third.querySelector("i") === row && third.textContent === "abcd", "insert accessor nested: " + reads + " " + third.textContent);
  shown.set(false);
  check(reads === 2 && third.textContent === "", "outer read still live");
  // An array holding an accessor (fragment content) likewise.
  const flag = signal(true), other = host();
  let runs = 0;
  mount(() => {
    const d = _tpl("<div></div>")();
    _fx(() => _t(d, (runs++, [_tpl("<b>x</b>")(), () => (flag() ? "on" : "off")])));
    return d;
  }, other);
  const b = other.querySelector("b");
  flag.set(false);
  check(runs === 1 && other.querySelector("b") === b && other.textContent === "xoff", "array accessor nested: " + runs + " " + other.textContent);
  return "passed";
}
`;

for (const scenario of ["disabledTargets", "fixedPath", "stopBelowDocument", "controlledSpread", "throwingChild", "nestedAccessor"]) {
  test("dom v2 parity: " + scenario, async () => {
    await withPage({ "/": "<!doctype html><body></body>", "/unit.mjs": unit }, async (page) => {
      await page.goto("http://rivet.test/");
      assert.equal(await page.evaluate(async (name) => ((await import("/unit.mjs" as string)) as Record<string, () => string>)[name]!(), scenario), "passed");
    });
  });
}
