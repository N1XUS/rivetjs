// Text edits of a Vite config (`plugins: [ … ]`, `rivetRouter({ … })`). Configs written by the starters and the
// generators have one `defineConfig({ plugins: [...] })`; edits are idempotent and throw on shapes they cannot edit.

/** Adds `line` after the last top-level import (or at the top). No-op when already present. */
export function addImport(source: string, line: string): string {
  if (source.includes(line)) return source;
  const imports = [...source.matchAll(/^import[^;]*;[^\n]*\n/gm)];
  const last = imports.at(-1);
  if (!last) return line + "\n" + source;
  const at = last.index! + last[0].length;
  return source.slice(0, at) + line + "\n" + source.slice(at);
}

/** Index just inside the `[` of `plugins: [` and of its matching `]`. */
function pluginsArray(source: string): { open: number; close: number } {
  const match = /\bplugins\s*:\s*\[/.exec(source);
  if (!match) throw new Error("vite config: no `plugins: [ … ]` array to edit");
  const open = match.index + match[0].length;
  let depth = 1;
  for (let i = open; i < source.length; i++) {
    const char = source[i];
    if (char === "[" || char === "(" || char === "{") depth++;
    else if (char === "]" || char === ")" || char === "}") {
      depth--;
      if (depth === 0) return { open, close: i };
    }
  }
  throw new Error("vite config: unbalanced `plugins` array");
}

/** Adds a plugin call (`i18n(config)`) first or last in `plugins`. No-op when the call name is already there. */
export function addPlugin(source: string, call: string, position: "first" | "last" = "last"): string {
  const { open, close } = pluginsArray(source);
  const name = call.slice(0, call.indexOf("("));
  const list = source.slice(open, close);
  if (new RegExp(`\\b${name}\\s*\\(`).test(list)) return source;
  if (!list.trim()) return source.slice(0, open) + call + source.slice(close);
  if (position === "first") return source.slice(0, open) + call + ", " + source.slice(open);
  const trimmed = list.replace(/[\s,]*$/, "");
  return source.slice(0, open) + trimmed + ", " + call + source.slice(open + list.length);
}

/** Removes a plugin call (`tailwindcss()`) from `plugins` and the import line matching `importPattern`. */
export function removePlugin(source: string, call: string, importPattern: RegExp): string {
  const { open, close } = pluginsArray(source);
  const list = source.slice(open, close);
  const escaped = call.replace(/[()]/g, "\\$&");
  const next = list.replace(new RegExp(`\\s*,\\s*${escaped}|${escaped}\\s*,\\s*|${escaped}`), "");
  return (source.slice(0, open) + next + source.slice(close)).replace(new RegExp(`^.*${importPattern.source}.*\\n`, "m"), "");
}

/** Start / end (exclusive, at `)`) of the first `rivetRouter(` call's argument text. */
function routerCall(source: string): { start: number; end: number } {
  const match = /\brivetRouter\s*\(/.exec(source);
  if (!match) throw new Error("vite config: no rivetRouter( … ) call to edit");
  const start = match.index + match[0].length;
  let depth = 1;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (char === "(" || char === "[" || char === "{") depth++;
    else if (char === ")" || char === "]" || char === "}") {
      depth--;
      if (depth === 0) return { start, end: i };
    }
  }
  throw new Error("vite config: unbalanced rivetRouter( … ) call");
}

/** Sets (`value` string) or removes (`undefined`) a top-level option of `rivetRouter({ … })` (`mode`, `styles`). */
export function setRouterOption(source: string, key: string, value: string | undefined): string {
  const { start, end } = routerCall(source);
  let args = source.slice(start, end).trim();
  if (!args) args = "{}";
  if (!args.startsWith("{")) throw new Error("vite config: rivetRouter( … ) argument is not an object literal");
  const inner = args.slice(1, -1);
  // Top-level `key: value` inside the object (values here are literals / arrays: no nested commas outside brackets).
  const entries: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of inner) {
    if (char === "[" || char === "{" || char === "(") depth++;
    if (char === "]" || char === "}" || char === ")") depth--;
    if (char === "," && depth === 0) {
      entries.push(current);
      current = "";
    } else current += char;
  }
  entries.push(current);
  const kept = entries.map((entry) => entry.trim()).filter((entry) => entry && !new RegExp(`^${key}\\s*:`).test(entry));
  const next = value === undefined ? kept : key === "mode" ? [`${key}: ${value}`, ...kept] : [...kept, `${key}: ${value}`];
  const text = next.length ? `{ ${next.join(", ")} }` : "";
  return source.slice(0, start) + text + source.slice(end);
}
