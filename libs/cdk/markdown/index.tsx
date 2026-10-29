// Rivet-authored (no React Aria / Angular CDK counterpart): a small, safe Markdown parser for AI responses. Feature set
// scoped from public docs of commercial UI kits (memoized blocks for streaming, incomplete-markdown repair while a
// response streams); independent implementation (no react-markdown / remark / marked / streamdown code).
// - Output is a plain-data AST (no HTML strings): renderers build elements, so nothing is ever parsed as HTML and raw
//   HTML in the source stays text. URLs pass `safeUrl` (http / https / mailto / tel / relative only).
// - Streaming: `splitBlocks(source)` cuts the source into top-level block strings with a cheap line scan; a renderer keys
//   each block by its index + text, so only the block being written re-renders while tokens arrive. `closeOpenMarks`
//   closes `**` / `~~` / `` ` `` left open at the end of the streamed block.
// - CommonMark + GFM subset: ATX / setext headings, paragraphs, hard / soft breaks, emphasis / strong / strikethrough,
//   code spans, fenced code (an unclosed fence runs to the end: `closed: false`), block quotes, nested bullet / ordered
//   / task lists (tight / loose), thematic breaks, GFM tables with alignment, inline links / images, `<url>` and bare
//   http(s) autolinks, backslash escapes. Not supported: reference-style links, footnotes, indented code blocks, HTML.

/* -------------------------------------------------------------------------------------------------
 * AST
 * -----------------------------------------------------------------------------------------------*/
export type MarkdownInline =
  | { type: "text"; value: string }
  | { type: "strong"; children: MarkdownInline[] }
  | { type: "em"; children: MarkdownInline[] }
  | { type: "del"; children: MarkdownInline[] }
  | { type: "code"; value: string }
  | { type: "link"; href: string; title?: string; children: MarkdownInline[] }
  | { type: "image"; src: string; alt: string; title?: string }
  | { type: "br" };

export type MarkdownAlign = "left" | "center" | "right" | null;

export interface MarkdownListItem {
  /** `true` / `false` for a task item (`[x]` / `[ ]`), `undefined` otherwise. */
  checked?: boolean;
  children: MarkdownBlock[];
}

export type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: MarkdownInline[] }
  | { type: "paragraph"; children: MarkdownInline[] }
  | { type: "code"; lang: string; value: string; closed: boolean }
  | { type: "blockquote"; children: MarkdownBlock[] }
  | { type: "list"; ordered: boolean; start: number; tight: boolean; items: MarkdownListItem[] }
  | { type: "table"; align: MarkdownAlign[]; head: MarkdownInline[][]; rows: MarkdownInline[][][] }
  | { type: "hr" };

/* -------------------------------------------------------------------------------------------------
 * Line patterns
 * -----------------------------------------------------------------------------------------------*/
