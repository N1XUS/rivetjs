// PPR-T01 T0 harness (spec docs/design/specs/2026-10-20-ppr-shell-design.md §4/§5): how much of a signed-in page is shell.
// Two pages, in-process, `process.cpuUsage` per request, interleaved rounds (default 5 × 1,500 requests per lane):
//
// 1. Editorial article (rivet-dynamic shape: lane `src/content.ts` + `Markdown`, N=1000 fixture), signed in (`sid` cookie →
//    session loader → user menu in the header), through the REAL router pipeline (`app/` built with Vite, `loadBuild`):
//      full  — today's signed-in request: cookie → route-cache bypass → loaders + full render
//      stub  — the same page with the hole (user menu) replaced by a constant placeholder of the same markup, no request read
//      hole  — the hole alone (pipeline + session loader + user menu in an empty document) = H-holes proxy
//      floor — pipeline floor (no loader, one element)
//    + the same page compiled in-process (`libs/runtime/tests/resume/compile.ts`) and rendered by `renderResumable`:
//      r-full / r-shell into the router's byte writer (`NodeStreamWriter` over a counting sink), r-shell-null into a no-op
//      string writer (H-replay proxy: the shell's JS runs, no bytes are written), r-hole.
// 2. ssr-bench `/resume` (lazy-cost source: nested layout with signal + handler, 1000 keyed rows), rendered in-process:
//      r-full, r-shell (rows → constant placeholder section), r-shell-null, r-hole (the rows alone).
//
// TTFB = time from the request (render call) to the first body byte handed out (handler: first `body` read; render: first
// sink write). Estimates: H-replay ≈ hole + shell-null (+ prefix copy); H-holes ≈ hole (+ prefix copy).
//
//   node apps/editorial-bench/spikes/ppr-shell/bench.ts [--build] [--rounds 5] [--requests 1500] [--rows 1000]
//        [--pages editorial,resume] [--json out.json] [--dump <lane>]
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { compileResume, importServer } from "../../../../libs/runtime/tests/resume/compile.ts";
import { makePage } from "../../../ssr-bench/spikes/splice/splice.ts";

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1]! : def;
}
const here = import.meta.dirname;
const root = resolve(here, "app");
const dist = resolve(root, ".artifacts", "dist");
const content = resolve(here, "../../fixture/content/n1000");
process.env.EDITORIAL_CONTENT ??= content;
if (process.argv.includes("--build")) {
  const script = `
    import { build } from "vite";
    const root = ${JSON.stringify(root)}, dist = ${JSON.stringify(dist)};
    await build({ root, configFile: root + "/vite.config.ts", logLevel: "warn", build: { outDir: dist + "/client", emptyOutDir: true } });
    await build({ root, configFile: root + "/vite.config.ts", logLevel: "warn", build: { ssr: true, outDir: dist + "/server", emptyOutDir: true } });`;
  execFileSync(process.execPath, ["--input-type=module", "-e", script], { stdio: "inherit", env: process.env, cwd: root });
}
const rounds = Number(arg("rounds", "5"));
const requests = Number(arg("requests", "1500"));
const pages = arg("pages", "editorial,resume").split(",");
const load = () =>
  loadavg()
    .map((n) => n.toFixed(2))
    .join(" ");

/** One lane: run once → { bytes, ttfb ms } (body consumed). */
type Lane = () => Promise<{ bytes: number; ttfb: number }>;

// ---- byte sink + writers (render lanes) ----
let first = 0,
  count = 0;
const sink = {
  destroyed: false,
  writableEnded: false,
  writableLength: 0,
  write(chunk: string | Uint8Array, cb?: () => void) {
    if (!first) first = performance.now();
    count += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.byteLength;
    cb?.();
    return true;
  },
  once() {
    return sink;
  },
  off() {
    return sink;
  },
};
const { renderResumable } = await import("@rivetjs/runtime/server-resume");
const { NodeStreamWriter } = await import("@rivetjs/runtime/node");
const { withIdScope } = await import("@rivetjs/runtime/id");
const manifest = { hash: "t0", runtime: "/rt.js", symbols: {} as Record<string, string> };
const nullWriter = { write(_chunk: string) {} };
const renderLane =
  (view: () => unknown, mode: "bytes" | "null"): Lane =>
  async () => {
    first = 0;
    count = 0;
    const t0 = performance.now();
    if (mode === "null") {
      await withIdScope("rv", () => renderResumable(view as never, nullWriter as never, { manifest }));
      return { bytes: 0, ttfb: 0 };
    }
    const writer = new NodeStreamWriter(sink as never);
    await withIdScope("rv", () => renderResumable(view as never, writer, { manifest }));
    await writer.finish();
    return { bytes: count, ttfb: first - t0 };
  };
