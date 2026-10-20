// Path-addressed row elements (server-resume row plans, RESUME-ROWS-2): the element paths of a compiled row template,
// read from its fragments, so rows written from the plan's tape can leave their `data-r` ids out. The browser finds a
// row's elements from the row's end marker (`<!--]-->` right after the row root) by element child index — elements
// only: text (whitespace, values) and comments never shift them. A template the HTML parser could restructure (implied
// end tags, table fostering, raw text, foreign content beyond plain SVG shapes) gets no paths (ids stay).

/** Per `_rId` element of the row (in slot order): `tag:i.j` (its tag, child indexes below the row root; root `tag:`). */
export interface RowPaths {
  paths: string[];
  /** Child slots in element content: a row is addressable only while each holds a primitive (text never adds elements). */
  content: number[];
}

const VOID = new Set("area base br embed hr img input link meta param source track wbr".split(" "));
// The parser restructures these (raw text / RCDATA, implied tables, select content, ruby, document parts): no paths.
const UNSAFE = new Set(
  "script style textarea title template xmp iframe noembed noframes noscript plaintext select option optgroup html head body frameset frame image math caption colgroup col thead tbody tfoot table rb rt rp rtc nobr keygen".split(
    " ",
  ),
);
// Start tags that close an open `<p>` (HTML "in body" insertion mode).
const CLOSES_P = new Set(
  "address article aside blockquote center details dialog dir div dl fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr listing main menu nav ol p pre search section summary table ul li dd dt".split(
    " ",
  ),
);
const HEADING = /^h[1-6]$/;
// SVG content kept: lowercase shapes the HTML parser leaves in the SVG namespace (no HTML breakout, no case fix-up).
const SVG = new Set("svg g path circle rect line polyline polygon ellipse use defs symbol stop mask pattern text tspan desc marker filter".split(" "));
const NAME = /[a-z][a-z0-9-]*/y;

/**
 * Paths of a row template (`fragments` around its slots; `entries[i]` null for a child slot, else an attribute; `ids` the
 * `_rId` slots, element order), or null when the parser could restructure it or a slot sits where the walk cannot follow.
 */
export function rowPaths(fragments: readonly string[], entries: readonly unknown[], ids: readonly number[]): RowPaths | null {
  return walk(fragments, entries, ids, null);
}

/**
 * DOM-backed loader data (DOM-DATA, spec `docs/design/specs/2026-10-20-dom-backed-loader-data-design.md` §3.1): the
 * content slots of a template that are the sole child of their element (`<dd>{x}</dd>`: the fragment before ends with
 * the element's start tag, the one after starts with its end tag), each with its element's path `tag:i.j` below the
 * template root (root `tag:`), and its attribute slots (not `_rId`), each `tag:i.j@` (the caller appends the name and
 * drops the attributes whose value the writer changes or a binding owns). A string written there is that element's whole
 * `textContent` / the attribute's value in the browser (entities decoded by the parser; the caller refuses strings the
 * parser would change: CR, NUL, lone surrogates). `entries` null: slots inside a start tag are attributes, every other
 * slot content (compiled templates of lazy rows).
 * Null when the parser could restructure the template (`rowPaths` rules); `<pre>` / `<listing>` drop a leading newline:
 * never listed.
 */
export function rowTexts(fragments: readonly string[], entries: readonly unknown[] | null): [slot: number, path: string][] | null {
  const texts: [number, string][] = [];
  return walk(fragments, entries, [], texts) && texts.length ? texts : null;
}