const BLANK = /^[ \t]*$/;
const FENCE = /^( {0,3})(`{3,}|~{3,})[ \t]*([^\s`]*)[^`]*$/;
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^ {0,3}> ?/;
const ITEM = /^( {0,3})([-*+]|\d{1,9}[.)])(?:([ \t]+)(.*)|[ \t]*$)/;
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
const TABLE_DELIMITER = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;

const isFenceClose = (line: string, marker: string): boolean => {
  const m = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
  return !!m && m[1]![0] === marker[0] && m[1]!.length >= marker.length;
};

/** Does `line` start a block that interrupts a paragraph? */
const interrupts = (line: string): boolean => {
  if (ATX.test(line) || FENCE.test(line) || HR.test(line) || QUOTE.test(line)) return true;
  const item = ITEM.exec(line);
  // An ordered item interrupts a paragraph only when it starts at 1; an empty item never does (CommonMark).
  return !!item && item[4] !== undefined && item[4] !== "" && (!/^\d/.test(item[2]!) || /^1[.)]$/.test(item[2]!));
};

/* -------------------------------------------------------------------------------------------------
 * Top-level block split (streaming keys)
 * -----------------------------------------------------------------------------------------------*/

/**
 * Cut `source` into top-level block strings (line scan, no inline parsing): blank lines separate blocks except inside a
 * fence and inside a list / quote that continues after the blank; headings, rules and fences are blocks of their own.
 * `parseMarkdown(chunk)` of each chunk equals the matching part of `parseMarkdown(source)`.
 */
export function splitBlocks(source: string): string[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let current: string[] = [];
  let kind: "none" | "fence" | "list" | "quote" | "text" = "none";
  let fence = "";
  const flush = () => {
    if (current.length) out.push(current.join("\n"));
    current = [];
    kind = "none";
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (kind === "fence") {
      current.push(line);
      if (isFenceClose(line, fence)) flush();
      continue;
    }
    if (BLANK.test(line)) {
      if (kind === "list" || kind === "quote") {
        // Keep a list / quote together when the next non-blank line continues it.
        let j = i + 1;
        while (j < lines.length && BLANK.test(lines[j]!)) j++;
        const next = lines[j];
        if (next !== undefined && (kind === "list" ? ITEM.test(next) || /^[ \t]{2,}\S/.test(next) : QUOTE.test(next))) {
          current.push(line);
          continue;
        }
      }
      flush();
      continue;
    }
    const fenceMatch = FENCE.exec(line);
    if (fenceMatch && kind !== "list" && kind !== "quote") {
      flush();
      kind = "fence";
      fence = fenceMatch[2]!;
      current.push(line);
      continue;
    }
    if (kind === "none" || kind === "text") {
      if (ATX.test(line) || (HR.test(line) && !(kind === "text" && SETEXT.test(line)))) {
        flush();
        out.push(line);
        continue;
      }
      if (kind === "text" && SETEXT.test(line)) {
        current.push(line);
        flush();
        continue;
      }
      if (kind === "text" && interrupts(line)) flush();
      if (kind === "none") kind = ITEM.test(line) ? "list" : QUOTE.test(line) ? "quote" : "text";
      current.push(line);
      continue;
    }
    // Inside a list / quote: a heading or rule at the margin ends it.
    if (!/^[ \t]/.test(line) && (ATX.test(line) || (HR.test(line) && !ITEM.test(line)))) {
      flush();
      out.push(line);
      continue;
    }
    current.push(line);
  }
  if (kind === "fence" || current.length) flush();
  return out;
}

/* -------------------------------------------------------------------------------------------------
 * Block parser
 * -----------------------------------------------------------------------------------------------*/

/** Parse a whole Markdown document into blocks. */
export function parseMarkdown(source: string): MarkdownBlock[] {
  return parseLines(source.replace(/\r\n?/g, "\n").split("\n"));
}

const indentOf = (line: string): number => {
  let n = 0;
  for (const ch of line) {
    if (ch === " ") n++;
    else if (ch === "\t") n += 4 - (n % 4);
    else break;
  }
  return n;
};

/** Remove up to `count` columns of leading indentation. */
const dedent = (line: string, count: number): string => {
  let col = 0;
  let i = 0;
  while (i < line.length && col < count) {
    const ch = line[i];
    if (ch === " ") col++;
    else if (ch === "\t") col += 4 - (col % 4);
    else break;
    i++;
  }
  return line.slice(i);
};

const splitRow = (line: string): string[] => {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let cell = "";
  let code = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch === "\\" && s[i + 1] === "|") {
      cell += "|";
      i++;
    } else if (ch === "`") {
      code = code ? 0 : 1;
      cell += ch;
    } else if (ch === "|" && !code) {
      cells.push(cell.trim());
      cell = "";
    } else cell += ch;
  }
  cells.push(cell.trim());
  return cells;
};

