// Ported from HeroUI v3.2.6 packages/react/src/components/disclosure-group/disclosure-group.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components` → `@rivetjs/cdk/disclosure` (`DisclosureGroup`);
//   `@heroui/styles` → vendored `styles/`.
// - `DisclosureGroupContext` carries plain data `{ inDisclosureGroup: true }` instead of the tv `slots` object
//   (`disclosureGroupVariants` has no variants: one module-level slots object), resumable token `rv-ui-disclosure-group`.
// - Function children go to the cdk part unchanged (it calls them with its render props; upstream wraps them).
// - Live `class` → a render-prop function for the cdk part (the composed class is a local: it reaches the cdk part as a plain value); static `class` stays a string.
// - `expandedKeys` also takes a two-way Signal (cdk).
import { DisclosureGroup as DisclosureGroupPrimitive } from "@rivetjs/cdk/disclosure";
import type { DisclosureGroupProps as DisclosureGroupPrimitiveProps, DisclosureGroupRenderProps } from "@rivetjs/cdk/disclosure";
import { createContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";

import type { DisclosureGroupVariants } from "../../../styles/src/components/disclosure-group/index.ts";
import { disclosureGroupVariants } from "../../../styles/src/components/disclosure-group/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * Disclosure Group Context
 * -----------------------------------------------------------------------------------------------*/
type DisclosureGroupContext = {
  /** Rivet: set by `DisclosureGroup` (upstream: `slots`). */
  inDisclosureGroup?: boolean;
};

const DisclosureGroupContext = resumableContext(createContext<DisclosureGroupContext>({}, { id: "rv-ui-disclosure-group" }));

let SLOTS: ReturnType<typeof disclosureGroupVariants> | undefined;
const ROOT_CONTEXT: DisclosureGroupContext = { inDisclosureGroup: true };

/* -------------------------------------------------------------------------------------------------
 * Disclosure Group Root
 * -----------------------------------------------------------------------------------------------*/
interface DisclosureGroupRootProps extends DisclosureGroupPrimitiveProps, DisclosureGroupVariants {}

const DisclosureGroupRoot = (props: DisclosureGroupRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const slots = (SLOTS ??= disclosureGroupVariants({}));
  const classOf = () => composeTwRenderProps(local.class as never, slots.base()) as string | ((v: DisclosureGroupRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: DisclosureGroupRenderProps) => renderClass(classOf(), values) : classOf();
  // A function: Rivet JSX builds nodes eagerly, the group must be created inside the provider.
  const content = () => (
    <DisclosureGroupPrimitive data-slot="disclosure-group" {...rest} class={cls as never}>
      {local.children}
    </DisclosureGroupPrimitive>
  );

  return (
    <Provider token={DisclosureGroupContext} value={ROOT_CONTEXT}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { DisclosureGroupRoot };

export type { DisclosureGroupRootProps };
