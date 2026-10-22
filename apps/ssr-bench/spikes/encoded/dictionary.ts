// E3 task 1 (derived-client plan M5, docs/design/plans/2026-10-18-derived-client.md "M5 — server track"; write-up
// docs/benchmarks/2026-10-22-dictionary-transport.md): which compression dictionary (RFC 9842 Compression Dictionary
// Transport, `dcz` = zstd + dictionary, `dcb` = brotli + dictionary) pays for itself, per resource class, on built sites.
//
// For every route group of a static build (first path segment) the pages split into a training half (even index) and
// a test half (odd index); each candidate dictionary is built from the training half only and measured on the test half:
//   shell     common prefix + suffix of the training pages (what the layout renders; ≈ the shell cache's prefix / suffix)
//   segments  `libs/router/adapters/dictionary.ts` `buildDictionary` (the shipped builder: content-defined segments seen
//             on ≥ 2 training pages, most shared last), capped at --max (64 KiB default)
//   trained   `zstd --train --maxdict=<max>` over the training pages (needs the zstd CLI; used as a RAW dictionary,
//             as browsers do — magic bytes cleared so zlib does not parse it as a formatted one)
//   site      what ships (`writeDictionaries`): `buildDictionary` over ≤ 12 evenly spaced training pages per group and
//             their `_data.json` (one dictionary for the whole site)
//   chunks    the JS / CSS files the training pages reference, concatenated (the route chunk + shared chunk graph)
//   previous  the training page next to the test page (page-to-page delta: the document itself as the dictionary)
// Pages per group are capped (--train / --test) after sorting; groups need ≥ 4 pages.
// Encodings per test page: br q4 / zstd −3 (the node adapter's per-request levels), br q11 / zstd 19 (precompressed /
// stored), dcb q4 / q11 and dcz −3 / 19 against each candidate (+ the RFC's 36 / 40 header bytes). Dictionary cost =
// its zstd 19 bytes (fetched once at idle, `Link: rel=compression-dictionary`), break-even = cost / bytes saved per page.
// Navigation data: the `_data.json` siblings of the same pages (static builds with a client router), same candidates.
// Chunks: `--previous <old build>` pairs each `assets/<name>-<hash>.js` with the old build's file of the same name
// (a deploy's delta: the old chunk as the dictionary of the new one).
//
//   node apps/ssr-bench/spikes/encoded/dictionary.ts --site <dist/client> [--label name] [--max 131072] [--test 40]
//        [--train 60] [--previous <old dist/client>] [--json out.json]
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { performance } from "node:perf_hooks";
import zlib from "node:zlib";
import { buildDictionary } from "../../../../libs/router/adapters/dictionary.ts";

const C = zlib.constants;
function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1]! : def;
}
const SITE = arg("site", "");
if (!SITE) throw new Error("--site <dist/client> required");
const LABEL = arg("label", SITE);
const MAX = Number(arg("max", "131072"));
const TEST = Number(arg("test", "40"));
const TRAIN = Number(arg("train", "60"));
const PREVIOUS = arg("previous", "");
const JSON_OUT = arg("json", "");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const br = (body: Buffer, q: number, dictionary?: Buffer) =>
  zlib.brotliCompressSync(body, {
    params: { [C.BROTLI_PARAM_QUALITY]: q, [C.BROTLI_PARAM_MODE]: C.BROTLI_MODE_TEXT, [C.BROTLI_PARAM_SIZE_HINT]: body.length },
    ...(dictionary ? { dictionary } : {}),
  }).length;
const zs = (body: Buffer, level: number, dictionary?: Buffer) =>
  zlib.zstdCompressSync(body, { params: { [C.ZSTD_c_compressionLevel]: level }, ...(dictionary ? { dictionary } : {}) }).length;
const DCB = 36,
  DCZ = 40;

