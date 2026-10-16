// Ported from HeroUI v3.2.6 packages/react/src/components/switch-group/switch-group.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `"use client"` dropped; `className` → `class`; `@heroui/styles` → vendored `styles/`; generic `dom.div` (`render`) as
// upstream; live `class` / `orientation` are read in the JSX attributes (classes update in place).
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { SwitchGroupVariants } from "../../../styles/src/components/switch-group/index.ts";
import { switchGroupVariants } from "../../../styles/src/components/switch-group/index.ts";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * Switch Group Root
 * -----------------------------------------------------------------------------------------------*/
interface SwitchGroupRootProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
  /** Layout orientation. */
  orientation?: SwitchGroupVariants["orientation"];
}

type SwitchGroupRootDivProps = SwitchGroupRootProps & Omit<JSX.IntrinsicElements["div"], keyof SwitchGroupRootProps>;

type SwitchGroupSlots = ReturnType<typeof switchGroupVariants>;

/** Module-level memo per `orientation` (upstream `useMemo`; tv slot functions are pure). */
const SLOTS: Record<string, SwitchGroupSlots> = {};
const slotsFor = (orientation: SwitchGroupVariants["orientation"]): SwitchGroupSlots => (SLOTS[String(orientation)] ??= switchGroupVariants({ orientation }));

const SwitchGroupRoot = <E extends keyof JSX.IntrinsicElements = "div">(props: SwitchGroupRootProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as SwitchGroupRootDivProps, ["children", "class", "orientation"]);

  return (
    <dom.div data-slot="switch-group" {...rest} class={slotsFor(local.orientation).base({ className: local.class })}>
      <dom.div class={slotsFor(local.orientation).items()} data-slot="switch-group-items">
        {local.children}
      </dom.div>
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { SwitchGroupRoot };
export type { SwitchGroupRootProps, SwitchGroupRootDivProps };
