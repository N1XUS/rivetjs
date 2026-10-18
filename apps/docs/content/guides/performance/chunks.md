---
title: Chunks
description: See how Rivet splits browser code into chunks, and choose between one chunk per component, per chunk group or per route.
template: guide
status: experimental
related: [guides/performance/preloading, learn/loading-code, guides/performance/measuring]
---

A :term[chunk]{id=chunk} is one JavaScript file that the browser downloads. Rivet does not send one big bundle. The compiler cuts the browser code of each component into small pieces (event handlers, effects, bindings), and the build puts those pieces into chunks. The browser downloads a chunk only when the page needs it.

After reading this page you know which chunks a build makes, how to group them differently, and how to check the result.

## What the build makes

A production client build of resumed pages contains:

- **The runtime entry.** The code that reads the page state and starts the browser side. It loads before the first handler runs.
- **Shared chunks.** Code used by several chunks, such as DOM helpers or a component library. Small shared modules that load together are merged (see [Fewer shared chunks](#fewer-shared-chunks)).
- **Component chunks.** The browser code of your components. By default there is one per component.
- **The built-in values chunk.** It reads regular expressions, `URLSearchParams`, binary data and errors back from the page state. It loads only on pages, route data and form answers that hold such a value.
- **`.vite/rivet-resume.json`.** A manifest that maps each piece of code to its chunk URL, with sizes. The server uses it to write the page.

The page itself carries no application bundle. The server writes a list of chunks into the page state; the inline loader downloads them when needed (see [Preloading](preloading.md)).

The component code that only builds the HTML is never sent. Components run once on the server; the browser receives only the code that reacts to events or changes.

## Choose a grouping

Set `resume.chunks` in the Vite config:

| Value | Chunks |
| --- | --- |
| `"route"` (default) | One chunk per lazily loaded route or `lazyComponent`, a main chunk, and shared chunks for the components several routes use |
| `"component"` | One chunk per component |
| `"group"` | One chunk per `<ChunkGroup>` subtree |

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ resume: { chunks: "component" } })],
});
```

The grouping changes only the browser chunks and the manifest. Server output stays the same.

### Which one to pick

`"route"` is the default: it needs far fewer files through the first click (a quarter of `"component"`'s on the Rivet UI docs) for about a fifth more bytes, and its first click downloads nothing. `"component"` downloads the least code for one interaction.

| App shape | Pick | What changes |
| --- | --- | --- |
| Pages built from a component library where one interaction must download the least code | `"component"` | One chunk per component: the first click fetches that component's handlers and nothing else. A select box example: 79 files before the first click at `merge: 2048`, 48 at the default `65536`. |
| Pages made of separate widgets: a search box, a comment section, a cart | `"group"` | Each widget's code arrives together, so the second click in a widget downloads nothing. |
| File-routed app with document prefetch on, where the first click must not wait for the network | `"route"` (the default) | The page downloads its own handler code after it loaded and the browser is idle, without running it. The first click downloads nothing. On the Rivet UI docs (one component library shared by 1,000 example pages), a select box page needs 24 files and 178 KB through its first click instead of 81 files and 146 KB with `"component"`: a quarter of the files for a fifth more bytes. On a slow network over HTTP/1.1, a cold first click was 0.5 to 1.5 seconds faster in our measurements, because the page needs fewer files; over HTTP/2 it was the same. |
| Pages with framework islands (React, Preact) | `"route"` | Fewer files: 15 to 10 on the bridge demo's orders page. |

With `"route"`, each page's components land in the route's own chunk. A component several routes use is placed by the bundler like any shared code: in a chunk that exactly the routes using it load, then merged with its neighbours under the budget of [Fewer shared chunks](#fewer-shared-chunks) and the `cap` on shared chunks per route. A component that no lazily loaded route reaches lands in the main chunk. Imports through `index.ts` files, such as `import { Select } from "@rivetjs/ui"`, count as imports of the components they name. Three cases are not followed yet, and their components land in the main chunk: a `.tsx` file that re-exports with `export *`, `export * as name from`, and re-exports written in the route module itself.

The early download of a route's handler code happens only while document prefetch is on (`rivetRouter({ prefetch })`, see [the router options](../../reference/config.md)), and never with Save-Data on or on [lean pages](preloading.md#lean-pages). Code downloaded this way never runs before it is needed. [Scheduled preloads](preloading.md) still run their chunks when the browser is idle, with either grouping: on the select box example, 76 modules ran before the first click.

Try a grouping, build, and compare in the browser's network panel. See [Measuring](measuring.md).

## Fewer shared chunks

The bundler puts shared code into one chunk per set of chunks that use it, so no page downloads a byte it does not need. With a component library this means many small files: a page with one select box can load 100 or more chunks before its first click, and each file is one more request.

The build merges small shared chunks that the same chunks load. Merging can make a page download code it does not use. The build allows a merge only while the extra code stays small for each request it saves: by default 65536 bytes of source per request saved. The budget is an average over all the chunks a merge affects, so one page can still download more than that. On the Rivet UI docs site the median page downloads 0.2 % fewer bytes, but one page in ten downloads 7 % more and the worst page 27 % more.

Merging never touches the runtime and app entry chunks, which every page loads: no page code joins them. A merged chunk never imports another chunk that imports it back, so modules run in the same order as without merging. Merging happens only in production builds; the dev server serves modules one by one. It is skipped when your Vite config sets `codeSplitting: false`, `manualChunks` or `advancedChunks`, so your own chunking wins.

Change the budget with `resume.merge`, or turn merging off with `false`:

```ts title="vite.config.ts"
export default defineConfig({
  plugins: [rivetRouter({ resume: { merge: 16384 } })],
});
```

The budget bounds bytes, not files. To bound files, set `resume.cap`: the most shared chunks one chunk may load (with `chunks: "route"`, one route). A chunk over the cap keeps merging its cheapest pair of shared chunks past the budget until it holds. Chunks every page loads still take no page code, and modules still run in their import order.

```ts title="vite.config.ts"
export default defineConfig({
  plugins: [rivetRouter({ resume: { cap: 3 } })],
});
```

A larger budget means fewer requests and more unused bytes. On the Rivet UI docs site the default cuts the code an example page preloads from a median of 77 files to 50, at the same median size.

## Group with `ChunkGroup`

`ChunkGroup` from `@rivetjs/runtime/dom` marks a group. It renders its children unchanged; it only affects chunking.

```tsx
import { ChunkGroup } from "@rivetjs/runtime/dom";
import { Comments } from "../components/Comments.tsx";
import { LikeButton } from "../components/LikeButton.tsx";

