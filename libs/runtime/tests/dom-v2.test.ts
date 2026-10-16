import { test } from "vitest";
import assert from "node:assert/strict";
import { withPage } from "./resume/harness.ts";

// DOM v2 compiler ABI: templates return cloned nodes, static values are written once, children
// reconcile by node identity, and bubbling events are delegated per document.
const unit = `
import { mount, render, _for, _tpl, _c, _fx, _fx1, _t, _textValue, _attrWrite, _attrValue, _setAttr, _on, _listen, _insert } from "/dom.ts";
import { _spread, _ref, _show, _switch, _match } from "/dom-v2.ts";
import { signal, onCleanup, createRoot, createContext, provide, useContext } from "/reactivity.mjs";
const check = (condition, message) => { if (!condition) throw Error(message); };
const host = () => { const node = document.createElement("div"); document.body.append(node); return node; };
const comments = (root) => { const w = document.createTreeWalker(root, 128); let n = 0; while (w.nextNode()) n++; return n; };
const row = _tpl('<tr><td class="id"></td><td><a></a></td></tr>');
export function templates() {
  const target = host(), label = signal("a"), effects = [];
  const stop = mount(() => {
    const tr = row(), id = tr.firstChild, a = id.nextSibling.firstChild;
    _textValue(id, 7);
    _fx(() => _t(a, label()));
    _attrValue(tr, "data-id", 7);
    _fx(() => _attrWrite(a, "title", label() + "!"));
    return tr;
  }, target);
  const tr = target.firstElementChild;
  check(tr.localName === "tr" || tr.nodeType === 1, "template root returned");
  check(target.textContent === "7a" && tr.getAttribute("data-id") === "7", "static values written once: " + target.innerHTML);
  const text = tr.querySelector("a").firstChild;
  label.set("b");
  check(tr.querySelector("a").firstChild === text, "text node kept across updates");
  label.set(""); label.set("b");
  check(target.textContent === "7b" && tr.querySelector("a").title === "b!", "dynamic text/attr update");
  check(comments(target) === 0, "no markers around a v2 root");
  check(row() !== row() && row().outerHTML === row().outerHTML, "fresh clone per call");
  stop();
  check(target.firstElementChild === null, "mount disposal removes nodes");
  return "passed";
}
// Closure-free bindings (OPT-D): one hoisted writer, captures passed per binding.
const writeLabel = (el, n, label) => _t(el, n + ":" + label());
const writeTitle = (el, label) => _attrWrite(el, "title", label() + "!");
export function closureFree() {
  const target = host(), label = signal("a");
  const stop = mount(() => {
    const tr = row(), id = tr.firstChild, a = id.nextSibling.firstChild;
    _fx1(writeLabel, id, 1, label);
    _fx1(writeLabel, a, 2, label);
    _fx1(writeTitle, a, label);
    return tr;
  }, target);
  check(target.textContent === "1:a2:a" && target.querySelector("a").title === "a!", "initial: " + target.innerHTML);
  label.set("b");
  check(target.textContent === "1:b2:b" && target.querySelector("a").title === "b!", "update: " + target.innerHTML);
  stop();
  label.set("c");
  check(target.firstElementChild === null, "mount disposal removes nodes and stops bindings");
  return "passed";
}
export function renders() {
  const target = host(), s = signal(1); let cleaned = 0;
  target.append(document.createElement("hr"));
  const stop = render(() => { onCleanup(() => cleaned++); const p = _tpl("<p></p>")(); _fx(() => _t(p, s())); return [p, "tail"]; }, target);
  check(comments(target) === 0 && target.innerHTML === "<hr><p>1</p>tail", "no markers, appended " + target.innerHTML);
  s.set(2); check(target.textContent === "2tail", "binding live");
  stop(); stop();
  check(target.innerHTML === "<hr>" && cleaned === 1, "dispose removes own nodes only");
  const empty = host(), stop2 = render(() => _tpl("<i>x</i>")(), empty); stop2();
  check(empty.firstChild === null, "fast clear");
  return "passed";
}
export function attributes() {
  const target = host();
  mount(() => {
    const t = _tpl("<div><a>x</a><input><button>b</button></div>")(), a = t.firstChild, input = a.nextSibling, button = input.nextSibling;
    _attrValue(a, "href", "javascript:alert(1)");
    _attrValue(input, "value", "v");
    _attrValue(button, "disabled", true);
    _attrValue(button, "hidden", false);
    _attrValue(a, "data-n", null);
    const fn = signal("one"); _attrValue(a, "title", fn); fn.set("two");
    _setAttr(a, "data-x", 3); _setAttr(a, "data-y", null); const dz = signal("z"); _setAttr(a, "data-z", dz); dz.set("zz");
    check(a.getAttribute("data-x") === "3" && !a.hasAttribute("data-y") && a.getAttribute("data-z") === "zz", "plain attrs");
    check(a.getAttribute("href") !== "javascript:alert(1)", "unsafe url blocked");
    check(input.value === "v" && button.disabled && !button.hasAttribute("hidden") && !a.hasAttribute("data-n"), "value/boolean/null");
    check(a.title === "two", "identifier accessor falls back to binding");
    return t;
  }, target);
  return "passed";
}
export function svg() {
  const target = host();
  mount(() => _tpl('<circle r="1"></circle>', 1)(), target);
  check(target.firstElementChild.namespaceURI === "http://www.w3.org/2000/svg", "svg context");
  const frag = _tpl("<i>a</i><b>b</b>", 4)();
  check(frag.nodeType === 11 && frag.childNodes.length === 2, "fragment flag");
  return "passed";
}
export function components() {
  const target = host(), s = signal(0); let runs = 0, cleaned = 0;
  const Child = (props) => { runs++; s(); onCleanup(() => cleaned++); const t = _tpl("<p></p>")(); _fx(() => _t(t, props.n + s())); return t; };
  const stop = mount(() => _c(Child, { n: 1 }), target);
  s.set(5);
  check(runs === 1 && target.textContent === "6", "component body untracked, binding tracked");
  stop();
  check(cleaned === 1, "component cleanup runs with owner");
  return "passed";
}
export function inserts() {
  const target = host(), value = signal("x");
  mount(() => {
    const t = _tpl("<div><b>end</b></div>")();
    _insert(t, () => value(), t.firstChild);
    return t;
  }, target);
  const div = target.firstElementChild;
  check(div.textContent === "xend", "text before marker");
  const text = div.firstChild; value.set("y");
  check(div.firstChild === text && div.textContent === "yend", "text updated in place");
  value.set(null); check(div.textContent === "end", "null removes");
  const n = document.createElement("i"); n.textContent = "n"; value.set(n); check(div.firstChild === n, "node inserted");
  value.set([1, "two", [document.createElement("u")]]); check(div.childNodes.length === 4 && div.textContent === "1twoend", "array flattened");
  value.set(42); check(div.textContent === "42end", "array → text");
  return "passed";
}
export function reconcile() {
  const target = host(), nodes = Array.from({ length: 8 }, (_, i) => { const e = document.createElement("p"); e.textContent = String(i); return e; });
  const list = signal(nodes.slice());
  mount(() => { const t = _tpl("<div></div>")(); _insert(t, () => list()); return t; }, target);
  const div = target.firstElementChild, order = () => Array.from(div.childNodes, (n) => n.textContent).join("");
  check(order() === "01234567", "initial");
  let moves = 0; const ib = div.insertBefore.bind(div); div.insertBefore = (a, b) => { moves++; return ib(a, b); };
  const swap = nodes.slice(); [swap[1], swap[6]] = [swap[6], swap[1]]; list.set(swap);
  check(order() === "06234517" && moves <= 2, "swap " + order() + " moves " + moves);
  moves = 0; list.set(swap.slice().reverse()); check(order() === "71543260", "reverse " + order());
  list.set(nodes.filter((_, i) => i % 2)); check(order() === "1357", "remove " + order());
  moves = 0; list.set(nodes.slice()); check(order() === "01234567", "insert " + order());
  const rm = div.removeChild.bind(div); let removes = 0; div.removeChild = (a) => { removes++; return rm(a); };
  list.set([]); check(div.childNodes.length === 0 && removes === 0, "fast clear");
  list.set(nodes.slice(0, 3)); check(order() === "012", "append from empty");
  return "passed";
}
export function lists() {
  const target = host(), list = signal([{ id: 1, t: "a" }, { id: 2, t: "b" }, { id: 3, t: "c" }]);
  let created = 0, cleaned = 0;
  const rowTpl = _tpl("<li></li>");
  render(() => {
    const ul = _tpl("<ul></ul>")();
    _insert(ul, _for({ each: list, by: (r) => r.id, children: (item) => {
      created++; onCleanup(() => cleaned++);
      const li = rowTpl(); _fx(() => _t(li, item().t)); return li;
    } }));
    return ul;
  }, target);
  const ul = target.firstChild, text = () => Array.from(ul.childNodes, (n) => n.textContent).join("");
  check(text() === "abc" && created === 3, "create " + text());
  const first = ul.firstChild;
  list.set([{ id: 1, t: "A" }, ...list().slice(1)]);
  check(text() === "Abc" && ul.firstChild === first && created === 3, "item updates in place " + text());
  list.set([list()[2], list()[1], list()[0]]);
  check(text() === "cbA" && created === 3, "reorder keeps rows " + text());
  list.set(list().slice(1));
  check(text() === "bA" && cleaned === 1, "removed row disposed " + cleaned);
  list.set([{ id: 9, t: "x" }, { id: 8, t: "y" }]);
  check(text() === "xy" && cleaned === 3 && created === 5, "replace all " + text() + cleaned + created);
  list.set([]);
  check(ul.childNodes.length === 0 && cleaned === 5, "clear");
  let threw = false; try { list.set([{ id: 1, t: "a" }, { id: 1, t: "b" }]); } catch { threw = true; }
  check(threw, "duplicate keys rejected");
  return "passed";
}
export function listIndex() {
  const target = host(), list = signal(["a", "b"]);
  render(() => {
    const ul = _tpl("<ul></ul>")();
    _insert(ul, _for({ each: list, by: (x) => x, children: (item, index) => { const li = _tpl("<li></li>")(); _fx(() => _t(li, index() + item())); return li; } }));
    return ul;
  }, target);
  const ul = target.firstChild, text = () => Array.from(ul.childNodes, (n) => n.textContent).join(",");
  check(text() === "0a,1b", text());
  list.set(["b", "a"]);
  check(text() === "0b,1a", "index updates " + text());
  return "passed";
}
export function listDynamicRows() {
  const target = host(), list = signal([1, 2]), flag = signal(true);
  render(() => {
    const ul = _tpl("<div></div>")();
    _insert(ul, _for({ each: list, by: (x) => x, children: (item) => () => (flag() ? "y" + item() : "n") }));
    return ul;
  }, target);
  const div = target.firstChild;
  check(div.textContent === "y1y2", div.textContent);
  flag.set(false); check(div.textContent === "nn", "dynamic row content " + div.textContent);
  list.set([2]); check(div.textContent === "n", "dynamic row removed " + div.textContent);
  return "passed";
}
export function events() {
  const target = host(); const log = [];
  mount(() => {
    const t = _tpl("<div><button><span>in</span></button><i>x</i></div>")(), b = t.firstChild, i = b.nextSibling;
    _on(t, "click", (e) => log.push("div:" + (e.currentTarget === t)));
    _on(b, "click", (e) => { log.push("btn:" + (e.currentTarget === b)); });
    _on(i, "click", (e) => { log.push("i"); e.stopPropagation(); });
    _listen(i, "focus", () => log.push("focus"));
    return t;
  }, target);
  target.querySelector("span").click();
  target.querySelector("i").click();
  check(log.join(",") === "btn:true,div:true,i", log.join(","));
  // B1: an unset handler prop (\`onBlur={props.onBlur}\`) binds nothing; a non-function is rejected like v1.
  const errors = [], onError = (e) => errors.push(e.message);
  window.addEventListener("error", onError);
  mount(() => {
    const el = _tpl("<i>y</i>")();
    _listen(el, "blur", undefined); _listen(el, "focus", null, { capture: true }); _on(el, "keydown", undefined); _on(el, "click", null);
    return el;
  }, target);
  const y = target.lastElementChild;
  y.dispatchEvent(new FocusEvent("blur")); y.dispatchEvent(new FocusEvent("focus")); y.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true })); y.click();
  window.removeEventListener("error", onError);
  check(errors.length === 0, "unset handlers are no-ops: " + errors.join(","));
  check(throws(() => mount(() => { const el = _tpl("<i></i>")(); _listen(el, "blur", "nope"); return el; }, host()), /Event handler must be a function/) === true, "listen rejects non-functions");
  check(throws(() => mount(() => { const el = _tpl("<i></i>")(); _on(el, "click", 1); return el; }, host()), /Event handler must be a function/) === true, "on rejects non-functions");
  return "passed";
}
export function eventContext() {
  const target = host(); const log = []; const token = createContext("outer"); const on = signal(true);
  const Inner = () => {
    const t = _tpl("<button>b</button>")();
    _on(t, "click", () => { log.push(useContext(token)); on.set(false); log.push("attached:" + t.isConnected); });
    _listen(t, "focus", () => log.push("focus:" + useContext(token)));
    return t;
  };
  mount(() => provide(token, "inner", () => { const d = _tpl("<div></div>")(); _insert(d, () => on() ? _c(Inner, {}) : null); return d; }), target);
  const button = target.querySelector("button");
  button.dispatchEvent(new FocusEvent("focus"));
  button.click();
  check(log.join(",") === "focus:inner,inner,attached:true" && !button.isConnected, log.join(","));
  return "passed";
}
const attrs = (el) => [...el.attributes].map((a) => a.name + "=" + a.value).sort().join(" ");
const throws = (fn, re) => { try { fn(); } catch (e) { return re.test(e.message) ? true : e.message; } return "no error"; };
// Spread: an object sequence through \`_spread\` (keys diffed per run).
const spreadSteps = [
  { title: "t", disabled: true, "data-n": 1, className: "a", class: "b", href: "javascript:alert(1)", value: "v", children: "k", ref: () => 1 },
  { title: "t2", "data-n": null, class: "c", hidden: false, htmlFor: "x", value: "w" },
  {},
];
export function spreads() {
  const object = signal(spreadSteps[0]);
  const run = (bind) => { const target = host(); const seen = []; const stop = mount(() => { const el = document.createElement("input"); bind(el, () => object()); return el; }, target); for (const step of spreadSteps) { object.set(step); seen.push(attrs(target.firstChild) + "|" + target.firstChild.value); } stop(); return seen; };
  const v2 = run((el, read) => _spread(el, read));
  check(v2[0] === "class=b data-n=1 disabled= href=about:invalid#rivet title=t value=v|v" && v2[1] === "class=c for=x title=t2 value=w|w" && v2[2] === "|", "diffed keys: " + v2.join(" / "));
  // Static object: applied once, no effect; an accessor value tracks inside one effect.
  const target = host(), acc = signal("one");
  mount(() => { const el = _tpl("<p></p>")(); _spread(el, { id: "s", title: acc }); return el; }, target);
  check(attrs(target.firstChild) === "id=s title=one", "static object " + attrs(target.firstChild));
  acc.set("two");
  check(target.firstChild.title === "two", "accessor value tracked");
  // Unsafe names throw; \`style\` strings are refused, objects are diffed like an explicit style={obj}; \`class\` removes on empty.
  check(throws(() => _spread(target.firstChild, { innerHTML: "x" }), /Unsafe attribute name/) === true, "innerHTML rejected");
  check(throws(() => _spread(target.firstChild, { style: "color:red" }), /Unsupported style value/) === true, "style string rejected");
  const styled = signal({ style: { color: "red", marginTop: "1px" } }), styleHost = host(), cssText = () => styleHost.firstChild.style.cssText;
  mount(() => { const el = _tpl("<p></p>")(); _spread(el, () => styled()); return el; }, styleHost);
  check(cssText() === "color: red; margin-top: 1px;", "style object " + cssText());
  styled.set({ style: { color: "blue", "--x": 2 } });
  check(cssText() === "color: blue; --x: 2;", "style keys diffed " + cssText());
  styled.set({ style: () => ({ color: "green" }) });
  check(cssText() === "color: green;", "style accessor value " + cssText());
  styled.set({});
  check(cssText() === "", "style removed " + cssText());
  _spread(target.firstChild, { class: "" });
  check(!target.firstChild.hasAttribute("class"), "empty class removed");
  return "passed";
}
export function spreadEvents() {
  const target = host(), log = [], object = signal({ onClick: (e) => log.push("spread:" + (e.currentTarget === e.target)), onScroll: () => log.push("scroll"), onPointerDownCapture: () => log.push("capture") });
  const stop = mount(() => { const el = _tpl("<button></button>")(); _on(el, "click", () => log.push("own")); _spread(el, () => object()); return el; }, target);
  const b = target.firstChild;
  b.click(); b.dispatchEvent(new Event("scroll")); b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  check(log.join(",") === "own,spread:true,scroll,capture", "explicit first, direct + capture listeners: " + log.join(","));
  log.length = 0;
  object.set({ onClick: () => log.push("swapped"), onScroll: null });
  b.click(); b.dispatchEvent(new Event("scroll")); b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  check(log.join(",") === "own,swapped", "swap keeps the explicit handler; removed keys stop firing: " + log.join(","));
  log.length = 0;
  object.set({});
  b.click();
  check(log.join(",") === "own", "spread handler removed, explicit stays: " + log.join(","));
  check(throws(() => _spread(_tpl("<i></i>")(), { onClick: 1 }), /must be a function/) === true, "non-function handler rejected");
  stop();
  log.length = 0;
  object.set({ onScroll: () => log.push("late") });
  b.dispatchEvent(new Event("scroll"));
  check(log.length === 0, "direct listeners removed on dispose");
  return "passed";
}
export function spreadContent() {
  const target = host(), object = signal({ children: "k", id: "a" });
  const stop = mount(() => { const el = _tpl("<div>old</div>")(); _spread(el, () => object(), 1); return el; }, target);
  check(target.innerHTML === '<div id="a">k</div>', "spread children render as content: " + target.innerHTML);
  const b = _tpl("<b>n</b>")();
  object.set({ children: [b, "!"], id: "a" });
  check(target.innerHTML === '<div id="a"><b>n</b>!</div>', "content updates: " + target.innerHTML);
  object.set({ id: "a" });
  check(target.innerHTML === '<div id="a"></div>', "content cleared: " + target.innerHTML);
  stop();
  // Children are re-inserted only when the \`children\` value changes (identity), not on every re-run of the
  // spread object: an attribute-only change keeps the child nodes (focus, input values, nested state).
  const cls = signal("a"), id = signal("x"), made = [];
  const kid = () => { const s = _tpl("<span>c</span>")(); made.push(s); return s; };
  const other = () => _tpl("<i>o</i>")();
  const kids = signal(kid), keep = host(), thunk = host();
  const stopKeep = mount(() => { const el = _tpl("<div></div>")(); _spread(el, { class: () => cls(), children: kid }, 1); return el; }, keep);
  const stopThunk = mount(() => { const el = _tpl("<div></div>")(); _spread(el, () => ({ id: id(), children: kids() }), 1); return el; }, thunk);
  const span = keep.querySelector("span"), span2 = thunk.querySelector("span");
  cls.set("b"); id.set("y");
  check(keep.firstChild.className === "b" && keep.querySelector("span") === span, "accessor attribute change keeps the child node: " + made.length);
  check(thunk.firstChild.id === "y" && thunk.querySelector("span") === span2, "spread object re-run keeps unchanged children");
  kids.set(() => other());
  check(thunk.innerHTML === '<div id="y"><i>o</i></div>', "changed children replace the content: " + thunk.innerHTML);
  stopKeep(); stopThunk();
  const plain = host(), r = signal(null);
  mount(() => { const el = _tpl("<p>x</p>")(); _ref(el, r); return el; }, plain);
  check(r() === plain.firstChild, "_ref binds a ref() signal");
  return "passed";
}
export function controlFlow() {
  // _show / _switch / _match (C3): Show / Switch semantics on _insert.
  const target = host(), on = signal(true), n = signal(1), log = [];
  let eagerFallback, frag;
  const stop = mount(() => {
    const d = _tpl("<div><!></div>")(), marker = d.firstChild;
    eagerFallback = _tpl("<i>off</i>")();
    // Lazy function children get the live accessor; eager fallback kept and re-inserted as is.
    _insert(d, _c(_show, { when: () => on() && n(), fallback: eagerFallback, children: (v) => { onCleanup(() => log.push("show")); const b = _tpl("<b></b>")(); _fx(() => _t(b, v())); return b; } }), marker);
    // Eager fragment content: its nodes are captured once and come back whole.
    frag = document.createDocumentFragment(); frag.append("x", _tpl("<u>y</u>")());
    _insert(d, _c(_show, { when: on, children: frag }), null);
    return d;
  }, target);
  const html = () => target.innerHTML.replace(/<!---->/g, "");
  check(html() === "<div><b>1</b>x<u>y</u></div>", "both shown: " + html());
  const b = target.querySelector("b");
  n.set(2);
  check(target.querySelector("b") === b && b.textContent === "2", "truthy memo keeps the branch, accessor live");
  on.set(false);
  check(html() === "<div><i>off</i></div>" && log.join() === "show", "hidden: disposed, fallback shown: " + html());
  on.set(true);
  check(html() === "<div><b>2</b>x<u>y</u></div>" && target.querySelector("b") !== b, "re-created; fragment back: " + html());
  on.set(false);
  check(target.querySelector("i") === eagerFallback, "eager fallback kept (same node)");
  // keyed: re-created on identity change.
  const k = signal({ id: 1 }), made = [];
  const t2 = host();
  const stop2 = mount(() => _c(_show, { when: k, keyed: true, children: (v) => { made.push(v().id); return String(v().id); } }), t2);
  const same = k(); k.set(same); k.set({ id: 2 }); k.set(null);
  check(made.join() === "1,2" && t2.textContent === "", "keyed: " + made.join());
  stop2();
  // Switch: first truthy Match; re-created only when the index changes; Match elsewhere renders nothing.
  const t3 = host(), m = signal(5), created = [];
  const stop3 = mount(() => _c(_switch, { fallback: "none", children: [
    _c(_match, { when: () => m() < 0, children: () => { created.push("neg"); return "neg"; } }),
    _c(_match, { when: () => m() > 10 && m(), children: (v) => { created.push("big"); const p = _tpl("<p></p>")(); _fx(() => _t(p, v())); return p; } }),
  ] }), t3);
  check(t3.textContent === "none", "fallback");
  m.set(-1); m.set(-2); m.set(20); m.set(30);
  check(created.join() === "neg,big" && t3.textContent === "30", "switch: " + created.join() + " " + t3.textContent);
  m.set(1);
  check(t3.textContent === "none", "back to fallback");
  stop3();
  const t4 = host();
  const stop4 = mount(() => [_c(_match, { when: () => true, children: "x" }), "y"], t4);
  check(t4.textContent === "y", "Match outside Switch renders nothing");
  stop4();
  // What a branch creates belongs to the branch: disposed when hidden.
  const t5 = host(), shown = signal(true);
  const stop5 = mount(() => _c(_show, { when: shown, children: () => { onCleanup(() => log.push("branch")); return _tpl("<s>b</s>")(); } }), t5);
  check(t5.textContent === "b", "branch inserted");
  shown.set(false);
  check(t5.textContent === "" && log.includes("branch"), "branch disposed when hidden");
  stop5();
  stop();
  check(target.innerHTML === "", "mount disposal");
  return "passed";
}
`;

for (const scenario of [
  "controlFlow",
  "templates",
  "closureFree",
  "renders",
  "lists",
  "listIndex",
  "listDynamicRows",
  "attributes",
  "svg",
  "components",
  "inserts",
  "reconcile",
  "events",
  "eventContext",
  "spreads",
  "spreadEvents",
  "spreadContent",
]) {
  test("dom v2: " + scenario, async () => {
    await withPage({ "/": "<!doctype html><body></body>", "/unit.mjs": unit }, async (page) => {
      await page.goto("http://rivet.test/");
      assert.equal(await page.evaluate(async (name) => ((await import("/unit.mjs" as string)) as Record<string, () => string>)[name]!(), scenario), "passed");
    });
  });
}
