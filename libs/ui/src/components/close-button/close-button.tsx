// Ported from HeroUI v3.2.6 packages/react/src/components/close-button/close-button.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `className` → `class`; `react-aria-components/Button` → `@rivetjs/cdk/button`; `useMemo` → direct `closeButtonVariants({ variant })`
//   (one string; no slots).
// - Live props: `children` / `class` / `variant` are read lazily (`splitLive`); the composed class is a local (a plain value for cdk `Button`), so
//   when `class` / `variant` is a live getter (`hasLiveProp`) the class goes in as a render-prop function (`renderClass`).
// - Default content: upstream's inline `CloseIcon` svg → lucide `X` via `@rivetjs/kit/icon` (16px, `data-slot="close-button-icon"`).
//   Visual diff (stroked lucide vs the filled glyph); `libs/ui/CLAUDE.md` Known diffs.
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import type { ButtonProps as ButtonPrimitiveProps } from "@rivetjs/cdk/button";
import { Icon } from "@rivetjs/kit/icon";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { X } from "lucide";

import type { CloseButtonVariants } from "../../../styles/src/components/close-button/index.ts";
import { closeButtonVariants } from "../../../styles/src/components/close-button/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { renderClass, hasLiveProp, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * Close Button Root
 * -----------------------------------------------------------------------------------------------*/
interface CloseButtonRootProps extends ButtonPrimitiveProps, CloseButtonVariants {}

const CloseButtonRoot = (props: CloseButtonRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "slot", "style", "variant"]);
  const classOf = (): string | ((values: never) => string) => composeTwRenderProps(local.class as never, closeButtonVariants({ variant: local.variant }));
  const cls = hasLiveProp(local, ["class", "variant"]) ? (values: unknown) => renderClass(classOf(), values) : classOf();

  return (
    <ButtonPrimitive aria-label="Close" class={cls as never} data-slot="close-button" slot={local.slot} style={local.style} type="button" {...rest}>
      {local.children ?? <Icon icon={X} size={16} data-slot="close-button-icon" />}
    </ButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { CloseButtonRoot };

export type { CloseButtonRootProps };
