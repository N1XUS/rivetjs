// Spike S1 (structural resume, docs/design/specs/2026-10-18-structural-resume-design.md §7; superseded gates in
// docs/design/research/2026-10-18-beyond-resume-hydration.md §8): the server bound of a values-only resume shape.
// Three lanes render the same page (the ssr-bench `/resume` page, standalone: nested layout with a signal + handler,
// keyed <For> rows with a per-row handler + reactive attribute + link) in-process:
//   resume      — today's serialized resume (`resumableToString`, server resume target)
//   static      — the plain server target (`renderToString`), no resume data at all (the floor)
//   structural  — the plain server target + what the structural / derived model records: a boundary record per
//                 interactive component, keyed signal values, wake sets on tracked reads, loader data as one JSON tree
// Hand-lowered: `_b` / `_sig` are written into the page source as a compiler would emit them. No framework change.
//
//   node apps/ssr-bench/spikes/structural/bench.ts [--rows 100,1000] [--rounds 7] [--samples 20]
import { performance } from "node:perf_hooks";
import zlib from "node:zlib";
import { compile } from "@rivetjs/compiler";
import { compileResume, importServer } from "../../../../libs/runtime/tests/resume/compile.ts";
import { makePage } from "../splice/splice.ts";

type Row = { id: number; values: (number | string)[] };
type Data = { title: string; token: string; rows: Row[] };

// ---------------------------------------------------------------------------------------------------------------------
// Page sources. `body` is shared verbatim; the structural variant adds boundary attributes + `_sig`.

const row = (values: string) => `
          <article data-row={row().id} data-state={selected() === row().id ? "selected" : "even"}>
            <header><h2><a href={"/resume?rows=" + row().id}>Record</a></h2><p>Static description and supporting HTML.</p></header>
            <section><dl>${values}</dl></section>
            <footer>
              <button type="button" onClick={() => selected.set(row().id)}>Increment</button>
              <label>Selected<input type="checkbox" readOnly /></label>
            </footer>
          </article>`;
const fields = Array.from({ length: 10 }, (_, i) => `<div><dt>Field ${i}</dt><dd>{row().values[${i}]}</dd></div>`).join("");

const pageSource = (structural: boolean) => `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
${
  structural
    ? `
// what the compiler would emit for the structural server target: per-render context, boundary records, keyed signals
// whose tracked reads record the reading boundary (wake sets)
export const ctx = { b: [], s: [], w: {}, cur: 0, next: 0 };
function _b(parent) { const id = ++ctx.next; ctx.b.push([id, parent]); ctx.cur = id; return id; }
function _sig(k, init) {
  const s = signal(init);
  ctx.s.push([k, init]);
  const read = () => { (ctx.w[k] ??= new Set()).add(ctx.cur); return s(); };
  read.set = s.set; read.update = s.update;
  return read;
}
`
    : ""
}
export function Layout(props) {
  ${structural ? "const b = _b(0);" : ""}
  const visits = ${structural ? '_sig("L0", 0)' : "signal(0)"};
  return (
    <div data-layout="resume"${structural ? " data-b={b}" : ""}>
      <nav>
        <a href="/resume?rows=10">Ten rows</a> <a href="/page">Static page</a>{" "}
        <button type="button" onClick={() => visits.update((n) => n + 1)}>Visits {visits()}</button>
      </nav>
      {props.children}
    </div>
  );
}
export function Page(props) {
  ${structural ? "const b = _b(1);" : ""}
  const data = props.data;
  const selected = ${structural ? '_sig("P0", -1)' : "signal(-1)"};
  return (
    <main data-token={data.token}${structural ? " data-b={b}" : ""}>
      <h1>{data.title}</h1>
      <section data-grid="">
        <For each={() => data.rows} by={(row) => row.id}>
          {(row) => (${row(fields)}
          )}
        </For>
      </section>
    </main>
  );
}
export function App(props) {
  return <Layout><Page data={props.data} /></Layout>;
}
`;

// ---------------------------------------------------------------------------------------------------------------------

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
}
const br = (s: string) => zlib.brotliCompressSync(Buffer.from(s), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }).length;