const dumpLane = async (view: () => unknown): Promise<string> => {
  const chunks: Buffer[] = [];
  const s = { ...sink, write: (c: string | Uint8Array, cb?: () => void) => (chunks.push(Buffer.from(c as Uint8Array)), cb?.(), true) };
  const writer = new NodeStreamWriter(s as never);
  await withIdScope("rv", () => renderResumable(view as never, writer, { manifest }));
  await writer.finish();
  return Buffer.concat(chunks).toString();
};

// ---- the measurement loop ----
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
type Result = { lane: string; cpu: number; wall: number; ttfb: number; bytes: number; cpuRounds: number[] };
async function measure(title: string, lanes: Record<string, Lane>): Promise<Result[]> {
  const names = Object.keys(lanes);
  const cpu: Record<string, number[]> = {},
    wall: Record<string, number[]> = {},
    ttfb: Record<string, number[]> = {},
    bytes: Record<string, number> = {};
  for (const n of names) {
    cpu[n] = [];
    wall[n] = [];
    ttfb[n] = [];
    for (let i = 0; i < 200; i++) bytes[n] = (await lanes[n]!()).bytes; // warm-up
  }
  console.log(`\n## ${title} — load before ${load()}`);
  for (let r = 0; r < rounds; r++) {
    for (const n of r % 2 ? [...names].reverse() : names) {
      const lane = lanes[n]!;
      const t: number[] = [];
      const c0 = process.cpuUsage(),
        w0 = performance.now();
      for (let i = 0; i < requests; i++) t.push((await lane()).ttfb);
      const w = performance.now() - w0,
        c = process.cpuUsage(c0);
      cpu[n]!.push((c.user + c.system) / 1000 / requests);
      wall[n]!.push(w / requests);
      ttfb[n]!.push(med(t));
    }
    console.log(`round ${r + 1}/${rounds} load ${load()}`);
  }
  const out = names.map((n) => ({ lane: n, cpu: med(cpu[n]!), wall: med(wall[n]!), ttfb: med(ttfb[n]!), bytes: bytes[n]!, cpuRounds: cpu[n]! }));
  console.log(`| lane | CPU ms/req (median of ${rounds}) | wall ms/req | TTFB ms (median) | bytes | CPU per round |`);
  console.log(`| --- | ---: | ---: | ---: | ---: | --- |`);
  for (const o of out)
    console.log(
      `| ${o.lane} | ${o.cpu.toFixed(4)} | ${o.wall.toFixed(4)} | ${o.ttfb.toFixed(4)} | ${o.bytes} | ${o.cpuRounds.map((x) => x.toFixed(3)).join(" ")} |`,
    );
  console.log(`load after ${load()}`);
  return out;
}

