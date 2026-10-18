// E1 (derived-client plan M5, docs/design/plans/2026-10-18-derived-client.md "M5 — server track"; numbers in
// docs/design/research/2026-10-18-floor-first.md §9): what a Rivet page costs ENCODED — bytes on the wire and server CPU
// per page through the real `@rivetjs/router/node` adapter (`serve()`, direct bodies from `renderDocument`), per
// content encoding the adapter negotiates: identity, gzip (6), br (q4), zstd (−3; −1 for bodies ≥ 256 KiB). Plus a
// 3-page session (document, 2 client navigations = the router's JSON data answers, 1 action = a JSON answer) summing
// wire bytes, and an in-process brotli q5 encode reference (the usual CDN / origin default) for the M5 E2 gate
// (zstd encode CPU ≤ 0.3× brotli q5 at ≤ +15 % bytes).
//
// Method: the server (this process) renders the ssr-bench pages compiled with the real Rivet server compiler (table
// 100 / 1000 rows: `adapters/rivet-compiled.jsx`'s shape, data from `spikes/splice` `makePage`; article: the X1 content
// shape — 60-link nav, 6 KB stylesheet, 40 paragraphs, 12 related links, 4 KB script). A CHILD process drives N
// keep-alive requests per (page, encoding) over one socket, decodes every body and checks it against the identity
// body's SHA-256, and reports bytes read from the socket (headers + body) per request; the parent measures its own
// `process.cpuUsage()` (user + system, all threads: zlib's pool included) around the child = server CPU per request,
// request parsing and the response path included. Rounds interleave encodings; the median round is reported.
//
//   node apps/ssr-bench/spikes/encoded/encoded.ts [--encoding identity|gzip|br|zstd|all] [--pages table100,table1000,article]
//                                                [--requests 200] [--rounds 5] [--sessions 100] [--json out.json]
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { Agent, request } from "node:http";
import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { compile } from "@rivetjs/compiler";
import { importServer } from "../../../../libs/runtime/tests/resume/compile.ts";
import { PAGE_STYLE } from "../../fixture/emitter.ts";
import { makePage } from "../splice/splice.ts";

type Encoding = "identity" | "gzip" | "br" | "zstd";
const ENCODINGS: Encoding[] = ["identity", "gzip", "br", "zstd"];
const ACCEPT: Record<Encoding, string> = { identity: "identity", gzip: "gzip", br: "gzip, deflate, br", zstd: "gzip, deflate, br, zstd" };
const SELF = fileURLToPath(import.meta.url);

// ---------------------------------------------------------------------------------------------------------------------
// Page sources (compiled with the real server compiler, rendered through the router's `renderDocument`).

const fields = Array.from({ length: 10 }, (_, i) => `<div><dt>Field ${i}</dt><dd>{row.values[${i}]}</dd></div>`).join("");
const TABLE_SOURCE = `
function Row({ row }) {
  return <article data-row={row.id} data-state="even"><header><h2>Record</h2><p>Static description and supporting HTML.</p></header><section><dl>${fields}</dl></section><footer><button type="button" disabled>Increment</button><label>Selected<input type="checkbox" readOnly /></label></footer></article>;
}
export function Table({ page }) {
  return <main data-token={page.token}><h1>{page.title}</h1><section data-grid="">{page.rows.map((row) => <Row row={row} />)}</section></main>;
}
`;
const ARTICLE_SOURCE = `
export function Article({ article }) {
  return (
    <>
      <header class="site"><nav><ul>{article.nav.map((item) => <li><a href={item.href} class={item.cls}>{item.label}</a></li>)}</ul></nav></header>
      <main><article><h1>{article.title}</h1><p class="byline">By {article.byline}</p><div class="body">{article.paragraphs.map((text) => <p>{text}</p>)}</div>
        <aside><h2>Related</h2><ul>{article.related.map((item) => <li><a href={item.href}>{item.label}</a></li>)}</ul></aside></article></main>
      <footer class="site"><p>© 2026 Example &amp; Co.</p><ul>{article.legal.map((item) => <li><a href={item.href}>{item.label}</a></li>)}</ul></footer>
    </>
  );
}
`;

