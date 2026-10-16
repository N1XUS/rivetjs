// @rivetjs/bridge-react/types — React components as Rivet JSX tags (import once: `import "@rivetjs/bridge-react/types"`):
// function components returning React elements, `memo` / `forwardRef` / `lazy` (exotic components) and class
// components take `IslandProps` — React props, `ReactNode` props as Rivet content, `client` / `preload` / `fallback`.
import type { Component, ExoticComponent, ReactElement, ReactNode } from "react";
import type { IslandProps } from "@rivetjs/bridge";

type ReactResult = ReactElement | null | Promise<ReactNode>;

declare module "@rivetjs/runtime/jsx-runtime" {
  interface RivetForeignObjects {
    react: ExoticComponent<any> | (abstract new (props: any) => Component<any, any>);
  }
  interface RivetForeignProps<C> {
    react: C extends ExoticComponent<infer P>
      ? IslandProps<P, ReactNode>
      : C extends abstract new (props: infer P) => Component<any, any>
        ? IslandProps<P, ReactNode>
        : C extends (props: infer P) => infer R
          ? [R] extends [null]
            ? never
            : [R] extends [ReactResult]
              ? IslandProps<P, ReactNode>
              : never
          : never;
  }
}

export {};
