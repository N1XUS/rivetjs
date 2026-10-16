// Ported from yet-another-react-lightbox (src/plugins/download/{Download.tsx,DownloadButton.tsx,FileSaver.ts,props.ts},
// v3.32.2), MIT, © Igor Danchenko (FileSaver after eligrey/FileSaver.js, MIT).
// Rivet:
// - `<LightboxDownload>` button part; URL / file name resolution and `canDownload` are YARL's (`downloadUrl` ||
//   string `download` || `download.url` || image `src`; a custom `download` function makes every slide downloadable
//   unless `download: false`).
// - `lightboxSaveAs`: same-origin or CORS-enabled URLs download as a blob through `fetch` (YARL: XHR `HEAD` probe +
//   XHR blob); otherwise the browser follows an `<a download>` link (cross-origin: opens in a new tab, like YARL).
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import type { StyleObject } from "@rivetjs/runtime/style";
import { getOwnerWindow } from "../../utils/dom.ts";
import { LightboxButton, useLightbox } from "../index.tsx";
import { isImageSlide, lightboxSlide, translateLabel, type LightboxSlide, type LightboxState } from "../state.ts";

/** Custom download handler (YARL `download.download`). */
export type LightboxDownloadFunction = (props: { slide: LightboxSlide; saveAs: (source: string | Blob, name?: string) => void }) => void;

/** The download URL of a slide (YARL `resolveDownloadUrl`). */
export function lightboxDownloadUrl(slide: LightboxSlide | undefined): string | undefined {
  if (!slide) return undefined;
  const d = slide.download;
  return (
    slide.downloadUrl ||
    (typeof d === "string" ? d : typeof d === "object" ? d.url : undefined) ||
    (isImageSlide(slide) || slide.type === "pdf" ? (slide as { src: string }).src : undefined)
  );
}

/** The download file name of a slide (YARL `downloadFilename` / `download.filename`). */
export function lightboxDownloadFilename(slide: LightboxSlide | undefined): string | undefined {
  if (!slide) return undefined;
  const d = slide.download;
  return slide.downloadFilename || (typeof d === "object" ? d.filename : undefined);
}

/** Whether the slide can be downloaded (YARL `canDownload`). */
export function lightboxCanDownload(slide: LightboxSlide | undefined, custom?: LightboxDownloadFunction): boolean {
  if (!slide) return false;
  return custom ? slide.download !== false : slide.download !== false && !!lightboxDownloadUrl(slide);
}

const fileName = (url: string): string => {
  try {
    return decodeURIComponent(new URL(url, getOwnerWindow()?.location?.href).pathname.split("/").pop() || "download");
  } catch {
    return "download";
  }
};

function click(href: string, name: string | undefined, newTab: boolean): void {
  const a = globalThis.document.createElement("a");
  a.href = href;
  a.download = name ?? "";
  a.rel = "noopener";
  if (newTab) a.target = "_blank";
  a.dispatchEvent(new MouseEvent("click"));
}

/** Saves a URL or a Blob as a file (YARL `FileSaver.saveAs`). */
export function lightboxSaveAs(source: string | Blob, name?: string): void {
  if (typeof source !== "string") {
    const url = URL.createObjectURL(source);
    click(url, name ?? "download", false);
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return;
  }
  const filename = name ?? fileName(source);
  let sameOrigin = false;
  try {
    const loc = getOwnerWindow().location;
    sameOrigin = new URL(source, loc.href).origin === loc.origin;
  } catch {
    // invalid URL: let the browser decide
  }
  if (source.startsWith("data:") || source.startsWith("blob:") || sameOrigin) {
    click(source, filename, false);
    return;
  }
  fetch(source, { mode: "cors" })
    .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(String(response.status)))))
    .then((blob) => lightboxSaveAs(blob, filename))
    .catch(() => click(source, filename, true));
}

/** Downloads the current slide (YARL Download plugin action). */
export function lightboxDownload(state: LightboxState, custom?: LightboxDownloadFunction): void {
  const slide = lightboxSlide(state);
  if (!slide || !lightboxCanDownload(slide, custom)) return;
  if (custom) custom({ slide, saveAs: lightboxSaveAs });
  else lightboxSaveAs(lightboxDownloadUrl(slide)!, lightboxDownloadFilename(slide));
}

export interface LightboxDownloadProps {
  class?: string;
  style?: StyleObject;
  label?: string;
  children?: Content;
  /** Custom download (YARL `download.download`). */
  download?: LightboxDownloadFunction;
  /** Called after a download starts (YARL `on.download`). */
  onDownload?: (props: { index: number }) => void;
}

/** Download button (YARL `DownloadButton`): disabled when the current slide cannot be downloaded. */
export function LightboxDownload(props: LightboxDownloadProps) {
  const state = useLightbox();
  const custom = props.download,
    onDownload = props.onDownload;
  return (
    <LightboxButton
      class={props.class}
      style={props.style}
      action="download"
      label={props.label ?? translateLabel(state.labels, "Download")}
      isDisabled={() => !lightboxCanDownload(lightboxSlide(state), custom)}
      onPress={() => {
        lightboxDownload(state, custom);
        onDownload?.({ index: state.index.value() });
      }}
    >
      {props.children}
    </LightboxButton>
  );
}
