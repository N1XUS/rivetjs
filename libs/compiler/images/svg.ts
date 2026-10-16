// SVG imports: svgo optimisation for `?image` / `?jsx` assets and the inline `?svg` component
// (sanitised markup → JSX → compiled like any Rivet component). svgo loads on the first SVG only.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Config, PluginConfig, XastChild, XastElement, XastParent, XastRoot } from "svgo";
import { hash } from "./cache.ts";

/** `rivet({ images: { svgo } })`: svgo settings shared by SVG assets and inline `?svg` components. */
export interface SvgoOptions {
  /** Replaces Rivet's plugin list (`svgoPlugins(kind)`; extend it: `[...svgoPlugins("file"), "removeDimensions"]`). */
  plugins?: PluginConfig[];
  /** Default `true`. */
  multipass?: boolean;
  /** Default `3`. */
  floatPrecision?: number;
  /**
   * Prefix ids (and the references to them) so several inlined SVGs never collide. `true` = `<file stem>-<hash5>`,
   * a string = that prefix, `false` = keep ids. Default: `true` for `?svg`, `false` for assets (sprites keep their ids).
   */
  prefixIds?: boolean | string;
}
/** Per-import `?svg` directives (`?currentColor&svg`, `?prefixIds=false&svg`). */
export interface SvgDirectives {
  /** Paint colours (`fill`, `stroke`, `stop-color`, …; not `none` / `url(…)`) become `currentColor`. */
  currentColor?: boolean;
  prefixIds?: boolean | string;
}
export type SvgKind = "file" | "inline";

/** Rivet's default svgo plugins: `preset-default` (viewBox kept: svgo 4 no longer removes it) with ids neither
 * removed nor renamed (external `<use href="file.svg#id">` keeps working). Inline adds style → attribute conversion. */
export function svgoPlugins(kind: SvgKind): PluginConfig[] {
  const ids = { remove: false, minify: false };
  if (kind === "file") return [{ name: "preset-default", params: { overrides: { cleanupIds: ids } } }];
  return [{ name: "preset-default", params: { overrides: { cleanupIds: ids, inlineStyles: { onlyMatchedOnce: false } } } }, "convertStyleToAttrs"];
}

let loaded: Promise<typeof import("svgo")> | undefined;
const load = () => (loaded ??= import("svgo"));
let version: string | undefined;
/** svgo version (part of every SVG cache key). */
export function svgoVersion(): string {
  if (version) return version;
  try {
    let dir = dirname(createRequire(import.meta.url).resolve("svgo"));
    for (let parent = dirname(dir); dir !== parent; dir = parent, parent = dirname(dir)) {
      try {
        const json = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name?: string; version: string };
        if (json.name === "svgo") return (version = json.version);
      } catch {}
    }
  } catch {}
  return (version = "missing");
}

/** Cache identity of an svgo setup (functions of custom plugins by source). */
export function svgoKey(options: SvgoOptions | false, kind: SvgKind, directives: SvgDirectives = {}): string {
  return hash(
    "svgo@" + svgoVersion(),
    kind,
    JSON.stringify([options, directives], (_, v) => (typeof v === "function" ? String(v) : v)),
  );
}

export interface Dimensions {
  width?: number;
  height?: number;
  viewBox?: [number, number, number, number];
}
/** Root `width` / `height` (unitless or `px`), else the `viewBox` size. */
export function svgDimensions(source: string): { width: number; height: number } | null {
  const root = /<svg\b([^>]*)>/i.exec(source)?.[1] ?? "";
  const attr = (name: string) => new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, "i").exec(root)?.[2];
  return size(attr("width"), attr("height"), attr("viewBox"));
}
function size(w?: string, h?: string, viewBox?: string): { width: number; height: number } | null {
  const px = (v?: string) => (v && /^\s*[\d.]+(?:px)?\s*$/.test(v) ? Number.parseFloat(v) : undefined);
  const box = viewBox
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  const vw = box?.length === 4 && box[2]! > 0 ? box[2] : undefined,
    vh = box?.length === 4 && box[3]! > 0 ? box[3] : undefined;
  let width = px(w),
    height = px(h);
  if (width === undefined && height !== undefined && vw && vh) width = (height * vw) / vh;
  if (height === undefined && width !== undefined && vw && vh) height = (width * vh) / vw;
  width ??= vw;
  height ??= vh;
  return width && height ? { width: Math.round(width), height: Math.round(height) } : null;
}

