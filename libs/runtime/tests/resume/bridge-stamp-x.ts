// Function Bridge T3 fix round 3 test helper: stamps module references from its own module (the development collision
// check tells stamping modules apart by the caller of `_rMod`).
import { _rMod } from "@rivetjs/runtime/server-resume";

export const stamp = (read: () => unknown, id: string): void => _rMod(read, id, 1);
