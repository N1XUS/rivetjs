---
title: Images
description: Turn image imports into responsive AVIF and WebP files at build time, render them with Picture, preload the important ones, and optimize or inline SVG files.
template: guide
status: experimental
related: [guides/performance/preloading, guides/tooling/vite, guides/performance/measuring]
---

Rivet can resize and convert your images when you build the app. You import an image file, and you get back a plain object that lists every size and format. The `Picture` component turns that object into `<picture>` and `<img>` markup. After reading this page you can add optimized images to a page, choose how they scale, preload the main image and use an image CDN.

`Picture` sends no JavaScript to the browser. It is only HTML.

## Turn on image processing

Image processing uses [sharp](https://sharp.pixelplumbing.com/). Install it as a dev dependency:

```bash
npm install -D sharp
```

Then turn on `images` in the Vite config. In a file-routed app, pass it to `rivetRouter`:

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ images: true })],
});
```

Without the router, pass the same option to `rivet({ images: true })` from `@rivetjs/compiler/vite`.

For TypeScript, add the image import types to `tsconfig.json`:

```json title="tsconfig.json"
{
  "compilerOptions": {
    "types": ["node", "@rivetjs/compiler/images/client"]
  }
}
```

## Import an image

Add `?image` to the import path:

```tsx title="src/routes/index.tsx"
import { Picture } from "@rivetjs/runtime/image";
import hero from "../assets/hero.jpg?image";

export default function Home() {
  return <Picture image={hero} alt="A mountain lake at sunrise" />;
}
```

`hero` is a plain JSON object (an `ImageDescriptor`) with `src`, `width`, `height`, `layout`, `sizes` and a list of `sources`. By default the build makes AVIF and WebP files plus a JPEG or PNG fallback, in several widths. It also adds a small blurred placeholder that shows while the image loads.

In a build, a small descriptor (up to 1 KB of JSON) is copied into each file that imports it, so the browser does not fetch a separate file for each image. Larger descriptors stay in their own file and importers share it.

`alt` is required. Use `alt=""` for decorative images.

::api{symbol="@rivetjs/runtime/image#Picture"}

## Choose a layout

The layout decides which widths the build makes and how the browser picks one.

| Layout | Use it for | What you get |
| --- | --- | --- |
| `constrained` (default) | Images that shrink on small screens but never grow past their size | Width steps up to the image width |
| `fixed` | Logos, avatars, icons with one size | 1x and 2x versions |
| `full-width` | Banners that fill the screen | Width steps across common screen sizes |

You set options with directives in the import path. Directives go **before** the `image` keyword:

```tsx
import logo from "../assets/logo.png?layout=fixed&width=120&image";
import banner from "../assets/banner.jpg?layout=full-width&image";
```

Available directives: `layout`, `width`, `height`, `formats` (separated by `;`, for example `formats=avif;webp`), `quality` (1–100), `densities` (for example `densities=1;2;3`), `placeholder` (`blur`, `dominant-color` or `none`), `fit` (`cover`, `contain`, `inside`), `position` and `preset`. An unknown directive is a build error.

### Presets

When many images share options, name them once in the config:

```ts title="vite.config.ts"
rivetRouter({
  images: { presets: { hero: { layout: "full-width" } } },
});
```

```tsx
import hero from "../assets/hero.jpg?preset=hero&image";
```

Directives in the import win over the preset, and the preset wins over the global `images` options.

## Tell the browser how wide the image is

`sizes` tells the browser how wide the image will be on screen, so it can download the right file. You can pass a normal `sizes` string, or an object with screen names (`sm`, `md`, `lg`, `xl`, `2xl`, the Tailwind defaults), pixel widths, or media queries:

```tsx
<Picture image={hero} alt="" sizes={{ md: "50vw", default: "100vw" }} />
```

This becomes `(min-width: 768px) 50vw, 100vw`.

## Load the main image first

For the large image at the top of the page, set `priority`. The image then loads eagerly with `fetchpriority="high"`. Pair it with `ImagePreload`, which adds a `<link rel="preload">` so the browser starts the download early:

```tsx
import { Picture, ImagePreload } from "@rivetjs/runtime/image";
import hero from "../assets/hero.jpg?image";

export default function Home() {
  return (
    <>
      <ImagePreload image={hero} />
      <Picture image={hero} alt="" priority />
    </>
  );
}
```

All other images load lazily (`loading="lazy"`) by default. Use `priority` only for the one or two images people see first.

## Show a different image on small screens

Pass an object of media queries instead of one image. `default` is the image used when no query matches:

```tsx
import wide from "../assets/team-wide.jpg?image";
import tall from "../assets/team-tall.jpg?image";