// ---- 1. editorial ----
const results: Record<string, unknown> = { load: { before: load() } };
const dump = arg("dump", "");
const SLUG = "/articles/";
if (pages.includes("editorial")) {
  const { loadBuild } = await import("../../../../libs/router/adapters/build.ts");
  const { handler } = await loadBuild(dist);
  const { article, slugs } = await import("../../lanes/rivet/src/content.ts");
  const slug = slugs()[17]!;
  const headers = { cookie: "sid=s7; theme=dark; _ga=GA1.2.123456789.1700000000", accept: "text/html" };
  const handlerLane =
    (path: string): Lane =>
    async () => {
      const t0 = performance.now();
      const response = await handler(new Request("http://localhost" + path, { headers }));
      if (response.status !== 200) throw new Error(`${path}: ${response.status}`);
      const reader = response.body!.getReader();
      let bytes = 0,
        ttfb = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!ttfb) ttfb = performance.now() - t0;
        bytes += value.byteLength;
      }
      return { bytes, ttfb };
    };
  const paths = { full: `/full${SLUG}${slug}/`, stub: `/stub${SLUG}${slug}/`, hole: `/hole/${slug}/`, floor: "/floor/" };
  if (dump in paths) {
    const r = await handler(new Request("http://localhost" + paths[dump as keyof typeof paths], { headers }));
    console.log(await r.text());
    process.exit(0);
  }
  // In-process compiled copy of the same components (one module: Markdown + UserMenu + Chrome + Article).
  const strip = (file: string) =>
    readFileSync(resolve(here, file), "utf8")
      .replace(/^import[^;]*;\n/gm, "")
      .replace(/^export (function|const|type)/gm, "$1");
  const source =
    strip("../../lanes/rivet/src/components/Markdown.tsx") +
    strip("app/src/components/UserMenu.tsx") +
    strip("app/src/components/Chrome.tsx") +
    strip("app/src/components/Article.tsx") +
    `export function Full(props) { return <Chrome user={props.user}><Article data={props.article} /></Chrome>; }\n` +
    `export function Hole(props) { return <UserMenu user={props.user} />; }\n`;
  const compiled = compileResume(source, "server", "src/routes/articles/[slug].tsx");
  const mod = await importServer<Record<string, (p: unknown) => unknown>>(compiled.code);
  const { session, PLACEHOLDER } = await import("./app/src/session.ts");
  const user = session({ cookies: { get: () => "s7" } } as never);
  const data = article(slug)!;
  const lanes: Record<string, Lane> = {
    full: handlerLane(paths.full),
    stub: handlerLane(paths.stub),
    hole: handlerLane(paths.hole),
    floor: handlerLane(paths.floor),
    "r-full": renderLane(() => mod.Full!({ article: data, user }), "bytes"),
    "r-shell": renderLane(() => mod.Full!({ article: data, user: PLACEHOLDER }), "bytes"),
    "r-shell-null": renderLane(() => mod.Full!({ article: data, user: PLACEHOLDER }), "null"),
    "r-hole": renderLane(() => mod.Hole!({ user }), "bytes"),
  };
  if (dump) {
    console.log(
      await dumpLane(dump === "r-hole" ? () => mod.Hole!({ user }) : () => mod.Full!({ article: data, user: dump === "r-shell" ? PLACEHOLDER : user })),
    );
    process.exit(0);
  }
  // Prefix copy (a hit writes the stored shell bytes): one copy of the stub body per request.
  const prefix = Buffer.from(await (await handler(new Request("http://localhost" + paths.stub, { headers }))).arrayBuffer());
  let sinkhole = 0;
  lanes["prefix-copy"] = async () => {
    const copy = new Uint8Array(prefix.byteLength);
    copy.set(prefix);
    sinkhole += copy[7]!;
    return { bytes: copy.byteLength, ttfb: 0 };
  };
  // The page loader alone (lane content.ts: marked lexer + tree per call): what a shell hit skips (stored shell data).
  lanes.loader = async () => {
    sinkhole += article(slug)!.body.length;
    return { bytes: 0, ttfb: 0 };
  };
  const out = await measure(`editorial article ${slug} (signed in, sid cookie)`, lanes);
  const at = (lane: string) => out.find((o) => o.lane === lane)!.cpu;
  // H-holes: pipeline + session loader + hole render (lane `hole`) + one copy of the stored prefix.
  // H-replay: that + the shell's JS without bytes (in-process `r-shell-null`; no loaders, no state encode).
  const holes = at("hole") + at("prefix-copy"),
    replay = holes + at("r-shell-null");
  const estimates = {
    today: at("full"),
    replay,
    holes,
    replayGain: at("full") / replay,
    holesGain: at("full") / holes,
    shellShare: (at("stub") - at("floor")) / (at("full") - at("floor")),
  };
  console.log(
    `estimates (CPU ms/req): today ${estimates.today.toFixed(4)} · H-replay ≈ ${replay.toFixed(4)} (${estimates.replayGain.toFixed(2)}×) · H-holes ≈ ${holes.toFixed(4)} (${estimates.holesGain.toFixed(2)}×) · shell share of the page render ${(estimates.shellShare * 100).toFixed(1)} %`,
  );
  results.editorial = { lanes: out, estimates };
  if (sinkhole < 0) console.log(sinkhole);
}

