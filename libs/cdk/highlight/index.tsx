// Rivet-authored (no React Aria / Angular CDK counterpart): a small regex tokenizer for code in AI responses. Feature set
// (syntax-highlighted code blocks for common languages) inspired by HeroUI Pro's public CodeBlock docs, which use Shiki;
// this is an independent, dependency-free implementation: no grammar files, no WASM, synchronous, same output on the
// server and in the browser. Tokens are plain data (`{ type, value }`); renderers wrap them in spans (no HTML strings).
// - Languages: JavaScript / TypeScript (+ JSX / TSX), JSON, CSS / SCSS, HTML / XML / SVG / Vue, shell, Python, SQL,
//   YAML, diff, and a C-family fallback (Rust, Go, Java, C, C++, C#, Kotlin, Swift, PHP, Ruby, Dart); anything else is
//   plain text. `resolveLanguage` maps aliases (`ts`, `sh`, `py`, …).
// - Joining every token `value` gives the input back exactly.

export type CodeTokenType =
  | "plain"
  | "comment"
  | "string"
  | "number"
  | "keyword"
  | "literal"
  | "type"
  | "function"
  | "property"
  | "operator"
  | "punctuation"
  | "tag"
  | "attribute"
  | "variable"
  | "inserted"
  | "deleted"
  | "meta";

export interface CodeToken {
  type: CodeTokenType;
  value: string;
}

export type CodeLanguage = "js" | "json" | "css" | "markup" | "shell" | "python" | "sql" | "yaml" | "diff" | "clike" | "plaintext";

const ALIASES: Record<string, CodeLanguage> = {
  js: "js",
  javascript: "js",
  jsx: "js",
  mjs: "js",
  cjs: "js",
  ts: "js",
  typescript: "js",
  tsx: "js",
  mts: "js",
  cts: "js",
  json: "json",
  jsonc: "json",
  json5: "json",
  css: "css",
  scss: "css",
  sass: "css",
  less: "css",
  postcss: "css",
  html: "markup",
  xml: "markup",
  svg: "markup",
  vue: "markup",
  svelte: "markup",
  astro: "markup",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  shell: "shell",
  console: "shell",
  shellscript: "shell",
  terminal: "shell",
  py: "python",
  python: "python",
  sql: "sql",
  postgres: "sql",
  postgresql: "sql",
  mysql: "sql",
  sqlite: "sql",
  yaml: "yaml",
  yml: "yaml",
  toml: "yaml",
  diff: "diff",
  patch: "diff",
  rust: "clike",
  rs: "clike",
  go: "clike",
  golang: "clike",
  java: "clike",
  c: "clike",
  h: "clike",
  cpp: "clike",
  "c++": "clike",
  cs: "clike",
  csharp: "clike",
  kotlin: "clike",
  kt: "clike",
  swift: "clike",
  php: "clike",
  ruby: "clike",
  rb: "clike",
  dart: "clike",
  scala: "clike",
};

/** Tokenizer family for a language id / alias (`"ts"` → `"js"`); unknown ids → `"plaintext"`. */
export function resolveLanguage(language: string | undefined): CodeLanguage {
  return (language && ALIASES[language.trim().toLowerCase()]) || "plaintext";
}

/** Display name for a language id (`"ts"` → `"TypeScript"`); unknown ids are returned as given. */
export function languageLabel(language: string | undefined): string {
  const id = (language ?? "").trim().toLowerCase();
  const names: Record<string, string> = {
    js: "JavaScript",
    javascript: "JavaScript",
    jsx: "JSX",
    ts: "TypeScript",
    typescript: "TypeScript",
    tsx: "TSX",
    json: "JSON",
    css: "CSS",
    scss: "SCSS",
    html: "HTML",
    xml: "XML",
    svg: "SVG",
    vue: "Vue",
    sh: "Shell",
    bash: "Bash",
    zsh: "Zsh",
    shell: "Shell",
    console: "Console",
    py: "Python",
    python: "Python",
    sql: "SQL",
    yaml: "YAML",
    yml: "YAML",
    toml: "TOML",
    diff: "Diff",
    rust: "Rust",
    rs: "Rust",
    go: "Go",
    java: "Java",
    c: "C",
    cpp: "C++",
    cs: "C#",
    csharp: "C#",
    kotlin: "Kotlin",
    swift: "Swift",
    php: "PHP",
    ruby: "Ruby",
    dart: "Dart",
    "": "Text",
    text: "Text",
    plaintext: "Text",
    txt: "Text",
  };
  return names[id] ?? language ?? "Text";
}

