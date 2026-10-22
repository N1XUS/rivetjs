// `@rivetjs/reactivity` for every module of a derived build's browser bundle but the runtime's own (DERIVED-C4; the Vite
// plugin's derived alias): `signal` numbers the plain signals an adopt run makes, so a write to one the server's wake
// lists name adopts its readers first (`dom-derived.ts` `_dsignal`).
export * from "@rivetjs/reactivity";
export { _dsignal as signal } from "./dom-derived.ts";
