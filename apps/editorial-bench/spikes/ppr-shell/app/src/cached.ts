import { article } from "../../../../lanes/rivet/src/content.ts";

// Cached-loader variant (PPR-T3B, T0 caveat): the article loader memoised per slug, so a page's loaders cost ~0 and a
// shell hit saves only what the replay does not render or encode.
const memo = new Map<string, ReturnType<typeof article>>();
export function cachedArticle(slug: string): ReturnType<typeof article> {
  let found = memo.get(slug);
  if (found === undefined && !memo.has(slug)) memo.set(slug, (found = article(slug)));
  return found;
}