function parseLines(lines: string[]): MarkdownBlock[] {
  const out: MarkdownBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (BLANK.test(line)) {
      i++;
      continue;
    }
    // Fenced code
    const fence = FENCE.exec(line);
    if (fence) {
      const indent = fence[1]!.length;
      const marker = fence[2]!;
      const body: string[] = [];
      let closed = false;
      i++;
      while (i < lines.length) {
        if (isFenceClose(lines[i]!, marker)) {
          closed = true;
          i++;
          break;
        }
        body.push(dedent(lines[i]!, indent));
        i++;
      }
      // An unclosed (streaming) fence ends at the source end: its trailing empty line is not content yet.
      if (!closed && body.length && body[body.length - 1] === "") body.pop();
      out.push({ type: "code", lang: fence[3]!.toLowerCase(), value: body.join("\n"), closed });
      continue;
    }
    // ATX heading
    const atx = ATX.exec(line);
    if (atx) {
      out.push({ type: "heading", level: atx[1]!.length as 1, children: parseInline(atx[2] ?? "") });
      i++;
      continue;
    }
    // Thematic break (before lists: "- - -")
    if (HR.test(line)) {
      out.push({ type: "hr" });
      i++;
      continue;
    }
    // Block quote (with lazy continuation lines)
    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && !BLANK.test(lines[i]!)) {
        const l = lines[i]!;
        if (QUOTE.test(l)) body.push(l.replace(QUOTE, ""));
        else if (!interrupts(l)) body.push(l);
        else break;
        i++;
      }
      out.push({ type: "blockquote", children: parseLines(body) });
      continue;
    }
    // List
    if (ITEM.test(line)) {
      i = parseList(lines, i, out);
      continue;
    }
    // Table: header row + delimiter row
    const next = lines[i + 1];
    if (line.includes("|") && next !== undefined && TABLE_DELIMITER.test(next)) {
      const head = splitRow(line);
      const align = splitRow(next).map((d): MarkdownAlign => {
        const left = d.startsWith(":");
        const right = d.endsWith(":");
        return left && right ? "center" : right ? "right" : left ? "left" : null;
      });
      if (align.length === head.length) {
        const rows: MarkdownInline[][][] = [];
        i += 2;
        while (i < lines.length && !BLANK.test(lines[i]!) && lines[i]!.includes("|") && !interrupts(lines[i]!)) {
          const cells = splitRow(lines[i]!);
          rows.push(head.map((_, c) => parseInline(cells[c] ?? "")));
          i++;
        }
        out.push({ type: "table", align, head: head.map((h) => parseInline(h)), rows });
        continue;
      }
    }
    // Paragraph (+ setext heading)
    const text: string[] = [line.replace(/^[ \t]+/, "")];
    i++;
    let setext: 1 | 2 | 0 = 0;
    while (i < lines.length) {
      const l = lines[i]!;
      if (BLANK.test(l)) break;
      const s = SETEXT.exec(l);
      if (s) {
        setext = s[1]![0] === "=" ? 1 : 2;
        i++;
        break;
      }
      if (interrupts(l) || (l.includes("|") && lines[i + 1] !== undefined && TABLE_DELIMITER.test(lines[i + 1]!))) break;
      text.push(l.replace(/^[ \t]+/, ""));
      i++;
    }
    // Hard breaks: keep the line ends; parseInline turns "  \n" / "\\\n" into `br`.
    const raw = text.join("\n").trimEnd();
    out.push(setext ? { type: "heading", level: setext, children: parseInline(raw) } : { type: "paragraph", children: parseInline(raw) });
  }
  return out;
}

