// Readable HTML for an example's "Server HTML" tab (the browser fetches the frame page and formats it,
// `highlighter.ts`): one element per line, long inline scripts elided, the docs frame theme script left out.

const FRAME_SCRIPT = /<script id="rivet-docs-frame"[^>]*>[\s\S]*?<\/script>/;

/** Format `html` one element per line (leaf elements with short text stay on one line). */
export function formatHTML(html: string): string {
  // The docs frame's theme script is not part of the example (its CSP hash stays in the meta).
  const elided = html
    .replace(FRAME_SCRIPT, "")
    .replace(/(<script\b(?![^>]*\btype="rivet\/boundaries")[^>]*>)([\s\S]*?)(<\/script>)/g, (all, open: string, body: string, close: string) =>
      body.length > 160 ? `${open}/* ${body.length} bytes of inline script (resume loader) */${close}` : all,
    );
  const LEAF = /<([a-z][a-z0-9-]*)\b[^>]*>[^<]{0,100}<\/\1>/gi;
  const tokens: { text: string; leaf: boolean }[] = [];
  let at = 0;
  for (const match of elided.matchAll(LEAF)) {
    for (const part of elided.slice(at, match.index).split(/(?=<)|(?<=>)/)) if (part.trim()) tokens.push({ text: part.trim(), leaf: false });
    tokens.push({ text: match[0], leaf: true });
    at = match.index + match[0].length;
  }
  for (const part of elided.slice(at).split(/(?=<)|(?<=>)/)) if (part.trim()) tokens.push({ text: part.trim(), leaf: false });
  const VOID = /^<(meta|link|br|hr|img|input|source|area|base|col|embed|track|wbr|!)/i;
  const lines: string[] = [];
  let depth = 0;
  for (const { text, leaf } of tokens) {
    if (!leaf && text.startsWith("</")) depth = Math.max(0, depth - 1);
    lines.push("  ".repeat(depth) + text);
    if (!leaf && text.startsWith("<") && !text.startsWith("</") && !text.endsWith("/>") && !VOID.test(text)) depth++;
  }
  return lines.join("\n") + "\n";
}
