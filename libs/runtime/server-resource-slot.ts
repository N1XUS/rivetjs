// `resource()` resume slot (lane RESOURCE), shared by server-resource.ts and server-resume.ts: own module, so `resource`
// on a non-resumable render does not bundle server-resume, and a resumable app that never calls `resource` adds only
// this slot and the hooks object.
import type { EntryRecord } from "./resume-format.ts";

/** What server-resume lends `resource()`: recipe aliasing, the function encoder chain, and the Suspense retry cut. */
export interface ResourceResume {
  /** Give `to` the recipe `from` has in this render; false when it has none. */
  alias(from: object, to: object): boolean;
  /** Encode the function values `own` recognises (chained like `_rBound`). */
  encode(own: (value: object, ref: (value: unknown) => number) => EntryRecord | undefined): void;
  /** What the active render recorded so far (null outside a resumable render). */
  mark(): unknown;
  /** Drop what was recorded since `mark` (a construction whose output is discarded). */
  cut(mark: unknown): void;
}
let hooks: ResourceResume | null = null;
/** @internal Resume ABI: server-resume installs its `resource()` hooks. */
export function _onResource(value: ResourceResume): void {
  hooks = value;
}
/** @internal The installed hooks (null: server-resume not loaded, nothing to record). */
export function _resourceResume(): ResourceResume | null {
  return hooks;
}
