// Rivet port of @radix-ui/react-avatar 1.2.6 `src/avatar.tsx` (MIT, © 2022 WorkOS; https://github.com/radix-ui/primitives
// packages/react/avatar; ported from the published `dist/index.mjs` of the 1.2.6 tarball, the version HeroUI v3.2.6 pins in
// `packages/react/package.json`). HeroUI builds `Avatar` on it (`import * as AvatarPrimitive from "@radix-ui/react-avatar"`);
// React stays out of the tree, so the state machine is re-implemented here on signals. Licence + notice: `libs/ui/NOTICE`.
// Upstream behaviour kept 1:1:
// - one `imageLoadingStatus` per root (`idle | loading | loaded | error`), shared with `Image` / `Fallback` through context;
// - `useImageLoadingStatus`: no `src` → `error`; else a probe `new window.Image()` with `load` / `error` listeners,
//   `referrerPolicy` (when set) and `crossOrigin` (`?? null`) applied BEFORE `src`; the status right after setting `src` is
//   `getImageLoadingStatus(image)` (`complete && naturalWidth > 0` → `loaded` at once for a cached image, no fallback flash;
//   `complete` with no width → `error`; else `loading`); the `load` handler re-reads the status from the image; cleanup removes
//   the listeners and resets the status to `idle`; the probe re-runs when `src` / `crossOrigin` / `referrerPolicy` change;
// - `Image` calls `onLoadingStatusChange` on every status change it observes (upstream: layout effect comparing the
//   previous status; the cleanup's `idle` and the next run's status are one batched change, as React batches them);
//   it renders the `<img>` only while `loaded`;
// - `Fallback`: `delayMs` → a `setTimeout` (upstream `window.setTimeout`; the global, so test fake timers apply) before it may render; renders while the root status is not `loaded`;
//   the timer effect re-runs when a live `delayMs` changes (upstream effect deps `[delayMs]`);
// - development only (`#dev`): more than one `Image` under a root warns once (upstream `useImageCount` / `useUpdateImageCount`).
// Rivet:
// - `Root` / `Image` / `Fallback` render `span` / `img` / `span`; no `Primitive` / `createContextScope`. `asChild` (radix `Slot`:
//   the child element receives the merged props) → `Image` `render` (the ui `DOMRenderProps` contract: `render(props, undefined)`
//   with the image's attributes incl. `src`; it must return one `<img>`), rendered in place of the `<img>` once `loaded`.
// - Live props: props are read lazily (`splitLive` = runtime `splitProps`), so a live `src={s()}` / `crossOrigin` /
//   `referrerPolicy` (read inside the probe effect) re-probes and a live `class` updates in place (React re-renders). They also
//   accept an accessor (`() => value`; cdk accessor rule).
// - the status signal lives in a context: the server renders the fallback (status `idle`,
//   no `<img>`); the probe runs in a `clientEffect`, which a resumed page starts without a user event; `Show` bindings add
//   the `<img>` and drop the fallback. An `Image` outside a `Root` (upstream: throws) keeps a status of its own.
// - `useLayoutEffect` / `useEffect` → `clientEffect`; `useCallbackRef` not needed (the callback is read when called).
import { createContext, signal, untrack, useContext } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";
import { Provider, Show, clientEffect } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { DEV } from "#dev";

import type { DOMRenderFunction } from "../../utils/dom.tsx";
import { splitLive } from "../../utils/live.tsx";

type ImageLoadingStatus = "idle" | "loading" | "loaded" | "error";

/** A value or an accessor of it (props are snapshots; an accessor makes the probe follow the value). */
type MaybeAccessor<T> = T | (() => T);

const read = <T,>(value: MaybeAccessor<T>): T => (typeof value === "function" ? (value as () => T)() : value);

interface AvatarContextValue {
  /** The root's image loading status (`undefined`: outside a root). */
  status?: Signal<ImageLoadingStatus>;
  /** Development only: `Image` parts mounted under the root (upstream `imageCount`). */
  images?: { count: number; warned: boolean };
}

const AvatarContext = createContext<AvatarContextValue>({});

/** Upstream `useImageCount` warning text. */
const IMAGE_COUNT_MESSAGE =
  "Avatar: Only one `Avatar.Image` component should be rendered per `Avatar.Root`, but multiple were detected. This will lead to unexpected behavior.";

/* -------------------------------------------------------------------------------------------------
 * Avatar
 * -----------------------------------------------------------------------------------------------*/
type AvatarProps = JSX.IntrinsicElements["span"] & {
  children?: Content;
  class?: string;
};

