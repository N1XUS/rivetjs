// PLACE calibration harness (spec docs/design/specs/2026-10-26-automatic-placement-design.md §4.3): measures what the
// placement cost model prices, on this machine, and writes a cost table (`libs/compiler/place-table.json` by default,
// read by `rivet({ resume: { placement: "measured" } })`).
//
//   node scripts/place/calibrate.ts [--profile mobile|desktop] [--out <file>] [--runs 5] [--no-browser]
//                                   [--p-interact 0.5] [--server-weight 0.001] [--ab <a.json>,<b.json>]
//
// `--ab`: two frame measurements of the same pages (`{ frames: { id: { html, htmlGz, files } } }`, e.g. a build with the
// heuristic table and one without any `site`): the HTML compression of a state byte is then fitted on real pages
// (Σ |Δ gzip| / Σ |Δ raw| over frames whose fetched files did not change) instead of the synthetic page.
//
// Measured (each a least-squares fit over variants, R² reported in `meta`):
// - JS: compiled DOM bytes per source byte (raw / gzip) over the `@rivetjs/ui` component modules, and V8 parse + compile
//   ms per raw KB (`vm.SourceTextModule` construction: the same V8 as Chromium; × the profile's CPU factor);
// - HTML: boundaries-tail bytes per record and per recorded props byte, and the tail's gzip ratio (server renders of a
//   synthetic page through `@rivetjs/runtime/server-derived`, N parts × props size, `site` vs `with-parent`);
// - server: µs per render as a + b·records + c·state bytes (same renders, median of `--runs` × 200);
// - browser (Chromium, CPU throttled per profile): first-click script ms as a + b·adopted elements + c·adopted records
//   (a parent with E static elements around N parts; `site` adopts one part, `with-parent` the parent).
// Policy inputs (not measured): the network profile (Lighthouse mobile 1.6 Mbps / desktop 10 Mbps), `p-interact` (share of
// page views with an interaction) and `server-weight` (client ms per server µs: 0.001 = server time counts like TTFB).
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, platform, release } from "node:os";
import { spawnSync } from "node:child_process";
import { join, relative } from "node:path";
import vm from "node:vm";

const repo = new URL("../../", import.meta.url).pathname;
// `vm.SourceTextModule` needs the flag: re-run ourselves with it.
if (!(vm as { SourceTextModule?: unknown }).SourceTextModule) {
  const r = spawnSync(
    process.execPath,
    ["--experimental-vm-modules", "--no-warnings", ...process.execArgv, new URL(import.meta.url).pathname, ...process.argv.slice(2)],
    {
      stdio: "inherit",
    },
  );
  process.exit(r.status ?? 1);
}

const { compile } = await import(repo + "libs/compiler/index.ts");
const { derivedToString } = await import("@rivetjs/runtime/server-derived");
const { importServer } = await import(repo + "libs/runtime/tests/resume/compile.ts");

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf("--" + name);
  return i >= 0 ? args[i + 1]! : fallback;
};
const PROFILES = {
  // Lighthouse mobile throttling (Slow 4G-class network, 4× CPU) / desktop.
  mobile: { kbps: 1638.4, rttMs: 150, cpu: 4 },
  desktop: { kbps: 10240, rttMs: 40, cpu: 1 },
} as const;
const profileName = flag("profile", "mobile") as keyof typeof PROFILES;
const profile = PROFILES[profileName];
if (!profile) throw new Error("unknown --profile " + profileName);
const out = flag("out", join(repo, "libs/compiler/place-table.json"));
const runs = Number(flag("runs", "5"));
const pInteract = Number(flag("p-interact", "0.5"));
const serverWeight = Number(flag("server-weight", "0.001"));
const browser = !args.includes("--no-browser");

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;
/** Least squares y = X·b (normal equations, Gauss–Jordan); returns b and R². */
function fit(rows: number[][], ys: number[]): { b: number[]; r2: number } {
  const k = rows[0]!.length;
  const a = Array.from({ length: k }, (_, i) => Array.from({ length: k + 1 }, (_, j) => rows.reduce((s, r, n) => s + r[i]! * (j < k ? r[j]! : ys[n]!), 0)));
  for (let c = 0; c < k; c++) {
    let p = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(a[r]![c]!) > Math.abs(a[p]![c]!)) p = r;
    [a[c], a[p]] = [a[p]!, a[c]!];
    const d = a[c]![c]! || 1e-12;
    for (let j = c; j <= k; j++) a[c]![j]! /= d;
    for (let r = 0; r < k; r++)
      if (r !== c) {
        const f = a[r]![c]!;
        for (let j = c; j <= k; j++) a[r]![j]! -= f * a[c]![j]!;
      }
  }
  const b = a.map((r) => r[k]!);
  const mean = ys.reduce((s, y) => s + y, 0) / ys.length;
  const ssTot = ys.reduce((s, y) => s + (y - mean) ** 2, 0);
  const ssRes = ys.reduce((s, y, n) => s + (y - rows[n]!.reduce((t, x, i) => t + x * b[i]!, 0)) ** 2, 0);
  return { b, r2: ssTot ? 1 - ssRes / ssTot : 1 };
}