export default function Post() {
  return (
    <article>
      <ChunkGroup name="reactions">
        <LikeButton />
        <Comments />
      </ChunkGroup>
    </article>
  );
}
```

With `chunks: "group"`, `LikeButton` and `Comments` share one chunk. A component used in several groups, or in none, keeps its own chunk.

`ChunkGroup` also takes `preload`, which sets the [preload strategy](preloading.md#change-it-for-a-component) for everything inside.

## Related chunks load together

Chunks of the same `ChunkGroup` or route form a group. When the browser loads one chunk of a group for an interaction, it schedules the others too, so the next click in the same widget is fast. This is skipped with Save-Data on or on a 2G connection.

## Lazy components and routes

`lazyComponent(() => import("./Chart.tsx"))` puts a component behind a dynamic import. Its code is a separate chunk, loaded when the component first renders in the browser (or warmed at idle on resumed pages). Pass `{ warm: false }` to load it only on first render.

In a file-routed app, every page is loaded this way. Code for other pages loads when the user shows intent to navigate, such as hovering a link.

## Common mistakes

- **Components outside `src/routes` resume only through `appModules`.** It is on by default in `rivetRouter`. With `resume: { appModules: false }`, list them in `resume.modules`, or their handlers do not work in production.
- **A component element in a resume module adds a chunk piece.** Rendering `<Picture />` or another static helper as an element makes a small piece of browser code. For markup that never changes, call the helper as a function; see [Images](../assets/images.md#picture-adds-code-to-a-component-chunk).
- **Judging chunk sizes in dev.** The dev server does not split code this way. Build for production first.

## See also

- [Preloading](preloading.md)
- [Loading code](../../learn/loading-code.md)
- [Measuring](measuring.md)
