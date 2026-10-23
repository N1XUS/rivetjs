// `resource()` derived slot (M6-PARITY task 3), shared by server-resource.ts and server-derived.ts: own module, so
// `resource` on a render without the derived recorder does not bundle server-derived, and a resumable app that never
// calls `resource` adds only this slot and the hooks object.

/** What the derived recorder lends `resource()` (M6-PARITY task 3): the state seed on the boundary, the Suspense retry cut. */
export interface DerivedResource {
  /** Register a resource's seed (read at the flush) on the boundary whose body is evaluating. */
  seed(get: () => unknown): void;
  /** What the derived render recorded so far (null outside one). */
  mark(): unknown;
  /** Drop the boundaries / counts recorded since `mark` (a Suspense build whose output is discarded). */
  cut(mark: unknown): void;
}
let derived: DerivedResource | null = null;
/** @internal `server-derived.ts` installs its `resource()` hooks. */
export function _onDerivedResource(value: DerivedResource): void {
  derived = value;
}
/** @internal The installed derived hooks (null: no derived recorder loaded). */
export function _derivedResource(): DerivedResource | null {
  return derived;
}