/** Parse the list starting at `lines[start]`; pushes it to `out`, returns the next line index. */
function parseList(lines: string[], start: number, out: MarkdownBlock[]): number {
  const first = ITEM.exec(lines[start]!)!;
  const ordered = /^\d/.test(first[2]!);
  const delimiter = ordered ? first[2]!.slice(-1) : first[2]!;
  const baseIndent = first[1]!.length;
  const items: MarkdownListItem[] = [];
  let tight = true;
  let i = start;
  let sawBlank = false;
  while (i < lines.length) {
    const m = ITEM.exec(lines[i]!);
    if (!m) break;
    const sameKind = ordered ? /^\d/.test(m[2]!) && m[2]!.slice(-1) === delimiter : m[2] === delimiter;
    if (!sameKind || m[1]!.length > baseIndent + 3) break;
    if (sawBlank) tight = false;
    sawBlank = false;
    const spaces = m[3] ? indentOf(m[3]) : 1;
    const contentIndent = m[1]!.length + m[2]!.length + (spaces > 4 ? 1 : spaces);
    const body: string[] = [m[4] ?? ""];
    i++;
    while (i < lines.length) {
      const l = lines[i]!;
      if (BLANK.test(l)) {
        // A blank inside the item: keep it only when indented content follows.
        let j = i + 1;
        while (j < lines.length && BLANK.test(lines[j]!)) j++;
        if (j < lines.length && indentOf(lines[j]!) >= contentIndent) {
          for (; i < j; i++) body.push("");
          tight = false;
          continue;
        }
        sawBlank = true;
        i = j;
        break;
      }
      if (indentOf(l) >= contentIndent) {
        body.push(dedent(l, contentIndent));
        i++;
        continue;
      }
      // Lazy paragraph continuation (not a new item / block).
      if (!ITEM.test(l) && !interrupts(l) && body.length && !BLANK.test(body[body.length - 1]!)) {
        body.push(l.trim());
        i++;
        continue;
      }
      break;
    }
    let checked: boolean | undefined;
    const task = /^\[([ xX])\][ \t]+/.exec(body[0]!);
    if (task) {
      checked = task[1] !== " ";
      body[0] = body[0]!.slice(task[0].length);
    }
    items.push({ checked, children: parseLines(body) });
    if (sawBlank && (i >= lines.length || !ITEM.test(lines[i]!))) break;
  }
  out.push({ type: "list", ordered, start: ordered ? parseInt(first[2]!, 10) : 1, tight, items });
  return i;
}

/* -------------------------------------------------------------------------------------------------
 * Inline parser
 * -----------------------------------------------------------------------------------------------*/
