// Ported from HeroUI v3.2.6 packages/react/src/components/list-box-section/list-box-section.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `"use client"` dropped; `className` → `class` (string: the composed class is a local, a plain value for cdk `ListBoxSection`);
// `react-aria-components/ListBox` → `@rivetjs/cdk/listbox`; `@heroui/styles` → vendored `styles/`.
import { ListBoxSection as ListBoxSectionPrimitive } from "@rivetjs/cdk/listbox";
import type { ListBoxSectionProps as ListBoxSectionPrimitiveProps } from "@rivetjs/cdk/listbox";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import { listboxSectionVariants } from "../../../styles/src/components/list-box-section/index.ts";
import { splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * ListBox Section Root
 * -----------------------------------------------------------------------------------------------*/
interface ListBoxSectionRootProps<T = object> extends ListBoxSectionPrimitiveProps<T> {
  class?: string;
}

const ListBoxSectionRoot = <T extends object = object>(props: ListBoxSectionRootProps<T>): JSX.Element => {
  const [local, rest] = splitLive(props as ListBoxSectionRootProps, ["children", "class"]);
  const styles = listboxSectionVariants({ class: typeof local.class === "string" ? local.class : undefined });

  return (
    <ListBoxSectionPrimitive class={styles} {...(rest as ListBoxSectionPrimitiveProps)}>
      {local.children as never}
    </ListBoxSectionPrimitive>
  ) as JSX.Element;
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ListBoxSectionRoot };

export type { ListBoxSectionRootProps };