// ---- 1. JS: compiled bytes per source byte, parse + compile per KB ----
const uiDir = join(repo, "libs/ui/src/components");
const files = readdirSync(uiDir, { recursive: true, encoding: "utf8" })
  .filter((f) => f.endsWith(".tsx") && !f.includes("test"))
  .sort()
  .map((f) => join(uiDir, f));
let src = 0,
  raw = 0,
  gz = 0;
const parse: { kb: number; ms: number }[] = [];
for (const file of files) {
  const source = readFileSync(file, "utf8");
  const r = compile(source, { target: "dom", filename: relative(repo, file) });
  if (r.diagnostics.length) continue;
  src += source.length;
  raw += Buffer.byteLength(r.code);
  gz += gzipSync(r.code, { level: 9 }).length;
  const times: number[] = [];
  for (let i = 0; i < runs + 2; i++) {
    const t0 = performance.now();
    new (vm as unknown as { SourceTextModule: new (code: string) => unknown }).SourceTextModule(r.code);
    times.push(performance.now() - t0);
  }
  parse.push({ kb: Buffer.byteLength(r.code) / 1024, ms: median(times.slice(2)) });
}
const parseFit = fit(
  parse.map((p) => [1, p.kb]),
  parse.map((p) => p.ms),
);
const parseMsPerKB = Math.max(0, parseFit.b[1]!) * profile.cpu;
const jsRawPerSource = raw / src,
  jsGzPerSource = gz / src;

// ---- 2. Server renders: tail bytes per record / props byte, µs per record / state byte ----
// Props text like real call sites (Tailwind class lists: tokens repeat across a page and appear in the markup too).
const TOKENS =
  "flex items-center justify-between gap-2 gap-4 px-3 px-4 py-2 rounded-md rounded-full text-sm text-neutral-800 font-medium bg-white shadow-sm border hover:bg-neutral-50 dark:bg-neutral-900 transition-all duration-300 w-full sm:w-auto".split(
    " ",
  );