/** zstd's trainer (CLI), returned as raw content: the magic number cleared so zlib loads it as a raw prefix. */
function trained(files: Buffer[], max: number): Buffer | null {
  const dir = mkdtempSync(join(tmpdir(), "rivet-dict-"));
  try {
    const paths = files.map((body, i) => {
      const path = join(dir, `s${i}`);
      writeFileSync(path, body);
      return path;
    });
    execFileSync("zstd", ["-q", "--train", ...paths, "-o", join(dir, "dict"), `--maxdict=${max}`], { stdio: "ignore" });
    const dict = readFileSync(join(dir, "dict"));
    dict[0] = 0;
    return dict;
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function commonShell(pages: Buffer[], max: number): Buffer {
  let prefix = pages[0]!.length,
    suffix = pages[0]!.length;
  const first = pages[0]!;
  for (const page of pages.slice(1)) {
    let i = 0;
    while (i < prefix && i < page.length && page[i] === first[i]) i++;
    prefix = i;
    let j = 0;
    while (j < suffix && j < page.length && page[page.length - 1 - j] === first[first.length - 1 - j]) j++;
    suffix = j;
  }
  const head = first.subarray(0, Math.min(prefix, max));
  const tail = first.subarray(first.length - Math.min(suffix, max - head.length));
  return Buffer.concat([head, tail]);
}

function referenced(page: Buffer, root: string): string[] {
  const out = new Set<string>();
  for (const match of page.toString("utf8").matchAll(/(?:src|href)="(\/[^"?#]+\.(?:js|css))"/g)) {
    const path = join(root, match[1]!);
    if (existsSync(path)) out.add(path);
  }
  return [...out];
}

interface Row {
  group: string;
  kind: string;
  pages: number;
  identity: number;
  br4: number;
  zstd3: number;
  br11: number;
  zstd19: number;
  candidates: Record<string, { size: number; cost: number; dcb4: number; dcz3: number; dcb11: number; dcz19: number; encodeUs: number; plainUs: number }>;
}

function measure(group: string, kind: string, train: Buffer[], test: Buffer[], dicts: Record<string, (i: number) => Buffer | null>): Row {
  const row: Row = { group, kind, pages: test.length, identity: 0, br4: 0, zstd3: 0, br11: 0, zstd19: 0, candidates: {} };
  for (const body of test) {
    row.identity += body.length;
    row.br4 += br(body, 4);
    row.zstd3 += zs(body, 3);
    row.br11 += br(body, 11);
    row.zstd19 += zs(body, 19);
  }
  for (const [name, dictOf] of Object.entries(dicts)) {
    const cell = { size: 0, cost: 0, dcb4: 0, dcz3: 0, dcb11: 0, dcz19: 0, encodeUs: 0, plainUs: 0 };
    let sized = false;
    const times: number[] = [],
      plain: number[] = [];
    for (let i = 0; i < test.length; i++) {
      const dict = dictOf(i);
      if (!dict || !dict.length) {
        cell.size = -1;
        break;
      }
      if (!sized || name === "previous") {
        cell.size = Math.max(cell.size, dict.length);
        if (name !== "previous") cell.cost = zs(dict, 19);
        sized = true;
      }
      const body = test[i]!;
      cell.dcb4 += br(body, 4, dict) + DCB;
      cell.dcb11 += br(body, 11, dict) + DCB;
      cell.dcz19 += zs(body, 19, dict) + DCZ;
      // Encode CPU per request (dictionary loaded per call, as the adapter does): dcz −3 vs zstd −3, best of 3.
      let best = Infinity,
        bestPlain = Infinity,
        size = 0;
      for (let r = 0; r < 3; r++) {
        let t = performance.now();
        size = zs(body, 3, dict);
        best = Math.min(best, performance.now() - t);
        t = performance.now();
        zs(body, 3);
        bestPlain = Math.min(bestPlain, performance.now() - t);
      }
      cell.dcz3 += size + DCZ;
      times.push(best * 1000);
      plain.push(bestPlain * 1000);
    }
    if (cell.size < 0) continue;
    times.sort((a, b) => a - b);
    plain.sort((a, b) => a - b);
    cell.encodeUs = times[times.length >> 1]!;
    cell.plainUs = plain[plain.length >> 1]!;
    row.candidates[name] = cell;
  }
  void train;
  return row;
}

const evenly = <T>(list: readonly T[], count: number): T[] =>
  list.length <= count ? [...list] : Array.from({ length: count }, (_, i) => list[Math.floor((i * list.length) / count)]!);
const files = walk(SITE);
const htmlFiles = files.filter((f) => f.endsWith(".html") && !f.endsWith("404.html"));
const groups = new Map<string, string[]>();
for (const file of htmlFiles) {
  const rel = relative(SITE, file).split("/");
  const key = rel.length === 1 ? "index" : rel[0]!;
  (groups.get(key) ?? groups.set(key, []).get(key)!).push(file);
}
const rows: Row[] = [];
const siteTrain: Buffer[] = [];
const split = new Map<string, { train: string[]; test: string[] }>();
for (const [key, list] of [...groups].sort()) {
  if (list.length < 4) continue;
  list.sort();
  const train = list.filter((_, i) => i % 2 === 0).slice(0, TRAIN);
  const test = list.filter((_, i) => i % 2 === 1).slice(0, TEST);
  split.set(key, { train, test });
  for (const file of evenly(train, 12)) {
    siteTrain.push(readFileSync(file));
    const data = join(file, "..", "_data.json");
    if (existsSync(data)) siteTrain.push(readFileSync(data));
  }
}
const site = buildDictionary(siteTrain, { max: MAX });
for (const [key, { train, test }] of split) {
  const trainBodies = train.map((f) => readFileSync(f));
  const testBodies = test.map((f) => readFileSync(f));
  const shell = commonShell(trainBodies, MAX);
  const segments = buildDictionary(trainBodies, { max: MAX });
  const zstdTrained = trained(trainBodies, MAX);
  const chunkFiles = [...new Set(trainBodies.flatMap((b) => referenced(b, SITE)))];
  const chunks = chunkFiles.length ? Buffer.concat(chunkFiles.map((f) => readFileSync(f))) : null;
  const dicts: Record<string, (i: number) => Buffer | null> = {
    shell: () => shell,
    segments: () => segments,
    ...(zstdTrained ? { trained: () => zstdTrained } : {}),
    site: () => site,
    ...(chunks ? { chunks: () => chunks } : {}),
    previous: (i) => trainBodies[Math.min(i, trainBodies.length - 1)]!,
  };
  rows.push(measure(key, "document", trainBodies, testBodies, dicts));
  // Navigation data: `_data.json` next to each page (static builds with the client router).
  const dataOf = (f: string) => join(f, "..", "_data.json");
  if (test.every((f) => existsSync(dataOf(f))) && train.every((f) => existsSync(dataOf(f)))) {
    const trainData = train.map((f) => readFileSync(dataOf(f)));
    const testData = test.map((f) => readFileSync(dataOf(f)));
    const dataSegments = buildDictionary(trainData, { max: MAX });
    const dataTrained = trained(trainData, MAX);
    const both = buildDictionary([...trainBodies, ...trainData], { max: MAX });
    rows.push(
      measure(key, "data", trainData, testData, {
        "document segments": () => segments,
        "data segments": () => dataSegments,
        "documents + data segments": () => both,
        site: () => site,
        ...(dataTrained ? { "data trained": () => dataTrained } : {}),
        previous: (i) => trainData[Math.min(i, trainData.length - 1)]!,
      }),
    );
  }
  console.error(`${LABEL} ${key}: ${train.length} train / ${test.length} test`);
}

// Chunks after a deploy: same chunk name, different content hash, old file = dictionary.
const chunkRows: { name: string; size: number; br11: number; zstd19: number; dcb11: number; dcz19: number }[] = [];
if (PREVIOUS) {
  const stem = (f: string) => relative(f.includes("/assets/") ? f.slice(0, f.indexOf("/assets/") + 8) : f, f).replace(/-[\w-]{8}\.js$/, "");
  const old = new Map<string, string>();
  for (const f of walk(join(PREVIOUS, "assets")).filter((f) => f.endsWith(".js"))) old.set(stem(f), f);
  for (const f of walk(join(SITE, "assets")).filter((f) => f.endsWith(".js"))) {
    const before = old.get(stem(f));
    if (!before) continue;
    const body = readFileSync(f),
      dict = readFileSync(before);
    if (body.equals(dict) || body.length < 1024) continue;
    chunkRows.push({
      name: stem(f),
      size: body.length,
      br11: br(body, 11),
      zstd19: zs(body, 19),
      dcb11: br(body, 11, dict) + DCB,
      dcz19: zs(body, 19, dict) + DCZ,
    });
  }
}

// Report.
const pct = (a: number, b: number) => ((100 * a) / b).toFixed(0) + " %";
console.log(`\n### ${LABEL} (max dictionary ${MAX} B, ≤ ${TRAIN} training / ${TEST} test pages per group; Node ${process.version})\n`);
console.log(
  `| group | class | test pages | identity / page | br q4 | zstd −3 | br q11 | zstd 19 | candidate | dict bytes (zstd 19) | dcb q4 | dcz −3 | dcb q11 | dcz 19 | dcz −3 vs br q4 | dcz 19 vs br q11 | break-even pages | dcz −3 encode µs (zstd −3) |`,
);
console.log(`| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`);
for (const row of rows) {
  const n = row.pages;
  const per = (v: number) => Math.round(v / n);
  for (const [name, c] of Object.entries(row.candidates)) {
    const saved = (row.zstd3 - c.dcz3) / n;
    const breakEven = name === "previous" ? "0 (the page)" : saved > 0 ? (c.cost / saved).toFixed(1) : "never";
    console.log(
      `| ${row.group} | ${row.kind} | ${n} | ${per(row.identity)} | ${per(row.br4)} | ${per(row.zstd3)} | ${per(row.br11)} | ${per(row.zstd19)} | ${name} | ${c.size} (${c.cost || "—"}) | ${per(c.dcb4)} | ${per(c.dcz3)} | ${per(c.dcb11)} | ${per(c.dcz19)} | ${pct(c.dcz3, row.br4)} | ${pct(c.dcz19, row.br11)} | ${breakEven} | ${c.encodeUs.toFixed(0)} (${c.plainUs.toFixed(0)}) |`,
    );
  }
}
if (chunkRows.length) {
  const sum = (k: keyof (typeof chunkRows)[number]) => chunkRows.reduce((s, r) => s + (r[k] as number), 0);
  console.log(`\nChunks changed by the deploy (${chunkRows.length} files ≥ 1 KiB, old file of the same name = dictionary):\n`);
  console.log(`| chunks | identity | br q11 | zstd 19 | dcb q11 | dcz 19 | dcz 19 vs br q11 |`);
  console.log(`| --- | ---: | ---: | ---: | ---: | ---: | ---: |`);
  console.log(
    `| ${chunkRows.length} | ${sum("size")} | ${sum("br11")} | ${sum("zstd19")} | ${sum("dcb11")} | ${sum("dcz19")} | ${pct(sum("dcz19"), sum("br11"))} |`,
  );
}
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ label: LABEL, max: MAX, node: process.version, rows, chunkRows }, null, 2) + "\n");
