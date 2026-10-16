// Production resolution of `@rivetjs/runtime/dev/a11y`: no checks (see dev/a11y.ts). Same export set as
// the `types`/`development` target (scripts/zero-cost/condition-parity.mjs), every function a no-op.
export type { A11yRule } from "./a11y.ts";

export function noteEvent(_element: Element, _type: string): void {}
export function checkElement(_element: Element): void {}
export function checkTree(_root: Element): void {}
export function start(): void {}