let seed = 7;
const label = (bytes: number) => {
  let out = "";
  while (out.length < bytes) out += (out ? " " : "") + TOKENS[(seed = (seed * 1103515245 + 12345) % 2147483648) % TOKENS.length];
  return out.slice(0, bytes);
};
const partSource = (parts: number, size: number, elements: number) => `import { createContext, signal, useContext } from "@rivetjs/reactivity";
export const Theme = createContext("light");
export function Part(props: { label: string }) {
  const theme = useContext(Theme);
  const n = signal(0);
  return <button class={"part " + theme} onClick={() => n.set(n() + 1)}>{props.label + n()}</button>;
}
export default function Home() {
  return (
    <main>
      ${"<p>static text</p>".repeat(elements)}
      ${Array.from({ length: parts }, () => `<Part label="${label(size)}" />`).join("\n      ")}
    </main>
  );
}`;
const resumeOf = (parts: number, site: boolean) => ({
  module: "src/c.tsx",
  boundaries: ["Part", "Home"],
  independent: ["Home"],
  conditional: ["Home"],
  ...(site ? { site: ["Part"], sites: Array.from({ length: parts }, (_, i) => "Home:" + i) } : {}),
});
const manifest = { runtime: "/rt.js", symbols: { "src/c.tsx#Part": "/c.js", "src/c.tsx#default": "/c.js" } };
const tailOf = (html: string) => /<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)?.[1] ?? "";
const server: {
  parts: number;
  label: number;
  site: boolean;
  records: number;
  independent: number;
  dependent: number;
  state: number;
  props: number;
  html: number;
  htmlGz: number;
  us: number;
}[] = [];
for (const parts of [1, 20, 100, 400])
  for (const label of [4, 64, 256])
    for (const site of [false, true]) {
      seed = 7 + parts * 1000 + label;
      const code = compile(partSource(parts, label, 0), { target: "server", filename: "c.tsx", resume: resumeOf(parts, site) } as never).code;
      const { default: Home } = await importServer<{ default: () => unknown }>(code);
      const render = async () => (await derivedToString(() => Home() as never, { manifest } as never)) as string;
      const html = await render();
      const tail = tailOf(html);
      const samples: number[] = [];
      for (let r = 0; r < runs; r++) {
        const n = 200;
        const t0 = performance.now();
        for (let i = 0; i < n; i++) await render();
        samples.push(((performance.now() - t0) / n) * 1000);
      }
      server.push({
        parts,
        label,
        site,
        html: Buffer.byteLength(html),
        htmlGz: gzipSync(html, { level: 9 }).length,
        records: site ? parts : parts + 1,
        // `site`: the parts are independent records with props (Home unkept); `with-parent`: Home (independent root)
        // plus the parts as dependent records (one sibling run in tail v2).
        independent: site ? parts : 1,
        dependent: site ? 0 : parts,
        state: Buffer.byteLength(tail),
        // Props source bytes as the facts count them (`<Part label="…" />`: the opening tag less `<`, the tag, `/>`).
        props: site ? parts * (label + 11) : 0,
        us: median(samples),
      });
    }
// Tail bytes = a + recordBytes·independent + dependentRecordBytes·dependent + propsRatio·props source bytes.
const tailFit = fit(
  server.map((s) => [1, s.independent, s.dependent, s.props]),
  server.map((s) => s.state),
);
const usFit = fit(
  server.map((s) => [1, s.records, s.state]),
  server.map((s) => s.us),
);
// Compressed cost of a state byte in its page: Δ gzip(HTML) / Δ HTML between `site` and `with-parent` (same parts / props).
const ab = flag("ab", "");
const syntheticGz = median(
  server
    .filter((s) => s.site && s.parts >= 20)
    .map((s) => {
      const other = server.find((o) => !o.site && o.parts === s.parts && o.label === s.label)!;
      return (s.htmlGz - other.htmlGz) / Math.max(1, s.html - other.html);
    }),
);
let abGz: { frames: number; ratio: number } | null = null;
if (ab) {
  const [a, b] = ab.split(",").map((f) => JSON.parse(readFileSync(f, "utf8")).frames as Record<string, { html: number; htmlGz: number; files: number }>);
  let raw = 0,
    zipped = 0,
    frames = 0;
  for (const [id, x] of Object.entries(a!)) {
    const y = b![id];
    if (!y || y.files !== x.files || y.html === x.html) continue;
    raw += Math.abs(y.html - x.html);
    zipped += Math.abs(y.htmlGz - x.htmlGz);
    frames++;
  }
  if (frames) abGz = { frames, ratio: zipped / raw };
}
const stateGz = abGz?.ratio ?? syntheticGz;

