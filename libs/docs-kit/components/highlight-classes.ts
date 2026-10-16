// Code highlighting shared by the build and the browser. Pages ship plain code (`<pre data-lang>` of
// `span.line`s); the browser highlighter (highlighter.ts, one lazy shared chunk) colours visible blocks with
// these classes, and the build writes their rules (`src/generated/highlight.css`, tools/content/highlight.ts)
// from the two themes' palettes. Fragments (`content/_*.md`, lean pages with no browser highlighter) are
// tokenized at build time with the same classes (highlighter.ts `loadTokenizer`).

export const THEMES = { light: "github-light", dark: "github-dark" } as const;
/** Languages the browser highlighter loads (on demand, one grammar chunk each). */
export const LANGS = ["tsx", "ts", "jsx", "js", "json", "css", "html", "bash", "diff", "md", "yaml", "toml", "dockerfile"] as const;
export type Lang = (typeof LANGS)[number];
const ALIASES: Record<string, string> = {
  typescript: "ts",
  javascript: "js",
  mjs: "js",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  markdown: "md",
  yml: "yaml",
  text: "txt",
  plain: "txt",
};
/** Fence / file-extension language → a highlighted language, or undefined (shown as plain text). */
export function langOf(lang: string): Lang | undefined {
  const normalized = ALIASES[lang] ?? lang;
  return (LANGS as readonly string[]).includes(normalized) ? (normalized as Lang) : undefined;
}

/** Compiler-inserted names in compiled output (`<pre data-rv>`): marked `code-rv`. */
export const COMPILER_NAME = /(__rivet\w*|_el\$\d+)/;

const hex = (color: string) => color.replace(/^#/, "").toLowerCase();
export const lightClass = (color: string) => "hl-" + hex(color);
export const darkClass = (color: string) => "hd-" + hex(color);
/** Font style bits (TextMate: 1 italic, 2 bold, 4 underline) → class. */
export const STYLE_CLASSES = [
  [1, "hi", "font-style:italic"],
  [2, "hb", "font-weight:600"],
  [4, "hu", "text-decoration:underline"],
] as const;

/**
 * Classes of one token: none when both themes use their default foreground and no font style; otherwise the light
 * and dark colour classes (both, so a token whose light colour is the theme default still gets that colour, as before)
 * and its style classes.
 */
export function tokenClass(light: string, dark: string, style: number, fg: { light: string; dark: string }): string {
  if (hex(light) === hex(fg.light) && hex(dark) === hex(fg.dark) && !style) return "";
  let cls = lightClass(light) + " " + darkClass(dark);
  for (const [bit, name] of STYLE_CLASSES) if (style & bit) cls += " " + name;
  return cls;
}
