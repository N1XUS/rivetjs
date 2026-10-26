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

/**
 * Theme colours below WCAG AA (4.5:1) on `--bg-code` (theme.css), replaced by the nearest GitHub Primer colour of the
 * same hue; the class keeps the theme colour's name (`hl-d73a49`), so browser-coloured and build-coloured blocks agree.
 * tests/contrast.test.ts checks every token colour after this map, both themes.
 */
export const AA_COLORS: { light: Record<string, string>; dark: Record<string, string> } = {
  light: { "#d73a49": "#cf222e", "#22863a": "#1a7f37", "#e36209": "#bc4c00" },
  dark: { "#6a737d": "#8b949e" },
};

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

/** The highlight of compiler names (`COMPILER_NAME` in `<pre data-rv>`), painted above the token colours. */
export const RV_HIGHLIGHT = "code-rv";
/**
 * The CSS Custom Highlight of one token class list (`tokenClass`) or `RV_HIGHLIGHT`: its name (the classes joined by
 * `_`, a CSS ident) and its `::highlight()` rule. Colour `light-dark(<light>, <dark>)` (AA-mapped, the page's
 * `color-scheme` picks one: the rule also works in a shadow root, where `[data-theme]` selectors cannot reach),
 * `hu` = underline. `::highlight()` takes no font style: italic / bold tokens (`hi` / `hb`, markup only) stay plain.
 */
export function highlightRule(cls: string): [name: string, rule: string] {
  const names = cls.split(" ");
  const name = names.join("_");
  if (cls === RV_HIGHLIGHT) return [name, `::highlight(${name}){color:var(--accent-strong)}`];
  let light = "",
    dark = "",
    decoration = "";
  for (const one of names) {
    const color = "#" + one.slice(3);
    if (one.startsWith("hl-")) light = AA_COLORS.light[color] ?? color;
    else if (one.startsWith("hd-")) dark = AA_COLORS.dark[color] ?? color;
    else if (one === "hu") decoration = ";text-decoration:underline";
  }
  return [name, `::highlight(${name}){color:light-dark(${light || "currentColor"},${dark || "currentColor"})${decoration}}`];
}
