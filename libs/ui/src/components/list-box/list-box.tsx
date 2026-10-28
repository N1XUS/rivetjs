// Ported from HeroUI v3.2.6 packages/react/src/components/list-box/list-box.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `"use client"` dropped; `className` → `class`; `react-aria-components/ListBox` → `@rivetjs/cdk/listbox` (render props are
// accessors); `@heroui/styles` → vendored `styles/`. `React.useMemo` → the class computed in the cdk `class` value; a live `variant` /
// `class` → render-prop function (the composed class is a local: it reaches cdk `ListBox` as a plain value).
import { ListBox as ListBoxPrimitive } from "@rivetjs/cdk/listbox";
import type { ListBoxProps as ListBoxPrimitiveProps, ListBoxRenderProps } from "@rivetjs/cdk/listbox";
import { isHidden } from "@rivetjs/cdk/collections/hidden";
import { lazyComponent } from "@rivetjs/runtime/dom";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ListBoxVariants } from "../../../styles/src/components/list-box/index.ts";
import { listboxVariants } from "../../../styles/src/components/list-box/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * ListBox Root
 * -----------------------------------------------------------------------------------------------*/
interface ListBoxRootProps<T extends object = object> extends ListBoxPrimitiveProps<T>, ListBoxVariants {
  /** Render only the rows in view. Give the list a fixed height. */
  virtualized?: boolean;
  /** Row height in px for virtualization (the default item min-h-9). @default 36 */
  rowHeight?: number;
  /** Viewport size of the server-rendered window. @default { width: 800, height: 600 } */
  initialSize?: { width: number; height: number };
}

// Only pages with a server-rendered virtual list load its implementation before adoption.
// lazyComponent's module value cannot be serialized by Async; preloading keeps adoption synchronous
// and preserves the first held interaction. Client-only virtual lists still load on demand.
const VirtualizedListBox = lazyComponent(() => import("./list-box-virtualized.tsx"));
if (typeof document !== "undefined" && document.querySelector('[data-ui-virtualized="true"][data-slot="list-box"]')) {
  await (VirtualizedListBox as typeof VirtualizedListBox & { load: () => Promise<unknown> }).load();
}

function ListBoxRoot<T extends object = object>(props: ListBoxRootProps<T>): JSX.Element {
  const [local, rest] = splitLive(props as ListBoxRootProps<object>, ["class", "variant", "virtualized", "rowHeight", "initialSize"]);
  const classOf = () => composeTwRenderProps(local.class as never, listboxVariants({ variant: local.variant })) as string | ((v: ListBoxRenderProps) => string);
  const cls = hasLiveProp(local, ["class", "variant"]) ? (values: ListBoxRenderProps) => renderClass(classOf(), values) : classOf();

  // Collection registration is synchronous, including a closed picker's hidden build pass.
  if (local.virtualized && !isHidden()) {
    return <VirtualizedListBox composed={cls as never} {...rest} rowHeight={local.rowHeight} initialSize={local.initialSize} />;
  }
  return <ListBoxPrimitive class={cls as never} data-slot="list-box" {...(rest as ListBoxPrimitiveProps<object>)} />;
}

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ListBoxRoot };

export type { ListBoxRootProps };
