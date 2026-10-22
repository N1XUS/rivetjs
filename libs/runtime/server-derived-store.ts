// `@rivetjs/reactivity/store` for a derived build's server bundle (DERIVED-C4): store reads are not tracked, so a render
// holding a store defers no boundary (`server-derived.ts` `_dstore`).
export * from "@rivetjs/reactivity/store";
export { _dstore as createStore } from "./server-derived.ts";
