// `@rivetjs/reactivity` for every module of a derived build's server bundle but the runtime's own (DERIVED-C4; the Vite
// plugin's derived alias): `signal` / `computed` / `selector` note which boundary made and read each source
// (`server-derived.ts` "Dependency facts"), so the browser can adopt closed heavy boundaries after their parent.
export * from "@rivetjs/reactivity";
export { _dsignal as signal, _dcomputed as computed, _dselector as selector } from "./server-derived.ts";
