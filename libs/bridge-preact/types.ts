// @rivetjs/bridge-preact/types — Preact components as Rivet JSX tags (import once: `import "@rivetjs/bridge-preact/types"`):
// function components returning Preact vnodes (or exactly `ComponentChildren`: `FunctionComponent`, compat `memo` /
// `forwardRef` / `lazy`) and class components take `IslandProps` — Preact props,
// `ComponentChildren` props as Rivet content, `client` / `preload` / `fallback`.
import type { Component, ComponentChildren, VNode } from "preact";
import type { IslandProps } from "@rivetjs/bridge";

declare module "@rivetjs/runtime/jsx-runtime" {
  interface RivetForeignObjects {
    preact: abstract new (props: any) => Component<any, any>;
  }
  interface RivetForeignProps<C> {
    preact: C extends abstract new (props: infer P) => Component<any, any>
      ? IslandProps<P, ComponentChildren>
      : C extends (props: infer P) => infer R
        ? [R] extends [null]
          ? never
          : [R] extends [VNode<any> | null]
            ? IslandProps<P, ComponentChildren>
            : // `FunctionComponent` / `FC` and the `preact/compat` `memo` / `forwardRef` / `lazy` results return exactly
              // `ComponentChildren` (both ways assignable: a Rivet component returning DOM values does not match).
              [R] extends [ComponentChildren]
              ? [ComponentChildren] extends [R]
                ? IslandProps<P, ComponentChildren>
                : never
              : never
        : never;
  }
}

export {};
