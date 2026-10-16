// Types shared by pages and server code. Page files cannot import types from `.server.ts` files.
import type { Root } from "mdast";

export interface PostSummary {
  slug: string;
  title: string;
  date: string;
}
export interface Post extends PostSummary {
  /** The Markdown syntax tree (plain objects), rendered by <Markdown>. */
  tree: Root;
}
