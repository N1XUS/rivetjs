// Source locations from creation and error stacks: parse V8 / SpiderMonkey frames, skip framework
// frames, and map served positions back through the module's inline source map (the dev server inlines
// one per transformed module). Maps are fetched once per module and HMR stamp, same origin only (LRU).
import type { Frame, SourceLocation } from "../protocol.ts";

const V8 = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/, GECKO = /^(.*?)@(.+?):(\d+):(\d+)$/;
const FRAMEWORK = /\/libs\/(?:reactivity|runtime|devtools\/agent)\/|\/node_modules\/|\/@rivetjs\/|\/@vite\/|\/@id\//;

export function parseStack(stack: string | undefined): Frame[] {
  const frames: Frame[] = [];
  for (const line of (stack ?? "").split("\n")) {
    const m = V8.exec(line) ?? GECKO.exec(line);
    if (!m || !/^(?:https?|file):/.test(m[2]!)) continue;
    frames.push({ fn: m[1] || "", url: m[2]!, line: Number(m[3]), col: Number(m[4]) });
  }
  return frames;
}
/** First frame outside the framework and dev tooling (the app code that created or threw). */
export const appFrame = (frames: readonly Frame[]): Frame | undefined => frames.find((frame) => !FRAMEWORK.test(new URL(frame.url).pathname));

/** Editor path of a module URL or source: root-relative for served paths, absolute for `/@fs/`. */
export function editorPath(url: string): string {
  const path = decodeURIComponent(new URL(url).pathname);
  return path.startsWith("/@fs/") ? path.slice(4) : path.replace(/^\//, "");
}

interface SourceMap {
  sources: string[];
  /** Per generated line: [generated column, source index, line, column] segments, sorted. */
  lines: number[][][];
}
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function decodeMappings(mappings: string): number[][][] {
  const lines: number[][][] = [];
  let source = 0, line = 0, col = 0;
  for (const text of mappings.split(";")) {
    const segments: number[][] = [];
    let generated = 0;
    for (const part of text.split(",")) {
      if (!part) continue;
      const values: number[] = [];
      let value = 0, shift = 0;
      for (const char of part) {
        const digit = B64.indexOf(char);
        value += (digit & 31) << shift;
        if (digit & 32) shift += 5;
        else {
          values.push(value & 1 ? -(value >>> 1) : value >>> 1);
          value = shift = 0;
        }
      }
      generated += values[0]!;
      if (values.length >= 4) {
        source += values[1]!;
        line += values[2]!;
        col += values[3]!;
        segments.push([generated, source, line, col]);
      }
    }
    lines.push(segments);
  }
  return lines;
}
/** Parse the inline (`data:` base64) source map of a module's code, if any. */
export function inlineMap(code: string): SourceMap | null {
  const m = /\/\/[#@] sourceMappingURL=data:application\/json[^,]*;base64,([A-Za-z0-9+/=]+)\s*$/.exec(code);
  if (!m) return null;
  const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(m[1]!), (c) => c.charCodeAt(0)))) as { sources: string[]; sourceRoot?: string; mappings: string };
  return { sources: json.sources.map((s) => (json.sourceRoot ?? "") + s), lines: decodeMappings(json.mappings) };
}
/** Original position of a 1-based generated line / column. */
export function lookup(map: SourceMap, line: number, col: number): { source: string; line: number; col: number } | null {
  const segments = map.lines[line - 1];
  if (!segments?.length) return null;
  let best: number[] | null = null;
  for (const segment of segments) {
    if (segment[0]! > col - 1) break;
    best = segment;
  }
  best ??= segments[0]!;
  return { source: map.sources[best[1]!]!, line: best[2]! + 1, col: best[3]! + 1 };
}

/** Source maps cached per module (Vite's `?t=` HMR stamp stripped) — the newest stamp seen, at most `MAX_MAPS`, least recently used dropped. */
const maps = new Map<string, { t: number; map: Promise<SourceMap | null> }>();
export const MAX_MAPS = 50;
/** Map a frame to its source (`file` as the editor expects it); the served position when unmapped. Only
 * same-origin modules (the dev server's) are fetched: third-party / CDN frames keep their served position. */
export function locate(frame: Frame, fetchText: (url: string) => Promise<string> = (url) => fetch(url).then((r) => r.text())): Promise<SourceLocation> {
  const url = new URL(frame.url);
  const served = { file: editorPath(frame.url), line: frame.line, col: frame.col };
  if (typeof location !== "undefined" && url.origin !== location.origin) return Promise.resolve(served);
  // Every HMR edit re-stamps the module URL: one entry per module, refetched when a newer stamp shows up
  // (older stamps are served the current code anyway).
  const t = Number(url.searchParams.get("t")) || 0;
  url.searchParams.delete("t");
  const key = url.href;
  let entry = maps.get(key);
  if (entry) maps.delete(key);
  if (!entry || t > entry.t) entry = { t, map: fetchText(frame.url).then(inlineMap, () => null) };
  maps.set(key, entry);
  if (maps.size > MAX_MAPS) maps.delete(maps.keys().next().value!);
  const map = entry.map;
  return map.then((loaded) => {
    const hit = loaded && lookup(loaded, frame.line, frame.col);
    if (!hit) return served;
    // Absolute file system sources stay absolute; others resolve against the module URL.
    const file = hit.source.startsWith("/") && !hit.source.startsWith("/@") ? hit.source : editorPath(new URL(hit.source, frame.url).href);
    return { file, line: hit.line, col: hit.col };
  });
}
