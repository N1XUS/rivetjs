// Lite runtime: static markup as data (`LiteSpec`, RT-DIET lite v2): the rows a keyed list (`dom-lite-list.ts`) and the
// branches a conditional subtree (`dom-lite-cond.ts`) build in the browser. A module of its own: a page imports it only
// through the leaves its residuals use.

/** Static markup: `[tag, attributes, …children]`, a child a Text's data, `0` / `1` a content opener / closer. */
export type LiteSpec = [tag: string, attributes: Record<string, string>, ...children: (string | 0 | 1 | LiteSpec)[]];
export const build = (d: Document, s: string | 0 | 1 | LiteSpec): Node => {
  if (typeof s == "string") return d.createTextNode(s);
  if (typeof s == "number") return d.createComment(s ? "]" : "[");
  const el = d.createElement(s[0]);
  for (const k in s[1]) el.setAttribute(k, s[1][k]!);
  for (let i = 2; i < s.length; i++) el.append(build(d, s[i] as LiteSpec));
  return el;
};