const stemPrefix = (file: string, source: string) =>
  (file.split(/[\\/]/).pop() ?? "svg").replace(/\.svg$/i, "").replace(/[^\w-]/g, "_") + "-" + hash(source).slice(0, 5);
function config(file: string, source: string, options: SvgoOptions, kind: SvgKind, directives: SvgDirectives, extra: PluginConfig[]): Config {
  const prefix = directives.prefixIds ?? options.prefixIds ?? kind === "inline";
  return {
    path: file,
    multipass: options.multipass ?? true,
    floatPrecision: options.floatPrecision ?? 3,
    plugins: [
      ...(options.plugins ?? svgoPlugins(kind)),
      ...extra,
      ...(prefix
        ? [{ name: "prefixIds", params: { prefix: prefix === true ? stemPrefix(file, source) : prefix, delim: "_", prefixClassNames: false } } as PluginConfig]
        : []),
    ],
  };
}

/** Optimised, sanitised SVG file bytes (`svgo: false` → only sanitised). Script never runs from an `<img>`, but a
 * hashed asset opened directly runs on the page's origin: scripts, `on*` attributes and script URLs are removed. */
export async function optimizeSvg(file: string, source: string, options: SvgoOptions | false): Promise<{ data: string; warnings: string[] }> {
  const { optimize } = await load();
  const warnings: string[] = [];
  const data = optimize(source, config(file, source, options === false ? { plugins: [] } : options, "file", {}, [sanitizer(file, "file", {}, warnings)])).data;
  return { data, warnings };
}

/** Elements never inlined: script / embedded documents, and `<style>` (inline styles are inlined into attributes by
 * svgo first; a page `<style>` would also need a CSP nonce). Files keep `<style>`. */
const DROP = new Set(["script", "style", "iframe", "frame", "frameset", "embed", "object", "link", "meta", "base", "handler", "listener"]);
const URL_ATTRS = new Set(["href", "xlink:href", "src", "action", "formaction", "to", "from", "by", "values"]);
const unsafeScheme = (value: string, kind: SvgKind) =>
  (kind === "inline" ? /^(?:javascript|vbscript|data):/i : /^(?:javascript|vbscript):/i).test(value.replace(/[\u0000-\u0020\u007f]/g, ""));
