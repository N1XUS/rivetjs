import { load as site, pageCount, pageItems, teaser } from "../../../lib/site.server.js";

export function entries() {
  const { site: s, articles } = site();
  return Array.from({ length: pageCount(s, articles) - 1 }, (_, i) => ({ n: String(i + 2) }));
}
export function load({ params }) {
  const { site: s, articles } = site();
  const n = Number(params.n);
  return { n, pages: pageCount(s, articles), items: pageItems(s, articles, n).map(teaser) };
}
