import type { RequestEvent } from "@rivetjs/router/server";
import { load } from "@rivetjs/router";

// `platform.env` is the target's `env` (Workers bindings); `clientAddress` the target's client address.
export const loader = load((event: RequestEvent) => ({
  greeting: "Hello deploy",
  platform: typeof event.platform.env === "object" ? "env" : event.platform.clientAddress ? "address" : "none",
}));