async function main() {
  const rowsList = arg("rows", "100,1000").split(",").map(Number);
  const rounds = Number(arg("rounds", "7"));
  const samples = Number(arg("samples", "20"));
  const module = "apps/ssr-bench/spikes/structural/page.tsx";

  // resume lane: server resume target + a manifest from the DOM symbols
  const resumeServer = compileResume(pageSource(false), "server", module);
  const resumeDom = compileResume(pageSource(false), "dom", module);
  const manifest = { hash: "s1", runtime: "/rt.js", symbols: Object.fromEntries(resumeDom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])) };
  const resumeMod = await importServer<{ App: (p: { data: Data }) => unknown }>(resumeServer.code);
  // static lane: plain server target
  const plain = compile(pageSource(false), { target: "server", filename: "page.tsx" } as never) as { code: string; diagnostics: { message: string }[] };
  if (plain.diagnostics.length) throw new Error(plain.diagnostics.map((d) => d.message).join("\n"));
  const plainMod = await importServer<{ App: (p: { data: Data }) => unknown }>(plain.code);
  // structural lane: plain server target of the hand-lowered source
  const structural = compile(pageSource(true), { target: "server", filename: "page.tsx" } as never) as { code: string; diagnostics: { message: string }[] };
  if (structural.diagnostics.length) throw new Error(structural.diagnostics.map((d) => d.message).join("\n"));
  const structMod = await importServer<{
    App: (p: { data: Data }) => unknown;
    ctx: { b: unknown[]; s: unknown[]; w: Record<string, Set<number>>; cur: number; next: number };
  }>(structural.code);

  const { renderToString } = await import("@rivetjs/runtime/server");
  const { resumableToString } = await import("@rivetjs/runtime/server-resume");

  const structuralRender = (data: Data, withRows: boolean) => {
    const c = structMod.ctx;
    c.b = [];
    c.s = [];
    c.w = {};
    c.cur = 0;
    c.next = 0;
    const html = renderToString(() => structMod.App({ data }));
    const wake: Record<string, number[]> = {};
    for (const k in c.w) wake[k] = [...c.w[k]];
    // `j`: the loader data, as every lane ships it today; `structural-dom` leaves it out — every row value is rendered
    // verbatim as a sole text child, so a compiler could read the rows back from the DOM on first use (bound only)
    const tail = JSON.stringify(withRows ? { b: c.b, s: c.s, w: wake, j: data.rows } : { b: c.b, s: c.s, w: wake });
    return (html as string) + '<script type="application/json" id="rv">' + tail + "</script>";
  };
  const lanes: Record<string, (data: Data) => string | Promise<string>> = {
    resume: (data) => resumableToString(() => resumeMod.App({ data }), { manifest }),
    static: (data) => renderToString(() => plainMod.App({ data })),
    structural: (data) => structuralRender(data, true),
    "structural-dom": (data) => structuralRender(data, false),
  };

  console.log(`| rows | lane | ms / render (min) | ms / render (median) | vs static (median) | HTML bytes | HTML br |`);
  console.log(`| --- | --- | ---: | ---: | ---: | ---: | ---: |`);
  for (const rows of rowsList) {
    const page = makePage(rows);
    const data: Data = { title: page.title as string, token: page.token as string, rows: page.rows as Row[] };
    const times: Record<string, number[]> = { resume: [], static: [], structural: [], "structural-dom": [] };
    const bytes: Record<string, string> = {};
    for (const name of Object.keys(lanes)) bytes[name] = await lanes[name](data);
    const n = Math.max(3, Math.round(samples / Math.max(1, rows / 200)));
    for (let r = 0; r < rounds; r++) {
      const order = Object.keys(lanes).sort(() => Math.random() - 0.5);
      for (const name of order) {
        await lanes[name](data); // warm
        for (let i = 0; i < n; i++) {
          const t0 = performance.now();
          await lanes[name](data);
          times[name].push(performance.now() - t0);
        }
      }
    }
    const stat = (xs: number[]) => {
      const s = [...xs].sort((a, b) => a - b);
      return { min: s[0], med: s[Math.floor(s.length / 2)] };
    };
    const base = stat(times.static).med;
    for (const name of Object.keys(lanes)) {
      const st = stat(times[name]);
      console.log(
        `| ${rows} | ${name} | ${st.min.toFixed(3)} | ${st.med.toFixed(3)} | ${(st.med / base).toFixed(2)}× | ${bytes[name].length} | ${br(bytes[name])} |`,
      );
    }
  }
}

await main();
