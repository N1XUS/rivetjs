// Offline docs search: BM25 over title (×4), description + headings (×2) and body, with camelCase / kebab-case
// identifiers also split into their words (`createAsyncList` matches "async list"). Built once per data set.
import type { McpDoc, SiteKey } from "./data.ts";

export interface SearchHit {
  id: string;
  title: string;
  description: string;
  site: SiteKey;
  kind: McpDoc["kind"];
  score: number;
  /** Best matching line (trimmed), for context. */
  snippet: string;
}

/** Lower-case word tokens; identifiers also yield their parts. */
export function tokens(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(/[A-Za-z0-9_$@./-]+/g)) {
    const word = match[0].replace(/^[./-]+|[./-]+$/g, "");
    if (!word) continue;
    const lower = word.toLowerCase();
    if (lower.length > 1) out.push(lower);
    const parts = word.split(/[./_$@-]+|(?<=[a-z0-9])(?=[A-Z])/).filter((part) => part.length > 1);
    if (parts.length > 1) for (const part of parts) out.push(part.toLowerCase());
  }
  return out;
}

interface Indexed {
  doc: McpDoc;
  length: number;
  tf: Map<string, number>;
}

export interface SearchIndex {
  search(query: string, options?: { site?: SiteKey; kind?: McpDoc["kind"]; limit?: number }): SearchHit[];
}

const K1 = 1.2;
const B = 0.75;

export function createSearchIndex(docs: readonly McpDoc[]): SearchIndex {
  const indexed: Indexed[] = [];
  const df = new Map<string, number>();
  for (const doc of docs) {
    const tf = new Map<string, number>();
    const add = (text: string, weight: number) => {
      for (const token of tokens(text)) tf.set(token, (tf.get(token) ?? 0) + weight);
    };
    add(doc.title, 4);
    add(doc.description, 2);
    add([...doc.markdown.matchAll(/^#{2,4} (.+)$/gm)].map((match) => match[1]).join("\n"), 2);
    add(doc.markdown, 1);
    let length = 0;
    for (const [token, count] of tf) {
      length += count;
      df.set(token, (df.get(token) ?? 0) + 1);
    }
    indexed.push({ doc, length, tf });
  }
  const average = indexed.reduce((sum, item) => sum + item.length, 0) / Math.max(1, indexed.length);
  const idf = (token: string) => {
    const n = df.get(token) ?? 0;
    return Math.log(1 + (indexed.length - n + 0.5) / (n + 0.5));
  };
  return {
    search(query, options = {}) {
      const terms = [...new Set(tokens(query))];
      if (!terms.length) return [];
      const hits: SearchHit[] = [];
      for (const item of indexed) {
        if (options.site && item.doc.site !== options.site) continue;
        if (options.kind && item.doc.kind !== options.kind) continue;
        let score = 0;
        let matched = 0;
        for (const term of terms) {
          const f = item.tf.get(term);
          if (!f) continue;
          matched++;
          score += idf(term) * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * item.length) / average)));
        }
        if (!score) continue;
        // Pages that match every term rank above partial matches; content pages above API / example docs on ties.
        score *= 1 + matched / terms.length;
        if (item.doc.kind === "page") score *= 1.15;
        // A title equal to the query (a component or API name) wins; a title holding every term ranks high.
        const title = item.doc.title.toLowerCase();
        if (title === query.trim().toLowerCase()) score *= 3;
        else if (terms.every((term) => title.includes(term))) score *= 1.5;
        hits.push({ id: item.doc.id, title: item.doc.title, description: item.doc.description, site: item.doc.site, kind: item.doc.kind, score, snippet: "" });
      }
      hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
      const top = hits.slice(0, options.limit ?? 10);
      const byId = new Map(indexed.map((item) => [item.doc.id, item.doc]));
      for (const hit of top) hit.snippet = snippet(byId.get(hit.id)!.markdown, terms);
      return top.map((hit) => ({ ...hit, score: Math.round(hit.score * 100) / 100 }));
    },
  };
}

/** The body line with the most query terms (headings and fences skipped). */
function snippet(markdown: string, terms: string[]): string {
  let best = "";
  let bestCount = 0;
  let inFence = false;
  for (const line of markdown.split("\n").slice(2)) {
    if (/^`{3,}/.test(line)) inFence = !inFence;
    if (inFence || !line.trim() || line.startsWith("#") || line.startsWith("Doc: ")) continue;
    const lower = line.toLowerCase();
    const count = terms.filter((term) => lower.includes(term)).length;
    if (count > bestCount) [best, bestCount] = [line, count];
  }
  const text = best.trim();
  return text.length > 240 ? text.slice(0, 237) + "…" : text;
}
