// Ported from yet-another-react-lightbox (src/plugins/fullscreen/{Fullscreen.tsx,FullscreenButton.tsx,
// FullscreenContext.tsx,props.ts}, v3.32.2), MIT, © Igor Danchenko.
// Rivet:
// - `<LightboxFullscreen>` toggle button part; the fullscreen element is the lightbox root (`[data-lightbox-root]`, or the
//   inline root / container), with WebKit prefixes like YARL.
// - State in `state.fullscreen` (resumable), synced from `fullscreenchange` (listener installed on first use).
// - `auto`: enter when the (modal) lightbox opens (YARL `auto`); leaving the lightbox exits fullscreen.
// - Hidden when the Fullscreen API is unavailable (YARL renders nothing; iOS Safari).
import { onCleanup, untrack } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import type { StyleObject } from "@rivetjs/runtime/style";
import { lightboxContainer } from "../behaviour.ts";
import { LightboxButton, lightboxToggleContent, useLightbox, type LightboxToggleChildren } from "../index.tsx";
import { translateLabel, type LightboxState } from "../state.ts";

type FsDocument = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

const fsDoc = (): FsDocument | undefined => globalThis.document as FsDocument | undefined;

/** Whether the Fullscreen API is available (YARL `isFullscreenEnabled`). Server: `true` (unknown). */
export function lightboxFullscreenEnabled(): boolean {
  const d = fsDoc();
  return !d || !!(d.fullscreenEnabled ?? d.webkitFullscreenEnabled);
}

const fullscreenElement = (): Element | null | undefined => {
  const d = fsDoc();
  return d?.fullscreenElement ?? d?.webkitFullscreenElement;
};

function target(state: LightboxState): FsElement | null {
  const container = lightboxContainer(state);
  return (container?.closest<FsElement>("[data-lightbox-root],[data-lightbox-inline]") ?? container) as FsElement | null;
}

const listening = new WeakSet<LightboxState>();

function listen(state: LightboxState): void {
  const d = fsDoc();
  if (!d || listening.has(state)) return;
  listening.add(state);
  const sync = () => {
    const el = target(state);
    state.fullscreen.set(!!el && fullscreenElement() === el);
  };
  d.addEventListener("fullscreenchange", sync);
  d.addEventListener("webkitfullscreenchange", sync);
}

/** Enters fullscreen (YARL `fullscreen.ref.enter`). */
export function lightboxEnterFullscreen(state: LightboxState): void {
  const el = target(state);
  if (!el || !lightboxFullscreenEnabled()) return;
  listen(state);
  const request = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
  request?.()?.catch?.(() => {});
}

/** Exits fullscreen (YARL `fullscreen.ref.exit`). */
export function lightboxExitFullscreen(state: LightboxState): void {
  const d = fsDoc();
  const el = target(state);
  if (!d || !el || fullscreenElement() !== el) return;
  const exit = d.exitFullscreen?.bind(d) ?? d.webkitExitFullscreen?.bind(d);
  exit?.()?.catch?.(() => {});
}

export interface LightboxFullscreenProps {
  class?: string;
  style?: StyleObject;
  /** Label override (default "Enter Fullscreen" / "Exit Fullscreen"). */
  label?: string;
  /** Icon: content, or a function of the fullscreen state. */
  children?: LightboxToggleChildren;
  /** Enter fullscreen when the lightbox opens. @default false */
  auto?: boolean;
  /** Called on enter / exit (YARL `on.enterFullscreen` / `on.exitFullscreen`). */
  onEnter?: () => void;
  onExit?: () => void;
}

/** Fullscreen toggle button (YARL `FullscreenButton`); hidden without the Fullscreen API. */
export function LightboxFullscreen(props: LightboxFullscreenProps) {
  const state = useLightbox();
  const label = props.label,
    children = props.children,
    onEnter = props.onEnter,
    onExit = props.onExit;
  if (props.auto) clientEffect(() => untrack(() => lightboxEnterFullscreen(state)));
  if (!state.inline) onCleanup(() => lightboxExitFullscreen(state));
  const on = () => state.fullscreen();
  return (
    <LightboxButton
      class={props.class}
      style={props.style}
      action="fullscreen"
      pressed={on}
      hidden={() => !lightboxFullscreenEnabled()}
      label={() => label ?? translateLabel(state.labels, state.fullscreen() ? "Exit Fullscreen" : "Enter Fullscreen")}
      onPress={() => {
        if (state.fullscreen()) {
          lightboxExitFullscreen(state);
          onExit?.();
        } else {
          lightboxEnterFullscreen(state);
          onEnter?.();
        }
      }}
    >
      {lightboxToggleContent(children, on)}
    </LightboxButton>
  );
}
