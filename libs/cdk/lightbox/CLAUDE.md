# libs/cdk/lightbox
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Headless media lightbox: port of yet-another-react-lightbox (YARL) 3.32.2 (MIT, © Igor Danchenko) on the cdk overlay layer + house motion. Images, video, embeds (YouTube / Vimeo / iframe), PDF, custom slides.

## Subpaths (pattern `./*` → `<dir>/index.tsx`; no explicit exports)
| Subpath | File | Exports |
| --- | --- | --- |
| `lightbox` | `index.tsx` (+ `state.ts`, `behaviour.ts` re-exported) | `Lightbox` (modal root), `LightboxView` (container, shared with inline), `LightboxCarousel`, `LightboxImage`, `LightboxToolbar`, `LightboxButton`, `LightboxClose` / `Previous` / `Next`, contexts `LightboxContext` (`rv-lightbox`) / `LightboxSlideContext` (`rv-lightbox-slide`), `useLightbox`, `useLightboxSlide`, `useLightboxIndex`, `lightboxToggleContent`; state: `createLightboxState`, slide types, defaults, `lightboxWindow`, labels; behaviour: `lightboxNavigate` / `Prev` / `Next` / `GoTo`, pointer / key handlers, `ensureLightbox`, `syncLightboxMedia`, `lightboxHandled` |
| `lightbox/zoom` | `zoom/index.tsx` | `LightboxZoom` (behaviour, renders null), `LightboxZoomIn` / `LightboxZoomOut`, `lightboxZoomIn` / `Out` / `ChangeZoom` / `ZoomState` |
| `lightbox/video` | `video/index.tsx` | `LightboxVideo`, `LIGHTBOX_VIDEO_DEFAULTS` |
| `lightbox/embed` | `embed/index.tsx` | `LightboxEmbed`, `lightboxEmbedUrl` (Rivet-authored) |
| `lightbox/pdf` | `pdf/index.tsx` | `LightboxPdf` (Rivet-authored) |
| `lightbox/captions` | `captions/index.tsx` | `LightboxCaptions`, `LightboxCaptionsToggle`, `lightboxCaptionsVisible`, `setLightboxCaptions` |
| `lightbox/counter` | `counter/index.tsx` | `LightboxCounter` |
| `lightbox/download` | `download/index.tsx` | `LightboxDownload`, `lightboxSaveAs`, `lightboxDownload`, `lightboxDownloadUrl` / `Filename`, `lightboxCanDownload` |
| `lightbox/fullscreen` | `fullscreen/index.tsx` | `LightboxFullscreen`, `lightboxEnterFullscreen` / `Exit`, `lightboxFullscreenEnabled` |
| `lightbox/share` | `share/index.tsx` | `LightboxShare`, `lightboxShare`, `lightboxShareData`, `lightboxCanShare`, `lightboxShareSupported` |
| `lightbox/slideshow` | `slideshow/index.tsx` | `LightboxSlideshow`, `lightboxPlay` / `lightboxPause` |
| `lightbox/thumbnails` | `thumbnails/index.tsx` | `LightboxThumbnails`, `LightboxThumbnailsToggle`, `lightboxThumbnailSrc`, visibility helpers |
| `lightbox/inline` | `inline/index.tsx` | `LightboxInline` (no overlay) |

## Usage shape
```tsx
<Lightbox isOpen={open} index={index} slides={slides}>
  {() => (
    <>
      <LightboxCarousel>{(slide) => (slide.type === "video" ? <LightboxVideo /> : slide.type === "pdf" ? <LightboxPdf /> : <LightboxImage />)}</LightboxCarousel>
      <LightboxZoom />
      <LightboxToolbar><LightboxZoomIn /><LightboxClose /></LightboxToolbar>
      <LightboxPrevious /><LightboxNext />
    </>
  )}
</Lightbox>
```
No children = default parts (carousel, Close, Previous, Next). Styled layer: `@rivetjs/ui/lightbox`.

