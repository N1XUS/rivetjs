// LAZY-COST harness: the ssr-bench `/resume` page (standalone, shape of router-app `resume/`: nested layout with a signal +
// handler, keyed <For> rows with a per-row handler + reactive attribute + link) rendered in-process by the resume server
// target, recorded rows (`resume`) vs lazy rows (`lazy`: manifest `lazyRows` + `RIVET_LAZY_ROWS=on`). Interleaved rounds;
// wall median + CPU (process.cpuUsage) per render. `--profile lazy|resume` renders one lane in a loop (run under
// `node --cpu-prof`).
//
//   node apps/ssr-bench/spikes/lazy-cost/bench.ts [--rows 100,1000,5000] [--rounds 7] [--samples 40] [--profile lazy --seconds 8]
import { performance } from "node:perf_hooks";
import { compileResume, importServer } from "../../../../libs/runtime/tests/resume/compile.ts";
import { makePage } from "../splice/splice.ts";

type Row = { id: number; values: (number | string)[] };
type Data = { title: string; token: string; rows: Row[] };

const fields = Array.from({ length: 10 }, (_, i) => `<div><dt>Field ${i}</dt><dd>{row().values[${i}]}</dd></div>`).join("");
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
      <h1>{data.title}</h1>
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
      </section>
    </main>
  );
}
export function App(props) {
  return <Layout><Page data={props.data} /></Layout>;
}
`;

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1]! : def;
}

const module = "src/routes/resume/index.tsx";
const server = compileResume(source, "server", module);
const dom = compileResume(source, "dom", module);
const manifest = { hash: "lc", runtime: "/rt.js", lazyRows: true, symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])) };
// `@rivetjs/router/link` (lowered `<Link>` hrefs) is a .tsx module Node cannot load: a stub with the same output (no base path).
const linkStub = "data:text/javascript," + encodeURIComponent("export const _linkHref = (to) => String(to);"); // no base path, trailing slash ignored
const code = server.code.replaceAll('"@rivetjs/router/link"', JSON.stringify(linkStub));
const mod = await importServer<{ App: (p: { data: Data }) => unknown }>(code);
const { resumableToString } = await import("@rivetjs/runtime/server-resume");
const { withIdScope } = await import("@rivetjs/runtime/id");

const { renderResumable } = await import("@rivetjs/runtime/server-resume");
const { NodeStreamWriter } = await import("@rivetjs/runtime/node");
// `--writer bytes` (default): the router's path — `renderResumable` into a byte writer (`NodeStreamWriter`, wasm row
// emitter) over a counting sink, chunks decoded only for `--dump`; `--writer string`: `resumableToString`.
const writerMode = arg("writer", "bytes");
let collect: Buffer[] | null = null;
const sink = {
  destroyed: false,
  writableEnded: false,
  writableLength: 0,
  write(chunk: string | Uint8Array, cb?: () => void) {
    if (collect) collect.push(Buffer.from(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk)));
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
const run = async (data: Data, lazy: boolean): Promise<string> => {
  if (lazy) process.env.RIVET_LAZY_ROWS = "on";
  else delete process.env.RIVET_LAZY_ROWS;
  if (writerMode === "string") return resumableToString(() => withIdScope("rv", () => mod.App({ data }) as never), { manifest }) as Promise<string>;
  const writer = new NodeStreamWriter(sink as never);
  await withIdScope("rv", () => renderResumable(() => mod.App({ data }) as never, writer, { manifest }));
  await writer.finish();
  await Promise.resolve();
  return "";
};
const lanes: Record<string, (data: Data) => Promise<string>> = { resume: (data) => run(data, false), lazy: (data) => run(data, true) };
const text = async (name: string, data: Data): Promise<string> => {
  collect = [];
  const s = await lanes[name]!(data);
  const out = s || Buffer.concat(collect).toString();
  collect = null;
  return out;
};
const pageOf = (rows: number): Data => {
  const page = makePage(rows);
  return { title: page.title as string, token: page.token as string, rows: page.rows as Row[] };
};

const dump = arg("dump", "");
if (dump) {
  const data = pageOf(Number(arg("rows", "3")));
  console.log(await text(dump, data));
  process.exit(0);
}
const profile = arg("profile", "");
if (profile) {
  const data = pageOf(Number(arg("rows", "1000")));
  const until = performance.now() + Number(arg("seconds", "8")) * 1000;
  let n = 0;
  while (performance.now() < until) {
    await lanes[profile]!(data);
    n++;
  }
  console.log(`${profile}: ${n} renders`);
} else {
  const rowsList = arg("rows", "100,1000,5000").split(",").map(Number);
  const rounds = Number(arg("rounds", "7"));
  const samples = Number(arg("samples", "40"));
  console.log(`| rows | lane | wall ms (median) | CPU ms (median) | vs resume (CPU) | HTML bytes | state bytes |`);
  console.log(`| --- | --- | ---: | ---: | ---: | ---: | ---: |`);
  for (const rows of rowsList) {
    const data = pageOf(rows);
    const wall: Record<string, number[]> = { resume: [], lazy: [] },
      cpu: Record<string, number[]> = { resume: [], lazy: [] };
    const html: Record<string, string> = {};
    for (const name of Object.keys(lanes)) html[name] = await text(name, data);
    const n = Math.max(3, Math.round(samples / Math.max(1, rows / 250)));
    for (let r = 0; r < rounds; r++) {
      for (const name of r % 2 ? ["lazy", "resume"] : ["resume", "lazy"]) {
        for (let i = 0; i < 3; i++) await lanes[name]!(data);
        const c0 = process.cpuUsage(),
          t0 = performance.now();
        for (let i = 0; i < n; i++) await lanes[name]!(data);
        const t = performance.now() - t0,
          c = process.cpuUsage(c0);
        wall[name]!.push(t / n);
        cpu[name]!.push((c.user + c.system) / 1000 / n);
      }
    }
    const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
    const state = (s: string) => /<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(s)?.[1]?.length ?? 0;
    for (const name of Object.keys(lanes))
      console.log(
        `| ${rows} | ${name} | ${med(wall[name]!).toFixed(3)} | ${med(cpu[name]!).toFixed(3)} | ${(med(cpu[name]!) / med(cpu.resume!)).toFixed(2)}× | ${html[name]!.length} | ${state(html[name]!)} |`,
      );
  }
}
