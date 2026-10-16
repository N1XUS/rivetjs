// Content collection with an inline loader over the shared fixture reader (bodies are rendered with marked,
// the same library as the other JS lanes, instead of Astro's remark pipeline).
import { defineCollection } from "astro:content";
import { loadSite } from "../../../fixture/load.mjs";

const dir = process.env.EDITORIAL_CONTENT;

export const collections = {
  articles: defineCollection({
    loader: () => loadSite(dir).articles.map((a) => ({ id: a.slug, ...a })),
  }),
};