const PUNCT_ESCAPE = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;
const BARE_URL = /^https?:\/\/[^\s<]*[^\s<.,:;"')\]!?*_~]/;
const WORD = /[\p{L}\p{N}]/u;

/** URL allowed in an `href` / `src`: http(s), mailto, tel, or relative; anything else (javascript:, data:, …) → `undefined`. */
export function safeUrl(url: string): string | undefined {
  const trimmed = url.trim();
  // Strip control characters / whitespace browsers ignore inside a scheme ("java\tscript:").
  const probe = trimmed.replace(/[\u0000- \u007f]/g, "").toLowerCase();
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(probe);
  if (!scheme) return trimmed;
  return ["http", "https", "mailto", "tel"].includes(scheme[1]!) ? trimmed : undefined;
}

/** Index of the `]` closing the bracket opened at `open` (nested brackets, code spans and escapes skipped), or -1. */
function closingBracket(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === "\\") i++;
    else if (ch === "`") {
      const run = /^`+/.exec(src.slice(i))![0];
      const end = src.indexOf(run, i + run.length);
      if (end > 0) i = end + run.length - 1;
    } else if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) return i;
  }
  return -1;
}

/** `(href "title")` at `src[at]`: `[end, href, title]` or `undefined`. */
function linkDestination(src: string, at: number): [number, string, string | undefined] | undefined {
  if (src[at] !== "(") return undefined;
  const m = /^\(\s*(<[^>\n]*>|(?:[^\s()\\]|\\.|\((?:[^\s()\\]|\\.)*\))*)(?:\s+("[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/.exec(src.slice(at));
  if (!m) return undefined;
  let href = m[1]!;
  if (href.startsWith("<")) href = href.slice(1, -1);
  href = href.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, "$1");
  const title = m[2] ? m[2].slice(1, -1) : undefined;
  return [at + m[0].length, href, title];
}

/** Find the closing delimiter run `delim` for an opener ending at `from` (right-flanking, not escaped, not in code). */
function closingDelimiter(src: string, from: number, delim: string): number {
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === "`") {
      const run = /^`+/.exec(src.slice(i))![0];
      const end = src.indexOf(run, i + run.length);
      if (end > 0) {
        i = end + run.length - 1;
        continue;
      }
    }
    if (src.startsWith(delim, i)) {
      const before = src[i - 1];
      const after = src[i + delim.length];
      // Right-flanking: not preceded by whitespace; a single `*` / `_` must not be part of a longer run.
      if (before === undefined || /\s/.test(before)) continue;
      if (delim.length === 1 && (src[i + 1] === delim || before === delim)) continue;
      if (delim[0] === "_" && after !== undefined && WORD.test(after)) continue;
      if (i === from) continue;
      return i;
    }
  }
  return -1;
}

/** Parse inline Markdown into nodes. */
export function parseInline(src: string): MarkdownInline[] {
  const out: MarkdownInline[] = [];
  let text = "";
  const pushText = () => {
    if (text) out.push({ type: "text", value: text });
    text = "";
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    // Hard break: two+ spaces or a backslash before a newline.
    if (ch === "\n") {
      if (/ {2,}$/.test(text) || text.endsWith("\\")) {
        text = text.replace(/ {2,}$|\\$/, "");
        pushText();
        out.push({ type: "br" });
      } else {
        text = text.replace(/ +$/, "");
        text += "\n";
      }
      i++;
      continue;
    }
    if (ch === "\\" && i + 1 < src.length && PUNCT_ESCAPE.test(src[i + 1]!)) {
      text += src[i + 1];
      i += 2;
      continue;
    }
    // Code span
    if (ch === "`") {
      const run = /^`+/.exec(src.slice(i))![0];
      const end = src.indexOf(run, i + run.length);
      if (end > 0 && src[end + run.length] !== "`") {
        pushText();
        let value = src.slice(i + run.length, end).replace(/\n/g, " ");
        if (/^ .*[^ ].* $/.test(value)) value = value.slice(1, -1);
        out.push({ type: "code", value });
        i = end + run.length;
        continue;
      }
      text += run;
      i += run.length;
      continue;
    }
    // Image / link
    if (ch === "!" && src[i + 1] === "[") {
      const close = closingBracket(src, i + 1);
      const dest = close > 0 ? linkDestination(src, close + 1) : undefined;
      if (dest) {
        const url = safeUrl(dest[1]);
        pushText();
        const alt = textOf(parseInline(src.slice(i + 2, close)));
        if (url !== undefined) out.push({ type: "image", src: url, alt, title: dest[2] });
        else out.push({ type: "text", value: alt });
        i = dest[0];
        continue;
      }
    }
    if (ch === "[") {
      const close = closingBracket(src, i);
      const dest = close > 0 ? linkDestination(src, close + 1) : undefined;
      if (dest) {
        pushText();
        const children = parseInline(src.slice(i + 1, close));
        const url = safeUrl(dest[1]);
        if (url !== undefined) out.push({ type: "link", href: url, title: dest[2], children });
        else out.push(...children);
        i = dest[0];
        continue;
      }
    }
    // Autolinks: <https://…> / <mailto:…> and bare http(s) URLs (GFM).
    if (ch === "<") {
      const m = /^<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s<>]*)>/.exec(src.slice(i));
      const url = m ? safeUrl(m[1]!) : undefined;
      if (m && url !== undefined) {
        pushText();
        out.push({ type: "link", href: url, children: [{ type: "text", value: m[1]! }] });
        i += m[0].length;
        continue;
      }
    }
    if ((ch === "h" || ch === "H") && (i === 0 || !WORD.test(src[i - 1]!))) {
      const m = BARE_URL.exec(src.slice(i));
      if (m) {
        pushText();
        out.push({ type: "link", href: m[0], children: [{ type: "text", value: m[0] }] });
        i += m[0].length;
        continue;
      }
    }
    // Emphasis / strong / strikethrough
    if (ch === "*" || ch === "_" || ch === "~") {
      const run = /^(\*+|_+|~+)/.exec(src.slice(i))![0];
      const after = src[i + run.length];
      const before = src[i - 1];
      const leftFlanking = after !== undefined && !/\s/.test(after) && !(ch === "_" && before !== undefined && WORD.test(before));
      if (leftFlanking) {
        const tries: [string, "strong" | "em" | "del"][] =
          ch === "~"
            ? run.length >= 2
              ? [["~~", "del"]]
              : []
            : run.length >= 3
              ? [
                  [ch.repeat(3), "strong"],
                  [ch + ch, "strong"],
                  [ch, "em"],
                ]
              : run.length === 2
                ? [
                    [ch + ch, "strong"],
                    [ch, "em"],
                  ]
                : [[ch, "em"]];
        let matched = false;
        for (const [delim, type] of tries) {
          const end = closingDelimiter(src, i + delim.length, delim);
          if (end < 0) continue;
          pushText();
          const inner = src.slice(i + delim.length, end);
          if (delim.length === 3) out.push({ type: "strong", children: [{ type: "em", children: parseInline(inner) }] });
          else out.push({ type, children: parseInline(inner) });
          i = end + delim.length;
          matched = true;
          break;
        }
        if (matched) continue;
      }
      text += run;
      i += run.length;
      continue;
    }
    text += ch;
    i++;
  }
  pushText();
  return out;
}