const Avatar = (props: AvatarProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children"]);
  const status = signal<ImageLoadingStatus>("idle");
  const value: AvatarContextValue = { status };
  if (DEV) value.images = { count: 0, warned: false };

  const content = () => <span {...rest}>{local.children}</span>;

  return (
    <Provider token={AvatarContext} value={value}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * AvatarImage
 * -----------------------------------------------------------------------------------------------*/
type AvatarImageProps = Omit<JSX.IntrinsicElements["img"], "src" | "crossOrigin" | "referrerPolicy"> & {
  src?: MaybeAccessor<string | undefined>;
  crossOrigin?: MaybeAccessor<JSX.IntrinsicElements["img"]["crossOrigin"]>;
  referrerPolicy?: MaybeAccessor<ReferrerPolicy | undefined>;
  class?: string;
  onLoadingStatusChange?: (status: ImageLoadingStatus) => void;
  /**
   * Renders a custom image component instead of the `<img>` (radix `asChild`): it receives the image's attributes (`src`,
   * `alt`, `class`, …) and must render one `<img>` with them. Called once the image has loaded, like the `<img>`.
   */
  render?: DOMRenderFunction<"img", undefined>;
};

const AvatarImage = (props: AvatarImageProps): JSX.Element => {
  const [local, imageProps] = splitLive(props, ["src", "onLoadingStatusChange", "render"]);
  const context = useContext(AvatarContext);
  const status = context.status ?? signal<ImageLoadingStatus>("idle");

  if (DEV && context.images) {
    const images = context.images;
    clientEffect(() => {
      images.count++;
      if (images.count > 1 && !images.warned) {
        images.warned = true;
        console.warn(IMAGE_COUNT_MESSAGE);
      }
      return () => {
        images.count--;
      };
    });
  }

  // Upstream: layout effect comparing the status with the previous render's (`loadingStatusRef`). Reports changes only:
  // on a resumed page it runs with the loading effect below (same unit), never needs a trigger of its own.
  let previous: ImageLoadingStatus = status();
  clientEffect(
    () => {
      const next = status();
      if (next !== previous) {
        previous = next;
        local.onLoadingStatusChange?.(next);
      }
    },
    { when: "interaction" },
  );

  // Upstream `useImageLoadingStatus` (deps: src, crossOrigin, referrerPolicy — read as accessors here). The server cannot
  // know whether the image loads (it renders the fallback), so a resumed page with a `src` probes at idle. Without a `src`
  // the status stays "not loaded" (the server's fallback): no trigger unless `onLoadingStatusChange` wants the "error" report
  // (CEFF 2026-10-28). `visible` would start at once
  // anyway: the image part renders no element to observe before it loads.
  clientEffect(
    () => {
      const source = read(local.src);
      const crossOrigin = read(imageProps.crossOrigin);
      const referrerPolicy = read(imageProps.referrerPolicy);
      if (!source) {
        status.set("error");
        return;
      }
      const image = new window.Image();
      const handleLoad = (event: Event) => status.set(getImageLoadingStatus(event.currentTarget as HTMLImageElement));
      const handleError = () => status.set("error");
      image.addEventListener("load", handleLoad);
      image.addEventListener("error", handleError);
      if (referrerPolicy) image.referrerPolicy = referrerPolicy;
      image.crossOrigin = crossOrigin ?? null;
      image.src = source;
      status.set(getImageLoadingStatus(image));
      return () => {
        image.removeEventListener("load", handleLoad);
        image.removeEventListener("error", handleError);
        status.set("idle");
      };
    },
    { when: untrack(() => read(local.src) || local.onLoadingStatusChange) ? "idle" : "interaction" },
  );

  const render = local.render;
  return (
    <Show when={() => status() === "loaded"}>
      {() =>
        render ? render({ ...imageProps, src: read(local.src) }, undefined) : <img {...(imageProps as JSX.IntrinsicElements["img"])} src={read(local.src)} />
      }
    </Show>
  );
};

/* -------------------------------------------------------------------------------------------------
 * AvatarFallback
 * -----------------------------------------------------------------------------------------------*/
type AvatarFallbackProps = JSX.IntrinsicElements["span"] & {
  /** Milliseconds to wait before rendering the fallback (avoids a flash while a fast image loads). */
  delayMs?: number;
  children?: Content;
  class?: string;
};

const AvatarFallback = (props: AvatarFallbackProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["delayMs"]);
  const context = useContext(AvatarContext);
  const canRender = signal(local.delayMs === undefined);

  // Upstream `useEffect(…, [delayMs])`: re-runs when a live `delayMs` changes (a new timer; never hides the fallback again).
  // Resumed page: only a delayed fallback (hidden by the server) needs its timer before the first input (CEFF 2026-10-28).
  clientEffect(
    () => {
      const delayMs = local.delayMs;
      if (delayMs === undefined) return;
      const timerId = setTimeout(() => canRender.set(true), delayMs);
      return () => clearTimeout(timerId);
    },
    { when: untrack(() => local.delayMs) === undefined ? "interaction" : "idle" },
  );

  return <Show when={() => canRender() && context.status?.() !== "loaded"}>{() => <span {...rest} />}</Show>;
};

/* -----------------------------------------------------------------------------------------------*/

/** Upstream `getImageLoadingStatus`: a complete image is `loaded` (has a width) or `error`; else still `loading`. */
function getImageLoadingStatus(image: HTMLImageElement): ImageLoadingStatus {
  return image.complete ? (image.naturalWidth > 0 ? "loaded" : "error") : "loading";
}

export { Avatar as Root, AvatarImage as Image, AvatarFallback as Fallback };

export type { AvatarProps as RootProps, AvatarImageProps as ImageProps, AvatarFallbackProps as FallbackProps, ImageLoadingStatus };
