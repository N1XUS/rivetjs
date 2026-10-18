// Spike X1 (floor-first, docs/design/research/2026-10-18-floor-first.md §2 F2 / §5): can a response be assembled from
// static template segments compressed ONCE at build time plus small per-request blocks for the dynamic data, and do
// browsers decode it? Throwaway harness (like apps/ssr-bench/spikes/rust-ceiling): no framework code, no deps beyond
// node:zlib and (for browser.ts) playwright.
//
//   node apps/ssr-bench/spikes/splice/splice.ts bench [--iterations 200]
//   node apps/ssr-bench/spikes/splice/splice.ts serve [--port 8787]        # then: node …/browser.ts
//
// Shapes: `table` = the ssr-bench fixture page (apps/ssr-bench/fixture/emitter.ts) at 100 / 1000 rows — hole-dense
// (11 holes per ~300 bytes of markup); `article` = a content page (static head + nav + footer ≈ 20 KB, one dynamic
// body ≈ 8 KB, a few small holes) — hole-sparse. Data is seeded pseudo-random (the fixture service's data is not
// repetitive; synthetic repeated strings made every compressor look 10× better than reality in a first run).
//
// Costs are split: `assemble` = producing the identity bytes (what the server does today), `encode` = what each
// scheme adds on top per request; whole-page schemes encode the assembled buffer, splice schemes assemble their
// own output from precompressed frames + per-request parts.
import { createServer } from "node:http";
import { performance } from "node:perf_hooks";
import zlib from "node:zlib";
import { emitPage, escapeAttribute, escapeText, PAGE_STYLE, type Page } from "../../fixture/emitter.ts";

// ---------------------------------------------------------------------------------------------------------------------
// Data

function prng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}
const WORDS =
  "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey xray yankee zulu".split(
    " ",
  );

export function makePage(rows: number): Page {
  const r = prng(rows * 7919 + 17);
  const out: Page["rows"] = [];
  for (let i = 0; i < rows; i++) {
    const values: (number | string)[] = [];
    for (let f = 0; f < 10; f++) {
      if (f % 3 === 0) values.push(Math.floor(r() * 1e6));
      else values.push(`${WORDS[Math.floor(r() * WORDS.length)]} ${WORDS[Math.floor(r() * WORDS.length)]} ${Math.floor(r() * 1000)}`);
    }
    out.push({ id: 1000 + i, values });
  }
  return { title: "Rivet bench & <page>", token: "tok-" + Math.floor(r() * 1e9).toString(36), rows: out };
}

export function identityHtml(page: Page): string {
  const chunks: string[] = [];
  const res = emitPage(page, { write: (c: string) => void chunks.push(c) });
  if (res) throw new Error("emitter suspended");
  return chunks.join("");
}

// ---------------------------------------------------------------------------------------------------------------------
// Segment model (what a compiler's segment table + op stream would carry): static runs and per-request holes.

type Op = { s: number } | { h: string };
interface Model {
  name: string;
  segments: Buffer[];
  ops(page: Page): Op[];
  identity(page: Page): string; // the reference producer (emitter-style string concat)
  /** indexes into ops(): [start, end) of the hole-dense region a compiler would compress per request */
  dense(ops: Op[]): [number, number];
}

const HEAD_A = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>`;
const HEAD_B = `</title><style>${PAGE_STYLE}</style></head><body><main data-token="`;
const HEAD_C = `"><h1>`;
const HEAD_D = `</h1><section data-grid="">`;
const ROW_A = `<article data-row="`;
const ROW_B = `" data-state="even"><header><h2>Record</h2><p>Static description and supporting HTML.</p></header><section><dl>`;
const FIELD = Array.from({ length: 10 }, (_, i) => `<div><dt>Field ${i}</dt><dd>`);
const FIELD_END = `</dd></div>`;
const ROW_END = `</dl></section><footer><button type="button" disabled>Increment</button><label>Selected<input type="checkbox" readonly></label></footer></article>`;
const TAIL = `</section></main><!--complete--></body></html>`;

function tableModel(rows: number): Model {
  const table = [HEAD_A, HEAD_B, HEAD_C, HEAD_D, ROW_A, ROW_B, ROW_END, TAIL, ...FIELD, FIELD_END];
  const S = Object.fromEntries(table.map((t, i) => [t, i])) as Record<string, number>;
  return {
    name: `table ${rows}`,
    segments: table.map((t) => Buffer.from(t, "utf8")),
    ops(page) {
      const ops: Op[] = [
        { s: S[HEAD_A] },
        { h: escapeText(page.title) },
        { s: S[HEAD_B] },
        { h: escapeAttribute(page.token) },
        { s: S[HEAD_C] },
        { h: escapeText(page.title) },
        { s: S[HEAD_D] },
      ];
      for (const row of page.rows) {
        ops.push({ s: S[ROW_A] }, { h: escapeAttribute(row.id) }, { s: S[ROW_B] });
        for (let f = 0; f < 10; f++) ops.push({ s: S[FIELD[f]] }, { h: escapeText(row.values[f]) }, { s: S[FIELD_END] });
        ops.push({ s: S[ROW_END] });
      }
      ops.push({ s: S[TAIL] });
      return ops;
    },
    identity: identityHtml,
    dense: (ops) => [7, ops.length - 1],
  };
}