<Picture image={{ "(max-width: 640px)": tall, default: wide }} alt="Our team" />;
```

## Use an image CDN

If your images live on an image CDN, `cdn()` builds the same kind of descriptor from URLs. It does not fetch anything; it only builds strings. `width` and `height` are required, so the page reserves space for the image.

```tsx
import { Picture, cdn, cloudinary } from "@rivetjs/runtime/image";

const photo = cdn("products/chair.jpg", { cdn: cloudinary({ cloud: "demo" }), width: 800, height: 600 });

export default function Product() {
  return <Picture image={photo} alt="Wooden chair" />;
}
```

Built-in helpers: `cloudinary({ cloud })`, `imgix({ domain })` and `cloudflare({ origin })`. For any other CDN, use `urlTemplate("https://img.example.com/{src}?w={width}&h={height}&fm={format}")`.

::api{symbol="@rivetjs/runtime/image#cdn"}

## SVG files

SVG files go through the same imports, optimized by [svgo](https://svgo.dev/) instead of sharp (an app that only uses SVG does not need sharp). `?image` and `?jsx` give you an `<img>` of a smaller, hashed copy of the file, with `width` and `height` read from the SVG so the page does not jump:

```tsx
import { Picture } from "@rivetjs/runtime/image";
import logo from "../assets/logo.svg?image";

<Picture image={logo} alt="Acme" />; // <img src="/assets/logo-120-1a2b3c4d.svg" width="120" height="40" alt="Acme">
```

Add `?svg` instead to put the SVG markup into the page. You get a component that renders the optimized SVG as static HTML. Its props go on the `<svg>` element: `class`, a `style` object, `aria-*`, plus `size` (width and height) and `title` (an accessible name):

```tsx
import Logo from "../assets/logo.svg?svg";
import Mark from "../assets/mark.svg?currentColor&svg";

<Logo class="h-6 w-auto" title="Acme" />;
<Mark size={20} style={{ color: "var(--brand)" }} />; // its colors follow the CSS color
```

- `?currentColor&svg` replaces the fill and stroke colors with `currentColor`, so CSS `color` paints the SVG.
- Inline SVGs are cleaned: scripts, event attributes, `javascript:` links and `<style>` elements are removed (svgo first moves the style rules onto the elements). Ids get a prefix so two SVGs on one page never clash; `?prefixIds=false&svg` keeps them.
- Without `title` or `aria-label`, the SVG is hidden from screen readers (`aria-hidden="true"`).
- Turn optimization off with `images: { svgo: false }`, or pass svgo settings: `images: { svgo: { plugins, multipass, floatPrecision, prefixIds } }`.

For icons, use lucide through `Icon` from `@rivetjs/kit/icon` (see [kit](../../ui/kit.md#icons)) instead of SVG files.

## Lower-level helpers

Because a descriptor is plain JSON, you can use it without `Picture`:

- `srcset(image)` returns the `srcset` string of the best source.
- `imageSet(image)` returns a CSS `image-set(...)` value for backgrounds.
- `preloadLink(image)` returns the attributes of a preload link.
- `getImage(file, { outDir })` from `@rivetjs/compiler/images` processes a file that is only known at build or prerender time, for example an upload from a CMS.

## Common mistakes

### Images missing after the build

If an image is used only in server code, it may be missing from the client output when you run `vite build` and `vite build --ssr` as two steps. Vite then warns that image variants "may be missing from the client build". Build with Vite's app builder instead (`vite build --app`, or `createBuilder({ builder: {} })` and `buildApp()`), which builds the server first and then the client.

### Picture adds browser code

In a component that resumes, a `<Picture />` element becomes a small piece of browser code in the [chunk](../performance/chunks.md) that holds the component's code. The image never changes, so you can avoid this by calling `Picture` as a function and rendering the result. The playground does this for its banner:

```tsx
import type { CompiledElement } from "@rivetjs/runtime/jsx-runtime";

const banner = [ImagePreload({ image: hero }), Picture({ image: hero, alt: "", priority: true })] as unknown as CompiledElement[];

return <header>{banner}</header>;
```

### Images with i18n

With [one build per language](../i18n/translating-text.md#build-one-app-per-language) the images are still written once, to `dist/client/assets/`, under the same URLs for every language. Translated `alt` text works: `<Picture image={hero} alt={t("home.hero")} />`.

### Missing size

`cdn()` throws when `width` or `height` is missing. Without a size, the page jumps when the image loads.

## See also

- [Preloading](../performance/preloading.md)
- [Vite](../tooling/vite.md)
- [Measuring](../performance/measuring.md)
