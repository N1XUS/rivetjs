// A plain module (`.ts` modules are not resume-compiled): its closures carry no symbol (serialize-fixture.tsx).
import { serialize } from "@rivetjs/runtime/resume-format";

export const plainClosure = (): (() => number) => () => 1;

/** `[serialize]` without `static [revive]`: refused when encoded (RV2102, runtime check). */
export class Conn {
  [serialize]() {
    return 1;
  }
}