const PAINT = ["fill", "stroke", "stop-color", "flood-color", "lighting-color", "color"];
const KEEP_PAINT = /^(?:none|transparent|currentcolor|inherit|url\()/i;

function sanitizer(file: string, kind: SvgKind, directives: SvgDirectives, warnings: string[]): PluginConfig {
  const where = kind === "inline" ? "inline SVG" : "SVG asset";
  return {
    name: "rivet-sanitize",
    fn: () => ({
      element: {
        enter(node: XastElement, parent: XastParent) {
          const tag = node.name.toLowerCase();
          if (DROP.has(tag) && (kind === "inline" || tag !== "style")) {
            const text = node.children.some((c) => (c.type === "text" || c.type === "cdata") && c.value.trim());
            if (tag !== "style") warnings.push(`${file}: <${node.name}> removed from ${where}`);
            else if (text) warnings.push(`${file}: <style> rules svgo could not inline were dropped (inline SVG takes no stylesheet)`);
            parent.children = parent.children.filter((child) => child !== node);
            return;
          }
          for (const name of Object.keys(node.attributes)) {
            const value = node.attributes[name]!;
            if (/^on/i.test(name)) {
              warnings.push(`${file}: event attribute ${name} removed from ${where}`);
              delete node.attributes[name];
            } else if (URL_ATTRS.has(name.toLowerCase()) && unsafeScheme(value, kind)) {
              if (/^\s*data:image\//i.test(value) && tag === "image")
                throw new Error(
                  `${file}: embedded data: image in <image ${name}> cannot be inlined (unsafe URL rule); import the SVG with ?image or reference the raster file`,
                );
              warnings.push(`${file}: unsafe ${name} URL removed from ${where}`);
              delete node.attributes[name];
            } else if (kind === "inline" && (name.startsWith("xmlns") || (name.includes(":") && !/^(?:xlink|xml):/.test(name)))) delete node.attributes[name];
          }
          if (directives.currentColor)
            for (const name of PAINT) {
              const value = node.attributes[name];
              if (value !== undefined && !KEEP_PAINT.test(value.trim())) node.attributes[name] = "currentColor";
            }
        },
      },
    }),
  };
}

export interface InlineSvg {
  /** TSX module source of the component. */
  tsx: string;
  warnings: string[];
}
/**
 * Optimise + sanitise an SVG and write it as a TSX component module: root attributes, then the caller's props
 * (`class`, `style` objects, `aria-*`, …), `size` → width + height, `title` → `<title>` + `role="img"`,
 * otherwise `aria-hidden="true"`. Children are static JSX (one hoisted template per target).
 */
export async function inlineSvg(file: string, source: string, options: SvgoOptions | false, directives: SvgDirectives): Promise<InlineSvg> {
  const { optimize } = await load();
  const warnings: string[] = [];
  let tree: XastRoot | undefined;
  const sanitize = sanitizer(file, "inline", directives, warnings);
  const capture: PluginConfig = { name: "rivet-capture", fn: (root: XastRoot) => void (tree = root) };
  const optimizeOptions = options === false ? { plugins: [] } : options;
  optimize(source, config(file, source, optimizeOptions, "inline", directives, [sanitize, capture]));
  const svg = tree?.children.find((c): c is XastElement => c.type === "element" && c.name === "svg");
  if (!svg) throw new Error(`${file}: no <svg> root element`);
  if (directives.currentColor && svg.attributes.fill === undefined) svg.attributes.fill = "currentColor";
  const dims = size(svg.attributes.width, svg.attributes.height, svg.attributes.viewBox);
  const attrs = Object.entries(svg.attributes)
    .filter(([name]) => name !== "width" && name !== "height")
    .map(([name, value]) => attribute(name, value))
    .join("");
  const w = dims ? String(dims.width) : "undefined",
    h = dims ? String(dims.height) : "undefined";
  const tsx = `// Generated from ${JSON.stringify(file)} by @rivetjs/compiler images (?svg). Do not edit.
const own = (p) => {
  const labelled = p.title || p["aria-label"] || p["aria-labelledby"];
  return { size: undefined, title: undefined, width: p.size ?? p.width ?? ${w}, height: p.size ?? p.height ?? ${h}, role: p.role ?? (labelled ? "img" : undefined), "aria-hidden": p["aria-hidden"] ?? (labelled ? undefined : "true") };
};
export default function Svg(props = {}) {
  return <svg${attrs} {...props} {...own(props)}>{props.title ? <title>{props.title}</title> : null}${children(svg.children)}</svg>;
}
`;
  return { tsx, warnings };
}

function attribute(name: string, value: string): string {
  if (!/^[A-Za-z_][\w.-]*(?::[\w.-]+)?$/.test(name)) return "";
  if (name === "style") {
    const entries = value
      .split(";")
      .map((decl) => decl.split(/:(.*)/s).map((s) => s.trim()))
      .filter(([k, v]) => k && v);
    return entries.length ? ` style={{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ")} }}` : "";
  }
  return ` ${name}="${value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`;
}
const text = (value: string) =>
  value.replace(/\s+/g, " ").replace(/[&<>{}]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "{": "&#123;", "}": "&#125;" })[c]!);
function children(nodes: XastChild[]): string {
  let out = "";
  for (const node of nodes) {
    if (node.type === "text" || node.type === "cdata") out += text(node.value);
    else if (node.type === "element") {
      const attrs = Object.entries(node.attributes)
        .map(([name, value]) => attribute(name, value))
        .join("");
      out += node.children.length ? `<${node.name}${attrs}>${children(node.children)}</${node.name}>` : `<${node.name}${attrs} />`;
    }
  }
  return out;
}
