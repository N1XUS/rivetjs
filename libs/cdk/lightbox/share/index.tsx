// Ported from yet-another-react-lightbox (src/plugins/share/{Share.tsx,ShareButton.tsx,props.ts,utils.ts}, v3.32.2), MIT,
// © Igor Danchenko.
// Rivet: `<LightboxShare>` button part; Web Share API (`navigator.share`), hidden when unsupported (YARL renders nothing);
// share data = YARL `resolveShareData` (`share: { url, text, title }` | URL string | the image `src`).
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import type { StyleObject } from "@rivetjs/runtime/style";
import { getOwnerWindow } from "../../utils/dom-core.ts";
import { LightboxButton, useLightbox } from "../index.tsx";
import { isImageSlide, lightboxSlide, translateLabel, type LightboxSlide, type LightboxState } from "../state.ts";

/** Custom share handler (YARL `share.share`). */
export type LightboxShareFunction = (props: { slide: LightboxSlide }) => void;

/** Whether the browser has the Web Share API (YARL `isShareSupported`). */
export const lightboxShareSupported = (): boolean => typeof getOwnerWindow()?.navigator?.share === "function";

/** Share data of a slide (YARL `resolveShareData`). */
export function lightboxShareData(slide: LightboxSlide | undefined): ShareData | undefined {
  if (!slide || slide.share === false) return undefined;
  const share = slide.share;
  if (typeof share === "object") return share.url || share.text || share.title ? { url: share.url, text: share.text, title: share.title } : undefined;
  if (typeof share === "string") return { url: share };
  if (isImageSlide(slide) || slide.type === "pdf") return { url: (slide as { src: string }).src };
  return undefined;
}

/** Whether the slide can be shared (YARL `canShare`). */
export const lightboxCanShare = (slide: LightboxSlide | undefined, custom?: LightboxShareFunction): boolean =>
  !!slide && (custom ? slide.share !== false : !!lightboxShareData(slide));

/** Shares the current slide (YARL Share plugin action). */
export function lightboxShare(state: LightboxState, custom?: LightboxShareFunction): void {
  const slide = lightboxSlide(state);
  if (!slide || !lightboxCanShare(slide, custom)) return;
  if (custom) custom({ slide });
  else
    getOwnerWindow()
      .navigator.share(lightboxShareData(slide)!)
      .catch(() => {});
}

export interface LightboxShareProps {
  class?: string;
  style?: StyleObject;
  label?: string;
  children?: Content;
  /** Custom share (YARL `share.share`; also makes the button visible without the Web Share API). */
  share?: LightboxShareFunction;
  /** Called after sharing starts (YARL `on.share`). */
  onShare?: (props: { index: number }) => void;
}

/** Share button (YARL `ShareButton`): hidden without the Web Share API, disabled when the slide is not shareable. */
export function LightboxShare(props: LightboxShareProps) {
  const state = useLightbox();
  const custom = props.share,
    onShare = props.onShare;
  return (
    <LightboxButton
      class={props.class}
      style={props.style}
      action="share"
      label={props.label ?? translateLabel(state.labels, "Share")}
      hidden={() => !custom && typeof document !== "undefined" && !lightboxShareSupported()}
      isDisabled={() => !lightboxCanShare(lightboxSlide(state), custom)}
      onPress={() => {
        lightboxShare(state, custom);
        onShare?.({ index: state.index.value() });
      }}
    >
      {props.children}
    </LightboxButton>
  );
}
