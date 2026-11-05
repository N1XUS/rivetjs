// Link check over the built site: internal hrefs/srcs resolve to files (example iframes, `src` or lazy `data-lazy`: their frame pages),
// `#anchors` exist in their target page, StackBlitz forms (starters) post to the run endpoint. Example frame pages
// (`/examples/<id>/frame/…`) are checked for their assets only: element hrefs other than `<link>` are demo content
// (placeholder paths and anchors of the example's own app, also on non-`<a>` link elements).
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { readTexts } from "./concurrency.ts";

async function htmlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter((e) => e.isFile() && e.name.endsWith(".html")).map((e) => join(e.parentPath, e.name));
}
const ATTR = /\s(href|src|data-lazy|action)="([^"]*)"/g;
const ID = /\sid="([^"]*)"/g;
const decode = (value: string) => value.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">");

/** Problems found under `<dist>/client`; empty when clean. */
export async function checkLinks(dist: string): Promise<string[]> {
  const client = resolve(dist, "client");
  const problems: string[] = [];
  const files = await htmlFiles(client);
  const ids = new Map<string, Set<string>>();
  const idsOf = async (file: string, current?: string): Promise<Set<string>> => {
    let found = ids.get(file);
    if (!found) {
      const html = current ?? (await readFile(file, "utf8"));
      found = new Set([...html.matchAll(ID)].map((m) => decode(m[1]!)));
      ids.set(file, found);
    }
    return found;
  };
  // Nav / footer links repeat on every page: one lookup per distinct path.
  const pages = new Map<string, string | undefined>();
  const pageFile = (path: string): string | undefined => {
    if (pages.has(path)) return pages.get(path);
    const found = lookup(path);
    pages.set(path, found);
    return found;
  };
  const lookup = (path: string): string | undefined => {
    const target = resolve(client, "." + decodeURIComponent(path));
    if (target !== client && !target.startsWith(client + sep)) return undefined;
    if (path.endsWith("/")) return existsSync(join(target, "index.html")) ? join(target, "index.html") : undefined;
    return existsSync(target) ? target : existsSync(join(target, "index.html")) ? join(target, "index.html") : undefined;
  };
  // Pages read 16 ahead, checked in order (problems keep their order).
  const texts = readTexts(files);
  for (const file of files) {
    const html = (await texts.next()).value as string;
    const from = "/" + relative(client, file).split(sep).join("/");
    // Skip <script> contents (state JSON, loader), code listings and <input value> payloads.
    let markup = html
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<pre\b[\s\S]*?<\/pre>/gi, "")
      .replace(/<code\b[\s\S]*?<\/code>/gi, "")
      .replace(/<input type="hidden"[^>]*>/g, "");
    if (/^\/examples\/[^/]+\/frame\//.test(from)) markup = markup.replace(/<(?!link\b)[a-z][\w-]*\b[^>]*>/gi, (tag) => tag.replace(/\shref="[^"]*"/g, ""));
    for (const [, kind, raw] of markup.matchAll(ATTR)) {
      const value = decode(raw!);
      if (!value || value.startsWith("data:") || value.startsWith("mailto:")) continue;
      if (kind === "action") {
        if (value.startsWith("https://stackblitz.com/run")) continue;
        if (/^https?:/.test(value)) continue;
      }
      if (/^[a-z]+:/i.test(value) || value.startsWith("//")) continue;
      const [path = "", hash] = value.split("#", 2) as [string, string | undefined];
      const target = path ? pageFile(new URL(path, "http://x" + from).pathname) : file;
      if (!target) {
        problems.push(`${from}: ${kind}="${value}" does not exist`);
        continue;
      }
      if (hash && target.endsWith(".html") && !(await idsOf(target, target === file ? html : undefined)).has(decodeURIComponent(hash)))
        problems.push(`${from}: #${hash} not found in ${path || "the same page"}`);
    }
  }
  return problems;
}
