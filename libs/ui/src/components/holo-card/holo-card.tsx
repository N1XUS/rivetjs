// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no holo card). Feature set inspired by HeroUI Pro's public Holo Card
// docs (a 3D tilting card with a pointer-tracked holographic glare: parts `.Rotator` / `.Frame` / `.Surface` / `.Image` /
// `.Inset` / `.Pattern` / `.Content` / `.Shine` / `.ShinePattern`; props `gradient`, `patternSize`,
// `isInteractive`, `isDisabled`, `parallaxStrength`; `--holo-card-*` variables); independent implementation, Rivet-authored styles.
// - Root `div.holo-card`: pointer move writes `--holo-card-pointer-x/y` (0–100), `--holo-card-background-x/y` (glare
//   position) and `--holo-card-opacity` (1 while the pointer is over) on itself; every transform, glare and parallax is CSS
//   (`calc()` over those numbers). Pointer leave resets them (CSS eases back). `isInteractive={false}` / `isDisabled` /
//   `prefers-reduced-motion` keep the card flat and unlit (`data-static`, CSS).
// - No image-URL texture prop: inline styles refuse `url()` (`@rivetjs/runtime/style` `unsafeStyle`), so an image texture
//   is a stylesheet rule setting `--holo-card-pattern: url(...)` on a class.
// - Touch: `touch-action: pan-y` (horizontal drags tilt, vertical drags scroll).
// - Nothing runs before input: the first pointer move resumes the card.
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import { holoCardVariants } from "../../../styles/src/components/holo-card/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";

const SLOTS = holoCardVariants();

type DivProps = Omit<JSX.IntrinsicElements["div"], "class" | "children"> & { class?: string; children?: Content };

/* -------------------------------------------------------------------------------------------------
 * HoloCard Root
 * -----------------------------------------------------------------------------------------------*/
interface HoloCardRootProps extends DivProps {
  /** CSS background of the surface (`--holo-card-gradient`). */
  gradient?: string;
  /** `background-size` of both texture layers (`--holo-card-pattern-size`). */
  patternSize?: string;
  /** Tilt and light up on pointer move. @default true */
  isInteractive?: boolean;
  /** No pointer tracking: flat and unlit. @default false */
  isDisabled?: boolean;
  /** How far `.Content` layers drift against the tilt (px at the edge). @default 10 */
  parallaxStrength?: number;
}

const HoloCardRoot = (props: HoloCardRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "gradient", "patternSize", "isInteractive", "isDisabled", "parallaxStrength", "style"]);
  const isStatic = local.isInteractive === false || local.isDisabled === true;
  const style = {
    ...(local.gradient ? { "--holo-card-gradient": local.gradient } : {}),
    ...(local.patternSize ? { "--holo-card-pattern-size": local.patternSize } : {}),
    ...(local.parallaxStrength == null ? {} : { "--holo-card-parallax": String(local.parallaxStrength) }),
    ...((local.style as object | undefined) ?? {}),
  };
  const set = (el: HTMLElement, px: number, py: number, on: number) => {
    el.style.setProperty("--holo-card-pointer-x", String(px));
    el.style.setProperty("--holo-card-pointer-y", String(py));
    el.style.setProperty("--holo-card-background-x", String(37 + (px / 100) * 26));
    el.style.setProperty("--holo-card-background-y", String(33 + (py / 100) * 34));
    el.style.setProperty("--holo-card-opacity", String(on));
  };
  // JSX attributes, not a spread object: the compiler sees these handlers (STATIC-ZERO T3 conditional handlers → a `COND`
  // boundary kept per instance that installs one), so the card resumes on its own first pointer move on a page with no
  // other boundary (a docs example frame). A spread `{ ...(isStatic ? {} : { onPointerMove }) }` hid them: no boundary,
  // no loader, the card never moved (UI-BUGS 2026-10-27).
  const onPointerMove = isStatic
    ? undefined
    : (e: PointerEvent) => {
        const el = e.currentTarget as HTMLElement;
        const box = el.getBoundingClientRect();
        if (!box.width || !box.height) return;
        const px = Math.min(100, Math.max(0, ((e.clientX - box.left) / box.width) * 100));
        const py = Math.min(100, Math.max(0, ((e.clientY - box.top) / box.height) * 100));
        el.setAttribute("data-active", "true");
        set(el, px, py, 1);
      };
  const onPointerLeave = isStatic
    ? undefined
    : (e: PointerEvent) => {
        const el = e.currentTarget as HTMLElement;
        el.removeAttribute("data-active");
        set(el, 50, 50, 0);
      };
  return (
    <div
      class={composeSlotClassName(SLOTS.base, local.class)}
      data-slot="holo-card"
      data-static={isStatic ? "true" : undefined}
      {...rest}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={style}
    >
      {local.children}
    </div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Layers
 * -----------------------------------------------------------------------------------------------*/
/** 3D tilt layer. */
const HoloCardRotator = (props: DivProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <div class={composeSlotClassName(SLOTS.rotator, local.class)} data-slot="holo-card-rotator" {...rest}>
      {local.children}
    </div>
  );
};

