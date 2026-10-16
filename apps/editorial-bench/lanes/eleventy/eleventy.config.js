// Eleventy lane of apps/editorial-bench. Markdown through marked (same library as the other JS lanes).
import { marked } from "marked";

export default function (eleventyConfig) {
  // src/articles is a gitignored build copy of the fixture: do not let .gitignore hide it.
  eleventyConfig.setUseGitIgnore(false);
  eleventyConfig.setLibrary("md", { render: (source) => marked.parse(source) });
  eleventyConfig.addPassthroughCopy({ "../../fixture/site.css": "site.css", "../../fixture/assets": "img" });
  eleventyConfig.addCollection("articles", (api) => api.getFilteredByGlob("src/articles/*.md").sort((a, b) => (a.data.date < b.data.date ? 1 : -1)));
  eleventyConfig.addFilter("day", (iso) => String(iso).slice(0, 10));
  const index = new WeakMap();
  eleventyConfig.addFilter("bySlug", (articles, slug) => {
    let map = index.get(articles);
    if (!map) index.set(articles, (map = new Map(articles.map((a) => [a.data.slug, a]))));
    return map.get(slug);
  });
  eleventyConfig.addFilter("withTag", (articles, tag, limit) => articles.filter((a) => a.data.tags.includes(tag)).slice(0, limit));
  eleventyConfig.addFilter("byAuthor", (articles, slug, limit) => articles.filter((a) => a.data.authorSlug === slug).slice(0, limit));
  // Front matter `date` is an ISO string; keep it a string (no Eleventy date coercion of the page date for display).
  eleventyConfig.addGlobalData("eleventyComputed", { iso: (data) => data.date });
}

export const config = {
  dir: { input: "src", output: "dist" },
  markdownTemplateEngine: false,
  htmlTemplateEngine: "njk",
};
