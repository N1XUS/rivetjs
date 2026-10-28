// Rivet-only helper (no HeroUI counterpart). State-space path (ZERO STATESPACE, `docs/guides/resumability.md` "Native
// automata"): a component family whose whole state space a native element realises (a switch = a checkbox input; an
// accordion = `<details name>`) renders static native markup at a call site the build proved closed. The compiler
// (`libs/compiler/facts-native.ts`) checks every part the site renders against the family's `@rivet-native` declaration
// (declared data props only, no spread, no function, no other component that reads a context) and passes the root
// `$native: 1`; the root re-checks its own props here (a provider above, a live getter) before taking the path. Same
// answer on both sides (props are the same on the server and in an adopt run).
import { isSlot } from "@rivetjs/runtime/slot";

/** The build's mark on a proven call site (compiler-injected prop; never rendered). */
export const NATIVE = "$native";
/** The build's static class of a call site (VCLS, `libs/compiler/static-class.ts`; compiler-injected, never rendered). */
export const CLASS_PROP = "$cls";

/**
 * `props` came from a proven call site and hold only `allowed` keys (plus `data-*` / `aria-*`) with static data values:
 * no live getter, no function but a children slot. The native path renders them all.
 */
export function nativeProps(props: object, allowed: ReadonlySet<string>): boolean {
  if ((props as Record<string, unknown>)[NATIVE] !== 1) return false;
  for (const key in props) {
    const d = Object.getOwnPropertyDescriptor(props, key);
    if (!d || d.get !== undefined) return false;
    if (!(allowed.has(key) || key === NATIVE || key === CLASS_PROP || key.startsWith("data-") || key.startsWith("aria-"))) return false;
    const v: unknown = d.value;
    if (typeof v === "function" && !(key === "children" && isSlot(v))) return false;
  }
  return true;
}

/** The `data-*` / `aria-*` attributes of `props` (forwarded to the native root element as given). */
export function nativeAttrs(props: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key in props) if (key.startsWith("data-") || key.startsWith("aria-")) out[key] = (props as Record<string, unknown>)[key];
  return out;
}
