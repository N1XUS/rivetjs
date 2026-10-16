// Bare-specifier imports for browser tests (`page.evaluate` cannot resolve them): import this module
// by root path, `const { mount, signal } = await import("/tests/browser/deps.ts")`.
export { mount } from "@rivetjs/runtime/dom";
export { signal, computed, effect, batch, untrack, useContext, createContext } from "@rivetjs/reactivity";
