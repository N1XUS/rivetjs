---
title: Quick Start
description: "Install @rivetjs/ui in a Rivet app: Tailwind CSS v4, the @rivetjs/ui/styles stylesheet, then import components from their subpaths."
template: guide
status: experimental
related: [start/introduction, start/theming, start/dark-mode]
---

Set up `@rivetjs/ui` in a new or existing Rivet app: install the packages, import one stylesheet, then import components from their subpaths.

## Requirements

- A [Rivet](site:docs/) app (the Rivet starters work as is), Node 24+
- [Tailwind CSS v4](https://tailwindcss.com/docs/installation/framework-guides) with `@tailwindcss/vite`
- [lucide](https://lucide.dev/) for icons (through `@rivetjs/kit/icon`)

React is not a dependency.

## Install

**New app:** the `ui` starter is a Rivet app with Tailwind CSS v4, `@rivetjs/ui/styles` and a sample page, ready to run:

```bash
npm create rivet@latest my-app -- --template ui
```

(`pnpm create rivet my-app --template ui`, `yarn create rivet my-app --template ui` and `bun create rivet my-app --template ui` work too.)

**Existing app:** add the packages. They are not published yet; inside the Rivet repository they resolve from the workspace. Once published:

**npm**

```bash
npm i @rivetjs/ui lucide
npm i -D tailwindcss @tailwindcss/vite
```

**pnpm**

```bash
pnpm add @rivetjs/ui lucide
pnpm add -D tailwindcss @tailwindcss/vite
```

**yarn**

```bash
yarn add @rivetjs/ui lucide
yarn add -D tailwindcss @tailwindcss/vite
```

**bun**

```bash
bun add @rivetjs/ui lucide
bun add -d tailwindcss @tailwindcss/vite
```

`@rivetjs/ui` depends on `@rivetjs/cdk`, `@rivetjs/kit`, `tailwind-variants` and `tw-animate-css`. Add Tailwind to the Vite config next to the Rivet router:

```ts
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ mode: "static", styles: ["src/styles.css"] }), tailwindcss()],
});
```

## Import the styles

Add to your main CSS file (`src/styles.css`):

```css
@import "tailwindcss";
@import "@rivetjs/ui/styles";
```

:::warning
Order matters: `tailwindcss` must come before `@rivetjs/ui/styles`.
:::

`@rivetjs/ui/styles` holds the base styles and the Rivet theme (local changes to the stylesheet are listed in `libs/ui/styles/TWEAKS.md`). Other looks, such as the Classic preset, are variables pasted after the import ([Themes](/start/themes/)). Component CSS is not in this file: each component module imports its own compiled stylesheet, so a page loads only the CSS of the components it renders (one merged file per page in a production build). All examples on this site use this setup plus a body rule:

```css title="src/styles.css"
@import "tailwindcss";
@import "@rivetjs/ui/styles";
@source "./**/*.{ts,tsx}";

@layer base {
  body {
    @apply bg-background text-foreground font-sans antialiased;
  }
}
```

## Use a component

```tsx
import { Button } from "@rivetjs/ui/button";

function App() {
  return <Button>My Button</Button>;
}
```

Prefer the component subpath. The root `@rivetjs/ui` entry re-exports everything (plus `dom`, `tv`, `cn`, `VariantProps`), but subpath imports keep the module graph small.

## Next steps

- [Theme builder](/themes/): derive a theme from one accent colour and copy its CSS
- [Components](/components/overview/): every component with examples
- [Styling](/start/styling/): customize with Tailwind CSS
- [Composition](/start/composition/): parts, variant functions and BEM classes
