import { onPost, type RequestEvent } from "@rivetjs/router";
import { backend } from "../../server/backend.server.ts";
export const POST = onPost(async ({ request, url }: RequestEvent) => {
  const token = url.searchParams.get("token") ?? "default";
  const body = (await request.json()) as { version: number; title: string };
  const previous = backend.tasks.get(token) ?? { version: 0, title: "" };
  if (body.version !== previous.version) return Response.json(previous, { status: 409 });
  const next = { version: previous.version + 1, title: body.title };
  backend.tasks.set(token, next);
  return Response.json(next);
});