function walk(fragments: readonly string[], entries: readonly unknown[] | null, ids: readonly number[], texts: [number, string][] | null): RowPaths | null {
  const stack: { tag: string; path: string; count: number }[] = [];
  const paths: string[] = [],
    content: number[] = [];
  let roots = 0,
    tag: string | null = null, // the start tag being read (TAG state), its path
    path = "",
    opened = false; // the last thing read is a (non-void) start tag: its element has no child yet
  for (let f = 0; f < fragments.length; f++) {
    const text = fragments[f]!;
    for (let i = 0; i < text.length;) {
      const c = text.charCodeAt(i);
      if (tag !== null) {
        // Inside a start tag: attributes (quoted values skipped whole), `>` / `/>` ends it.
        if (c === 34 || c === 39) {
          const close = text.indexOf(text[i]!, i + 1);
          if (close < 0) return null;
          i = close + 1;
        } else if (c === 62 || (c === 47 && text.charCodeAt(i + 1) === 62)) {
          // `/>` closes only void and SVG elements: the HTML parser ignores it on any other.
          if (c === 47 && !VOID.has(tag) && !SVG.has(tag)) return null;
          if (c === 62 && !VOID.has(tag)) ((opened = true), stack.push({ tag, path, count: 0 }));
          i += c === 62 ? 1 : 2;
          tag = null;
        } else i++;
        continue;
      }
      opened = false;
      if (c !== 60) {
        i++;
        continue;
      }
      if (text.startsWith("<!--", i)) {
        const close = text.indexOf("-->", i + 4);
        if (close < 0) return null;
        i = close + 3;
        continue;
      }
      if (text.charCodeAt(i + 1) === 47) {
        // End tag: closes the current element (compiled markup nests properly).
        const close = text.indexOf(">", i);
        if (close < 0 || stack.pop()?.tag !== text.slice(i + 2, close)) return null;
        i = close + 1;
        continue;
      }
      NAME.lastIndex = i + 1;
      const name = NAME.exec(text)?.[0];
      // An uppercase / non-name tag (SVG camelCase, `<!doctype>`) or a restructured element: no paths.
      if (!name || UNSAFE.has(name) || !/[\s/>]/.test(text[i + 1 + name.length] ?? ">")) return null;
      const parent = stack[stack.length - 1];
      if (!parent && roots++) return null;
      if (parent && !hostOk(stack, parent.tag, name)) return null;
      path = parent ? (parent.path ? parent.path + "." : "") + parent.count++ : "";
      tag = name;
      i += 1 + name.length;
    }
    if (f === fragments.length - 1) break;
    // Slot f: an `_rId` attribute names the element whose start tag is open; a child slot outside a tag is content.
    if (ids.includes(f)) {
      if (tag === null) return null;
      paths[ids.indexOf(f)] = tag + ":" + path;
    } else if (entries === null ? tag === null : entries[f] === null) {
      if (tag === null) {
        content.push(f);
        const top = stack[stack.length - 1];
        if (texts !== null && opened && top && top.tag !== "pre" && top.tag !== "listing" && fragments[f + 1]!.startsWith("</" + top.tag + ">"))
          texts.push([f, top.tag + ":" + top.path]);
        opened = false;
      }
    } else if (tag === null) return null;
    // An attribute slot of the open start tag (DOM-DATA): `tag:i.j@` (the caller appends the output name).
    else if (texts !== null) texts.push([f, tag + ":" + path + "@"]);
  }
  if (tag !== null || stack.length || paths.length !== ids.length) return null;
  return { paths, content };
}

/** Whether `<name>` stays a child of the open element `host` (no implied end tag, fostering or foreign-content breakout). */
function hostOk(stack: readonly { tag: string }[], host: string, name: string): boolean {
  if (host === "svg" || SVG.has(host)) return SVG.has(name) && name !== "svg";
  if (name === "svg") return true;
  if (SVG.has(name) && name !== "svg") return false;
  // Table rows / cells only as a row root and its cells.
  if (name === "tr" || name === "td" || name === "th") return name !== "tr" && host === "tr";
  if (host === "tr") return false;
  for (let k = stack.length - 1; k >= 0; k--) {
    const open = stack[k]!.tag;
    if (open === "p" && CLOSES_P.has(name)) return false;
    if (open === name && (name === "a" || name === "button" || name === "form")) return false;
    if (name === "li" && (open === "ul" || open === "ol" || open === "menu")) break;
    if (name === "li" && open === "li") return false;
    if ((name === "dd" || name === "dt") && (open === "dd" || open === "dt")) return false;
  }
  return !(HEADING.test(name) && HEADING.test(host));
}