/** Plain text of inline nodes (image alt, accessible names, copy). */
export function textOf(nodes: readonly MarkdownInline[]): string {
  let s = "";
  for (const n of nodes) {
    if (n.type === "text" || n.type === "code") s += n.value;
    else if (n.type === "image") s += n.alt;
    else if (n.type === "br") s += "\n";
    else s += textOf(n.children);
  }
  return s;
}

/* -------------------------------------------------------------------------------------------------
 * Streaming repair
 * -----------------------------------------------------------------------------------------------*/

/**
 * Close inline marks a streamed block left open at its end (`**`, `__`, `~~`, `` ` ``), so a partial response renders
 * as formatted text instead of flashing raw delimiters. Fenced code needs no repair (an open fence runs to the end).
 */
export function closeOpenMarks(block: string): string {
  if (FENCE.test(block.split("\n", 1)[0]!)) return block;
  let out = block;
  let tail = "";
  // An open code span: close it (its text is literal, so marks inside it do not count).
  const ticks = block.match(/(?<!\\)`/g)?.length ?? 0;
  let scan = block;
  if (ticks % 2 === 1) {
    tail = "`";
    scan = block.slice(0, block.lastIndexOf("`"));
  }
  scan = scan.replace(/`[^`]*`/g, (m) => " ".repeat(m.length));
  // Last unmatched opener per mark, closed innermost first.
  const open: [number, string][] = [];
  for (const mark of ["**", "__", "~~"]) {
    const at: number[] = [];
    for (let i = scan.indexOf(mark); i >= 0; i = scan.indexOf(mark, i + mark.length)) if (scan[i - 1] !== "\\") at.push(i);
    if (at.length % 2 === 1) open.push([at[at.length - 1]!, mark]);
  }
  open.sort((a, b) => b[0] - a[0]);
  for (const [index, mark] of open) {
    // A lone opener with nothing after it yet renders as nothing (no empty bold flash).
    if (!tail && /^\s*$/.test(out.slice(index + mark.length))) out = out.slice(0, index);
    else tail += mark;
  }
  // Closers go before trailing whitespace (`**bold **` is no strong: a closer must follow a non-space), unless a code
  // span closes first (its text, spaces included, is literal).
  if (tail && tail[0] !== "`") {
    const space = /\s*$/.exec(out)![0].length;
    if (space) return out.slice(0, out.length - space) + tail + out.slice(out.length - space);
  }
  return out + tail;
}