function prng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}
const WORDS =
  "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey xray yankee zulu".split(
    " ",
  );
const ARTICLE_CSS = Array.from(
  { length: 120 },
  (_, i) => `.c${i}{display:flex;gap:${i % 9}px;padding:${i % 7}px ${i % 11}px;color:#${(i * 2654435).toString(16).slice(0, 6)};border-radius:${i % 4}px}`,
).join("");
const ARTICLE_SCRIPT = Array.from({ length: 40 }, (_, i) => `function f${i}(a,b){return a+b*${i}+Math.max(a,b)}`).join("");
/** The X1 article shape: static chrome + one dynamic body (≈ 8 KB of prose) + small holes. Deterministic per seed. */
function makeArticle(seed: number) {
  const g = prng(seed * 7919 + 17);
  return {
    title: `Article ${seed}: ${WORDS[Math.floor(g() * 26)]} ${WORDS[Math.floor(g() * 26)]}`,
    byline: `${WORDS[Math.floor(g() * 26)]} ${WORDS[Math.floor(g() * 26)]}`,
    nav: Array.from({ length: 60 }, (_, i) => ({
      href: `/section-${i % 12}/page-${i}`,
      cls: `nav-link nav-link--${i % 5}`,
      label: `Section ${WORDS[i % 26]} ${i}`,
    })),
    paragraphs: Array.from({ length: 40 }, () => Array.from({ length: 60 }, () => WORDS[Math.floor(g() * 26)]).join(" ") + "."),
    related: Array.from({ length: 12 }, (_, i) => ({ href: `/a/${seed * 100 + i}`, label: WORDS[(i * 7) % 26] + " " + WORDS[(i * 3) % 26] })),
    legal: Array.from({ length: 24 }, (_, i) => ({ href: `/legal/${i}`, label: `Legal ${i}` })),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Client (child process): N keep-alive requests over one socket, decoded bodies checked, socket bytes counted.

interface ClientStep {
  path: string;
  method?: string;
  body?: string;
}
interface ClientResult {
  requests: number;
  /** Bytes read from the socket (status line, headers, framing, body) per request sequence. */
  wire: number;
  /** Body bytes as received (encoded) per sequence. */
  body: number;
  ms: number;
  encodings: Record<string, number>;
}
const decodeBody = (encoding: string | undefined, body: Buffer): Buffer =>
  encoding === "zstd"
    ? zlib.zstdDecompressSync(body)
    : encoding === "br"
      ? zlib.brotliDecompressSync(body)
      : encoding === "gzip"
        ? zlib.gunzipSync(body)
        : body;
const sha = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

async function clientMain(url: string, accept: string, n: number, steps: ClientStep[], expected: string[]): Promise<void> {
  const agent = new Agent({ keepAlive: true, maxSockets: 1 });
  // Keep-alive normally reuses one socket; `bytesRead` is cumulative per socket, so every socket seen is summed.
  const sockets = new Set<{ bytesRead: number }>();
  let body = 0;
  const encodings: Record<string, number> = {};
  const one = (step: ClientStep, i: number) =>
    new Promise<void>((done, fail) => {
      const req = request(
        url + step.path,
        {
          agent,
          method: step.method ?? "GET",
          headers: {
            "accept-encoding": accept,
            ...(step.body ? { "content-type": "application/json", "content-length": String(Buffer.byteLength(step.body)) } : {}),
          },
        },
        (res) => {
          const parts: Buffer[] = [];
          res.on("data", (chunk: Buffer) => parts.push(chunk));
          res.on("end", () => {
            const raw = Buffer.concat(parts);
            body += raw.length;
            const encoding = res.headers["content-encoding"];
            encodings[encoding ?? "identity"] = (encodings[encoding ?? "identity"] ?? 0) + 1;
            if (res.statusCode !== 200) return fail(new Error(`${step.path}: status ${res.statusCode}`));
            const text = decodeBody(encoding, raw);
            if (sha(text) !== expected[i]) return fail(new Error(`${step.path}: decoded body differs (${encoding ?? "identity"}, ${text.length} bytes)`));
            done();
          });
          res.on("error", fail);
        },
      );
      req.on("socket", (socket) => sockets.add(socket as unknown as { bytesRead: number }));
      req.on("error", fail);
      req.end(step.body);
    });
  const started = performance.now();
  for (let r = 0; r < n; r++) for (let i = 0; i < steps.length; i++) await one(steps[i]!, i);
  const ms = performance.now() - started;
  let socketBytes = 0;
  for (const socket of sockets) socketBytes += socket.bytesRead;
  agent.destroy();
  const out: ClientResult = { requests: n * steps.length, wire: socketBytes / n, body: body / n, ms, encodings };
  process.stdout.write(JSON.stringify(out));
}

// ---------------------------------------------------------------------------------------------------------------------
// Server (this process) + measurement.

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1]! : def;
}
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};
const kb = (n: number) => (n / 1024).toFixed(1);

