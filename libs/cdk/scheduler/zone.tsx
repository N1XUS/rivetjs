// SCHED-TZ: the scheduler's default zone as keyed state. `.tsx` gives the signal a compiler state key shared by the
// server and DOM builds (as `utils/resumed-id.tsx`), so the zone the server rendered with ("UTC") ships in the resume
// record and the adopt run reads it back instead of resolving the browser's zone.
import { signal } from "@rivetjs/reactivity";
import { getLocalTimeZone } from "../date/queries.ts";

/** The zone resolved where the state is first created (server: `"UTC"`, browser: the local zone), retained on resume. */
export function resumedZone(): string {
  const keyed = signal(typeof document === "undefined" ? "UTC" : getLocalTimeZone());
  return keyed();
}
