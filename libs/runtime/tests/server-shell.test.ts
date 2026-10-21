// Shell cache hooks (`@rivetjs/runtime/server-shell`, PPR-T3B): a fill seals the root numbering, a replay writes and
// encodes no root state and its patches equal the fill's — seeded for a hole that records nothing, through the late
// shell encode for one that captures shell values; a numbering that differs is a mismatch.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderResumable, resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { shellHook, type ShellSeal } from "@rivetjs/runtime/server-shell";
import { compileResume, importServer, symbolUrls } from "./resume/compile.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
const source = `
import { signal } from "@rivetjs/reactivity";
import { Async } from "@rivetjs/runtime/server";
const load = (key: string) => Promise.resolve("value " + key);
export function Quiet() {
  const n = signal(0);
  return <main>
    <button id="top" onClick={() => n.set(n() + 1)}>{n()}</button>
    <Async load={() => load("q")} fallback={() => <i>wait</i>}>{(v: string) => <em id="q">{v}</em>}</Async>
    <footer>after</footer>
  </main>;
}
export function Capturing() {
  const n = signal(0);
  const label = { text: "shared" };
  return <main>
    <button id="top" onClick={() => n.set(n() + 1)}>{n()}</button>
    <Async load={() => load("c")} fallback={() => <i>wait</i>}>{(v: string) => <button id="c" onClick={() => n.set(label.text.length)}>{v}</button>}</Async>
  </main>;
}
`;
const dom = compileResume(source, "dom");
const server = await importServer<{ Quiet(): ServerValue; Capturing(): ServerValue }>(compileResume(source, "server").code);
const manifest: ResumeManifest = { hash: "t", runtime: "/rt.js", symbols: symbolUrls(dom.symbols) };

/** Renders `page` into a string writer; `at`: the output length when the hook's `cut` ran. */
async function render(page: () => ServerValue, hook: Parameters<typeof shellHook>[0]): Promise<{ html: string; at: number }> {
  let html = "",
    at = -1;
  const options = { ...hook, cut: () => ((at = html.length), hook.cut?.()) };
  await renderResumable(page, { write: (chunk: string) => void (html += chunk) }, { manifest, stream: {}, shell: shellHook(options) });
  return { html, at };
}
async function fill(page: () => ServerValue): Promise<{ html: string; at: number; seal: ShellSeal }> {
  let seal: ShellSeal | undefined;
  const out = await render(page, { seal: (value) => (seal = value) });
  assert.ok(seal, "sealed at the first patch");
  return { ...out, seal };
}
const HOLES = '<template data-a="';

for (const name of ["Quiet", "Capturing"] as const) {
  test(`shell hook: the replay of a ${name.toLowerCase()} hole writes the shell without its root state, then the fill's holes`, async () => {
    const page = () => server[name]();
    let plain = "";
    await renderResumable(page, { write: (chunk: string) => void (plain += chunk) }, { manifest, stream: {} });
    const filled = await fill(page);
    // The fill renders as without the hook; `cut` ran where the root state script starts.
    assert.equal(filled.html, plain);
    assert.ok(filled.html.startsWith('<script type="rivet/state" data-region="0"', filled.at));
    assert.ok(filled.seal.t > 0 && filled.seal.c.length > 0 && filled.seal.e.includes("click"));
    const mismatches: string[] = [];
    const replayed = await render(page, { replay: filled.seal, mismatch: (why) => void mismatches.push(why) });
    assert.deepEqual(mismatches, []);
    assert.equal(replayed.html.slice(0, replayed.at), filled.html.slice(0, filled.at));
    assert.doesNotMatch(replayed.html, /data-region="0"/);
    // Byte for byte the fill's holes (patch indexes included: the replay's patches encode against the fill's numbering).
    assert.equal(replayed.html.slice(replayed.at), filled.html.slice(filled.html.indexOf(HOLES)));
    assert.match(replayed.html, new RegExp('data-patch="\\d+">\\{"t0":' + filled.seal.t + ","));
  });
}

