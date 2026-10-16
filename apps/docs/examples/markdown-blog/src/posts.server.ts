/// <reference types="vite/client" />
// Server-only: the Markdown parser and the post files never reach the browser.
import { fromMarkdown } from "mdast-util-from-markdown";
import type { Post, PostSummary } from "./posts.ts";

// #region demo
// Vite bundles every post into the server build as a string.
const files = import.meta.glob<string>("./posts/*.md", { query: "?raw", import: "default", eager: true });

/** Split `---` frontmatter (`key: value` lines) from the Markdown body. */
function parse(source: string): { meta: Record<string, string>; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!match) return { meta: {}, body: source };
  const meta = Object.fromEntries(match[1]!.split("\n").map((line) => [line.slice(0, line.indexOf(":")).trim(), line.slice(line.indexOf(":") + 1).trim()]));
  return { meta, body: source.slice(match[0].length) };
}

/** Remove source positions: the page only needs the content, and smaller data is faster. */
function strip<T>(node: T): T {
  return JSON.parse(JSON.stringify(node, (key, value) => (key === "position" ? undefined : value))) as T;
}

const posts: Post[] = Object.entries(files)
  .map(([path, source]) => {
    const { meta, body } = parse(source);
    const slug = path.slice(path.lastIndexOf("/") + 1, -".md".length);
    return { slug, title: meta.title ?? slug, date: meta.date ?? "", tree: strip(fromMarkdown(body)) };
  })
  .sort((a, b) => b.date.localeCompare(a.date));
// #endregion

export const listPosts = (): PostSummary[] => posts.map(({ slug, title, date }) => ({ slug, title, date }));
export const getPost = (slug: string): Post | undefined => posts.find((post) => post.slug === slug);
