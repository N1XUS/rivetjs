// Browser build of `@rivetjs/runtime/id` (`browser` export condition): ids created in the browser
// (CSR mounts, regions re-created after resume) are `rvc` + decimal counter, apart from server `rv` /
// `rvs` ids (namespaces: `id.ts`).
import { _nextId } from "./id.ts";
export { withIdScope, _nextId, _idScope, _inIdScope, _rowIdPrefix } from "./id.ts";

const client = { prefix: "rvc", n: 0 };

/** A document-unique id: `rvc0`, `rvc1`, … (or the nearest `withIdScope` prefix + counter). */
export function createId(): string {
  return _nextId(client);
}

/** @internal Restart the client counter (`@rivetjs/runtime/testing` `cleanup()`: test-order independent ids). */
export function _resetIds(): void {
  client.n = 0;
}
