// Search index: Pagefind over the prerendered pages (only `data-pagefind-body` regions; nav,
// footers and example frames carry `data-pagefind-ignore`). Written to <client>/pagefind/.
import { resolve } from "node:path";
import * as pagefind from "pagefind";

/** Index options shared by the build and the dev server's in-memory index (`dev-search.ts`). */
export const SEARCH_INDEX: pagefind.PagefindServiceConfig = { forceLanguage: "en", includeCharacters: "$@#" };

/** Index `client` and write `client/pagefind/`; returns the number of pages indexed. */
export async function buildSearch(client: string): Promise<number> {
  const { index, errors } = await pagefind.createIndex(SEARCH_INDEX);
  if (!index) throw new Error(`pagefind: ${errors.join("; ")}`);
  try {
    const added = await index.addDirectory({ path: client, glob: "**/index.html" });
    if (added.errors.length) throw new Error(`pagefind: ${added.errors.join("; ")}`);
    const written = await index.writeFiles({ outputPath: resolve(client, "pagefind") });
    if (written.errors.length) throw new Error(`pagefind: ${written.errors.join("; ")}`);
    return added.page_count;
  } finally {
    await pagefind.close();
  }
}
