// G9: native events from lib.dom (one generated list for compiler + JSX types).
import { test } from "vitest";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { check, compile } from "../index.ts";

const root = new URL("../../../", import.meta.url);

test("generated event list is up to date with TypeScript's lib.dom", () => {
  const out = execFileSync(process.execPath, [new URL("scripts/gen-events.mjs", root).pathname, "--check"], { encoding: "utf8" });
  assert.match(out, /up to date/);
});

test("compiler and JSX types carry the same event names", () => {
  const rust = readFileSync(new URL("libs/compiler/rust/src/events_data.rs", root), "utf8");
  const types = readFileSync(new URL("libs/runtime/jsx-events.ts", root), "utf8");
  const fromRust = [...rust.matchAll(/\("(\w+)", "\w+"\)/g)].map((m) => m[1]);
  const fromTypes = [...types.matchAll(/^ {2}(\w+): \w+;$/gm)].map((m) => m[1]);
  assert.ok(fromRust.length > 90);
  assert.deepEqual(fromTypes, fromRust);
});

test("lib.dom events compile on both targets with their DOM type names", () => {
  const names = { onTransitionEnd: "transitionend", onPaste: "paste", onToggle: "toggle", onBeforeToggle: "beforetoggle", onAnimationStart: "animationstart", onLoadedMetadata: "loadedmetadata", onDblClick: "dblclick", onPointerOver: "pointerover", onInvalid: "invalid", onClose: "close", onCancel: "cancel" };
  for (const [name, type] of Object.entries(names)) {
    const source = `export const A = (p: { f: () => void }) => <div ${name}={p.f} />;`;
    const server = compile(source, { target: "server", filename: "a.tsx" });
    assert.deepEqual(server.diagnostics, [], name);
    const dom = compile(source, { target: "dom", filename: "a.tsx" });
    assert.deepEqual(dom.diagnostics, [], name);
    assert.match(dom.code, new RegExp(`"${type}"`), name);
  }
});

test("unknown camelCase and lowercase on-names still fail", () => {
  for (const name of ["onMystery", "onclick", "onTransitionend", "onWebkitAnimationEnd"]) {
    const { diagnostics } = compile(`export const A = (p: { f: () => void }) => <div ${name}={p.f} />;`, { target: "dom", filename: "a.tsx" });
    assert.deepEqual(diagnostics.map((d) => d.message), [`Unknown native event: ${name} (a DOM event like onClick / onInput, or on:my-event={…} for a custom event)`], name);
  }
});

test("on:custom-name listens for that exact event type; prop:x binds a property (DOM) and is omitted on the server", () => {
  const source = `export const A = (p: { f: () => void; v: number[] }) => <x-el on:value-change={p.f} on:openChanged={p.f} prop:items={p.v} />;`;
  const dom = compile(source, { target: "dom", filename: "a.tsx" });
  assert.deepEqual(dom.diagnostics, []);
  assert.match(dom.code, /__rivet_listen\(_el\$1, "value-change", p\.f\);/);
  assert.match(dom.code, /__rivet_listen\(_el\$1, "openChanged", p\.f\);/);
  assert.match(dom.code, /__rivet_fx\(\(\) => __rivet_setProp\(_el\$1, "items", p\.v\)\);/);
  const server = compile(source, { target: "server", filename: "a.tsx" });
  assert.deepEqual(server.diagnostics, []);
  assert.doesNotMatch(server.code, /items|value-change/);
  assert.match(server.code, /__rivetOmitted\(p\.v\)/);
  // Unused: no new imports.
  const plain = compile(`export const B = () => <div onClick={() => {}} />;`, { target: "dom", filename: "b.tsx" });
  assert.doesNotMatch(plain.code, /setProp|_listen/);
});

test("unsafe prop: names fail on both targets", () => {
  for (const [attr, message] of [
    ["prop:innerHTML", "Unsafe or unsupported native attribute: prop:innerHTML"],
    ["prop:outerHTML", "Unsafe or unsupported native attribute: prop:outerHTML"],
    ["prop:onclick", "Unsafe or unsupported native attribute: prop:onclick"],
    ["prop:style", "Unsafe or unsupported native attribute: prop:style"],
    ["prop:__proto__", "Unsafe or unsupported native attribute: prop:__proto__"],
  ]) {
    for (const target of ["server", "dom"] as const) {
      const { diagnostics } = compile(`export const A = (p: { v: string }) => <div ${attr}={p.v} />;`, { target, filename: "a.tsx" });
      assert.deepEqual(diagnostics.map((d) => d.message), [message], `${target} ${attr}`);
    }
  }
});

