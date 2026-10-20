import type { RequestEvent } from "@rivetjs/router";
import { load } from "@rivetjs/router";

// SSR hook point of the persisted layout: the request's `Cookie` header → `cookieStorage(header)`.
export const loader = load(({ request }: RequestEvent) => ({ cookie: request.headers.get("cookie") ?? "" }));
