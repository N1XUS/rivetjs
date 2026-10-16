// Ported from HeroUI v3.2.6 packages/react/src/components/menu-section/menu-section.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `"use client"` dropped; `className` → `class` (string: the composed class is a local, a plain value for cdk `MenuSection`);
// `react-aria-components/Menu` → `@rivetjs/cdk/menu`; `@heroui/styles` → vendored `styles/`.
import { MenuSection as MenuSectionPrimitive } from "@rivetjs/cdk/menu";
import type { MenuSectionProps as MenuSectionPrimitiveProps } from "@rivetjs/cdk/menu";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import { menuSectionVariants } from "../../../styles/src/components/menu-section/index.ts";
import { splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * Menu Section Root
 * -----------------------------------------------------------------------------------------------*/
interface MenuSectionRootProps<T = object> extends MenuSectionPrimitiveProps<T> {
  class?: string;
}

const MenuSectionRoot = <T extends object = object>(props: MenuSectionRootProps<T>): JSX.Element => {
  const [local, rest] = splitLive(props as MenuSectionRootProps, ["children", "class"]);
  const styles = menuSectionVariants({ class: typeof local.class === "string" ? local.class : undefined });

  return (
    <MenuSectionPrimitive class={styles} {...(rest as MenuSectionPrimitiveProps)}>
      {local.children as never}
    </MenuSectionPrimitive>
  ) as JSX.Element;
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { MenuSectionRoot };

export type { MenuSectionRootProps };
