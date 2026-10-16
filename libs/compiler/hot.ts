// Dev-server hot replacement for compiled client modules (see @rivetjs/runtime/hot). Exported
// components (capitalized function exports, the default function and a default arrow) become stable `hot()` wrappers
// and the module accepts its own updates; when its other exports change, it invalidates, so the
// update reaches importers as before. Anything this does not recognize leaves the module unchanged.

const NAME = /^[A-Z][\w$]*$/;
const REGEX_AFTER_WORD = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"]);

/**
 * Lexical scan of compiled JS (T6): which lines start in top-level code (bracket depth 0, outside
 * strings, template literals, comments and regex literals), and the offsets of depth-0 `,` / `;`.
 * Lines inside a template literal that happen to start with `export ` are never rewritten.
 */
export function topLevel(code: string): { lines: boolean[]; commas: number[]; semis: number[] } {
  const lines: boolean[] = [true];
  const commas: number[] = [];
  const semis: number[] = [];
  // Open brackets; `$` marks a template literal `${`, "`" a template literal body.
  const stack: string[] = [];
  let prev = ""; // previous significant character (regex vs division)
  let word = ""; // previous identifier-ish word
  const n = code.length;
  let i = 0;
  const newline = () => lines.push(stack.length === 0);
  // Scan a template body from i (after the backtick or `}`) until "`" or "${".
  const template = () => {
    while (i < n) {
      const c = code[i]!;
      if (c === "\\") {
        if (code[i + 1] === "\n") lines.push(false);
        i += 2;
      } else if (c === "`") {
        i++;
        stack.pop();
        prev = ")";
        return;
      } else if (c === "$" && code[i + 1] === "{") {
        i += 2;
        stack.push("$");
        prev = "{";
        return;
      } else {
        if (c === "\n") lines.push(false);
        i++;
      }
    }
  };
  while (i < n) {
    const c = code[i]!;
    if (c === "\n") {
      newline();
      i++;
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") {
      i++;
      continue;
    }
    if (c === "/" && code[i + 1] === "/") {
      while (i < n && code[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && code[i + 1] === "*") {
      const end = code.indexOf("*/", i + 2);
      const stop = end < 0 ? n : end + 2;
      for (let k = i; k < stop; k++) if (code[k] === "\n") lines.push(false);
      i = stop;
      continue;
    }
    if (c === '"' || c === "'") {
      i++;
      while (i < n && code[i] !== c && code[i] !== "\n") i += code[i] === "\\" ? 2 : 1;
      i++;
      prev = ")";
      word = "";
      continue;
    }
    if (c === "`") {
      i++;
      stack.push("`");
      template();
      word = "";
      continue;
    }
    if (c === "/" && (prev === "" || "(,=:[!&|?{};+-*%<>~^".includes(prev) || REGEX_AFTER_WORD.has(word))) {
      // Regex literal (classes may hold `/`).
      i++;
      let inClass = false;
      while (i < n && code[i] !== "\n") {
        const r = code[i]!;
        if (r === "\\") i++;
        else if (r === "[") inClass = true;
        else if (r === "]") inClass = false;
        else if (r === "/" && !inClass) break;
        i++;
      }
      i++;
      while (i < n && /[a-z]/i.test(code[i]!)) i++;
      prev = ")";
      word = "";
      continue;
    }
    if (c === "(" || c === "[" || c === "{") stack.push(c);
    else if (c === ")" || c === "]") stack.pop();
    else if (c === "}") {
      if (stack.pop() === "$") {
        // Back into the template body.
        i++;
        template();
        word = "";
        continue;
      }
    } else if (stack.length === 0 && c === ",") commas.push(i);
    else if (stack.length === 0 && c === ";") semis.push(i);
    if (/[\w$]/.test(c)) {
      let j = i;
      while (j < n && /[\w$]/.test(code[j]!)) j++;
      word = code.slice(i, j);
      prev = "a";
      i = j;
      continue;
    }
    prev = c;
    word = "";
    i++;
  }
  return { lines, commas, semis };
}

/**
 * Hot module source for compiled `code`, or null when the module is left to normal propagation.
 * `locals`: names a resume-mode compile exports for its symbol chunks (dev resume); still exported,
 * but a change in them does not make importers update.
 */
export function hotModule(code: string, id: string, source = code, locals?: ReadonlySet<string>): string | null {
  const lines = code.split("\n");
  const scan = topLevel(code);
  const starts: number[] = [];
  for (let i = 0, at = 0; i < lines.length; at += lines[i]!.length + 1, i++) starts.push(at);
  /** Two or more declarators (`export const A = …, B = 1`): a depth-0 comma before the statement's `;`. */
  const multiple = (i: number) => {
    const from = starts[i]!;
    const end = scan.semis.find((s) => s > from) ?? code.length;
    return scan.commas.some((c) => c > from && c < end);
  };
  const components: { local: string; exported: string }[] = [];
  const values: string[] = [];
  const names: string[] = [];
  const listed: string[] = []; // `name: local` entries from export lists
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.startsWith("export ") || !scan.lines[i]) continue;
    // Blank `export ` (same width: generated source maps keep their columns).
    const strip = (prefix: string) => (lines[i] = " ".repeat(prefix.length) + line.slice(prefix.length));
    let m: RegExpExecArray | null;
    if ((m = /^export default function\s*\*?\s*([A-Za-z_$][\w$]*)?\s*\(/.exec(line))) {
      if (line.includes("function*")) return null;
      if (m[1]) strip("export default ");
      // Same width as the prefix (`function __rivetDefault` is 23 chars, `export default function` too):
      // the parameter list keeps its column (T9; was one column right).
      else lines[i] = line.replace(/^export default function\s*/, (head) => " ".repeat(Math.max(0, head.length - 23)) + "function __rivetDefault");
      components.push({ local: m[1] ?? "__rivetDefault", exported: "default" });
    } else if (/^export default (?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/.test(line)) {
      // Arrow default (`export default () => …`): bound to a local of the same width as the prefix.
      lines[i] = "let __rivetDef=" + line.slice("export default ".length);
      components.push({ local: "__rivetDef", exported: "default" });
    } else if ((m = /^export default ([A-Za-z_$][\w$]*);\s*$/.exec(line))) {
      lines[i] = "";
      components.push({ local: m[1]!, exported: "default" });
    } else if ((m = /^export function ([A-Za-z_$][\w$]*)\s*\(/.exec(line))) {
      if (NAME.test(m[1]!)) {
        strip("export ");
        components.push({ local: m[1]!, exported: m[1]! });
      } else values.push(m[1]!);
    } else if ((m = /^export (const|let|var) ([A-Za-z_$][\w$]*)\s*=/.exec(line))) {
      // Several declarators: blanking `export` would drop the others' exports — leave the module alone.
      if (multiple(i)) return null;
      const name = m[2]!;
      // `export let`: reassignable — a wrapper would freeze the live binding, so it stays a value.
      if (m[1] !== "let" && NAME.test(name) && /=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>|=\s*function\b/.test(line)) {
        strip("export ");
        components.push({ local: name, exported: name });
      } else values.push(name);
    } else if ((m = /^export \{([^}]*)\};?\s*$/.exec(line))) {
      // A local export list (e.g. bindings the compiler exports for symbol chunks): plain values.
      for (const entry of m[1]!
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)) {
        const spec = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(entry);
        if (!spec || spec[2] === "default") return null;
        names.push(spec[2] ?? spec[1]!);
        if (!spec[2] && locals?.has(spec[1]!)) continue;
        listed.push(spec[2] ? `${spec[2]}: ${spec[1]}` : spec[1]!);
      }
    } else if (/^export (?:async function|class) ([A-Za-z_$][\w$]*)/.test(line)) {
      values.push(/^export (?:async function|class) ([A-Za-z_$][\w$]*)/.exec(line)![1]!);
    } else return null;
  }
  if (!components.length) return null;
  const reset = /@refresh reset\b/.test(source);
  names.unshift(...components.map((c) => c.exported), ...values);
  const wrappers = components.map((c, n) => `const __rivetHot${n} = __rivetHot(${c.local}, ${JSON.stringify(id + "#" + c.exported)}${reset ? ", true" : ""});`);
  return [
    ...lines,
    `import { hot as __rivetHot, changed as __rivetChanged } from "@rivetjs/runtime/hot";`,
    ...wrappers,
    `export { ${components.map((c, n) => `__rivetHot${n} as ${c.exported}`).join(", ")} };`,
    "if (import.meta.hot) {",
    `  const __rivetValues = { ${[...values, ...listed].join(", ")} };`,
    `  import.meta.hot.accept((next) => { if (!next || __rivetChanged(__rivetValues, next, ${JSON.stringify(names)})) import.meta.hot.invalidate(); });`,
    "}",
    "",
  ].join("\n");
}

const DECLARED_FUNCTION = /^(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s*\*?\s*([A-Z][\w$]*)\s*[<(]/;
const DECLARED_BINDING = /^(?:export\s+)?(?:const|let|var)\s+([A-Z][\w$]*)\b/;

/**
 * Dev client (DIAG-VERBOSE): a statement to append to a compiled module that records where its components are declared,
 * for dev warnings (`@rivetjs/runtime/dev` names `<Card> (src/card.tsx:12:17)`): every capitalized top-level function /
 * `const` / `let` / `var` of `source` (declarations starting at column 0) that is a function at module end goes into the
 * process-wide `globalThis[Symbol.for("rivet.sources")]` WeakMap (function → [name, "file:line:col"]), and so does the
 * `hot()` wrapper `hotModule` made for it (`const __rivetHotN = __rivetHot(Local, …)` in `code`). "" when none.
 */
export function sourceStamps(source: string, file: string, code: string): string {
  const found = new Map<string, string>();
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const m = DECLARED_FUNCTION.exec(line) ?? DECLARED_BINDING.exec(line);
    if (m && !found.has(m[1]!)) found.set(m[1]!, `${file}:${i + 1}:${m[0].lastIndexOf(m[1]!) + 1}`);
  }
  if (!found.size) return "";
  const entries: string[] = [];
  for (const [name, at] of found) entries.push(`typeof ${name} === "function" && m.set(${name}, ${JSON.stringify([name, at])});`);
  for (const [, wrapper, local] of code.matchAll(/^const (__rivetHot\d+) = __rivetHot\(([A-Za-z_$][\w$]*), /gm))
    if (found.has(local!)) entries.push(`m.set(${wrapper}, ${JSON.stringify([local, found.get(local!)])});`);
  return `\n;((m) => { ${entries.join(" ")} })(globalThis[Symbol.for("rivet.sources")] ??= new WeakMap());\n`;
}