type Rule = [CodeTokenType | "ident", RegExp];

const words = (list: string): Set<string> => new Set(list.split(" "));

const JS_KEYWORDS = words(
  "abstract as async await break case catch class const constructor continue debugger declare default delete do else enum export extends finally for from function get if implements import in infer instanceof interface is keyof let module namespace new of override private protected public readonly return satisfies set static super switch this throw try type typeof var void while with yield",
);
const JS_LITERALS = words("true false null undefined NaN Infinity");
const PY_KEYWORDS = words(
  "and as assert async await break class continue def del elif else except finally for from global if import in is lambda match case nonlocal not or pass raise return try while with yield",
);
const PY_LITERALS = words("True False None self cls");
const SHELL_KEYWORDS = words(
  "if then else elif fi for while until do done case esac in function select return exit export local readonly unset source alias sudo",
);
const SQL_KEYWORDS = words(
  "select from where and or not insert into values update set delete create table index view drop alter add column primary key foreign references join left right inner outer full on group by order having limit offset as distinct union all exists in is like between case when then else end returning with default unique check constraint begin commit rollback transaction asc desc count sum avg min max",
);
const SQL_LITERALS = words("null true false");
const CLIKE_KEYWORDS = words(
  "abstract as async await break case catch class const continue crate def default defer do dyn else enum extends extern final finally fn for foreach func go goto if impl implements import in interface internal let loop match mod module move mut namespace new nil override package private protected pub public readonly ref return select self Self sealed static struct super switch template this throw throws trait try type typedef typename union unsafe use using var virtual void volatile when where while yield val fun object companion lateinit init deinit guard protocol extension elif elsif unless until begin end require include echo function",
);
const CLIKE_LITERALS = words("true false null nullptr nil None NULL");
const CLIKE_TYPES = words(
  "int long short char byte bool boolean float double string String str usize isize u8 u16 u32 u64 u128 i8 i16 i32 i64 i128 f32 f64 void auto Vec Option Result Box Some Ok Err error any rune uint uint8 uint16 uint32 uint64 int8 int16 int32 int64 float32 float64 object dynamic",
);

const NUMBER = /(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?)n?/y;
const IDENT = /[A-Za-z_$][\w$]*/y;
const SPACE = /\s+/y;

