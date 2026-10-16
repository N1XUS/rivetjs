// URL attribute rule shared by the server encoder, DOM attribute writers and the dev façade; the
// compiler's static check (libs/compiler/rust/src/html.rs) applies the same rule to literals.

/** What an unsafe dynamic URL becomes: inert, and visible in the rendered markup. */
export const INVALID_URL = "about:invalid#rivet";
// URL-bearing attribute (lowercase) → 1: one URL, 2: a list whose every entry is checked (srcset
// candidates, ping, SMIL `values`). `values`/`to`/`from`/`by` animate `href` on SVG <animate>/<set>.
export const URLS = new Map<string, number>();
for (const name of "href src action formaction poster xlink:href data to from by".split(" ")) URLS.set(name, 1);
for (const name of "ping srcset imagesrcset values".split(" ")) URLS.set(name, 2);
/** HTML `element attribute` pairs whose URL may be a `data:` image, video or audio. */
export const MEDIA_URLS = /^(?:(?:img|source) src(?:set)?|video (?:src|poster)|audio src)$/;
const SPACE = /[\u0000-\u0020\u007f]/g;
const SCHEME = /^(javascript|vbscript|data):/i;
const MEDIA_DATA = /^data:(?:image\/(?!svg)|video\/|audio\/)[\w.+-]+(?:[;,]|$)/i;
const check = (url: string, media: boolean): string | undefined => {
  const scheme = SCHEME.exec((url = url.replace(SPACE, "")));
  return scheme && !(media && MEDIA_DATA.test(url)) ? scheme[1] : undefined;
};
/**
 * Scheme (as written) of the first unsafe URL (`javascript`, `vbscript`, or `data` outside a media source) in
 * attribute `lower`'s value; undefined when safe or not a URL attribute. Controls and spaces are
 * ignored as browsers do; list entries are split on whitespace, `,` and `;` (a superset of every
 * position where a list URL can start), SMIL `values` on `;` only (its entries may hold tabs / newlines).
 */
export function unsafeUrl(lower: string, value: string, media: boolean): string | undefined {
  const kind = URLS.get(lower);
  if (kind === 1) return check(value, media);
  // SMIL `values` is a `;` list whose entries are URLs on their own (the URL parser drops tab / LF / CR
  // inside them: `java\tscript:`), so split it on `;` only (SEC3); srcset / ping URLs end at whitespace.
  if (kind === 2)
    for (const part of value.split(lower === "values" ? ";" : /[\t\n\f\r ,;]+/)) {
      const scheme = check(part, media);
      if (scheme) return scheme;
    }
}
