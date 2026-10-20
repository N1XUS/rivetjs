// Server-only content access (named content.ts, not content.server.ts, for historical reasons: a rolldown 1.2.12
// resolve-option race fired the router's server-only guard at random until 2d198ad1; see apps/editorial-bench/CLAUDE.md).
// Imported only by the load(…) / entries(…) exports, which the compiler strips from the browser build.
// the fixture directory comes from EDITORIAL_CONTENT (absolute path to fixture/content/n<N>).
// Markdown is parsed with marked's lexer (same library as the other JS lanes); the token tree is rendered as JSX
// by components/Markdown.tsx (Rivet has no raw-HTML sink).
import { marked, type Token } from "marked";
import { byAuthor, byTag, day, loadSite, pageCount, pageItems } from "../../../fixture/load.mjs";
import type { Article, MdNode, Teaser } from "./types.ts";

type Loaded = {
  site: { perPage: number; listLimit: number; tags: string[]; authors: { slug: string; name: string }[] };
  articles: Article[];
  bySlug: Map<string, Article>;
};
let cache: Loaded | undefined;
const load = (): Loaded => (cache ??= loadSite(process.env.EDITORIAL_CONTENT ?? "") as Loaded);

const teaser = (a: Article): Teaser => ({ slug: a.slug, title: a.title, date: a.date, day: day(a.date), author: a.author, description: a.description });

/** marked tokens → compact tree (no `raw` copies; tight list items unwrap their text token). */
function tree(tokens: Token[]): MdNode[] {
  const out: MdNode[] = [];
  for (const t of tokens) {
    switch (t.type) {
      case "space":
        break;
      case "heading":
        out.push({ type: "heading", depth: t.depth, children: tree(t.tokens ?? []) });
        break;
      case "paragraph":
      case "strong":
      case "em":
      case "blockquote":
        out.push({ type: t.type, children: tree(t.tokens ?? []) });
        break;
      case "text":
        if (t.tokens) out.push(...tree(t.tokens));
        else out.push({ type: "text", value: t.text });
        break;
      case "escape":
        out.push({ type: "text", value: t.text });
        break;
      case "codespan":
        out.push({ type: "codespan", value: t.text });
        break;
      case "code":
        out.push({ type: "code", lang: t.lang || undefined, value: t.text + "\n" });
        break;
      case "link":
        out.push({ type: "link", href: t.href, children: tree(t.tokens ?? []) });
        break;
      case "image":
        out.push({ type: "image", href: t.href, value: t.text });
        break;
      case "list":
        out.push({
          type: "list",
          ordered: t.ordered,
          children: t.items.map((item: Token) => ({ type: "item", children: tree((item as { tokens: Token[] }).tokens) })),
        });
        break;
      case "hr":
        out.push({ type: "hr" });
        break;
      case "br":
        out.push({ type: "br" });
        break;
      default:
        break; // raw HTML and unknown tokens render nothing
    }
  }
  return out;
}

export const listPages = () => pageCount(load().site, load().articles);
export const listPage = (n: number) => ({ n, pages: listPages(), items: pageItems(load().site, load().articles, n).map(teaser) });
export const slugs = () => load().articles.map((a) => a.slug);
export const tags = () => load().site.tags;
export const authors = () => load().site.authors.map((a) => a.slug);
export function article(slug: string) {
  const { bySlug } = load();
  const a = bySlug.get(slug);
  if (!a) return undefined;
  return {
    slug: a.slug,
    title: a.title,
    date: a.date,
    day: day(a.date),
    author: a.author,
    authorSlug: a.authorSlug,
    tags: a.tags,
    description: a.description,
    body: tree(marked.lexer(a.body)),
    related: a.related.map((s) => teaser(bySlug.get(s)!)),
  };
}
export const tagPage = (tag: string) => ({ tag, items: byTag(load().site, load().articles, tag).map(teaser) });
export function authorPage(slug: string) {
  const { site, articles } = load();
  const name = site.authors.find((a) => a.slug === slug)?.name;
  return name ? { slug, name, items: byAuthor(site, articles, slug).map(teaser) } : undefined;
}