// Article shape: a realistic content page. Static chrome (nav of 60 links, footer, a 6 KB stylesheet, a 4 KB inline
// script) + dynamic title / byline / body / 12 related links.
function articleModel(): Model {
  const nav = `<header class="site"><nav><ul>${Array.from({ length: 60 }, (_, i) => `<li><a href="/section-${i % 12}/page-${i}" class="nav-link nav-link--${i % 5}">Section ${WORDS[i % 26]} ${i}</a></li>`).join("")}</ul></nav></header>`;
  const css = Array.from(
    { length: 120 },
    (_, i) => `.c${i}{display:flex;gap:${i % 9}px;padding:${i % 7}px ${i % 11}px;color:#${(i * 2654435).toString(16).slice(0, 6)};border-radius:${i % 4}px}`,
  ).join("");
  const script = `<script>${Array.from({ length: 40 }, (_, i) => `function f${i}(a,b){return a+b*${i}+Math.max(a,b)}`).join("")}</script>`;
  const footer = `<footer class="site"><p>© 2026 Example &amp; Co.</p><ul>${Array.from({ length: 24 }, (_, i) => `<li><a href="/legal/${i}">Legal ${i}</a></li>`).join("")}</ul></footer>`;
  const A = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>`;
  const B = `</title><style>${css}</style></head><body>${nav}<main><article><h1>`;
  const C = `</h1><p class="byline">By `;
  const D = `</p><div class="body">`;
  const E = `</div><aside><h2>Related</h2><ul>`;
  const REL_A = `<li><a href="/a/`;
  const REL_B = `">`;
  const REL_C = `</a></li>`;
  const F = `</ul></aside></article></main>${footer}${script}</body></html>`;
  const table = [A, B, C, D, E, REL_A, REL_B, REL_C, F];
  const S = Object.fromEntries(table.map((t, i) => [t, i])) as Record<string, number>;
  const paras = (seed: number) => {
    const g = prng(seed);
    return Array.from({ length: 40 }, () => `<p>${Array.from({ length: 60 }, () => WORDS[Math.floor(g() * 26)]).join(" ")}.</p>`).join("");
  };
  const ops = (page: Page): Op[] => {
    const ops: Op[] = [
      { s: S[A] },
      { h: escapeText(page.title) },
      { s: S[B] },
      { h: escapeText(page.title) },
      { s: S[C] },
      { h: escapeText(page.token) },
      { s: S[D] },
      { h: paras(page.rows.length) },
      { s: S[E] },
    ];
    for (let i = 0; i < 12; i++)
      ops.push(
        { s: S[REL_A] },
        { h: String(page.rows.length * 100 + i) },
        { s: S[REL_B] },
        { h: escapeText(WORDS[(i * 7) % 26] + " " + WORDS[(i * 3) % 26]) },
        { s: S[REL_C] },
      );
    ops.push({ s: S[F] });
    return ops;
  };
  return {
    name: "article",
    segments: table.map((t) => Buffer.from(t, "utf8")),
    ops,
    identity(page) {
      let s = "";
      for (const op of ops(page)) s += "s" in op ? table[op.s] : op.h;
      return s;
    },
    dense: () => [7, 8], // only the body is per request; the related list's holes are tiny → raw frames
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// zstd frames by hand: one RAW block (no compression) for per-request dynamic bytes. Magic 28 B5 2F FD · descriptor
// (Single_Segment=1; FCS 1 byte when ≤ 255 else 8 bytes) · block header 3 bytes LE (last=1 | RAW | size<<3) · bytes.

function rawFrameInto(out: Buffer, at: number, bytes: Buffer): number {
  const n = bytes.length;
  if (n > 128 * 1024) throw new Error("raw frame > 128 KiB");
  const small = n <= 255;
  out.writeUInt32LE(0xfd2fb528, at);
  out[at + 4] = small ? 0x20 : 0xe0;
  let p = at + 5;
  if (small) out[p++] = n;
  else {
    out.writeUInt32LE(n >>> 0, p);
    out.writeUInt32LE(0, p + 4);
    p += 8;
  }
  const bh = 1 | (n << 3);
  out[p] = bh & 0xff;
  out[p + 1] = (bh >>> 8) & 0xff;
  out[p + 2] = (bh >>> 16) & 0xff;
  bytes.copy(out, p + 3);
  return p + 3 + n;
}
const rawFrameSize = (n: number) => 4 + 1 + (n <= 255 ? 1 : 8) + 3 + n;

const zstd = (b: Buffer, level: number) => zlib.zstdCompressSync(b, { params: { [zlib.constants.ZSTD_c_compressionLevel]: level } });
const brotli = (b: Buffer, q: number) =>
  zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: q, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: b.length } });