const GRAMMARS: Record<Exclude<CodeLanguage, "plaintext" | "diff">, Rule[]> = {
  js: [
    ["comment", /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/y],
    ["string", /`(?:\\[\s\S]|\$\{[^}]*\}|[^\\`])*`?|"(?:\\.|[^\\"\n])*"?|'(?:\\.|[^\\'\n])*'?/y],
    ["tag", /(?<![\w$)\]])<\/?(?=[A-Za-z])[\w.:-]*|\/>/y],
    ["number", NUMBER],
    ["ident", IDENT],
    ["operator", /=>|\?\?=?|\?\.|\.\.\.|[=!]==?|[<>]=?|&&=?|\|\|=?|[-+*/%&|^~!?:]=?|=/y],
    ["punctuation", /[{}()[\];,.@#]/y],
  ],
  json: [
    ["comment", /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/y],
    ["property", /"(?:\\.|[^\\"\n])*"(?=\s*:)/y],
    ["string", /"(?:\\.|[^\\"\n])*"?/y],
    ["number", /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y],
    ["literal", /\b(?:true|false|null)\b/y],
    ["punctuation", /[{}[\],:]/y],
  ],
  css: [
    ["comment", /\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*/y],
    ["string", /"(?:\\.|[^\\"\n])*"?|'(?:\\.|[^\\'\n])*'?/y],
    ["keyword", /@[\w-]+/y],
    ["property", /--?[A-Za-z][\w-]*(?=\s*:(?!:))/y],
    ["number", /#[\da-fA-F]{3,8}\b|-?(?:\d+\.?\d*|\.\d+)(?:%|[a-zA-Z]+)?/y],
    ["function", /[\w-]+(?=\()/y],
    ["variable", /\$[\w-]+|--[\w-]+/y],
    ["tag", /[.#][A-Za-z_-][\w-]*|&/y],
    ["plain", /[A-Za-z_-][\w-]*/y],
    ["punctuation", /[{}()[\];:,>+~*=]/y],
  ],
  markup: [
    ["comment", /<!--[\s\S]*?(?:-->|$)/y],
    ["meta", /<![^>]*>?|<\?[\s\S]*?(?:\?>|$)/y],
    ["tag", /<\/?[A-Za-z][\w.:-]*|\/?>/y],
    ["attribute", /[A-Za-z_:@#.][\w:.-]*(?=\s*=)/y],
    ["string", /"[^"]*"?|'[^']*'?/y],
    ["operator", /=/y],
    ["plain", /[^<"'=\s/>]+/y],
  ],
  shell: [
    ["comment", /(?<![^\s;])#[^\n]*/y],
    ["string", /"(?:\\.|[^\\"])*"?|'[^']*'?/y],
    ["variable", /\$(?:\{[^}]*\}?|\w+|[@#?$!*-])/y],
    ["attribute", /(?<=\s)--?[\w-]+/y],
    ["meta", /^(?:\$|>|#) /my],
    ["number", /\b\d+\b/y],
    ["ident", /[A-Za-z_][\w.-]*/y],
    ["operator", /&&|\|\||[|&;<>]=?|=/y],
    ["punctuation", /[(){}[\]]/y],
  ],
  python: [
    ["comment", /#[^\n]*/y],
    ["string", /[rRbBfFuU]{0,2}(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^\\"\n])*"?|'(?:\\.|[^\\'\n])*'?)/y],
    ["meta", /@[\w.]+/y],
    ["number", NUMBER],
    ["ident", IDENT],
    ["operator", /\*\*=?|\/\/=?|->|:=|[=!<>]=?|[-+*/%&|^~@]=?/y],
    ["punctuation", /[{}()[\];,.:]/y],
  ],
  sql: [
    ["comment", /--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/y],
    ["string", /'(?:''|[^'])*'?|"(?:""|[^"])*"?/y],
    ["number", /\b\d+(?:\.\d+)?\b/y],
    ["ident", /[A-Za-z_][\w$]*/y],
    ["operator", /[<>!]=?|=|\|\||[-+*/%]/y],
    ["punctuation", /[(),;.]/y],
  ],
  yaml: [
    ["comment", /#[^\n]*/y],
    ["meta", /^---$|^\.\.\.$|^\[[^\]\n]*\]$/my],
    ["property", /[\w.-]+(?=\s*[:=](?:\s|$))|"[^"\n]*"(?=\s*:)/y],
    ["string", /"(?:\\.|[^\\"\n])*"?|'(?:''|[^'\n])*'?/y],
    ["literal", /\b(?:true|false|null|yes|no|on|off)\b|~/y],
    ["number", /-?\b\d+(?:\.\d+)?\b/y],
    ["variable", /[&*][\w-]+/y],
    ["punctuation", /[-:[\]{},|>=]/y],
    ["plain", /[^\s#:"'[\]{},]+/y],
  ],
  clike: [
    ["comment", /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|#(?!\[)[^\n]*/y],
    ["string", /r#*"[\s\S]*?"#*|"(?:\\.|[^\\"\n])*"?|`[^`]*`?|'(?:\\.|[^\\'\n]){0,2}'/y],
    ["meta", /#\[[^\]\n]*\]?|@\w+/y],
    ["number", NUMBER],
    ["ident", IDENT],
    ["operator", /::|->|=>|\.\.=?|[=!<>]=?|&&|\|\||[-+*/%&|^~!?]=?|:=?/y],
    ["punctuation", /[{}()[\];,.]/y],
  ],
};

