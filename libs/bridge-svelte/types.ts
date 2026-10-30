import type { Component, Snippet } from "svelte";
import type { IslandProps, RivetContent } from "@rivetjs/bridge";

// Test the branded Snippet type in the prop-to-snippet direction: snippets are assignable to void callbacks.
type SvelteProps<P> = IslandProps<{ [K in keyof P]: NonNullable<P[K]> extends Snippet<any> ? RivetContent : P[K] }>;

declare module "@rivetjs/runtime/jsx-runtime" {
  interface RivetForeignObjects {
    svelte: Component<any, any, any>;
  }
  interface RivetForeignProps<C> {
    // Component's two required parameters distinguish Svelte 5 functions from ordinary Rivet functions.
    svelte: C extends Component<infer P, any, any>
      ? C extends (...args: infer A) => unknown
        ? A extends [unknown, unknown]
          ? SvelteProps<P>
          : never
        : never
      : never;
  }
}
export {};
