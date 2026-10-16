import { byTag, load as site, teaser } from "../../../lib/site.server.js";

export function entries() {
  return site().site.tags.map((tag) => ({ tag }));
}
export function load({ params }) {
  const { site: s, articles } = site();
  return { tag: params.tag, items: byTag(s, articles, params.tag).map(teaser) };
}
