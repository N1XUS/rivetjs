// Lane X7 ceiling: a static-heavy page (100 cards from a module-constant array, each a static icon + header component
// + prose + link, one counter boundary) rendered plain / derived vs the same HTML as one precomputed constant, and a
// variant with the static child components inlined by hand (what cross-component inlining alone would give).
// usage: node ceiling.mjs <repo> [iters=500]   (compiles in-process with the real server compiler; run inside <repo>)
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import v8 from "node:v8";

const repo = resolve(process.argv[2]),
  iters = +(process.argv[3] ?? 500);
const { compile } = await import(pathToFileURL(resolve(repo, "libs/compiler/index.ts")).href);
const ICON = `<svg class="icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 2l3 7h7l-5.5 4 2 7-6.5-4.5L5.5 20l2-7L2 9h7z" /><circle cx="12" cy="12" r="3" /></svg>`;
const page = (inline) => `import { signal } from "@rivetjs/reactivity";
const CARDS = Array.from({ length: 100 }, (_, i) => ({ id: i, title: "Card " + i, body: "Some static prose for card number " + i + " & more <text>." }));
function Icon() { return ${ICON}; }
function CardHeader(props: { title: string }) { return <div class="card-header flex items-center gap-2"><Icon /><h3 class="text-lg font-semibold">{props.title}</h3></div>; }
function Card(props: { title: string; body: string }) {
  return <section class="card rounded border p-4">${inline ? `<div class="card-header flex items-center gap-2">${ICON}<h3 class="text-lg font-semibold">{props.title}</h3></div>` : `<CardHeader title={props.title} />`}<p class="text-sm text-slate-600">{props.body}</p><footer class="mt-2"><a href="/docs">Read more</a></footer></section>;
}
function Counter() { const n = signal(0); return <button type="button" onClick={() => n.set(n() + 1)}>{n()}</button>; }
export default function Page() {
  return <main class="page"><header class="top"><h1>Static page</h1>${inline ? ICON : "<Icon />"}</header><Counter />{CARDS.map((c) => <Card title={c.title} body={c.body} />)}<footer class="bottom">footer</footer></main>;
}
`;
const specs = ["@rivetjs/runtime/server-derived", "@rivetjs/runtime/server", "@rivetjs/reactivity"];
const load = (code) => {
  for (const s of specs) code = code.replaceAll(`"${s}"`, JSON.stringify(import.meta.resolve(s)));
  return import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
};
const sd = await import("@rivetjs/runtime/server-derived"),
  sv = await import("@rivetjs/runtime/server");
const manifest = { hash: "t", runtime: "/rt.js", symbols: { "m#Counter": "/m.js", "m#default": "/m.js" }, deps: {} };
for (const inline of [false, true]) {
  const src = page(inline),
    file = "ceiling.tsx";
  const D = await load(compile(src, { target: "server", filename: file, resume: { module: "m", boundaries: ["Counter"] } }).code);
  const P = await load(compile(src, { target: "server", filename: file }).code);
  const constant = Object.freeze([await sv.renderToString(P.default())]);
  const modes = {
    derived: () => sd.derivedToString(() => D.default(), { manifest }),
    plain: () => sv.renderToString(P.default()),
    constant: () => sv.renderToString(sv.compiledTemplate(constant, [])),
  };
  console.log(inline ? "static children inlined by hand" : "as written");
  for (const [name, render] of Object.entries(modes)) {
    for (let i = 0; i < 200; i++) await render();
    let cpu = Infinity,
      alloc = Infinity,
      bytes = 0;
    for (let r = 0; r < 7; r++) {
      const a0 = v8.getHeapStatistics().total_allocated_bytes,
        c0 = process.cpuUsage();
      for (let i = 0; i < iters; i++) bytes = (await render()).length;
      const c = process.cpuUsage(c0);
      cpu = Math.min(cpu, (c.user + c.system) / iters);
      alloc = Math.min(alloc, (v8.getHeapStatistics().total_allocated_bytes - a0) / iters / 1024);
    }
    console.log(" ", name.padEnd(9), cpu.toFixed(1).padStart(6), "µs/page", alloc.toFixed(0).padStart(5), "KB/page", bytes, "B");
  }
}