// ---- 3. Browser: first-click adopt cost per element / per record ----
const adopt: { elements: number; records: number; ms: number }[] = [];
if (browser) {
  const { withPage, DERIVED_BUILD, rewrite } = await import(repo + "libs/runtime/tests/resume/harness.ts");
  for (const elements of [0, 200, 800])
    for (const parts of [1, 40])
      for (const site of [false, true]) {
        const source = partSource(parts, 4, elements);
        const resume = resumeOf(parts, site);
        const s = compile(source, { target: "server", filename: "c.tsx", resume } as never).code;
        const d = compile(source, { target: "dom", filename: "c.tsx", resume } as never).code;
        const { default: Home } = await importServer<{ default: () => unknown }>(s);
        const html = (await derivedToString(() => Home() as never, { manifest } as never)) as string;
        const page = {
          ...DERIVED_BUILD,
          "/": "<!doctype html><html><body>" + html + "</body></html>",
          "/rt.js": 'export { default } from "/dom-derived.ts";',
          "/c.js": rewrite(d),
        };
        const samples: number[] = [];
        for (let r = 0; r < runs; r++)
          samples.push(
            await withPage(page, async (p: any) => {
              const cdp = await p.context().newCDPSession(p);
              await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
              await p.goto("http://rivet.test/");
              await p.waitForLoadState("networkidle");
              await p.waitForTimeout(200);
              await cdp.send("Performance.enable");
              const metric = async () => (await cdp.send("Performance.getMetrics")).metrics.find((m: { name: string }) => m.name === "ScriptDuration").value;
              const m0 = await metric();
              await p.click(".part");
              await p.waitForFunction(() => document.querySelector(".part")!.textContent!.endsWith("1"), null, { polling: "raf" });
              await p.waitForTimeout(100);
              return ((await metric()) - m0) * 1000;
            }),
          );
        // Adopted: `site` → the part (1 element, 1 record); `with-parent` → the parent (elements + parts, parts + 1 records).
        adopt.push(site ? { elements: 1, records: 1, ms: median(samples) } : { elements: elements + parts + 1, records: parts + 1, ms: median(samples) });
      }
}
const adoptFit = adopt.length
  ? fit(
      adopt.map((a) => [1, a.elements, a.records]),
      adopt.map((a) => a.ms),
    )
  : { b: [0, 0, 0], r2: 0 };

// ---- Table ----
const msPerByte = 8 / profile.kbps; // ms to transfer one (compressed) byte
const table = {
  kind: "measured",
  siteBonus: 0,
  htmlMsPerByte: stateGz * msPerByte,
  jsMsPerByte: jsGzPerSource * msPerByte + (jsRawPerSource * parseMsPerKB) / 1024,
  runtimeLiteMs: 0,
  runtimeFullMs: 0,
  recordBytes: Math.max(0, tailFit.b[1]!),
  dependentRecordBytes: Math.max(0, tailFit.b[2]!),
  propsRatio: Math.max(0, tailFit.b[3]!),
  adoptMsPerElement: Math.max(0, adoptFit.b[1]!),
  adoptMsPerRecord: Math.max(0, adoptFit.b[2]!),
  pInteract,
  serverUsPerRecord: Math.max(0, usFit.b[1]!),
  serverUsPerStateByte: Math.max(0, usFit.b[2]!),
  serverMsPerUs: serverWeight,
  meta: {
    measured: new Date().toISOString(),
    machine: `${cpus()[0]?.model ?? "?"} × ${cpus().length}, ${platform()} ${release()}, node ${process.version}`,
    profile: { name: profileName, ...profile },
    policy: { pInteract, serverWeight },
    js: {
      modules: parse.length,
      sourceBytes: src,
      rawPerSource: jsRawPerSource,
      gzPerSource: jsGzPerSource,
      parseMsPerKB1x: parseFit.b[1],
      parseR2: parseFit.r2,
    },
    tail: { intercept: tailFit.b[0], r2: tailFit.r2, gzRatio: stateGz, syntheticGz, abGz },
    server: { intercept: usFit.b[0], r2: usFit.r2, samples: server },
    adopt: { intercept: adoptFit.b[0], r2: adoptFit.r2, samples: adopt },
    note: "runtimeLiteMs / runtimeFullMs are 0: no phase-1 decision changes whether a page has records or runs lite (spec §4.2).",
  },
};
writeFileSync(out, JSON.stringify(table, null, 2) + "\n");
console.log(JSON.stringify({ ...table, meta: { ...table.meta, server: undefined, adopt: undefined } }, null, 2));
console.log("wrote " + relative(process.cwd(), out));
