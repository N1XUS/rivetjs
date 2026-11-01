/**
 * Run `fn` with resume recording suspended: nothing it renders registers ids, bindings, handlers or
 * markers (output a pass only inspects and discards — cdk's collection build pass). In the browser, or outside a
 * resumable render, it is `fn()`. `server-derived` installs the real implementation on import (`_setUnrecorded`), so
 * this entry stays trivial where no recorder exists.
 */
export function _rUnrecorded<T>(fn: () => T): T {
  return unrecorded(fn);
}
let unrecorded: <T>(fn: () => T) => T = (fn) => fn();
/**
 * Derived client: the decoder of table-encoded `Async` values (tail `a` entries settled `2`), installed by whoever already
 * ships `createDecoder` (the router's generated derived `Root`) so the derived runtime carries none of it. Null: such a
 * hole renders in the browser.
 */
export let _tableDecoder: ((table: readonly unknown[]) => { get: (index: number) => unknown }) | null = null;
/** @internal `server-derived` hook. */
export function _setUnrecorded(run: <T>(fn: () => T) => T): void {
  unrecorded = run;
}
/** @internal The format module installs its decoder only when a consumer uses it. */
export function _setTableDecoder(decoder: typeof _tableDecoder): void {
  _tableDecoder = decoder;
}