/** Node's zstd decoders stop after the first frame; walk the frames (header + block headers) and decode each. */
function decodeZstdFrames(body: Buffer): Buffer {
  const out: Buffer[] = [];
  let at = 0;
  while (at < body.length) {
    const len = frameLength(body.subarray(at));
    out.push(zlib.zstdDecompressSync(body.subarray(at, at + len)));
    at += len;
  }
  return Buffer.concat(out);
}
function frameLength(b: Buffer): number {
  if (b.readUInt32LE(0) !== 0xfd2fb528) throw new Error("not a zstd frame");
  const fhd = b[4];
  const fcsFlag = fhd >> 6;
  const single = (fhd >> 5) & 1;
  const checksum = (fhd >> 2) & 1;
  const didFlag = fhd & 3;
  let p = 5;
  if (!single) p += 1; // window descriptor
  p += [0, 1, 2, 4][didFlag];
  p += fcsFlag === 0 ? (single ? 1 : 0) : fcsFlag === 1 ? 2 : fcsFlag === 2 ? 4 : 8;
  for (;;) {
    const bh = b[p] | (b[p + 1] << 8) | (b[p + 2] << 16);
    const last = bh & 1;
    const type = (bh >> 1) & 3;
    const size = bh >> 3;
    p += 3 + (type === 1 ? 1 : size); // RLE block carries one byte
    if (last) break;
  }
  return p + (checksum ? 4 : 0);
}

// ---------------------------------------------------------------------------------------------------------------------
// Schemes

interface Scheme {
  name: string;
  encoding: "identity" | "zstd" | "br";
  prep?(model: Model): void;
  /** per request: `identity` is the assembled page (already paid by every scheme); returns the body */
  body(model: Model, page: Page, identity: Buffer): Buffer;
}

function assembleParts(model: Model, page: Page): Buffer {
  const ops = model.ops(page);
  let n = 0;
  const holes: Buffer[] = [];
  for (const op of ops) {
    if ("s" in op) n += model.segments[op.s].length;
    else {
      const b = Buffer.from(op.h, "utf8");
      holes.push(b);
      n += b.length;
    }
  }
  const out = Buffer.allocUnsafe(n);
  let at = 0;
  let h = 0;
  for (const op of ops) {
    const b = "s" in op ? model.segments[op.s] : holes[h++];
    b.copy(out, at);
    at += b.length;
  }
  return out;
}

const frames = new WeakMap<Model, Buffer[]>();
const prepFrames = (m: Model) =>
  void frames.set(
    m,
    m.segments.map((s) => zstd(s, 19)),
  );

function spliceAll(model: Model, page: Page): Buffer {
  const fr = frames.get(model)!;
  const ops = model.ops(page);
  const holes: Buffer[] = [];
  let n = 0;
  for (const op of ops) {
    if ("s" in op) n += fr[op.s].length;
    else {
      const b = Buffer.from(op.h, "utf8");
      holes.push(b);
      n += rawFrameSize(b.length);
    }
  }
  const out = Buffer.allocUnsafe(n);
  let at = 0;
  let h = 0;
  for (const op of ops) {
    if ("s" in op) {
      fr[op.s].copy(out, at);
      at += fr[op.s].length;
    } else at = rawFrameInto(out, at, holes[h++]);
  }
  return out;
}

function hybrid(level: number) {
  return (model: Model, page: Page): Buffer => {
    const fr = frames.get(model)!;
    const ops = model.ops(page);
    const [d0, d1] = model.dense(ops);
    const parts: Buffer[] = [];
    const emit = (from: number, to: number) => {
      for (let i = from; i < to; i++) {
        const op = ops[i];
        if ("s" in op) parts.push(fr[op.s]);
        else {
          const b = Buffer.from(op.h, "utf8");
          const f = Buffer.allocUnsafe(rawFrameSize(b.length));
          rawFrameInto(f, 0, b);
          parts.push(f);
        }
      }
    };
    emit(0, d0);
    const mid: Buffer[] = [];
    for (let i = d0; i < d1; i++) {
      const op = ops[i];
      mid.push("s" in op ? model.segments[op.s] : Buffer.from(op.h, "utf8"));
    }
    parts.push(zstd(Buffer.concat(mid), level));
    emit(d1, ops.length);
    return Buffer.concat(parts);
  };
}

