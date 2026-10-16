import { byAuthor, load as site, teaser } from "../../../lib/site.server.js";

export function entries() {
  return site().site.authors.map((a) => ({ author: a.slug }));
}
export function load({ params }) {
  const { site: s, articles } = site();
  const name = s.authors.find((a) => a.slug === params.author).name;
  return { name, items: byAuthor(s, articles, params.author).map(teaser) };
}
