// Ported from HeroUI v3.2.6 packages/react/src/components/close-button/close-button.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `className` → `class`; `react-aria-components/Button` → `@rivetjs/cdk/button`; `useMemo` → direct `closeButtonVariants({ variant })`
//   (one string; no slots).
// - Live props: `children` / `class` / `variant` are read lazily (`splitLive`); the composed class is a local (a plain value for cdk `Button`), so
//   when `class` / `variant` is a live getter (`hasLiveProp`) the class goes in as a render-prop function (`renderClass`).
// - Default content: upstream's inline `CloseIcon` svg → lucide `X` via `@rivetjs/kit/icon` (16px, `data-slot="close-button-icon"`).
//   Visual diff (stroked lucide vs the filled glyph); `libs/ui/CLAUDE.md` Known diffs.
import { Button as ButtonPrimitive, ButtonContext } from "@rivetjs/cdk/button";
import { isHiddenPart } from "@rivetjs/cdk/collections/hidden";
import { FocusableContext } from "@rivetjs/cdk/interactions/focus";
import { PressResponderContext } from "@rivetjs/cdk/interactions/press";
import type { ButtonProps as ButtonPrimitiveProps } from "@rivetjs/cdk/button";
import { Icon } from "@rivetjs/kit/icon";
import { useContext } from "@rivetjs/reactivity";
import { createId } from "@rivetjs/runtime/id";
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

// Native path (ZERO JSLEAK, as `../button/button.tsx`): a CloseButton with no behaviour at a proven call site is
// a native `<button>`; `close-button.css` twins every pressed / hovered / focus-visible state with `:active` / `:hover` / `:focus-visible`.
// @rivet-native CloseButtonRoot(children,class,variant,isDisabled,id)
/** A context value that hands a button props or behaviour (a provider above). */
const given = (value: unknown): boolean => value != null && (typeof value !== "object" || Object.keys(value).length > 0);

/**
 * The call site is proven (`$native: 1`: declared keys only, plain data values, no handler / spread / function child —
 * `libs/compiler/facts-native.ts` checks it, so no props re-scan here), the type is not `submit` / `reset`, and nothing
 * above gives the button props or behaviour: no cdk `ButtonContext` value (slots: DialogTrigger, Select, …), no
 * `PressResponder` (triggers), no `FocusableContext` (TooltipTrigger), not the collection build pass. Same answer on the
 * server and in the browser (an ancestor's adopt run renders this branch over the server's `<button>`: the cdk part, a
 * boundary without a server record, would replace the nodes).
 */
function inertButton(props: object): boolean {
  const p = props as { $native?: unknown; type?: unknown };
  // A submit / reset button belongs to its form: the cdk Form adopts on its press (constraint validation fires
  // non-bubbling `invalid` events at the fields before any submit handler; a native press would leave them cold).
  return (
    p.$native === 1 &&
    (p.type === undefined || p.type === "button") &&
    !isHiddenPart() &&
    !given(useContext(ButtonContext)) &&
    !given(useContext(PressResponderContext)) &&
    !given(useContext(FocusableContext))
  );
}

// @rivet-class-join inertAttrs(2)
/** What the cdk part renders for static data props without behaviour (same attributes, same id sequence). */
function inertAttrs(props: object, slot: string, cls: string): Record<string, unknown> {
  const p = props as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key in p) if (key.startsWith("data-") || key.startsWith("aria-")) out[key] = p[key];
  out["data-slot"] = slot;
  out.type = p.type ?? "button";
  out.id = p.id ?? createId(); // the cdk Button's `aria.id ?? createId()`: same ids as the cdk path
  out.class = cls;
  out["data-radius"] = p.radius;
  if (p.isDisabled) ((out.disabled = true), (out["data-disabled"] = "true"));
  return out;
}

const CloseButtonRoot = (props: CloseButtonRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "slot", "style", "variant"]);
  const classOf = (): string | ((values: never) => string) => composeTwRenderProps(local.class as never, closeButtonVariants({ variant: local.variant }));
  const cls = hasLiveProp(local, ["class", "variant"]) ? (values: unknown) => renderClass(classOf(), values) : classOf();
  if (inertButton(props)) {
    const attrs = inertAttrs(props, "close-button", cls as string);
    // Two returns: a static default icon renders without a hole marker.
    if (local.children == null)
      return (
        <button aria-label="Close" {...attrs}>
          <Icon icon={X} size={16} data-slot="close-button-icon" />
        </button>
      );
    return (
      <button aria-label="Close" {...attrs}>
        {local.children as never}
      </button>
    );
  }

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
