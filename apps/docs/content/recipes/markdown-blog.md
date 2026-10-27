---
title: Markdown blog
description: Write posts as Markdown files, parse them in server code, render the syntax tree as JSX and prerender one page per post.
template: recipe
related: [guides/routing/params, guides/routing/loading-data, guides/routing/head-and-seo, guides/deploy/static-hosts]
---

## What you will build

A blog whose posts are Markdown files in `src/posts`. The home page lists them, newest first. Each post has its own page at `/blog/<file name>`.

The Markdown parser runs only on the server. The browser never downloads it.

The example runs as a server app, so it is shown as code. The same files work in a static build (see step 5).

::example{id=markdown-blog}

## How it works

### 1. Posts are Markdown files with a small header

```md title="src/posts/hello-rivet.md"
---
title: Hello, Rivet
date: 2026-09-14
---

This post is a **Markdown file** in `src/posts`.
```

### 2. A server module reads and parses them

`src/posts.server.ts` loads every file with Vite's `import.meta.glob`. With `query: "?raw"` each file arrives as a string, bundled into the server build. Then `fromMarkdown` from the `mdast-util-from-markdown` package turns the text into a **syntax tree**: plain objects such as `{ type: "heading", depth: 2, children: [...] }`.

The file name ends in `.server.ts`, so the parser and the posts can never end up in browser code. Only the pages' `load(…)` functions import it. The build fails if a component uses it.

The types (`Post`, `PostSummary`) live in a separate `src/posts.ts`. Components import their types from there, not from the `.server.ts` file.

### 3. Loaders return what each page needs

```tsx title="src/routes/blog/[slug].tsx"
import { getPost, listPosts } from "../../posts.server.ts"; // used only by server exports
import { load } from "@rivetjs/router";

export const loader = load(({ params }: RequestEvent<"blog/[slug]">) => {
  const post = getPost(params.slug);
  if (!post) throw notFound(`No post called "${params.slug}"`);
  return post;
});

export default function BlogPost({ data }: PageProps<typeof loader>) {
  return (
    <article>
      <h1>{data.title}</h1>
      <Markdown node={data.tree} />
    </article>
  );
}
```

The file name `[slug]` makes `slug` a URL parameter. An unknown slug throws `notFound()`, which renders the nearest `_404` page with status 404.

The list page's loader returns only titles and dates, not the post bodies.

### 4. A component renders the tree as JSX

Rivet has no "insert this HTML string" feature. That is on purpose: HTML strings are the usual way to let attackers inject scripts. Instead, `Markdown.tsx` walks the tree and returns JSX for each node type:

```tsx
case "strong":
  return <strong>{children()}</strong>;
case "code":
  return <pre><code class={node.lang ? "language-" + node.lang : undefined}>{node.value}</code></pre>;
```

Text is escaped like all JSX text. Node types the component does not handle, including raw HTML inside the Markdown, render nothing.

The component has no state and no handlers, so after a full page load nothing in it runs in the browser. When the router navigates from the list to a post in the page, the post page renders in the browser from the loaded data; the parser still stays on the server.

### 5. Static build: list the posts in `entries(…)`

```ts
import { entries } from "@rivetjs/router";
export const paths = entries(() => listPosts().map((post) => ({ slug: post.slug })));
```

With `rivetRouter({ mode: "static" })`, the build renders one HTML file for each object `entries(…)` returns. A server app ignores `entries(…)`. See [static hosts](/guides/deploy/static-hosts.md).

## Variations

- **Code highlighting.** Highlight `code` nodes on the server (for example with Shiki's token API) and render the tokens as `<span>` elements with classes.
- **More Markdown.** Add GFM tables and task lists with the `mdast-util-gfm` and `micromark-extension-gfm` packages, and add cases for the new node types (`table`, `tableRow`, `tableCell`).
- **Posts from a CMS.** Replace `import.meta.glob` with a `fetch` to your CMS in the loader. The rendering stays the same.

## Watch out

- **Strip `position`.** The parser adds source positions to every node. The example removes them before returning, because loader data is sent to the browser on client navigation.
- **Unsafe links throw.** Rivet refuses `javascript:`, `vbscript:` and `data:` URLs in `href` and other URL attributes. A post with such a link fails to render. Filter link URLs in the component if authors are not trusted.
- **Install the parser.** The example's `package.json` adds `mdast-util-from-markdown` and `@types/mdast`.
- **Types for `import.meta.glob`.** TypeScript reports `Property 'glob' does not exist on type 'ImportMeta'` until you add Vite's types: `"types": ["node", "vite/client"]` in `tsconfig.json`.