const schemes: Scheme[] = [
  { name: "identity", encoding: "identity", body: (_m, _p, id) => id },
  ...[4, 5, 6].map((q): Scheme => ({ name: `br q${q} whole page`, encoding: "br", body: (_m, _p, id) => brotli(id, q) })),
  ...[1, 3].map((l): Scheme => ({ name: `zstd -${l} whole page`, encoding: "zstd", body: (_m, _p, id) => zstd(id, l) })),
  { name: "zstd splice (static frames + raw frame per hole)", encoding: "zstd", prep: prepFrames, body: (m, p) => spliceAll(m, p) },
  { name: "zstd hybrid (static frames; dense region zstd -1)", encoding: "zstd", prep: prepFrames, body: (m, p) => hybrid(1)(m, p) },
  { name: "zstd hybrid (static frames; dense region zstd -3)", encoding: "zstd", prep: prepFrames, body: (m, p) => hybrid(3)(m, p) },
];

function decode(encoding: Scheme["encoding"], body: Buffer): Buffer {
  if (encoding === "identity") return body;
  if (encoding === "br") return zlib.brotliDecompressSync(body);
  return decodeZstdFrames(body);
}

// ---------------------------------------------------------------------------------------------------------------------

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
}

const models = (): [Model, Page][] => [
  [tableModel(100), makePage(100)],
  [tableModel(1000), makePage(1000)],
  [articleModel(), makePage(3)],
];

function timeIt(fn: () => unknown, iterations: number): { med: number; p90: number } {
  const t: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    t.push((performance.now() - t0) * 1000);
  }
  t.sort((a, b) => a - b);
  return { med: t[Math.floor(t.length / 2)], p90: t[Math.floor(t.length * 0.9)] };
}

function bench() {
  const iterations = Number(arg("iterations", "200"));
  console.log(`| shape | scheme | bytes | ratio vs identity | encode µs / page (median) | p90 | vs br q5 | decodes (Node, frame by frame) |`);
  console.log(`| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |`);
  for (const [model, page] of models()) {
    for (const s of schemes) s.prep?.(model);
    const truth = Buffer.from(model.identity(page), "utf8");
    if (!assembleParts(model, page).equals(truth)) throw new Error(`segment model drifted (${model.name})`);
    const iters = Math.max(10, Math.round(iterations / Math.max(1, truth.length / 100_000)));
    const assemble = timeIt(() => assembleParts(model, page), iters);
    console.log(
      `| ${model.name} | assemble identity from segments (every scheme pays this) | ${truth.length} | 1.000 | ${assemble.med.toFixed(0)} | ${assemble.p90.toFixed(0)} | – | – |`,
    );
    let brq5 = 0;
    for (const s of schemes) {
      if (s.name === "identity") continue;
      const body = s.body(model, page, truth);
      let ok: string;
      try {
        ok = decode(s.encoding, body).equals(truth) ? "yes" : "MISMATCH";
      } catch (e) {
        ok = `error: ${(e as Error).message.slice(0, 40)}`;
      }
      const t = timeIt(() => s.body(model, page, truth), iters);
      if (s.name.startsWith("br q5")) brq5 = t.med;
      const rel = brq5 ? (t.med / brq5).toFixed(2) + "×" : "–";
      console.log(
        `| ${model.name} | ${s.name} | ${body.length} | ${(body.length / truth.length).toFixed(3)} | ${t.med.toFixed(0)} | ${t.p90.toFixed(0)} | ${rel} | ${ok} |`,
      );
    }
  }
}

export function serve(port: number) {
  const all = models();
  for (const [m] of all) for (const s of schemes) s.prep?.(m);
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (url.pathname === "/index") {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({ shapes: all.map(([m], i) => ({ i, name: m.name })), schemes: schemes.map((s, i) => ({ i, name: s.name, encoding: s.encoding })) }),
      );
      return;
    }
    const m = /^\/(\d+)\/(\d+)$/.exec(url.pathname);
    if (!m) {
      res.statusCode = 404;
      res.end();
      return;
    }
    const [model, page] = all[Number(m[1])];
    const s = schemes[Number(m[2])];
    const body = s.body(model, page, Buffer.from(model.identity(page), "utf8"));
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    if (s.encoding !== "identity") res.setHeader("content-encoding", s.encoding);
    res.setHeader("content-length", body.length);
    res.end(body);
  });
  server.listen(port, "127.0.0.1", () => console.log(`splice spike on http://127.0.0.1:${port}/index`));
  return server;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*\//, ""))) {
  const cmd = process.argv[2];
  if (cmd === "bench") bench();
  else if (cmd === "serve") serve(Number(arg("port", "8787")));
  else console.log("usage: splice.ts bench | serve");
}
