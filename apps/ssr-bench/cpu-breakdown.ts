// CPU profile breakdown of one SSR lane process (`node --cpu-prof`), self time by owner:
//   rivet  — Rivet-owned code in the lane bundle (adapter render, compiled templates, runtime, NodeStreamWriter, router
//            handler / node adapter); lane bundle URLs dist/<lane>.mjs, dist/rivet-router/**
//   data   — the bench's SHARED data client (same for every lane): services/content.server (lean node:http2 gRPC client:
//            encodePageRequest/grpc*) + services/page-decoder (decodePage/varint/row/string) in dist/server.mjs or the router
//            build, node:http2 internals; @grpc/* / protobufjs for profiles taken before the 2026-10-09 grpc-js removal
//   http   — response writing / request parsing in Node core (node:_http_*, net, stream, buffer, string encoding)
//   harness — shared bench HTTP glue in dist/server.mjs (request parsing, adapter dispatch; same for every non-router lane)
//   gc     — (garbage collector);  idle — (idle)/(program)/(root);  other — everything else
// Usage: node apps/ssr-bench/cpu-breakdown.ts <file.cpuprofile> [--requests N] [--top 15] [--json]
import { readFile } from "node:fs/promises";

interface Node {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  hitCount?: number;
  children?: number[];
}
interface Profile {
  nodes: Node[];
  startTime: number;
  endTime: number;
  samples: number[];
  timeDeltas: number[];
}

export type Owner = "rivet" | "data" | "http" | "harness" | "gc" | "idle" | "other";
const DATA_FUNCTIONS = new Set([
  "decodePage",
  "varint",
  "row",
  "string",
  "bounded",
  "skip",
  "getPage",
  "encodePageRequest",
  "grpcSession",
  "grpcResponse",
  "grpcData",
  "grpcTrailers",
  "grpcEnd",
]);

/** Classify one call frame (self time). Exported for tests. */
export function owner(frame: Node["callFrame"]): Owner {
  const { functionName: name, url } = frame;
  if (name === "(garbage collector)") return "gc";
  if (name === "(idle)" || name === "(program)" || name === "(root)") return "idle";
  if (/node_modules\/(@grpc|protobufjs|@protobufjs|long|lodash\.camelcase)\//.test(url) || /internal\/http2|node:http2/.test(url)) return "data";
  if (/dist\/(server\.mjs|rivet-router\/server\/)/.test(url) && DATA_FUNCTIONS.has(name)) return "data";
  if (/dist\/(rivet[^/]*\.mjs|rivet-router\/)/.test(url)) return "rivet";
  if (/dist\/(solid|qwik)[^/]*\.mjs/.test(url)) return "other";
  if (
    /^node:(_http|net|stream|buffer|string_decoder|events|internal\/(streams|stream_base|http|net|buffer|timers))/.test(url) ||
    /^node:internal\/(streams|http|net)/.test(url)
  )
    return "http";
  if (!url && /^(write|writev|writeUtf8String|writeLatin1String|writeBuffer|close|shutdown|onStreamRead|readStop|readStart)$/.test(name)) return "http";
  if (/dist\/server\.mjs$/.test(url)) return "harness";
  return "other";
}

export function breakdown(profile: Profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map<number, number>();
  for (let i = 0; i < profile.samples.length; i++) self.set(profile.samples[i]!, (self.get(profile.samples[i]!) ?? 0) + (profile.timeDeltas[i] ?? 0));
  const owners: Record<Owner, number> = { rivet: 0, data: 0, http: 0, harness: 0, gc: 0, idle: 0, other: 0 };
  const functions = new Map<string, { owner: Owner; us: number }>();
  for (const [id, us] of self) {
    const node = byId.get(id)!;
    const o = owner(node.callFrame);
    owners[o] += us;
    const key = `${node.callFrame.functionName || "(anonymous)"} ${node.callFrame.url.replace(/^.*\/(dist|node_modules)\//, "$1/")}:${node.callFrame.lineNumber}`;
    const entry = functions.get(key) ?? { owner: o, us: 0 };
    entry.us += us;
    functions.set(key, entry);
  }
  const busy = owners.rivet + owners.data + owners.http + owners.harness + owners.gc + owners.other;
  return { owners, busy, functions: [...functions].sort((a, b) => b[1].us - a[1].us) };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const option = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i < 0 ? undefined : args[i + 1];
  };
  const profile = JSON.parse(await readFile(args[0]!, "utf8")) as Profile;
  const requests = Number(option("requests") ?? 0);
  const { owners, busy, functions } = breakdown(profile);
  const share = (us: number) => ((100 * us) / busy).toFixed(1) + "%";
  const perPage = (us: number) => (requests ? ` ${(us / 1000 / requests).toFixed(3)} ms/page` : "");
  if (args.includes("--json")) {
    console.log(
      JSON.stringify({ busy_us: busy, requests, owners, top: functions.slice(0, Number(option("top") ?? 15)).map(([k, v]) => ({ fn: k, ...v })) }, null, 1),
    );
  } else {
    console.log(`busy ${(busy / 1000).toFixed(0)} ms${perPage(busy)}`);
    for (const o of ["rivet", "data", "http", "harness", "gc", "other"] as const)
      console.log(`${o.padEnd(6)} ${share(owners[o]).padStart(6)}${perPage(owners[o])}`);
    for (const [key, v] of functions.slice(0, Number(option("top") ?? 15))) console.log(`  ${v.owner.padEnd(6)} ${share(v.us).padStart(6)}  ${key}`);
  }
}
