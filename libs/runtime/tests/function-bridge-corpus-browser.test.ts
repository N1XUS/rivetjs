// Function Bridge failure corpus (BRIDGE-P0; spec docs/design/specs/2026-10-09-function-bridge-design.md, cases in
// `resume/bridge-corpus.ts`). One resumed page per capture pattern, all in one Chromium session. Per case:
//   "today: …" pins the current outcome (status + message fragment), so a change in failure mode is visible;
//   "bridge: …" asserts the correct behaviour — `test.fails` while today's status is not "pass", so the suite stays green
//   and flips (forcing an update of the case's `today`) once Phase 1–2 fix it.
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import * as compiler from "@rivetjs/compiler";
import { compileSymbolModule } from "./resume/compile.ts";
import type { CompileResult, ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";
import { cases } from "./resume/bridge-corpus.ts";
import type { BridgeCase, Status } from "./resume/bridge-corpus.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
interface Outcome {
  status: Status;
  message: string;
  seen: string[];
}

const RUNTIME = [
  "@rivetjs/runtime/server-resume",
  "@rivetjs/runtime/server",
  "@rivetjs/runtime/style",
  "@rivetjs/runtime/slot",
  "@rivetjs/runtime/resume-format",
  "@rivetjs/runtime/props",
  "@rivetjs/reactivity/store",
  "@rivetjs/reactivity",
];
const typed = compiler as unknown as { compile(source: string, options: object): CompileResult };
const compile = (source: string, target: "server" | "dom", module: string): CompileResult =>
  typed.compile(source, { target, filename: "fixture.tsx", resume: { module } });
/** Library specifiers → data URLs (server) / served paths (browser), longest first. */
const swap = (code: string, map: Record<string, string>): string => {
  for (const [from, to] of Object.entries(map).sort((a, b) => b[0].length - a[0].length))
    code = code.replaceAll(`"${from}"`, JSON.stringify(to)).replaceAll(`'${from}'`, JSON.stringify(to));
  return code;
};
const dataURL = (code: string): string => "data:text/javascript;base64," + Buffer.from(code).toString("base64");

const files: Record<string, Served> = {};
const prepared: { c: BridgeCase; base: string; html?: string; early?: Outcome }[] = [];
for (const [index, c] of cases.entries()) {
  const base = "/k" + index + "/";
  const module = "src/" + c.id + ".tsx";
  const fail = (status: Status, message: string): number => prepared.push({ c, base, early: { status, message, seen: [] } });
  let server: CompileResult, dom: CompileResult;
  try {
    server = compile(c.source, "server", module);
    dom = compile(c.domSource ?? c.source, "dom", module);
  } catch (error) {
    fail("compile", String((error as Error)?.message ?? error));
    continue;
  }
  const diagnostics = [...server.diagnostics, ...dom.diagnostics];
  if (diagnostics.length) {
    fail("compile", diagnostics.map((d) => d.message).join("\n"));
    continue;
  }
  const libs = c.libs ?? {};
  const serverMap: Record<string, string> = Object.fromEntries(RUNTIME.map((s) => [s, import.meta.resolve(s)]));
  const browserMap: Record<string, string> = {};
  for (const [name, code] of Object.entries(libs)) {
    serverMap[name] = dataURL(code);
    browserMap[name] = base + "lib-" + name + ".js";
    files[base + "lib-" + name + ".js"] = code;
  }
  let html: string;
  try {
    const mod = (await import(dataURL(swap(server.code, serverMap)))) as Record<string, () => ServerValue>;
    const byComponent: Record<string, ResumeSymbol[]> = {};
    for (const symbol of dom.symbols) (byComponent[base + "c/" + symbol.component + ".js"] ??= []).push(symbol);
    // Manifest from the SERVER's symbols (what the old page references) mapped to the chunks the browser gets.
    const chunkOf = (s: ResumeSymbol) => base + "c/" + s.component + ".js";
    const manifest: ResumeManifest = {
      hash: c.id,
      runtime: base + "rt.js",
      builtins: base + "builtins.js",
      symbols: Object.fromEntries(server.symbols.map((s) => [s.id, chunkOf(s)])),
      // Dev manifest capture names (Function Bridge T19): dev render errors name the capture.
      captures: Object.fromEntries(server.symbols.map((s) => [s.id, s.labels ?? s.captures])),
    };
    html = await resumableToString(() => mod.Page!(), { manifest });
    files[base + "fixture.mjs"] = swap(rewrite(dom.code), browserMap);
    files[base + "rt.js"] = 'import { createResume } from "/dom-resume.ts"; export default createResume({});';
    files[base + "builtins.js"] = 'import "/resume-builtins.ts";';
    for (const [path, symbols] of Object.entries(byComponent)) files[path] = swap(rewrite(compileSymbolModule(symbols, base + "fixture.mjs")), browserMap);
  } catch (error) {
    fail("render", String((error as Error)?.message ?? error));
    continue;
  }
  const state = /<script type="rivet\/state"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";
  const leaked = (c.absent ?? []).filter((s) => state.includes(s));
  if (leaked.length) {
    // Behaviour is still checked in the browser; the byte verdict wins when it runs right.
    prepared.push({ c, base, html, early: { status: "bytes", message: "state contains " + leaked.join(", ") + " (" + state.length + " B)", seen: [] } });
  } else prepared.push({ c, base, html });
  files[base] = "<!doctype html><html><head></head><body>" + html + "</body></html>";
}

const READ = `document.querySelector(".out")?.textContent ?? "<no .out>"`;
const outcomes = new Map<string, Outcome>();
await withPage(files, async (page) => {
  let errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  // Skew probe: a resume error is recorded (and the loader's reload is canceled so the read stays on this document).
  await page.addInitScript(() => {
    document.addEventListener("rivet:resume-error", (event) => {
      (window as { __resumeError?: boolean }).__resumeError = true;
      event.preventDefault();
    });
  });
  for (const { c, base, html, early } of prepared) {
    if (!html) {
      outcomes.set(c.id, early!);
      continue;
    }
    errors = [];
    const read = c.read ?? READ;
    await page.goto("http://rivet.test" + base);
    const seen: string[] = [String(await page.evaluate(read))];
    for (const step of c.steps ?? [".go"]) {
      const before = seen[seen.length - 1];
      await page.click(step, { timeout: 2000 }).catch((error: Error) => errors.push("click " + step + ": " + error.message.split("\n")[0]));
      await page.waitForFunction(([r, b]) => String(eval(r!)) !== b, [read, before], { timeout: 700 }).catch(() => {});
      seen.push(String(await page.evaluate(read)));
    }
    if (await page.evaluate(() => (globalThis as { __componentRuns?: unknown }).__componentRuns)) errors.push("a component ran in the browser");
    const right = JSON.stringify(seen) === JSON.stringify(c.expect);
    const outcome: Outcome = errors.length
      ? { status: "client", message: errors.join("\n"), seen }
      : right
        ? (early ?? { status: "pass", message: "", seen })
        : { status: "wrong", message: "seen " + JSON.stringify(seen), seen };
    outcomes.set(c.id, outcome);
  }
});

if (process.env.BRIDGE_CORPUS_LOG)
  for (const c of cases) {
    const o = outcomes.get(c.id)!;
    console.log(`[bridge] ${c.group}\t${c.id}\t${o.status}\t${o.message.split("\n")[0]!.slice(0, 220)}`);
  }

for (const c of cases) {
  test(`today: ${c.group} / ${c.id} — ${c.today}`, () => {
    const o = outcomes.get(c.id)!;
    // Production and development builds may fail at different stages (dev checks cycles at encode time).
    assert.ok(o.status === c.today || o.status === c.todayDev, `${c.title}: ${o.status} ${o.message}`);
    if (c.note) assert.match(o.message, new RegExp(c.note, "i"));
  });
  const done = c.today === "pass" || (c.bridge !== undefined && c.today === c.bridge.status && c.note === c.bridge.message);
  (done ? test : test.fails)(`bridge: ${c.group} / ${c.id} — ${c.title}`, () => {
    const o = outcomes.get(c.id)!;
    if (c.bridge) {
      assert.equal(o.status, c.bridge.status, o.message);
      assert.match(o.message, new RegExp(c.bridge.message, "i"));
      return;
    }
    assert.equal(o.status, "pass", o.message);
    assert.deepEqual(o.seen, c.expect);
  });
}