test("static unsafe URL literals on prop: fail like URL attributes (RV1101); dynamic values are checked at runtime", () => {
  for (const attr of [`prop:href="javascript:alert(1)"`, `prop:src={"vbscript:x"}`, `prop:formAction=" javascript:x"`]) {
    for (const target of ["server", "dom"] as const) {
      const { diagnostics } = compile(`export const A = () => <a ${attr} />;`, { target, filename: "a.tsx" });
      assert.equal(diagnostics.length, 1, `${target} ${attr}`);
      assert.match(diagnostics[0]!.message, /^Unsafe URL attribute/);
    }
  }
  const ok = compile(`export const A = (p: { u: string }) => <a prop:href={p.u} prop:title="javascript:fine" />;`, { target: "dom", filename: "a.tsx" });
  assert.deepEqual(ok.diagnostics, []);
});

test("prop:indeterminate on a checkbox: DOM binding, omitted on the server, element effect when resumed", () => {
  const source = `import { signal } from "@rivetjs/reactivity"; export function A() { const m = signal(true); return <input type="checkbox" prop:indeterminate={m()} />; }`;
  const dom = compile(source, { target: "dom", filename: "a.tsx" });
  assert.deepEqual(dom.diagnostics, []);
  assert.match(dom.code, /__rivet_fx\(\(\) => __rivet_setProp\(_el\$1, "indeterminate", m\(\)\)\);/);
  const server = compile(source, { target: "server", filename: "a.tsx" });
  assert.deepEqual(server.diagnostics, []);
  assert.doesNotMatch(server.code, /indeterminate/);
  const resumed = compile(source, { target: "server", filename: "a.tsx", resume: { module: "src/a.tsx" } });
  assert.deepEqual(resumed.diagnostics, []);
  assert.match(resumed.code, /__rivetR_effect\("src\/a\.tsx#A\$\w+", \[__rivetCell, m\], \{ when: "load" \}\)/);
  const symbols = compile(source, { target: "dom", filename: "a.tsx", resume: { module: "src/a.tsx" } }).symbols!;
  assert.match(symbols[0]!.source, /\(__rivetEl, m\) => \(\) => __rivetResumeElement\(__rivetEl, "indeterminate", \(m\(\)\)\)/);
});

