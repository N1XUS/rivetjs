// Register Vue component objects/constructors as Rivet JSX tags without enabling Vue's global JSX namespace.
import type { ComponentOptions, FunctionalComponent, VNode, VNodeChild } from "vue";
import type { IslandProps, RivetContent } from "@rivetjs/bridge";

type VueConstructor = abstract new (...args: any[]) => { $props: object; $slots: object };
type SlotProps<S> = string extends keyof S ? {} : { [K in keyof S]?: RivetContent };
type VueProps<P> = IslandProps<P, VNodeChild> & { children?: RivetContent };
type FunctionProps<C> = C extends (props: infer P, ...args: any[]) => infer R
  ? [R] extends [VNode | VNode[] | null]
    ? [R] extends [null]
      ? never
      : VueProps<P>
    : never
  : never;

declare module "@rivetjs/runtime/jsx-runtime" {
  interface RivetForeignObjects {
    vue: VueConstructor | ComponentOptions | FunctionalComponent<any>;
  }
  interface RivetForeignProps<C> {
    vue: C extends abstract new (...args: any[]) => { $props: infer P; $slots: infer S }
      ? VueProps<P> & SlotProps<S>
      : C extends FunctionalComponent<infer P>
        ? "props" extends keyof C
          ? VueProps<P>
          : FunctionProps<C>
        : FunctionProps<C>;
  }
}
export {};
