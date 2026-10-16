// A forwarding view (`splitProps(props, ["class"])[0]`) captured on a resumed page whose source props hold a value the
// resume format cannot serialize (cdk CalendarCell: `date`, a CalendarDate instance) (RESUME-BUGS #4, 2026-10-09). The
// forward box (`{k:"m"}`) used to encode the whole source props object, so the render failed ("capture #0 Day
// instance is not serializable"); a source that fails is narrowed to the key the view forwards (a data value, the
// source's own forwards, else the value read now). Known limit: a live getter of a props recipe whose captures do not
// serialize (`<Cell day={d} class={tone()} />` captures `d`) is that snapshot — it keeps the server value on a resumed
// page (no crash, as the former read-once CalendarCell); per-key recipe captures would need the compiler. `Day` keeps a
// `#private` field: a plain-field class is a resumable data class since Function Bridge T24 (it would not exercise the narrowing).
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = `
import { signal, untrack } from "@rivetjs/reactivity";
import { splitProps } from "@rivetjs/runtime/props";
class Day { #n: number; constructor(n: number) { this.#n = n; } get n() { return this.#n; } }
const days = [new Day(1), new Day(2)];
function Cell(props: { day: Day; class?: string }) {
  const [view] = splitProps(props, ["class"]);
  const n = untrack(() => props.day.n);
  return <span class={view.class}>{n}</span>;
}
function Wrap(props: { day: Day; tone: string }) {
  const [local, rest] = splitProps(props, ["tone"]);
  return <Cell {...rest} class={"c-" + local.tone} />;
}
function Grid(props: { children: (d: Day) => unknown }) {
  return <div>{days.map((d) => props.children(d))}</div>;
}
export function Page() {
  const tone = signal("a");
  return <main>
    <button id="go" onClick={() => tone.set(tone() + "b")}>go</button>
    <section id="static">{days.map((d) => <Cell day={d} class="s" />)}</section>
    <section id="wrap">{days.map((d) => <Wrap day={d} tone={tone()} />)}</section>
    <section id="grid"><Grid>{(d: Day) => <Cell day={d} class={tone()} />}</Grid></section>
  </main>;
}
`;

test("a forwarding view over props holding an unserializable value resumes; its live key updates", async () => {
  const dom = compileResume(source, "dom", "src/narrow.tsx");
  const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/narrow.tsx").code);
  const groups: Record<string, ResumeSymbol[]> = {};
  for (const symbol of dom.symbols) (groups["/c/" + symbol.component + ".js"] ??= []).push(symbol);
  const manifest: ResumeManifest = {
    hash: "narrow",
    runtime: "/rt.js",
    symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
  };
  const files: Record<string, Served> = {
    "/fixture.mjs": rewrite(dom.code),
    "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  };
  for (const [path, symbols] of Object.entries(groups)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
  const page = "<!doctype html><html><head></head><body>" + (await resumableToString(() => server.Page(), { manifest })) + "</body></html>";
  await withPage({ ...files, "/": page }, async (p) => {
    const errors: string[] = [];
    p.on("pageerror", (error) => errors.push(error.message));
    p.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await p.goto("http://rivet.test/");
    const state = () =>
      p.evaluate(() =>
        [...document.querySelectorAll("section")].map((el) => el.id + ":" + [...el.querySelectorAll("span")].map((s) => s.className + s.textContent).join(",")),
      );
    assert.deepEqual(await state(), ["static:s1,s2", "wrap:c-a1,c-a2", "grid:a1,a2"]);
    await p.click("#go");
    await p.waitForFunction(() => document.querySelector("#go")?.textContent === "go");
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.deepEqual(await state(), ["static:s1,s2", "wrap:c-a1,c-a2", "grid:a1,a2"]);
    assert.deepEqual(errors, []);
  });
});
