// Ported from yet-another-react-lightbox (src/plugins/captions/{Captions.tsx,Title.tsx,Description.tsx,CaptionsButton.tsx,
// CaptionsContext.tsx,props.ts}, v3.32.2), MIT, © Igor Danchenko.
// Rivet:
// - `<LightboxCaptions>` renders the current slide's `title` / `description` once (over the carousel, absolutely
//   positioned by CSS) instead of once per slide (YARL renders them inside every slide's `render.slideFooter`); the text
//   swaps with the slide.
// - Visibility lives in the lightbox state (`state.captions`, resumable; YARL CaptionsContext `visible`), toggled by
//   `<LightboxCaptionsToggle>` (YARL `showToggle` button); both parts take `hidden` (initial: hidden).
// - `descriptionMaxLines` = `-webkit-line-clamp` inline; `descriptionTextAlign` = `text-align`.
import { Show } from "@rivetjs/runtime/dom";
import type { StyleObject } from "@rivetjs/runtime/style";
import { LightboxButton, lightboxToggleContent, useLightbox, type LightboxToggleChildren } from "../index.tsx";
import { lightboxSlide, translateLabel, type LightboxState } from "../state.ts";

/** Captions plugin options (YARL `CaptionsProps`). */
export interface LightboxCaptionsOptions {
  /** Initially hidden. @default false */
  hidden?: boolean;
  /** Description text alignment. @default "start" */
  descriptionTextAlign?: "start" | "end" | "center";
  /** Description lines shown (0 = all). @default 3 */
  descriptionMaxLines?: number;
}

/** Whether captions are visible (tracked). */
export const lightboxCaptionsVisible = (state: LightboxState, hidden = false): boolean => state.captions() ?? !hidden;

/** Shows / hides the captions (YARL `captions.ref` `show` / `hide`). */
export function setLightboxCaptions(state: LightboxState, visible: boolean): void {
  state.captions.set(visible);
}

export interface LightboxCaptionsProps extends LightboxCaptionsOptions {
  /** @default "rv-LightboxCaptions" */
  class?: string;
  style?: StyleObject;
  /** @default "rv-LightboxCaptionsTitle" */
  titleClass?: string;
  /** @default "rv-LightboxCaptionsDescription" */
  descriptionClass?: string;
}

/** The current slide's title and description (YARL Captions `Title` + `Description`). */
export function LightboxCaptions(props: LightboxCaptionsProps) {
  const state = useLightbox();
  const hidden = props.hidden ?? false,
    align = props.descriptionTextAlign ?? "start",
    lines = props.descriptionMaxLines ?? 3;
  const cls = props.class ?? "rv-LightboxCaptions",
    style = props.style,
    titleCls = props.titleClass ?? "rv-LightboxCaptionsTitle",
    descriptionCls = props.descriptionClass ?? "rv-LightboxCaptionsDescription";
  const clamp = lines > 0 ? { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: String(lines), overflow: "hidden" } : {};
  return (
    <Show when={() => lightboxCaptionsVisible(state, hidden) && !!(lightboxSlide(state)?.title || lightboxSlide(state)?.description)}>
      {() => (
        <div class={cls} style={style as never} data-lightbox-captions="">
          <Show when={() => !!lightboxSlide(state)?.title}>{() => <div class={titleCls}>{lightboxSlide(state)?.title}</div>}</Show>
          <Show when={() => !!lightboxSlide(state)?.description}>
            {() => (
              <div class={descriptionCls} style={{ textAlign: align, whiteSpace: "pre-line", ...clamp } as never}>
                {lightboxSlide(state)?.description}
              </div>
            )}
          </Show>
        </div>
      )}
    </Show>
  );
}

export interface LightboxCaptionsToggleProps {
  class?: string;
  style?: StyleObject;
  /** Initially hidden (same value as the `LightboxCaptions` part). @default false */
  hidden?: boolean;
  /** Label override (default "Show captions" / "Hide captions"). */
  label?: string;
  /** Icon: content, or a function of the visible state. */
  children?: LightboxToggleChildren;
}

/** Show / hide captions button (YARL `CaptionsButton`, `aria-pressed` = visible). */
export function LightboxCaptionsToggle(props: LightboxCaptionsToggleProps) {
  const state = useLightbox();
  const hidden = props.hidden ?? false,
    label = props.label,
    children = props.children;
  const visible = () => lightboxCaptionsVisible(state, hidden);
  return (
    <LightboxButton
      class={props.class}
      style={props.style}
      action="captions"
      pressed={visible}
      label={() => label ?? translateLabel(state.labels, visible() ? "Hide captions" : "Show captions")}
      onPress={() => setLightboxCaptions(state, !lightboxCaptionsVisible(state, hidden))}
    >
      {lightboxToggleContent(children, visible)}
    </LightboxButton>
  );
}