// Handler expressions are evaluated once (Solid semantics, DOM v2 spec decision Q4): no handler-selection effect.
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
test("event handler expressions are passed as written: delegated `_on`, capture / custom `_listen`; no effect", () => {
  for (const expression of ["() => count()", "function (event) { return this.id + event.type; }", "((() => count()))", "async () => count()"])
    for (const name of ["onClick", "onClickCapture", "on:custom"]) {
      const result = compile(`export const A = () => <button ${name}={${expression}} />;`, { target: "dom", filename: "inline.tsx" });
      assert.deepEqual(result.diagnostics, [], `${name}: ${expression}`);
      assert.match(
        result.code,
        name === "onClick" ? /__rivet_on\(_el\$1, "click", / : name === "onClickCapture" ? /__rivet_listen\(_el\$1, "click", [^]*, \{ capture: true \}\);/ : /__rivet_listen\(_el\$1, "custom", /,
        expression,
      );
      assert.doesNotMatch(result.code, /__rivet_fx/, expression);
    }
  for (const expression of ["handler", "props.handler", "handle.bind(null, 1)", "(track(), () => count())"])
    for (const name of ["onClick", "onClickCapture"]) {
      const result = compile(`export const A = () => <button ${name}={${expression}} />;`, { target: "dom", filename: "dynamic.tsx" });
      assert.deepEqual(result.diagnostics, [], expression);
      assert.match(result.code, new RegExp(`__rivet_(?:on|listen)\\(_el\\$1, "click", ${escape(expression)}[,)]`), expression);
      assert.doesNotMatch(result.code, /__rivet_fx/, expression);
    }
});

// Spec decision Q4 (docs/design/specs/2026-10-06-dom-v2-only-design.md, user 2026-10-07): handlers bind once, so a
// value that reads state when it binds — a call, or a conditional / logical whose operands run a call — is RV1016
// (an error: it would silently freeze on its first result). Calls inside nested functions do not run at bind time.
const RV1016 = /^Event handler (\S+) expression is evaluated once at render \(handlers bind once\); wrap it in an arrow/;
const frozen = [
  "getHandler()",
  "makeHandler?.(id)",
  "props.handlerFor(id)",
  "enabled() ? (() => one()) : (() => two())",
  "enabled() ? one : two",
  "open ? close() : show",
  "enabled() && handler",
  "handler || fallback()",
  "custom() ?? handler",
  "(cond ? new Handler() : handler)",
  "(getHandler() as (event: Event) => void)",
  "(0, getHandler())",
  "(track(), enabled() ? one : two)",
];
const allowed = [
  "() => (enabled() ? one() : two())",
  "function (event) { return getHandler()(event); }",
  "handler",
  "props.onClick",
  "handlers[kind]",
  "handle.bind(null, id)",
  "disabled ? undefined : props.onClick",
  "!disabled && handler",
  "cond ? (() => one()) : undefined",
  "handler ?? fallback",
  "(track(), () => count())",
  "(track(), undefined)",
];
const source = (name: string, expression: string) =>
  `const id = 1, open = true, cond = true, disabled = false, kind = "a";\nexport const A = (props: any) => <button ${name}={${expression}} />;\n`;

test("RV1016: handler values that read state when they bind are errors on every target (decision Q4)", () => {
  for (const expression of frozen)
    for (const name of ["onClick", "onClickCapture", "on:custom", "window:onKeyDown", "document:onClick"])
      for (const options of [{ target: "dom" }, { target: "server" }, { target: "dom", resume: { module: "m" } }, { target: "server", resume: { module: "m" } }] as const) {
        const text = source(name, expression);
        const result = compile(text, { ...options, filename: "frozen.tsx" });
        const label = `${name}={${expression}} ${JSON.stringify(options)}`;
        assert.equal(result.code, "", label);
        assert.deepEqual(
          result.diagnostics.map((d) => [d.code, d.severity, RV1016.exec(d.message)?.[1], d.line, d.column]),
          [["RV1016", "error", name, 2, text.split("\n")[1]!.indexOf(name) + 1]],
          label,
        );
      }
  // `check`: one diagnostic for both targets, spanning the attribute.
  const text = source("onClick", "enabled() ? one : two");
  const { diagnostics } = check(text, { filename: "frozen.tsx", resume: { module: "m" } });
  assert.equal(diagnostics.length, 1);
  const [d] = diagnostics;
  assert.deepEqual([d!.code, d!.severity, d!.targets], ["RV1016", "error", ["server", "dom"]]);
  assert.equal(text.slice(d!.start, d!.end), "onClick={enabled() ? one : two}");
  assert.match(d!.message, /`onClick=\{\(\) => \(cond\(\) \? a\(\) : b\(\)\)\}`/);
});

test("RV1016 allows function literals, references, `f.bind(…)` and call-free conditionals", () => {
  for (const expression of allowed)
    for (const name of ["onClick", "onClickCapture", "window:onKeyDown"])
      for (const target of ["dom", "server"] as const) {
        const result = compile(source(name, expression), { target, filename: "allowed.tsx" });
        assert.deepEqual(result.diagnostics, [], `${target} ${name}={${expression}}`);
        assert.notEqual(result.code, "");
      }
  // Component props are props, not bindings: forwarded as written.
  assert.deepEqual(compile(`export const A = () => <Button onClick={getHandler()} />;`, { target: "dom", filename: "c.tsx" }).diagnostics, []);
});

test("inline event options cannot capture a shadowed undefined binding", () => {
  for (const source of [
    'export function A(undefined) { return <button onClick={() => {}} />; }',
    'export function A() { const button = <button onClick={() => {}} />; let undefined; return button; }',
  ]) {
    const result = compile(source, { target: "dom", filename: "shadow.tsx" });
    assert.deepEqual(result.diagnostics, []);
    // Run the generated binding call with a tiny ABI stub; the user binding must never
    // become listener options, nor cause a temporal-dead-zone read.
    const code = result.code.replace(/^import .*;\n/m, "").replace("export function", "function");
    let args: unknown[] = ["not called"];
    const A = new Function("__rivet_tpl", "__rivet_on", code + "\nreturn A;")(
      () => () => ({}),
      (...call: unknown[]) => {
        args = call;
      },
    );
    A({ capture: true });
    assert.equal(args.length, 3);
    assert.equal(args[1], "click");
    assert.equal(typeof args[2], "function");
  }
});
