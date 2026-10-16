import { marked } from "marked";
import { day, load as site, teaser } from "../../../lib/site.server.js";

export function entries() {
  return site().articles.map((a) => ({ slug: a.slug }));
}
export function load({ params }) {
  const { bySlug } = site();
  const a = bySlug.get(params.slug);
  return {
    title: a.title,
    description: a.description,
    date: a.date,
    day: day(a.date),
    author: a.author,
    authorSlug: a.authorSlug,
    tags: a.tags,
    html: marked.parse(a.body),
    related: a.related.map((s) => teaser(bySlug.get(s))),
  };
}