async function compileComponent<T>(source: string, name: string): Promise<T> {
  const result = compile(source, { target: "server", filename: name } as never) as { code: string; diagnostics: { message: string }[] };
  if (result.diagnostics.length) throw new Error(result.diagnostics.map((d) => d.message).join("\n"));
  return importServer<T>(result.code);
}

async function serverMain(): Promise<void> {
  const encodings = arg("encoding", "all") === "all" ? ENCODINGS : (arg("encoding", "all").split(",") as Encoding[]);
  const pageNames = arg("pages", "table100,table1000,article").split(",");
  const requests = Number(arg("requests", "200"));
  const rounds = Number(arg("rounds", "5"));
  const sessions = Number(arg("sessions", "100"));
  const jsonOut = arg("json", "");

  const { renderDocument } = await import("../../../../libs/router/server/render.ts");
  const { serve } = await import("../../../../libs/router/adapters/node.ts");
  const { Table } = await compileComponent<{ Table: (p: { page: unknown }) => unknown }>(TABLE_SOURCE, "table.tsx");
  const { Article } = await compileComponent<{ Article: (p: { article: unknown }) => unknown }>(ARTICLE_SOURCE, "article.tsx");

  const pages = { table100: makePage(100), table1000: makePage(1000) };
  const articles = { 1: makeArticle(1), 2: makeArticle(2) };
  const tableDocument = (title: string) => () => ({
    start: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${PAGE_STYLE}</style></head><body>`,
    end: "<!--complete--></body></html>",
  });
  const articleDocument = (title: string) => () => ({
    start: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${ARTICLE_CSS}</style></head><body>`,
    end: `<script>${ARTICLE_SCRIPT}</script></body></html>`,
  });
  const input = (url: URL) => ({ head: undefined, nonce: undefined, url, status: 200, styles: [] });
  const html = { "content-type": "text/html; charset=utf-8" };
  const serving = await serve({
    port: 0,
    onError: (error) => console.error(error),
    handler: (req) => {
      const url = new URL(req.url);
      const init = { status: 200, headers: new Headers(html) };
      if (url.pathname === "/table") {
        const rows = url.searchParams.get("rows") === "1000" ? 1000 : 100;
        const page = pages[rows === 1000 ? "table1000" : "table100"];
        return renderDocument(() => Table({ page }), input(url), { document: tableDocument("Rivet bench &amp; &lt;page&gt;") }, init);
      }
      if (url.pathname === "/article") {
        const article = articles[url.searchParams.get("seed") === "2" ? 2 : 1];
        return renderDocument(() => Article({ article }), input(url), { document: articleDocument(article.title) }, init);
      }
      // The router's JSON answers of a client navigation (`_data`: loader data of the next page) and of an action.
      if (url.pathname === "/_data/table") return Response.json({ data: pages[url.searchParams.get("rows") === "1000" ? "table1000" : "table100"] });
      if (url.pathname === "/_data/article") return Response.json({ data: articles[url.searchParams.get("seed") === "2" ? 2 : 1] });
      if (url.pathname === "/action" && req.method === "POST") return Response.json({ ok: true, id: 4711, message: "Saved" });
      return new Response("not found", { status: 404 });
    },
  });
  const url = serving.url;

  /** Identity body of a step (the reference every encoded answer must decode to). */
  const identityOf = (step: ClientStep) =>
    new Promise<string>((done, fail) => {
      const req = request(
        url + step.path,
        { method: step.method ?? "GET", headers: { "accept-encoding": "identity", ...(step.body ? { "content-type": "application/json" } : {}) } },
        (res) => {
          const parts: Buffer[] = [];
          res.on("data", (chunk: Buffer) => parts.push(chunk));
          res.on("end", () => done(sha(Buffer.concat(parts))));
        },
      );
      req.on("error", fail);
      req.end(step.body);
    });
  const identityBytes = (step: ClientStep) =>
    new Promise<Buffer>((done, fail) => {
      const req = request(url + step.path, { method: step.method ?? "GET", headers: { "accept-encoding": "identity" } }, (res) => {
        const parts: Buffer[] = [];
        res.on("data", (chunk: Buffer) => parts.push(chunk));
        res.on("end", () => done(Buffer.concat(parts)));
      });
      req.on("error", fail);
      req.end(step.body);
    });

  /** Run the client for `n` sequences of `steps`; returns its report and this process's CPU µs per sequence. */
  const run = (steps: ClientStep[], accept: string, n: number, expected: string[]) =>
    new Promise<ClientResult & { cpu: number }>((done, fail) => {
      const before = process.cpuUsage();
      execFile(
        process.execPath,
        [SELF, "--client", url, accept, String(n), JSON.stringify(steps), JSON.stringify(expected)],
        { maxBuffer: 1 << 20 },
        (error, stdout, stderr) => {
          const usage = process.cpuUsage(before);
          if (error) return fail(new Error(`client failed: ${error.message}\n${stderr}`));
          const result = JSON.parse(stdout) as ClientResult;
          done({ ...result, cpu: (usage.user + usage.system) / n });
        },
      );
    });

  const PAGE_STEPS: Record<string, ClientStep> = {
    table100: { path: "/table?rows=100" },
    table1000: { path: "/table?rows=1000" },
    article: { path: "/article" },
  };
  interface Cell {
    wire: number;
    body: number;
    cpu: number;
  }
  const results: Record<string, Partial<Record<Encoding, Cell>>> = {};
  const identity: Record<string, { bytes: number; q5: { bytes: number; us: number } }> = {};

  for (const name of pageNames) {
    const step = PAGE_STEPS[name];
    if (!step) throw new Error(`unknown page ${name}`);
    const expected = [await identityOf(step)];
    const raw = await identityBytes(step);
    // brotli q5 reference (in-process, encode only): median of 15 one-shot compressions.
    const q5 = {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 5,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
    };
    const q5Times: number[] = [];
    let q5Bytes = 0;
    for (let i = 0; i < 15; i++) {
      const t0 = performance.now();
      q5Bytes = zlib.brotliCompressSync(raw, { params: q5 }).length;
      q5Times.push((performance.now() - t0) * 1000);
    }
    identity[name] = { bytes: raw.length, q5: { bytes: q5Bytes, us: median(q5Times) } };
    // Warm every encoding (JIT, zlib pools, keep-alive) before timing.
    for (const encoding of encodings) await run([step], ACCEPT[encoding], Math.min(50, requests), expected);
    const samples: Record<string, Cell[]> = {};
    for (let r = 0; r < rounds; r++) {
      const order = [...encodings].sort(() => Math.random() - 0.5);
      for (const encoding of order) {
        const out = await run([step], ACCEPT[encoding], requests, expected);
        const got = Object.keys(out.encodings);
        if (got.length !== 1 || got[0] !== encoding) throw new Error(`${name} ${encoding}: answered ${JSON.stringify(out.encodings)}`);
        (samples[encoding] ??= []).push({ wire: out.wire, body: out.body, cpu: out.cpu });
      }
    }
    results[name] = {};
    for (const encoding of encodings) {
      const cells = samples[encoding]!;
      results[name][encoding] = { wire: median(cells.map((c) => c.wire)), body: median(cells.map((c) => c.body)), cpu: median(cells.map((c) => c.cpu)) };
    }
    console.error(`${name}: done`);
  }

  // Session: article document → navigate to the table (its JSON data) → navigate to another article (its JSON data) → one action.
  const SESSION: ClientStep[] = [
    { path: "/article" },
    { path: "/_data/table?rows=100" },
    { path: "/_data/article?seed=2" },
    { path: "/action", method: "POST", body: "{}" },
  ];
  const sessionExpected = await Promise.all(SESSION.map(identityOf));
  const sessionIdentity = await Promise.all(SESSION.map(identityBytes));
  const session: Partial<Record<Encoding, Cell>> = {};
  for (const encoding of encodings) await run(SESSION, ACCEPT[encoding], Math.min(20, sessions), sessionExpected);
  const sessionSamples: Record<string, Cell[]> = {};
  for (let r = 0; r < rounds; r++) {
    const order = [...encodings].sort(() => Math.random() - 0.5);
    for (const encoding of order) {
      const out = await run(SESSION, ACCEPT[encoding], sessions, sessionExpected);
      (sessionSamples[encoding] ??= []).push({ wire: out.wire, body: out.body, cpu: out.cpu });
    }
  }
  for (const encoding of encodings) {
    const cells = sessionSamples[encoding]!;
    session[encoding] = { wire: median(cells.map((c) => c.wire)), body: median(cells.map((c) => c.body)), cpu: median(cells.map((c) => c.cpu)) };
  }
  await serving.close();

  // Report.
  const host = `Node ${process.version}, ${process.platform} ${process.arch}, ${new Date().toISOString().slice(0, 10)}`;
  console.log(`Host: ${host}; ${requests} requests × ${rounds} rounds per cell (median round), keep-alive, one client process.\n`);
  console.log(`| page | encoding | body bytes | wire bytes / request | vs identity | server CPU µs / request | encode µs (− identity) | vs br q5 encode |`);
  console.log(`| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |`);
  for (const name of pageNames) {
    const id = results[name]!.identity;
    const ref = identity[name]!;
    for (const encoding of encodings) {
      const cell = results[name]![encoding]!;
      const encode = id ? cell.cpu - id.cpu : NaN;
      console.log(
        `| ${name} (${kb(ref.bytes)} KB) | ${encoding} | ${Math.round(cell.body)} | ${Math.round(cell.wire)} | ${id ? (cell.wire / id.wire).toFixed(3) : "—"} | ${cell.cpu.toFixed(0)} | ${id && encoding !== "identity" ? encode.toFixed(0) : "—"} | ${id && encoding !== "identity" ? (encode / ref.q5.us).toFixed(2) + "×" : "—"} |`,
      );
    }
    console.log(`| ${name} | br q5 (in-process encode reference) | ${ref.q5.bytes} | — | — | — | ${ref.q5.us.toFixed(0)} | 1.00× |`);
  }
  console.log(
    `\nSession (article document → table-100 data JSON → article-2 data JSON → action JSON; identity bodies ${sessionIdentity.map((b) => b.length).join(" + ")} bytes):\n`,
  );
  console.log(`| encoding | wire bytes / session | vs identity | server CPU µs / session |`);
  console.log(`| --- | ---: | ---: | ---: |`);
  for (const encoding of encodings) {
    const cell = session[encoding]!;
    console.log(
      `| ${encoding} | ${Math.round(cell.wire)} | ${session.identity ? (cell.wire / session.identity.wire).toFixed(3) : "—"} | ${cell.cpu.toFixed(0)} |`,
    );
  }
  if (jsonOut) await writeFile(jsonOut, JSON.stringify({ host, requests, rounds, sessions, identity, results, session }, null, 2) + "\n");
}

if (process.argv[2] === "--client") {
  const [, , , url, accept, n, steps, expected] = process.argv;
  clientMain(url!, accept!, Number(n), JSON.parse(steps!) as ClientStep[], JSON.parse(expected!) as string[]).catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else await serverMain();
