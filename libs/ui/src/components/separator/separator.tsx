// Ported from HeroUI v3.2.6 packages/react/src/components/separator/separator.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `className` → `class` (string); `react-aria-components/Separator` → `@rivetjs/cdk/separator`; `useSlottedContext` →
// `slottedContext` (`@rivetjs/cdk/slots`); `@heroui/styles` → vendored `styles/`. `data-slot` / `data-orientation` are
// written before `{...props}` as upstream.
// Live props: `class` / `variant` are read lazily (`splitLive`); the composed class is a local, which reaches cdk `Separator` as a
//   plain value (no getter), so when one is a live getter (`hasLiveProp`) the class goes in as a function (`renderClass`). `orientation` is read once: it picks the element
//   (`hr` / `div`) and the ARIA attributes in cdk, so a changed orientation needs a re-created part (keyed `Show`).
import { slottedContext } from "@rivetjs/cdk/slots";
import { Separator as SeparatorPrimitive, SeparatorContext } from "@rivetjs/cdk/separator";
import type { SeparatorProps as SeparatorPrimitiveProps } from "@rivetjs/cdk/separator";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { SeparatorVariants } from "../../../styles/src/components/separator/index.ts";
import { separatorVariants } from "../../../styles/src/components/separator/index.ts";
import { renderClass, hasLiveProp, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * Separator Root
 * -----------------------------------------------------------------------------------------------*/
interface SeparatorRootProps extends Omit<SeparatorPrimitiveProps, "orientation">, SeparatorVariants {}

const SeparatorRoot = (props: SeparatorRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "orientation", "variant"]);
  const context = slottedContext(SeparatorContext);
  const resolvedOrientation = local.orientation ?? context?.orientation ?? "horizontal";
  const classOf = (): string | ((values: never) => string) =>
    separatorVariants({ orientation: resolvedOrientation, variant: local.variant, class: local.class });
  const cls = hasLiveProp(local, ["class", "variant"]) ? (values: unknown) => renderClass(classOf(), values) : classOf();

  return <SeparatorPrimitive data-orientation={resolvedOrientation} data-slot="separator" orientation={resolvedOrientation} class={cls as string} {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { SeparatorRoot };

export type { SeparatorRootProps };
