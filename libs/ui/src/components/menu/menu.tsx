// Ported from HeroUI v3.2.6 packages/react/src/components/menu/menu.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `"use client"` dropped; `className` → `class`; `react-aria-components/Menu` → `@rivetjs/cdk/menu` (render props are
// accessors); `@heroui/styles` → vendored `styles/`. `React.useMemo` → the class computed once; a live `class` → render-prop
// function (the composed class is a local: it reaches cdk `Menu` as a plain value).
import { Menu as MenuPrimitive } from "@rivetjs/cdk/menu";
import type { MenuProps as MenuPrimitiveProps, MenuRenderProps } from "@rivetjs/cdk/menu";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { MenuVariants } from "../../../styles/src/components/menu/index.ts";
import { menuVariants } from "../../../styles/src/components/menu/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * Menu Root
 * -----------------------------------------------------------------------------------------------*/
interface MenuRootProps<T extends object = object> extends MenuPrimitiveProps<T>, MenuVariants {}

function MenuRoot<T extends object = object>(props: MenuRootProps<T>): JSX.Element {
  const [local, rest] = splitLive(props as MenuRootProps<object>, ["class"]);
  const classOf = () => composeTwRenderProps(local.class as never, menuVariants()) as string | ((v: MenuRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: MenuRenderProps) => renderClass(classOf(), values) : classOf();

  return <MenuPrimitive class={cls as never} data-slot="menu" {...(rest as MenuPrimitiveProps<object>)} />;
}

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { MenuRoot };

export type { MenuRootProps };
