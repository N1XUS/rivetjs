import { notFound, type RequestEvent } from "@rivetjs/router";

const titles: Record<string, string> = { "1": "First item", "2": "Second item" };
export const load = async ({ params, url }: RequestEvent<{ id: string }>) => {
  const title = titles[params.id];
  if (!title) throw notFound();
  // `?slow=<ms>`: a slow loader for pending UI tests.
  const slow = Number(url.searchParams.get("slow") ?? 0);
  if (slow) await new Promise((done) => setTimeout(done, slow));
  return { id: params.id, title };
};
