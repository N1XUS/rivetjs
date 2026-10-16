// Rivet diagnostic code registry (`codes.json`): severity, title and docs URL per `RVnnnn` code, plus
// the ranges reserved for other packages (router RV3102+, runtime hints RV25xx). Compiler codes are
// assigned in `rust/src/diagnostics.rs`; `tests/codes.test.ts` keeps the two in sync.
import registry from "./codes.json" with { type: "json" };

/** Severity of a registered diagnostic code. */
export type Severity = "error" | "warning" | "info";

/** Registry entry of one `RVnnnn` diagnostic code. */
export interface CodeInfo {
  code: string;
  severity: Severity;
  title: string;
  /** Docs page of the code. */
  docs: string;
  /** Retired codes stay registered (codes are never reused). */
  retired?: boolean;
}

/** A block of codes reserved for another package (`owner`). */
export interface ReservedRange {
  from: string;
  to: string;
  owner: string;
  title: string;
}

/** Every registered code, in code order. */
export const CODES: readonly CodeInfo[] = registry.codes as CodeInfo[];
/** Code blocks other packages own (codes there are assigned by those packages). */
export const RESERVED: readonly ReservedRange[] = registry.reserved;

const byCode = new Map(CODES.map((info) => [info.code, info]));

/** Registry entry of `code`, if registered. */
export function codeInfo(code: string): CodeInfo | undefined {
  return byCode.get(code);
}

/** Docs URL of `code` (registered or reserved: same scheme). */
export function docsUrl(code: string): string {
  return byCode.get(code)?.docs ?? registry.docs + code;
}
