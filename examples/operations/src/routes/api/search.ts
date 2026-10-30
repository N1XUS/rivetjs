import { onGet, type RequestEvent } from "@rivetjs/router";
import { backend } from "../../server/backend.server.ts";
export const GET = onGet(async ({ url, signal }: RequestEvent) => {
  const q = url.searchParams.get("q") ?? "";
  backend.stats.searchStarted++;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(done, q === "slow" ? 250 : 20);
    function done() {
      signal.removeEventListener("abort", abort);
      resolve();
    }
    function abort() {
      clearTimeout(timer);
      backend.stats.searchAborted++;
      done();
    }
    signal.addEventListener("abort", abort, { once: true });
  });
  return q === "error" ? Response.json({ error: "deliberate" }, { status: 503 }) : Response.json({ q });
});