// ---- 2. ssr-bench /resume ----
if (pages.includes("resume")) {
  const rows = Number(arg("rows", "1000"));
  const fields = Array.from({ length: 10 }, (_, i) => `<div><dt>Field ${i}</dt><dd>{row().values[${i}]}</dd></div>`).join("");
  const grid = `
        <section data-grid="">
          <For each={() => data.rows} by={(row) => row.id}>
            {(row) => (
            <article data-row={row().id} data-state={selected() === row().id ? "selected" : "even"}>
              <header><h2><Link to={"/resume?rows=" + row().id}>Record</Link></h2><p>Static description and supporting HTML.</p></header>
              <section><dl>${fields}</dl></section>
              <footer>
                <button type="button" onClick={() => selected.set(row().id)}>Increment</button>
                <label>Selected<input type="checkbox" readOnly /></label>
              </footer>
            </article>)}
          </For>
        </section>`;
  const source = `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Link } from "@rivetjs/router/client";
export function Layout(props) {
  const visits = signal(0);
  return (
    <div data-layout="resume">
      <nav>
        <Link to="/resume?rows=10">Ten rows</Link> <Link to="/page">Static page</Link>{" "}
        <button type="button" onClick={() => visits.update((n) => n + 1)}>Visits {visits()}</button>
      </nav>
      {props.children}
    </div>
  );
}
export function Page(props) {
  const data = props.data;
  const selected = signal(-1);
  return (
    <main data-token={data.token}>
      <h1>{data.title}</h1>${grid}
    </main>
  );
}
export function ShellPage(props) {
  const data = props.data;
  return (
    <main data-token={data.token}>
      <h1>{data.title}</h1>
      <section data-grid=""><p data-hole="rows">Loading rows…</p></section>
    </main>
  );
}
export function Rows(props) {
  const data = props.data;
  const selected = signal(-1);
  return (${grid}
  );
}
export function App(props) {
  return <Layout><Page data={props.data} /></Layout>;
}
export function Shell(props) {
  return <Layout><ShellPage data={props.data} /></Layout>;
}
`;
  const module = "src/routes/resume/index.tsx";
  const server = compileResume(source, "server", module);
  const dom = compileResume(source, "dom", module);
  for (const s of dom.symbols) manifest.symbols[s.id] = "/c/" + s.component + ".js";
  const linkStub = "data:text/javascript," + encodeURIComponent("export const _linkHref = (to) => String(to);");
  const mod = await importServer<Record<string, (p: unknown) => unknown>>(server.code.replaceAll('"@rivetjs/router/link"', JSON.stringify(linkStub)));
  const page = makePage(rows);
  const data = { title: page.title as string, token: page.token as string, rows: page.rows };
  const views: Record<string, () => unknown> = {
    "r-full": () => mod.App!({ data }),
    "r-shell": () => mod.Shell!({ data }),
    "r-hole": () => mod.Rows!({ data }),
  };
  if (dump && dump.startsWith("resume:")) {
    console.log(await dumpLane(views[dump.slice(7)]!));
    process.exit(0);
  }
  const out = await measure(`ssr-bench /resume ${rows} rows`, {
    "r-full": renderLane(views["r-full"]!, "bytes"),
    "r-shell": renderLane(views["r-shell"]!, "bytes"),
    "r-shell-null": renderLane(views["r-shell"]!, "null"),
    "r-hole": renderLane(views["r-hole"]!, "bytes"),
  });
  const at = (lane: string) => out.find((o) => o.lane === lane)!;
  const replay = at("r-hole").cpu + at("r-shell-null").cpu;
  console.log(
    `estimates (render CPU ms, no pipeline): full ${at("r-full").cpu.toFixed(4)} · H-replay ≈ ${replay.toFixed(4)} (${(at("r-full").cpu / replay).toFixed(2)}×) · H-holes ≈ ${at("r-hole").cpu.toFixed(4)} (${(at("r-full").cpu / at("r-hole").cpu).toFixed(2)}×) · shell share ${((at("r-shell").cpu / at("r-full").cpu) * 100).toFixed(1)} % · TTFB full ${at("r-full").ttfb.toFixed(4)} vs shell ${at("r-shell").ttfb.toFixed(4)} ms`,
  );
  results.resume = { lanes: out };
}
(results.load as Record<string, string>).after = load();
const json = arg("json", "");
if (json) writeFileSync(json, JSON.stringify(results, null, 2));
