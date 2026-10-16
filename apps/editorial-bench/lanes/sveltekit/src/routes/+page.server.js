import { load as site, pageCount, pageItems, teaser } from "../lib/site.server.js";

export function load() {
  const { site: s, articles } = site();
  return { n: 1, pages: pageCount(s, articles), items: pageItems(s, articles, 1).map(teaser) };
}
