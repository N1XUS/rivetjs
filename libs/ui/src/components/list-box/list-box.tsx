// Ported from HeroUI v3.2.6 packages/react/src/components/list-box/list-box.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `"use client"` dropped; `className` → `class`; `react-aria-components/ListBox` → `@rivetjs/cdk/listbox` (render props are
// accessors); `@heroui/styles` → vendored `styles/`. `React.useMemo` → the class computed in the cdk `class` value; a live `variant` /
// `class` → render-prop function (the composed class is a local: it reaches cdk `ListBox` as a plain value).
import { ListBox as ListBoxPrimitive } from "@rivetjs/cdk/listbox";
import type { ListBoxProps as ListBoxPrimitiveProps, ListBoxRenderProps } from "@rivetjs/cdk/listbox";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ListBoxVariants } from "../../../styles/src/components/list-box/index.ts";
import { listboxVariants } from "../../../styles/src/components/list-box/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * ListBox Root
 * -----------------------------------------------------------------------------------------------*/
interface ListBoxRootProps<T extends object = object> extends ListBoxPrimitiveProps<T>, ListBoxVariants {}

function ListBoxRoot<T extends object = object>(props: ListBoxRootProps<T>): JSX.Element {
  const [local, rest] = splitLive(props as ListBoxRootProps<object>, ["class", "variant"]);
  const classOf = () => composeTwRenderProps(local.class as never, listboxVariants({ variant: local.variant })) as string | ((v: ListBoxRenderProps) => string);
  const cls = hasLiveProp(local, ["class", "variant"]) ? (values: ListBoxRenderProps) => renderClass(classOf(), values) : classOf();

  return <ListBoxPrimitive class={cls as never} data-slot="list-box" {...(rest as ListBoxPrimitiveProps<object>)} />;
}

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ListBoxRoot };

export type { ListBoxRootProps };