/** Clipping bounds the tilted card moves within. */
const HoloCardFrame = (props: DivProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <div class={composeSlotClassName(SLOTS.frame, local.class)} data-slot="holo-card-frame" {...rest}>
      {local.children}
    </div>
  );
};

/** The card body (gradient background, radius clip). */
const HoloCardSurface = (props: DivProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <div class={composeSlotClassName(SLOTS.surface, local.class)} data-slot="holo-card-surface" {...rest}>
      {local.children}
    </div>
  );
};

/** Hairline border inside the card edge. */
const HoloCardInset = (props: Omit<DivProps, "children">): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return <div aria-hidden="true" class={composeSlotClassName(SLOTS.inset, local.class)} data-slot="holo-card-inset" {...rest} />;
};

/** Static texture beneath the content. */
const HoloCardPattern = (props: Omit<DivProps, "children">): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return <div aria-hidden="true" class={composeSlotClassName(SLOTS.pattern, local.class)} data-slot="holo-card-pattern" {...rest} />;
};

/** The texture the glare reveals. */
const HoloCardShinePattern = (props: Omit<DivProps, "children">): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return <div aria-hidden="true" class={composeSlotClassName(SLOTS.shinePattern, local.class)} data-slot="holo-card-shine-pattern" {...rest} />;
};

/** Pointer-tracked holographic glare; renders a `.ShinePattern` when no children are given. */
const HoloCardShine = (props: DivProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  const children = local.children;
  return (
    <div aria-hidden="true" class={composeSlotClassName(SLOTS.shine, local.class)} data-slot="holo-card-shine" {...rest}>
      {children === undefined ? <HoloCardShinePattern /> : children}
    </div>
  );
};

/** Full-bleed card art beneath every overlay. */
const HoloCardImage = (props: Omit<JSX.IntrinsicElements["img"], "class"> & { class?: string; alt: string }): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return <img class={composeSlotClassName(SLOTS.image, local.class)} data-slot="holo-card-image" draggable={false} {...rest} />;
};

interface HoloCardContentProps extends DivProps {
  /** Drift against the tilt. @default true */
  parallax?: boolean;
}

/** A full-bleed parallax layer for the card face (render one per band). */
const HoloCardContent = (props: HoloCardContentProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "parallax"]);
  return (
    <div
      class={composeSlotClassName(SLOTS.content, local.class)}
      data-slot="holo-card-content"
      data-parallax={local.parallax === false ? "false" : "true"}
      {...rest}
    >
      {local.children}
    </div>
  );
};

export {
  HoloCardRoot,
  HoloCardRotator,
  HoloCardFrame,
  HoloCardSurface,
  HoloCardImage,
  HoloCardInset,
  HoloCardPattern,
  HoloCardContent,
  HoloCardShine,
  HoloCardShinePattern,
};
export type { HoloCardRootProps, HoloCardContentProps, DivProps as HoloCardDivProps };