test("shell hook: a capturing hole whose shell numbers differently from the seal is a mismatch", async () => {
  const page = () => server.Capturing();
  const { seal } = await fill(page);
  const mismatches: string[] = [];
  await assert.rejects(render(page, { replay: { ...seal, t: seal.t + 1 }, mismatch: (why) => void mismatches.push(why) }), /Shell mismatch/);
  assert.equal(mismatches.length, 1);
  assert.match(mismatches[0]!, /table \d+ vs \d+/);
});

test("shell hook: a page without streamed boundaries is not sealed; its replay reports a mismatch and writes the default tail", async () => {
  const source = `export function Flat() { return <p>flat</p>; }`;
  const flat = await importServer<{ Flat(): ServerValue }>(compileResume(source, "server").code);
  let sealed = false;
  await render(() => flat.Flat(), { seal: () => (sealed = true) });
  assert.equal(sealed, false);
  const mismatches: string[] = [];
  const replayed = await render(() => flat.Flat(), {
    replay: { t: 1, c: [], s: [], e: [], f: 0 },
    mismatch: (why) => void mismatches.push(why),
  });
  assert.equal(mismatches.length, 1);
  assert.equal(replayed.html, "<p>flat</p>");
});

// H-holes (PPR-T6): a fill retains its `$hole` boundaries; a hit renders no shell — the boundaries re-run under their frames
// with the fill's numbering, their patches equal the fill's byte for byte (overlay over the fill's table when they capture).
// `$hole={1}` by hand tests the runtime mechanism apart from the compiler's policy (CapturingHoles captures a signal: the
// compiler would not mark it); Unmarked's second boundary captures a `let`, so the compiler leaves it unmarked.
const holesSource = `
import { signal, createContext, useContext } from "@rivetjs/reactivity";
import { Async, Provider } from "@rivetjs/runtime/server";
import { createId } from "@rivetjs/runtime/id";
const load = (key: string) => Promise.resolve("value " + key);
const Theme = createContext("light", { id: "test:theme" });
function Leaf(props: { v: string }) {
  const id = createId();
  const theme = useContext(Theme);
  return <label for={id} data-theme={theme}>{props.v}<input id={id} /></label>;
}
export function QuietHoles() {
  return <main>
    <p>{createId()}</p>
    <Async $hole={1} load={() => load("a")} fallback={() => <i>wait</i>}>{(v: string) => <em id="a">{v}</em>}</Async>
    <Provider token={Theme} value="dark">
      <section><Async $hole={1} load={() => load("b")} fallback={() => <i>wait</i>}>{(v: string) => <Leaf v={v} />}</Async></section>
    </Provider>
    <footer>after</footer>
  </main>;
}
export function CapturingHoles() {
  const n = signal(0);
  const label = { text: "shared" };
  return <main>
    <button id="top" onClick={() => n.set(label.text.length)}>{n()}</button>
    <Async $hole={1} load={() => load("c")} fallback={() => <i>wait</i>}>{(v: string) => <button id="c" onClick={() => n.set(label.text.length + v.length)}>{v}</button>}</Async>
  </main>;
}
export function Unmarked() {
  let key = "b";
  return <main>
    <Async $hole={1} load={() => load("a")} fallback={() => <i>wait</i>}>{(v: string) => <em>{v}</em>}</Async>
    <Async load={() => load(key)} fallback={() => <i>wait</i>}>{(v: string) => <em>{v}</em>}</Async>
  </main>;
}
`;
const holesDom = compileResume(holesSource, "dom");
const holesServer = await importServer<Record<"QuietHoles" | "CapturingHoles" | "Unmarked", () => ServerValue>>(compileResume(holesSource, "server").code);
const holesManifest: ResumeManifest = { hash: "t", runtime: "/rt.js", symbols: symbolUrls(holesDom.symbols) };
const { withIdScope } = await import("@rivetjs/runtime/id");
const { shellHoles } = await import("@rivetjs/runtime/server-shell");
type Holes = NonNullable<Parameters<NonNullable<Parameters<typeof shellHook>[0]["holes"]>>[0]>;

