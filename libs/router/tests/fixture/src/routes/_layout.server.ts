import type { RequestEvent } from "@rivetjs/router";

export const load = ({ url }: RequestEvent) => ({ site: "Fixture", path: url.pathname });
