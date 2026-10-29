// @rivetjs/bridge — public types of framework islands (spec §3.1): the island props a framework component takes when a
// Rivet module renders it (`IslandProps`), the island options (`client` / `preload` / `persist` / `fallback`), and the
// content Rivet passes into a framework slot. Adapters' type modules (`@rivetjs/bridge-react/types`, …) register their
// frameworks through the runtime's `RivetForeignObjects` / `RivetForeignProps<C>` (JSX `LibraryManagedAttributes`).
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import type { ClientPolicy, PreloadStrategy } from "./adapter.ts";

export type { ClientOn, ClientPolicy, PreloadStrategy } from "./adapter.ts";

/** Rivet content in a framework slot (`children`, a content prop): JSX, text, numbers, lists, render functions. */
export type RivetContent = JSX.Element | string | number | bigint | boolean | null | undefined | readonly RivetContent[] | (() => RivetContent);

/** Island options every framework island takes (read once by the island; never passed to the framework). */
export interface IslandOptions {
  /** Hydration policy; absent = static HTML (hydrates on the first live prop change when a prop is live). */
  client?: ClientPolicy;
  /** Chunk preload strategy. No effect on the derived resume model: island chunks are fetched ahead of their trigger. */
  preload?: PreloadStrategy;
  /**
   * Reserved: keeps the island alive across client navigations once implemented (roadmap). No effect yet; the island
   * reads it and never passes it to the framework component.
   */
  persist?: string;
  /** Rivet content shown when the island fails to render, and in place of a `client="only"` island until it mounts. */
  fallback?: RivetContent;
}

/**
 * Island props of a framework component with props `P`: `P` with every prop that takes the framework's node type
 * (`Node`: React `ReactNode`, Preact `ComponentChildren`, …) accepting Rivet content instead (a slot), plus the island
 * options.
 */
export type IslandProps<P, Node = never> = {
  [K in keyof P]: [Node] extends [never] ? P[K] : [NonNullable<Node>] extends [NonNullable<P[K]>] ? RivetContent : P[K];
} & IslandOptions;
