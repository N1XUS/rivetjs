import type { RequestEvent } from "@rivetjs/router";

// SSR hook point of the persisted layout: the request's `Cookie` header → `cookieStorage(header)`.
export const load = ({ request }: RequestEvent) => ({ cookie: request.headers.get("cookie") ?? "" });
