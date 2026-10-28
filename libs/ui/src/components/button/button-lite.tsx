// Rivet-only (no HeroUI counterpart). PRESS-LITE (2026-10-28, user ruling "native"): the Button the build renders at a
// call site it proved needs no press machinery (`libs/compiler/native-lite.ts`, declared by `button.tsx`'s
// `@rivet-native-lite` pragma). The caller's `<Button …>` is rewritten to this component on both targets (same text: same
// markup and ids on the server and in an adopt run), so the page imports no cdk Button / press / hover / focus-visible /
// slots code. The proof guarantees: no provider above that a ButtonRoot reads (ButtonContext, PressResponder, Focusable,
// ButtonGroup, Form, collection build), every `on*` handler ignores its arguments (it gets the native `MouseEvent`), only
// the props below (style props constant, `type` absent or `"button"`, plain `data-*` / `aria-*`), no function children.
// Accepted semantics at these sites: a native `click` (Enter on keydown, Space on keyup, no press-up-outside cancel), no
// `data-pressed` / `data-hovered` / `data-focus-visible`: `button.css` keys every state on `:active` / `:hover` /
// `:focus-visible` / `:disabled` as well. Never used by hand.
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ButtonVariants } from "../../../styles/src/components/button/index.ts";
import { buttonVariants } from "../../../styles/src/components/button/index.ts";

/** What a proven call site may pass (`button.tsx` `@rivet-native-lite`). */
interface ButtonLiteProps extends ButtonVariants {
  children?: Content;
  id?: string;
  /** Live allowed: a getter, a value or an accessor. */
  isDisabled?: boolean | (() => boolean);
  /** Arguments never read (proven): called with the native click event. */
  onPress?: (event: MouseEvent) => void;
  radius?: "concentric";
  type?: "button";
  /** @internal The build's class for this call site (VCLS). */
  $cls?: string;
  [attr: `data-${string}` | `aria-${string}`]: unknown;
}

// VCLS: proven sites pass constant style props and no `class`, so the build passes `$cls` (no variant table shipped).
// @rivet-class ButtonLite(fullWidth,isIconOnly,size,variant) buttonVariants

const ButtonLite = (props: ButtonLiteProps): JSX.Element => {
  const attrs: Record<string, unknown> = {};
  for (const key in props) if (key.startsWith("data-") || key.startsWith("aria-")) attrs[key] = (props as Record<string, unknown>)[key];
  const disabled = (): boolean => {
    const value = props.isDisabled;
    return !!(typeof value === "function" ? value() : value);
  };
  return (
    <button
      data-radius={props.radius}
      {...attrs}
      data-slot="button"
      type="button"
      id={props.id}
      class={props.$cls ?? buttonVariants({ fullWidth: props.fullWidth, isIconOnly: props.isIconOnly, size: props.size, variant: props.variant })}
      disabled={disabled()}
      data-disabled={disabled() ? "true" : undefined}
      onClick={props.onPress}
    >
      {props.children}
    </button>
  );
};

export { ButtonLite };
export type { ButtonLiteProps };
