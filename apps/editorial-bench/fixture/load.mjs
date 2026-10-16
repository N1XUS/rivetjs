// Shared content reader for the JS lanes that have no own front matter reader in their idiomatic setup
// (rivet, next, sveltekit, astro custom collection loader). Eleventy and Hugo parse the same files natively.
// Front matter values are JSON literals (fixture/gen.ts), so each line is `key: <json>`.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Parse one article file: front matter + raw Markdown body. */
export function parseArticle(source) {
  const end = source.indexOf("\n---\n", 4);
  const meta = {};
  for (const line of source.slice(4, end).split("\n")) {
    const at = line.indexOf(": ");
    meta[line.slice(0, at)] = JSON.parse(line.slice(at + 2));
  }
  meta.body = source.slice(end + 5);
  return meta;
}

/**
 * Read a fixture directory (`fixture/content/n<N>`): `site` (site.json), `articles` newest first,
 * `bySlug` map. Reads every file once per process.
 */
export function loadSite(dir) {
  const site = JSON.parse(readFileSync(join(dir, "site.json"), "utf8"));
  const folder = join(dir, "content", "articles");
  const articles = readdirSync(folder)
    .filter((name) => name.endsWith(".md"))
    .map((name) => parseArticle(readFileSync(join(folder, name), "utf8")))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const bySlug = new Map(articles.map((a) => [a.slug, a]));
  return { site, articles, bySlug };
}

/** Listing helpers shared by the lanes (same selection everywhere). */
export const pageCount = (site, articles) => Math.ceil(articles.length / site.perPage);
export const pageItems = (site, articles, n) => articles.slice((n - 1) * site.perPage, n * site.perPage);
export const byTag = (site, articles, tag) => articles.filter((a) => a.tags.includes(tag)).slice(0, site.listLimit);
export const byAuthor = (site, articles, author) => articles.filter((a) => a.authorSlug === author).slice(0, site.listLimit);
export const day = (iso) => iso.slice(0, 10);
