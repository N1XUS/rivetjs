import { marked } from "marked";
import { error, type RequestEvent } from "@rivetjs/router";
import { contentServer, textProfile } from "../../services/content.server.ts";
import type { Page } from "../../services/page-decoder.ts";

// One reused native gRPC channel per process, as in `server.ts`.
const service = contentServer(process.env.GRPC_URL ?? "127.0.0.1:18100");

export interface PageRequest {
  rows: number;
  token: string;
  article: boolean;
  delayMs: number;
  strings?: number;
}
export async function loadPage(request: PageRequest, signal: AbortSignal): Promise<{ page: Page; articleHtml: string }> {
  const page = await service.getPage(request, { signal });
  return { page, articleHtml: page.markdown ? marked.parse(page.markdown, { async: false }) : "" };
}
export function closeContent(): void {
  service.close();
}

/** The `/page` request contract of `server.ts` (rows / delay_ms / token bounds → 400, `strings=1` escaping /
 * `strings=2` text-grid variants) as a route loader; shared by the `page` and `resume` routes. */
export async function loadBenchPage({ url, request }: Pick<RequestEvent, "url" | "request">) {
  const rows = Number(url.searchParams.get("rows") ?? 100);
  const delayMs = Number(url.searchParams.get("delay_ms") ?? 0);
  const token = url.searchParams.get("token") ?? "";
  const article = url.searchParams.get("article") === "1";
  if (!Number.isInteger(rows) || rows < 0 || rows > 5000 || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 5000 || token.length > 512)
    throw error(400, "Bad request");
  // Rivet JSX has no raw-HTML sink: the article variant is not supported by the router lanes.
  if (article) throw error(400, "article=1 is not supported by the router lane");
  const { page } = await loadPage({ rows, token, article, delayMs, strings: textProfile(url.searchParams.get("strings")) }, request.signal);
  return { title: page.title, token: page.token, rows: page.rows };
}
