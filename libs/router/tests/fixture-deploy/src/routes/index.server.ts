import type { RequestEvent } from "@rivetjs/router/server";

// `platform.env` is the target's `env` (Workers bindings); `clientAddress` the target's client address.
export const load = (event: RequestEvent) => ({
  greeting: "Hello deploy",
  platform: typeof event.platform.env === "object" ? "env" : event.platform.clientAddress ? "address" : "none",
});