## Rulings (deviations from YARL; user brief 2026-10-08, rulings mine)
- Parts instead of YARL modules + plugin augmentation; every plugin = own subpath (0 B unless imported).
- Modal = cdk `ModalOverlay` > `Modal` (div overlay layer, focus trap + restore, Escape `closeOnEscape`, scroll lock, `inert` outside); container is `role="dialog"` (Modal does not forward role / aria). Fade = CSS on `data-entering` / `data-exiting`, duration `--rv-lightbox-fade`.
- Motion = house `Motion1D` (`../motion`): track x + pull y; navigation keeps the visual position and settles to 0. ms options → embla units `msToMotion` (ms / 20); easing options dropped. A settled motion renders its target (last interpolated frame can stop short: flaky stuck transform before).
- Layout: container = CSS grid (`top` / `start` / `main` / `end` / `bottom`); carousel in `main`, thumbnails strip in its side's area; toolbar / nav / captions absolutely positioned (styled layer).
- Media sizing CSS only: slide box `container-type: size`; images `max-width/height`, video / embed / PDF `min(100cqw, 100cqh × ratio)` + `aspect-ratio`. Image `sizes` = `min(100vw, ratio vh)`; zoom raises `sizes` to the zoomed width.
- Media sync DOM-driven (no effect): `syncLightboxMedia` after each slide change pauses non-current `<video>` and plays the current `video[data-autoplay]`; afterwards the core scrolls the current thumbnail into view and dispatches `rv-lightbox-view` on the container (Slideshow listens while playing).
- Plugin events: Zoom marks handled events in `lightboxHandled` (WeakSet); core swipe / wheel / arrows skip them and stop while `state.zoom() > 1`.
- Captions render once over the current slide (YARL: per slide). Thumbnails = all slides, native scroll (YARL: windowed animated track); buttons labelled "Go to slide k".
- Embed: iframe only while current (`<Show>`), poster otherwise; leaving unmounts (stops playback). Thumbnails use `poster` only (no provider image requests).
- PDF: `<object type="application/pdf">` + link fallback, mounted for current ± 1; no pdf.js (native viewer, 0 B).
- Slideshow waits by probing the current slide's DOM (`img.complete`, playing `video`) instead of YARL slide-status events.
- Media controls: pointer down in the bottom 40 px of `<video controls>` never swipes (all browsers; YARL WebKit only).
- Server-rendered images (inline) start `complete`; the inline view installs browser listeners on first pointerenter / focusin.
- Share / Fullscreen hide when unsupported — evaluated client-side; an inline server render shows them until a binding re-runs (gap).
- State = plain data + signals (`zoom`, `maxZoom`, `playing`, `captions`, `thumbnails`, `fullscreen`, `gesture`) so plugin parts on resumed / re-created regions share it; runtime controllers (motions, timers) in WeakMaps.

## Tests
- `../tests/lightbox.browser.test.tsx` (core, 21), `../tests/lightbox-plugins.browser.test.tsx` (plugins, 30) — project `cdk-browser`.
- `../tests-components/lightbox.test.ts` + story `app/src/routes/lightbox.tsx` — resumed page: nothing boots, open at slide 2, keys, embed lazy, Escape focus restore, inline after resume.

## Gotchas
- URL sanitizer: `data:image/svg+xml` is invalid in `poster` / dynamic thumbnail `src` (`about:invalid#rivet`); tests use plain paths / PNG data URIs.
- JSX types for `<object data>` and video `controlsList` / `disablePictureInPicture` / `disableRemotePlayback` added in `libs/runtime/jsx-runtime.ts` for this module.
- Browser globals in plugin modules only via `getOwnerWindow()` (`../utils/dom.ts`): a bare `location` / `navigator` read is compiler RV2001 (server render), and events are created from the container's window (`rv-lightbox-view`).
- Carousel render function must be an inline arrow in a `.tsx` (resumable).
- State attributes (`data-current`, `data-autoplay`, `data-cover`, …) via `dataBool` (`"true"` / absent; `tests/data-attrs.test.ts` lint); presence markers (`data-lightbox-*`) are `""`. Selectors use presence (`[data-current]`).
- `Lightbox` / `LightboxInline` `containerClass` styles the container (`role="dialog"` gesture surface); default `rv-LightboxContainer`.
- Parts take no `id` / rest DOM props: select them by `data-action` (`close`, `prev`, `next`, `zoom-in`, `captions`, …) / `data-lightbox-*` (docs example steps do).
- Server-rendered `LightboxImage` (inline) binds no `onLoad` / `onError` (status starts `complete`): a cold `load` would boot the resumed page per image, and the runtime's cold-replay form-state restore (`dom-resume.ts` `show`) read `selectionStart` of the replayed `load` event's `null` target (console TypeError; reported to the runtime owner 2026-10-08). No loading / error placeholder on server-rendered images.
- Keyboard navigation is throttled to half the navigation duration (YARL): a second arrow key < 250 ms after the first is ignored (example steps click `[data-action=prev]` instead).