function classify(language: CodeLanguage, word: string, rest: string, prev: CodeToken | undefined, lineStart: boolean): CodeTokenType {
  const call = /^\s*\(/.test(rest);
  const afterDot = prev?.type === "punctuation" && prev.value === ".";
  if (language === "js") {
    if (afterDot) return call ? "function" : "property";
    if (JS_KEYWORDS.has(word)) return "keyword";
    if (JS_LITERALS.has(word)) return "literal";
    if (call) return "function";
    if (/^[A-Z]/.test(word)) return "type";
    if (/^\s*:(?!:)/.test(rest) && prev?.value !== "?" && prev?.type !== "operator") return "property";
    return "plain";
  }
  if (language === "python") {
    if (afterDot) return call ? "function" : "property";
    if (PY_KEYWORDS.has(word)) return "keyword";
    if (PY_LITERALS.has(word)) return "literal";
    if (call || prev?.value === "def") return "function";
    if (/^[A-Z]/.test(word) || prev?.value === "class") return "type";
    return "plain";
  }
  if (language === "shell") {
    if (SHELL_KEYWORDS.has(word)) return "keyword";
    // The command word of a line / after a pipe, `&&`, `;` or a prompt.
    if (lineStart || prev?.type === "operator" || prev?.type === "meta") return "function";
    return "plain";
  }
  if (language === "sql") {
    const lower = word.toLowerCase();
    if (SQL_KEYWORDS.has(lower)) return "keyword";
    if (SQL_LITERALS.has(lower)) return "literal";
    if (call) return "function";
    return "plain";
  }
  // clike
  if (afterDot) return call ? "function" : "property";
  if (CLIKE_KEYWORDS.has(word)) return "keyword";
  if (CLIKE_LITERALS.has(word)) return "literal";
  if (CLIKE_TYPES.has(word) || /^[A-Z][a-z]/.test(word)) return "type";
  if (call || /^!\s*\(/.test(rest)) return "function";
  return "plain";
}

/** Tokenize `code` for `language` (id or alias). Unknown languages give one plain token. */
export function highlight(code: string, language?: string): CodeToken[] {
  const lang = resolveLanguage(language);
  if (lang === "plaintext") return code ? [{ type: "plain", value: code }] : [];
  if (lang === "diff") return highlightDiff(code);
  const rules = GRAMMARS[lang];
  const out: CodeToken[] = [];
  const push = (type: CodeTokenType, value: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type && (type === "plain" || type === "punctuation")) last.value += value;
    else out.push({ type, value });
  };
  let prev: CodeToken | undefined;
  let lineStart = true;
  let i = 0;
  while (i < code.length) {
    SPACE.lastIndex = i;
    const space = SPACE.exec(code);
    if (space) {
      push("plain", space[0]);
      if (space[0].includes("\n")) lineStart = true;
      i += space[0].length;
      continue;
    }
    let matched = false;
    for (const [type, re] of rules) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (!m || !m[0]) continue;
      const value = m[0];
      const resolved = type === "ident" ? classify(lang, value, code.slice(i + value.length, i + value.length + 3), prev, lineStart) : type;
      push(resolved, value);
      prev = { type: resolved, value };
      lineStart = false;
      i += value.length;
      matched = true;
      break;
    }
    if (!matched) {
      push("plain", code[i]!);
      prev = { type: "plain", value: code[i]! };
      lineStart = false;
      i++;
    }
  }
  return out;
}

function highlightDiff(code: string): CodeToken[] {
  const out: CodeToken[] = [];
  const lines = code.split(/(?<=\n)/);
  for (const line of lines) {
    const type: CodeTokenType = /^(?:\+\+\+|---|@@|diff |index )/.test(line)
      ? "meta"
      : line.startsWith("+")
        ? "inserted"
        : line.startsWith("-")
          ? "deleted"
          : "plain";
    out.push({ type, value: line });
  }
  return out;
}
