import type { JSX as SolidJSX } from "solid-js";
import type { IslandProps } from "@rivetjs/bridge";

declare module "@rivetjs/runtime/jsx-runtime" {
  interface RivetForeignProps<C> {
    solid: C extends (props: infer P) => infer R
      ? [R] extends [SolidJSX.Element]
        ? [SolidJSX.Element] extends [R]
          ? IslandProps<P, SolidJSX.Element>
          : never
        : never
      : never;
  }
}
export {};
