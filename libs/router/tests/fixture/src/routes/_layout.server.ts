import type { RequestEvent } from "@rivetjs/router";
import { load } from "@rivetjs/router";

export const loader = load(({ url }: RequestEvent) => ({ site: "Fixture", path: url.pathname }));