async function renderIn(page: () => ServerValue, hook: Parameters<typeof shellHook>[0]): Promise<{ html: string; at: number }> {
  let html = "",
    at = -1;
  const options = { ...hook, cut: () => ((at = html.length), hook.cut?.()) };
  await withIdScope("rv", () =>
    renderResumable(page, { write: (chunk: string) => void (html += chunk) }, { manifest: holesManifest, stream: {}, shell: shellHook(options) }),
  );
  return { html, at };
}

for (const name of ["QuietHoles", "CapturingHoles"] as const) {
  test(`shell hook: H-holes — a hit of ${name} renders no shell and streams the fill's holes byte for byte`, async () => {
    const page = () => holesServer[name]();
    let seal: ShellSeal | undefined,
      retained: Holes | null = null,
      why: string | null = null;
    const filled = await renderIn(page, { seal: (value) => (seal = value), holes: (holes, reason) => ((retained = holes), (why = reason)) });
    assert.equal(why, null);
    assert.ok(seal?.fork, "the seal carries the encoder numbering");
    assert.ok(retained);
    for (let hit = 0; hit < 3; hit++) {
      const mismatches: string[] = [];
      const out = await renderIn(shellHoles(retained!), { replay: seal!, retained: retained!, mismatch: (why) => void mismatches.push(why) });
      assert.deepEqual(mismatches, []);
      assert.equal(out.at, 0, "nothing before the holes");
      assert.equal(out.html, filled.html.slice(filled.html.indexOf(HOLES)));
    }
  });
}

test("shell hook: H-holes — a streamed boundary without the compiler's `$hole` keeps the entry on replay", async () => {
  let retained: unknown = 1,
    why: string | null = null;
  await renderIn(() => holesServer.Unmarked(), { seal: () => {}, holes: (holes, reason) => ((retained = holes), (why = reason)) });
  assert.equal(retained, null);
  assert.match(why!, /did not mark `\$hole`/);
});

// PPR-T57: provider lists forked with the table (a hole's computed under the shell's identified provider reuses the
// fill's list entry), ancestor-provided signals watched (a hole that writes one makes the entry replay-only), and
// per-hit context swaps (the router's head sink).
const t57Source = `
import { signal, computed, createContext, useContext } from "@rivetjs/reactivity";
import { Async, Provider } from "@rivetjs/runtime/server";
import { resumableContext } from "@rivetjs/runtime/resume-format";
const load = (key: string) => Promise.resolve("value " + key);
const Tone = resumableContext(createContext("plain", { id: "test:t57-tone" }));
const Tally = createContext<{ seen: { (): number; set(n: number): unknown } } | null>(null);
const Sink = createContext<{ name: string } | null>(null);
function ShellButton() {
  const doubled = computed(() => 2);
  return <button id="s" onClick={() => console.log(doubled())}>shell</button>;
}
function HoleButton(props: { v: string }) {
  const tripled = computed(() => props.v.length * 3);
  return <button id="h" onClick={() => console.log(tripled())}>{props.v}</button>;
}
export function SharedProviders() {
  return <main><Provider token={Tone} value="loud">
    <ShellButton />
    <Async $hole={1} load={() => load("p")} fallback={() => <i>wait</i>}>{(v: string) => <HoleButton v={v} />}</Async>
  </Provider></main>;
}
function TallyProvider(props: { children: unknown }) {
  const seen = signal(0);
  return <Provider token={Tally} value={{ seen }}>{props.children}</Provider>;
}
function Writer(props: { v: string; write: boolean }) {
  const tally = useContext(Tally)!;
  if (props.write) tally.seen.set(tally.seen() + 1);
  const open = signal(false);
  return <em id="w" onClick={() => open.set(!open())}>{props.v} {String(tally.seen())}</em>;
}
export function Writes() {
  return <main><TallyProvider>
    <Async $hole={1} load={() => load("w")} fallback={() => <i>wait</i>}>{(v: string) => <Writer v={v} write={true} />}</Async>
  </TallyProvider></main>;
}
export function Reads() {
  return <main><TallyProvider>
    <Async $hole={1} load={() => load("r")} fallback={() => <i>wait</i>}>{(v: string) => <Writer v={v} write={false} />}</Async>
  </TallyProvider></main>;
}
function Named(props: { v: string }) {
  const open = signal(false);
  return <b id="n" onClick={() => open.set(!open())}>{props.v} {useContext(Sink)?.name ?? "none"}</b>;
}
export function Swapped() {
  return <main><Provider token={Sink} value={{ name: "fill" }}>
    <Async $hole={1} load={() => load("n")} fallback={() => <i>wait</i>}>{(v: string) => <Named v={v} />}</Async>
  </Provider></main>;
}
export { Sink };
`;
const t57Dom = compileResume(t57Source, "dom");
type T57 = Record<"SharedProviders" | "Writes" | "Reads" | "Swapped", () => ServerValue> & { Sink: import("@rivetjs/reactivity").Context<unknown> };
const t57 = await importServer<T57>(compileResume(t57Source, "server").code);
const t57Manifest: ResumeManifest = { hash: "t", runtime: "/rt.js", symbols: symbolUrls(t57Dom.symbols) };
const { shellWritten } = await import("@rivetjs/runtime/server-shell");

