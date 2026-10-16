import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getCollection } from "astro:content";

export const site = JSON.parse(readFileSync(join(process.env.EDITORIAL_CONTENT, "site.json"), "utf8"));
let sorted;
/** Articles newest first (collection order is not guaranteed). */
export async function articles() {
  sorted ??= (await getCollection("articles")).map((e) => e.data).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return sorted;
}
let index;
/** slug → article. */
export async function bySlug() {
  index ??= new Map((await articles()).map((a) => [a.slug, a]));
  return index;
}
export const day = (iso) => iso.slice(0, 10);
