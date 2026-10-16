// Ported from yet-another-react-lightbox (src/plugins/inline/{Inline.tsx,InlineContainer.tsx}, v3.32.2), MIT,
// © Igor Danchenko.
// Rivet:
// - `<LightboxInline>`: the lightbox view rendered in place (no overlay, no Close, no focus grab, no scroll lock) —
//   YARL's Inline plugin replaces the portal with a container. Server-rendered: the current slide (and its window) are
//   in the HTML; on a resumed page nothing runs until the first pointer / focus / key interaction installs the browser
//   listeners (wheel) — no load effect.
// - Size it with `class` / `style` (YARL `inline.style`); the root is `position: relative`.
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import type { StyleObject } from "@rivetjs/runtime/style";
import { useId } from "../../utils/id.ts";
import { LightboxView } from "../index.tsx";
import { createLightboxState, translateLabel, type LightboxStateProps } from "../state.ts";

export interface LightboxInlineProps extends LightboxStateProps {
  id?: string;
  /** Root class. @default "rv-LightboxInline" */
  class?: string;
  /** Root style (give it a size: `aspect-ratio`, `height`). */
  style?: StyleObject;
  /** Class of the container (gesture surface). @default "rv-LightboxContainer" */
  containerClass?: string;
  /** Accessible name of the gallery region. @default labels["Photo gallery"] */
  "aria-label"?: string;
  /** Parts (default: carousel + previous / next). */
  children?: Content | (() => Content);
}

/** An inline (in-page) lightbox carousel (YARL Inline plugin). */
export function LightboxInline(props: LightboxInlineProps) {
  const id = useId(props.id);
  const state = createLightboxState(props, id);
  const cls = props.class ?? "rv-LightboxInline",
    style = props.style,
    children = props.children,
    containerCls = props.containerClass;
  const label = props["aria-label"] ?? translateLabel(state.labels, "Photo gallery");
  return (
    <section class={cls} aria-label={label} data-lightbox-inline="" style={{ position: "relative", ...style } as never}>
      <LightboxView state={state} class={containerCls}>
        {children}
      </LightboxView>
    </section>
  );
}