async function renderT57(page: () => ServerValue, hook: Parameters<typeof shellHook>[0]): Promise<string> {
  let html = "";
  await withIdScope("rv", () =>
    renderResumable(page, { write: (chunk: string) => void (html += chunk) }, { manifest: t57Manifest, stream: {}, shell: shellHook(hook) }),
  );
  return html;
}
async function fillT57(page: () => ServerValue): Promise<{ html: string; seal: ShellSeal; retained: Holes }> {
  let seal: ShellSeal | undefined,
    retained: Holes | null = null,
    why: string | null = null;
  const html = await renderT57(page, { seal: (value) => (seal = value), holes: (holes, reason) => ((retained = holes), (why = reason)) });
  assert.equal(why, null);
  assert.ok(seal?.fork && retained, JSON.stringify({ seal: !!seal, fork: !!seal?.fork, retained: !!retained, html }));
  return { html, seal, retained };
}

test("shell hook: H-holes — a hole's computed under a shell provider reuses the fill's provider list (patch byte-equal)", async () => {
  const page = () => t57.SharedProviders();
  const { html, seal, retained } = await fillT57(page);
  const holes = html.slice(html.indexOf(HOLES));
  assert.match(holes, /"v":1/, "the hole's computed carries its providers");
  assert.ok(seal.fork!.providers.size > 0, "the fork holds the shell's provider list");
  for (let hit = 0; hit < 2; hit++) {
    const mismatches: string[] = [];
    const out = await renderT57(shellHoles(retained), { replay: seal, retained, mismatch: (why) => void mismatches.push(why) });
    assert.deepEqual(mismatches, []);
    assert.equal(out, holes);
  }
});

test("shell hook: H-holes — a hole writing a signal an ancestor provides is caught (replay-only); reading it is not", async () => {
  const writes = await fillT57(() => t57.Writes());
  assert.equal(writes.retained.watch.length, 1, "the provided signal is watched");
  assert.match(shellWritten(writes.retained)!, /wrote a signal/);
  const reads = await fillT57(() => t57.Reads());
  assert.equal(reads.retained.watch.length, 1);
  assert.equal(shellWritten(reads.retained), null);
  // Hits of the reading page stay H-holes, equal to the fill; a write on a hit is caught after it.
  const out = await renderT57(shellHoles(reads.retained), { replay: reads.seal, retained: reads.retained });
  assert.equal(out, reads.html.slice(reads.html.indexOf(HOLES)));
  assert.equal(shellWritten(reads.retained), null);
});

test("shell hook: H-holes — swaps provide the hit's value of a frame context around each boundary", async () => {
  const page = () => t57.Swapped();
  const { html, seal, retained } = await fillT57(page);
  assert.match(html, /value n fill/);
  const swap = [[t57.Sink, (fill: unknown) => ({ ...(fill as object), name: "hit" })]] as const;
  const out = await renderT57(
    shellHoles(retained, () => swap),
    { replay: seal, retained },
  );
  assert.match(out, /value n hit/);
  assert.equal(out.replace("value n hit", "value n fill"), html.slice(html.indexOf(HOLES)));
});
