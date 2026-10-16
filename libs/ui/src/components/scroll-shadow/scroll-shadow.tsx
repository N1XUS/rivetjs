// Ported from HeroUI v3.2.6 packages/react/src/components/scroll-shadow/scroll-shadow.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; React types → Rivet JSX types; `@heroui/styles` → vendored `styles/`.
// - Plain `div` root, not generic, no `render` (= upstream: `Omit<ComponentProps<"div">, "size">`).
// - Pass-through props: `{...rest}` (the `splitLive` rest; the compiler binds a native-element identifier spread live).
// - Live props (`splitLive` = runtime `splitProps`, never a destructure): `isEnabled` / `orientation` / `size` / `offset` /
//   `visibility` / `hideScrollBar` / `variant` / `class` / `style` are read in the JSX attributes and in the client effects, so
//   a changed prop updates the same scroll container in place (scroll position kept); React re-renders.
// - `useRef` + `mergeRefs(internalRef, ref)` → a `ref()` signal on the element; a passed `ref` (callback or `ref()`) is bound
//   to the same element from a client effect (runtime `bindRef`).
// - `useSafeLayoutEffect` (controlled visibility) → `clientEffect` (runs on resume without a user event); `useMemo` slots →
//   module-level memo (`slotsFor`).
// - `style` is a Rivet style object (`StyleObject`); the shadow variables come first, the passed style wins, as upstream.
import { bindRef, clientEffect, ref as createRef } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ScrollShadowVariants } from "../../../styles/src/components/scroll-shadow/index.ts";
import { scrollShadowVariants } from "../../../styles/src/components/scroll-shadow/index.ts";
import { splitLive } from "../../utils/live.tsx";

import { useScrollShadow } from "./use-scroll-shadow.tsx";

export type ScrollShadowVisibility = "auto" | "both" | "top" | "bottom" | "left" | "right" | "none";

type Orientation = "vertical" | "horizontal";

interface ScrollShadowRootProps extends Omit<JSX.IntrinsicElements["div"], "size" | "children" | "class">, ScrollShadowVariants {
  children?: Content;
  class?: string;
  /**
   * The shadow size in pixels
   * @default 40
   */
  size?: number;
  /**
   * The scroll offset before showing shadows (in pixels)
   * @default 0
   */
  offset?: number;
  /**
   * Controlled shadow visibility state
   * @default "auto"
   */
  visibility?: ScrollShadowVisibility;
  /**
   * Whether scroll shadow detection is enabled
   * @default true
   */
  isEnabled?: boolean;
  /**
   * Callback invoked when shadow visibility changes
   */
  onVisibilityChange?: (visibility: ScrollShadowVisibility) => void;
}

type ScrollShadowSlots = ReturnType<typeof scrollShadowVariants>;

/** Module-level memo per variant combination (upstream `useMemo`): tv slot functions are pure. */
const SLOTS: Record<string, ScrollShadowSlots> = {};
const slotsFor = (hideScrollBar: boolean, orientation: Orientation, variant: ScrollShadowVariants["variant"]): ScrollShadowSlots =>
  (SLOTS[`${hideScrollBar}|${orientation}|${variant}`] ??= scrollShadowVariants({ hideScrollBar, orientation, variant }));

const ScrollShadowRoot = (props: ScrollShadowRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, [
    "children",
    "class",
    "hideScrollBar",
    "isEnabled",
    "offset",
    "onVisibilityChange",
    "orientation",
    "ref",
    "size",
    "style",
    "variant",
    "visibility",
  ]);
  const internalRef = createRef<HTMLDivElement>();
  const orientation = (): Orientation => local.orientation ?? "vertical";
  const isEnabled = (): boolean => local.isEnabled ?? true;
  const offset = (): number => local.offset ?? 0;
  const size = (): number => local.size ?? 40;
  const visibility = (): ScrollShadowVisibility => local.visibility ?? "auto";

  const shadow = {
    containerRef: internalRef,
    get isEnabled() {
      return isEnabled();
    },
    get offset() {
      return offset();
    },
    get onVisibilityChange() {
      return local.onVisibilityChange;
    },
    get orientation() {
      return orientation();
    },
    get visibility() {
      return visibility();
    },
  };
  useScrollShadow(shadow);

  // Handle controlled visibility mode
  clientEffect(() => {
    const el = internalRef();
    const mode = visibility();
    const axis = orientation();

    if (!el || mode === "auto") return;

    // Clear all data attributes
    delete el.dataset["topScroll"];
    delete el.dataset["bottomScroll"];
    delete el.dataset["topBottomScroll"];
    delete el.dataset["leftScroll"];
    delete el.dataset["rightScroll"];
    delete el.dataset["leftRightScroll"];

    // Set controlled visibility
    if (mode === "both") {
      el.dataset[axis === "vertical" ? "topBottomScroll" : "leftRightScroll"] = "true";
    } else if (mode !== "none") {
      el.dataset[`${mode}Scroll`] = "true";
    }
  });

  // `mergeRefs(internalRef, ref)`: the passed ref (callback or `ref()` signal) gets the same element.
  clientEffect(() => {
    const el = internalRef();
    if (el) bindRef(el, local.ref as ((element: Element) => void) | null | undefined);
  });

  // Explicit `ref`: the hook needs the element; the passed `ref` is split out (explicit + spread `ref` = the later one wins).
  return (
    <div
      ref={internalRef}
      class={slotsFor(local.hideScrollBar ?? false, orientation(), local.variant ?? "fade").base({ class: local.class })}
      data-orientation={orientation()}
      // Selects the scroll-driven fade where supported. Controlled and disabled modes stay
      // attribute-driven, matching what the hook does for the same combination of props.
      data-scroll-shadow-mode={isEnabled() && visibility() === "auto" ? "auto" : "manual"}
      data-scroll-shadow-size={size()}
      data-slot="scroll-shadow"
      style={{
        "--scroll-shadow-size": `${size()}px`,
        "--scroll-shadow-offset": `${offset()}px`,
        ...local.style,
      }}
      {...rest}
    >
      {local.children}
    </div>
  );
};

export { ScrollShadowRoot };
export type { ScrollShadowRootProps };
