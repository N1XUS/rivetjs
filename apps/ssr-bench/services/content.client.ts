/** Public article DTO served by `/api/articles/:id`. */
export interface Article {
  id: string;
  markdown: string;
}

/** Creates the browser REST implementation of the article service. No backend transport is imported. */
export function contentClient(baseUrl = "") {
  return {
    /** Fetches a public article DTO and propagates HTTP and cancellation failures. */
    async getArticle(id: string, { signal }: { signal?: AbortSignal } = {}): Promise<Article> {
      const response = await fetch(`${baseUrl}/api/articles/${encodeURIComponent(id)}`, { signal });
      if (!response.ok) throw new Error(`Article request failed: HTTP ${response.status}`);
      const dto = (await response.json()) as Partial<Record<keyof Article, unknown>>;
      if (typeof dto.id !== "string" || typeof dto.markdown !== "string") throw new Error("Invalid article DTO");
      return dto as Article;
    },
  };
}
