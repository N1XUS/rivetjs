---
title: Lightbox
description: "Lightbox: full-screen viewer for images, video, embeds and PDF with zoom, captions, thumbnails, slideshow, fullscreen, download and share."
template: reference
status: experimental
related: [components/carousel, components/modal]
---

`Lightbox` shows images, videos, YouTube / Vimeo / iframe embeds and PDF documents full screen, one slide at a time, with swipe, drag, wheel and keyboard navigation.

::example{id=lightbox-basic}

## Usage

```tsx
import { signal } from "@rivetjs/reactivity";
import { Lightbox, type LightboxSlide } from "@rivetjs/ui/lightbox";

const slides: LightboxSlide[] = [
  { src: "/photos/coast.jpg", alt: "Coast at dawn", width: 1600, height: 1067, title: "Coast" },
  { type: "video", poster: "/clip.jpg", sources: [{ src: "/clip.mp4", type: "video/mp4" }] },
];

export default function Gallery() {
  const open = signal(false);
  const index = signal(0);
  return (
    <>
      <button type="button" onClick={() => open.set(true)}>
        Open
      </button>
      <Lightbox isOpen={open} index={index} slides={slides} aria-label="Photos" />
    </>
  );
}
```

- `isOpen` / `index`: a value, an accessor or a two-way signal; the lightbox writes the signal when it moves or closes.
- `slides`: plain data. Image slides take `src`, `alt`, `width`, `height`, `srcSet`, `title`, `description`; `type: "video"` takes `sources` and `poster`; `type: "embed"` takes `provider` (`youtube`, `vimeo`, `iframe`) and `id` or `src`; `type: "pdf"` takes `src`.
- Without children the lightbox renders `Lightbox.Slides`, `Lightbox.Close` and `Lightbox.Previous` / `Lightbox.Next`.

## Anatomy

```tsx
<Lightbox isOpen={open} slides={slides}>
  {() => (
    <>
      <Lightbox.Slides />
      <Lightbox.Toolbar>
        <Lightbox.Close />
      </Lightbox.Toolbar>
      <Lightbox.Previous />
      <Lightbox.Next />
    </>
  )}
</Lightbox>
```

| Part                                                   | What                                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `Lightbox` (`Lightbox.Root`)                           | modal root: `backdrop` `opaque` (default) / `blur`, `class`, `backdropClass`, `containerClass` |
| `Lightbox.Slides`                                      | the carousel; its render function draws a slide (default `Lightbox.Media`)                     |
| `Lightbox.Media`                                       | the slide by type: image, video, embed, PDF; `fallback` for your own types                     |
| `Lightbox.Image`                                       | image slide only                                                                               |
| `Lightbox.Toolbar`, `Lightbox.Button`                  | button row at the top end, and an icon button for your own actions                             |
| `Lightbox.Close`, `Lightbox.Previous`, `Lightbox.Next` | close and navigation buttons (disabled at the ends of a `finite` carousel)                     |

The parts are a render function (`{() => …}`): they are created when the lightbox opens, so a closed lightbox renders nothing but its anchor and loads no code.

## Examples

### Import

```tsx
import { Lightbox, LightboxCounter, LightboxThumbnails, LightboxZoom, LightboxZoomIn } from "@rivetjs/ui/lightbox";
```

### Plugins

Plugin parts are separate named exports (an unused one adds no bytes): `LightboxZoom` + `LightboxZoomIn` / `LightboxZoomOut`, `LightboxCaptions` + `LightboxCaptionsToggle`, `LightboxCounter`, `LightboxThumbnails` + `LightboxThumbnailsToggle`, `LightboxSlideshow`, `LightboxFullscreen`, `LightboxDownload`, `LightboxShare`. Fullscreen and Share hide themselves where the browser lacks the API.

::example{id=lightbox-plugins}

### Video, embeds and PDF

`Lightbox.Media` renders a native `<video>`, an embed iframe that exists only while its slide is current (neighbours show the `poster`, so an unopened YouTube slide makes no request), or the browser's PDF viewer with a download link as fallback. Thumbnails of slides without an image show a lucide type icon.

::example{id=lightbox-media}

### Inline

`LightboxInline` renders the same carousel in the page, without the overlay. Give it a size with `class`; without children it renders slides and Previous / Next.

::example{id=lightbox-inline}

### Options

Every `@rivetjs/cdk/lightbox` setting passes through: `carousel` (`finite`, `preload`, `padding`, `spacing`, `imageFit`), `animation` (`fade`, `swipe`, `navigation`, `zoom`), `controller` (`closeOnBackdropClick`, `closeOnPullDown`, `closeOnPullUp`, `closeOnEscape`, `touchAction`, …), `labels`, and the events `onView`, `onClick`, `onEntering`, `onEntered`, `onExiting`, `onExited`, `onIndexChange`, `onOpenChange`. See the [cdk page](site:cdk/components/lightbox/) for each option.

## Styling Reference

The component’s parts emit these additional `data-slot` values: `lightbox-loading-icon`, `lightbox-error-icon`, `lightbox-pdf-icon`, `lightbox-close-icon`, `lightbox-previous-icon`, `lightbox-next-icon`, `lightbox-zoom-in-icon`, `lightbox-zoom-out-icon`, `lightbox-download-icon`, `lightbox-share-icon`, `lightbox-fullscreen-enter-icon`, `lightbox-fullscreen-exit-icon`, `lightbox-play-icon`, `lightbox-pause-icon`, `lightbox-captions-off-icon`, `lightbox-captions-icon`, `lightbox-thumbnails-icon`, `lightbox-thumbnail-icon`.

### Styling

| Class                                                                                            | Element                                               |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `.lightbox__backdrop` (`--opaque`, `--blur`)                                                     | overlay                                               |
| `.lightbox`, `.lightbox__container`, `.lightbox__carousel`                                       | dialog, grid container (gesture surface), slide track |
| `.lightbox__slide`, `.lightbox__image`, `.lightbox__video`, `.lightbox__embed`, `.lightbox__pdf` | slides and their media                                |
| `.lightbox__toolbar`, `.lightbox__button`, `.lightbox__previous`, `.lightbox__next`              | controls                                              |
| `.lightbox__counter`, `.lightbox__captions`, `.lightbox__thumbnails`, `.lightbox__thumbnail`     | plugin parts                                          |
| `.lightbox__inline`                                                                              | inline root                                           |

Controls use `--lightbox-control-bg` / `--lightbox-control-fg`. State is in attributes: `[data-current]` on the current slide, `[aria-pressed]` on toggles, `[data-zoomed]` on the container.

## API Reference

See the [full module API](/api/rivetjs/ui/lightbox/) for every named export and part prop type.

Props and options: the [cdk Lightbox page](site:cdk/components/lightbox/) (every cdk prop passes through) plus `backdrop`, `backdropClass` and `containerClass` on the root.

## Accessibility

- The container is a `role="dialog"` with `aria-modal` and the `aria-label` you pass. Focus moves into it on open and returns to the trigger on close.
- Slides are groups labelled "2 of 4"; slides that are not current are inert.
- :kbd[ArrowLeft] / :kbd[ArrowRight] move between slides (pan while zoomed), :kbd[Escape] closes, :kbd[+] / :kbd[-] zoom with `LightboxZoom`.

## Related Components

- [Carousel](/components/carousel/)
- [Modal](/components/modal/)
