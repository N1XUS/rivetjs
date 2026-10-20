import type { RequestEvent } from "@rivetjs/router/server";
import { load } from "@rivetjs/router";

// `platform.env` is the fetch adapter's `env` argument (Workers bindings); absent under node.
export const loader = load((event: RequestEvent) => ({ greeting: "Hello edge", platform: typeof event.platform.env === "object" ? "env" : "none" }));
