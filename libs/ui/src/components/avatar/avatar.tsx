// Ported from HeroUI v3.2.6 packages/react/src/components/avatar/avatar.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `@radix-ui/react-avatar` → the in-tree signal port `../../vendor/radix-avatar/avatar-primitive.tsx`.
// - `AvatarContext` carries plain data `{ color, size, variant }` (defaulted; `variant: null` = none) instead of the tv `slots` object:
//   resumable token `rv-ui-avatar`, default `{}` (= outside an `Avatar`); parts look the slots up in a module-level memo (`slotsFor`,
//   key `${color}|${size}|${variant}`). The root element is built inside the provider (Rivet JSX is eager).
// - `AvatarGroupContext` / `AVATAR_GROUP_CHILD` come from `../avatar-group/avatar-group-context.ts`. Upstream reads the group
//   context only for the group's cloned direct children (`AVATAR_GROUP_CHILD: true`); Rivet has no clone: every Avatar under an
//   `AvatarGroup` reads it and registers with the group (`register()` / `isVisible(id)`: `max` truncation without `Children`),
//   `{ [AVATAR_GROUP_CHILD]: false }` opts out (the group's `Count`). A registered Avatar renders through a `computed` visibility
//   (a `Show`: re-created only when it crosses `max`).
// - Image: no SSR `<img>` (radix: status `idle` until the client probe loads it); the fallback is the server markup. `src` /
//   `crossOrigin` / `referrerPolicy` pass through as value or accessor (the primitive re-probes on change).
// - `Avatar.Image` `asChild` (radix Slot: a custom image component as the child, e.g. Next.js `<Image>`) → `render={(props) =>
//   <MyImage {...props} />}` (the primitive's `render`, called with the image attributes incl. `src` and the slot class).
// - Live props: parts read props lazily (`splitLive` = runtime `splitProps`, never a destructure); the context value's fields are
//   getters over the root's props (+ the group context), parts read it inside their class binding, so a changed `color` / `size` /
//   `variant` / `class` updates in place.
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider, Show } from "@rivetjs/runtime/dom";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { AvatarVariants } from "../../../styles/src/components/avatar/index.ts";
import { avatarVariants } from "../../../styles/src/components/avatar/index.ts";
import * as AvatarPrimitive from "../../vendor/radix-avatar/avatar-primitive.tsx";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";

import { AVATAR_GROUP_CHILD, AvatarGroupContext } from "../avatar-group/avatar-group-context.ts";

/* ------------------------------------------------------------------------------------------------
 * Avatar Context
 * --------------------------------------------------------------------------------------------- */
interface AvatarContext {
  color?: AvatarVariants["color"];
  size?: AvatarVariants["size"];
  /** `null`: no variant (avatarVariants has no default variant). */
  variant?: AvatarVariants["variant"] | null;
}

const AvatarContext = createContext<AvatarContext>({});

type AvatarSlots = ReturnType<typeof avatarVariants>;

/** Module-level memo per `color|size|variant` (tv slot functions are pure). */
const SLOTS: Record<string, AvatarSlots> = {};
const slotsFor = (color: AvatarVariants["color"], size: AvatarVariants["size"], variant: AvatarVariants["variant"] | null | undefined): AvatarSlots =>
  (SLOTS[`${color}|${size}|${variant ?? "none"}`] ??= avatarVariants({ color, size, variant: variant ?? undefined }));

/** Upstream `use(AvatarContext).slots`: `undefined` outside an `Avatar`. Read inside the part's class binding (live getters). */
const slotsOf = (context: AvatarContext): AvatarSlots | undefined => {
  const size = context.size;
  return size === undefined ? undefined : slotsFor(context.color, size, context.variant);
};

/* -------------------------------------------------------------------------------------------------
 * Avatar Root
 * -----------------------------------------------------------------------------------------------*/
interface AvatarRootProps extends Omit<AvatarPrimitive.RootProps, "color" | "class">, AvatarVariants {
  class?: string;
  [AVATAR_GROUP_CHILD]?: boolean;
}

const AvatarRoot = (props: AvatarRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "color", "size", "variant", AVATAR_GROUP_CHILD]);
  // Upstream: only direct children of AvatarGroup (cloned with the marker). Rivet: every Avatar under a group unless opted out.
  const shouldUseContext = local[AVATAR_GROUP_CHILD] !== false;
  const avatarGroupContext = shouldUseContext ? useContext(AvatarGroupContext) : undefined;

  // Merge props with precedence: direct props > context props (getters: live props and a live group context follow)
  const contextValue: AvatarContext = {
    get color() {
      return local.color ?? (shouldUseContext ? avatarGroupContext?.color : undefined) ?? "default";
    },
    get size() {
      return local.size ?? (shouldUseContext ? avatarGroupContext?.size : undefined) ?? "md";
    },
    get variant() {
      return local.variant ?? (shouldUseContext ? avatarGroupContext?.variant : undefined) ?? null;
    },
  };

  const content = () => (
    <AvatarPrimitive.Root class={slotsOf(contextValue)!.base({ class: local.class })} {...rest}>
      {local.children}
    </AvatarPrimitive.Root>
  );

  // Registered with an AvatarGroup: rendered while within `max` (upstream: the group slices its children).
  const group = avatarGroupContext?.register !== undefined ? avatarGroupContext : undefined;
  if (group !== undefined) {
    const id = group.register!();
    // `Show` (not a bare `{cond ? … : null}` accessor, which the enclosing children insert re-reads and would re-create).
    return (
      <Show when={() => group.isVisible!(id)}>
        {() => (
          <Provider token={AvatarContext} value={contextValue}>
            {content()}
          </Provider>
        )}
      </Show>
    );
  }

  return (
    <Provider token={AvatarContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Avatar Image
 * -----------------------------------------------------------------------------------------------*/
interface AvatarImageProps extends Omit<AvatarPrimitive.ImageProps, "class"> {
  class?: string;
}

const AvatarImage = (props: AvatarImageProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(AvatarContext);

  return <AvatarPrimitive.Image class={composeSlotClassName(slotsOf(context)?.image, local.class)} {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Avatar Fallback
 * -----------------------------------------------------------------------------------------------*/
interface AvatarFallbackProps extends Omit<AvatarPrimitive.FallbackProps, "class" | "color"> {
  class?: string;
  color?: AvatarVariants["color"];
}

const AvatarFallback = (props: AvatarFallbackProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "color"]);
  const context = useContext(AvatarContext);

  return (
    <AvatarPrimitive.Fallback
      class={composeSlotClassName(slotsOf(context)?.fallback, local.class, { color: local.color })}
      data-slot="avatar-fallback"
      {...rest}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { AvatarRoot, AvatarImage, AvatarFallback };

export type { AvatarRootProps, AvatarImageProps, AvatarFallbackProps };
