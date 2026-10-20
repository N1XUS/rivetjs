import type { RequestEvent } from "@rivetjs/router";
import { onGet } from "@rivetjs/router";

/** The client-rendered demo moved to the resumed pages: permanent redirect, query kept. */
export const GET = onGet(({ url }: RequestEvent) => new Response(null, { status: 308, headers: { location: "/" + url.search } }));
