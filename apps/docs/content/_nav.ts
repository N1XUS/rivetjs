// Site navigation: areas (top-bar sections) → sections (side-nav headings) → groups (collapsible in the
// side nav) → content paths (files under content/, without `.md`; `{ path, tag }` adds a New/Updated tag).
// Order here is reading order (prev/next). Every page must appear exactly once; the build fails on
// orphans and on entries without a file.

import { site } from "../site.config.ts";
import type { NavArea, NavSection } from "@rivetjs/docs-kit/tools/nav.ts";

export const areas: NavArea[] = [
  { id: "guide", title: "Guide" },
  { id: "ui", title: "UI", href: site.sites.ui + "/" },
];

export const nav: NavSection[] = [
  {
    id: "start",
    title: "Start",
    area: "guide",
    groups: [
      {
        title: "Get started",
        pages: [
          "start/what-is-rivet",
          "start/quick-start",
          "start/project-structure",
          "start/editor-setup",
          { path: "start/coming-from-other-frameworks", tag: "new" },
        ],
      },
      {
        title: "Tutorial",
        pages: [
          "start/tutorial/index",
          "start/tutorial/01-a-page",
          "start/tutorial/02-components-and-props",
          "start/tutorial/03-state",
          "start/tutorial/04-lists",
          "start/tutorial/05-input",
          "start/tutorial/06-pages-and-layouts",
        ],
      },
    ],
  },
  {
    id: "learn",
    title: "Learn",
    area: "guide",
    groups: [{ title: "How it works", pages: ["learn/server-first", "learn/resuming", "learn/signals", "learn/rendering-modes", "learn/loading-code"] }],
  },
  {
    id: "guides",
    title: "Guides",
    area: "guide",
    groups: [
      {
        title: "Components",
        pages: [
          "guides/components/components",
          "guides/components/events",
          "guides/components/lists",
          "guides/components/conditional",
          "guides/components/forms-and-input",
          "guides/components/refs",
          "guides/components/context",
          "guides/components/async",
          "guides/components/suspense",
          "guides/components/browser-only",
          "guides/components/slots",
          { path: "guides/components/error-boundaries", tag: "new" },
          { path: "guides/components/dynamic-and-portal", tag: "new" },
        ],
      },
      {
        title: "State",
        pages: [
          "guides/state/signals",
          "guides/state/computed",
          "guides/state/effects",
          "guides/state/batching",
          "guides/state/equality",
          { path: "guides/state/stores", tag: "new" },
        ],
      },
      {
        title: "Routing",
        pages: [
          "guides/routing/file-routes",
          "guides/routing/layouts",
          "guides/routing/params",
          "guides/routing/loading-data",
          "guides/routing/guards",
          "guides/routing/actions-and-forms",
          "guides/routing/errors-and-404",
          "guides/routing/head-and-seo",
          "guides/routing/headers-and-caching",
          "guides/routing/endpoints",
          "guides/routing/typed-routes",
          "guides/routing/links-and-navigation",
          "guides/routing/transitions",
          "guides/routing/server-code-in-routes",
        ],
      },
      { title: "Forms", pages: ["guides/forms/forms", { path: "guides/forms/forms-in-overlays", tag: "new" }] },
      { title: "UI packages", pages: ["ui/overview", "ui/kit"] },
      { title: "Styling", pages: ["guides/styling/css-and-tailwind", "guides/styling/scoped-styles"] },
      {
        title: "Motion",
        pages: [
          { path: "guides/motion/index", tag: "new" },
          { path: "guides/motion/presence", tag: "new" },
          { path: "guides/motion/layout", tag: "new" },
          { path: "guides/motion/scroll", tag: "new" },
        ],
      },
      { title: "Assets", pages: ["guides/assets/images"] },
      { title: "Languages", pages: ["guides/i18n/translating-text", "guides/i18n/plurals-and-formatting", "guides/i18n/locale-urls"] },
      {
        title: "Performance",
        pages: ["guides/performance/preloading", "guides/performance/chunks", "guides/performance/streaming", "guides/performance/measuring"],
      },
      { title: "Security", pages: ["guides/security/csp", "guides/security/trusted-types", "guides/security/server-only-code"] },
      {
        title: "Tooling",
        pages: [
          "guides/tooling/vite",
          "guides/tooling/dev-server-and-hot-reload",
          "guides/tooling/devtools",
          "guides/tooling/language-service",
          { path: "guides/tooling/testing", tag: "new" },
          { path: "guides/tooling/testing-resumability", tag: "new" },
          { path: "guides/tooling/nx", tag: "new" },
          { path: "guides/tooling/ai", tag: "new" },
        ],
      },
      {
        title: "Deploy",
        pages: [
          { path: "guides/deploy/overview", tag: "new" },
          { path: "guides/deploy/node", tag: "updated" },
          "guides/deploy/static-hosts",
          "guides/deploy/docker",
          { path: "guides/deploy/vercel", tag: "new" },
          { path: "guides/deploy/netlify", tag: "new" },
          { path: "guides/deploy/cloudflare", tag: "new" },
          { path: "guides/deploy/bun", tag: "new" },
          { path: "guides/deploy/deno", tag: "new" },
        ],
      },
    ],
  },

  {
    id: "more",
    title: "More",
    area: "guide",
    groups: [
      {
        title: "Recipes",
        pages: [
          "recipes/dark-mode-toggle",
          "recipes/search-with-debounce",
          "recipes/paginated-list-from-url",
          "recipes/protected-pages",
          "recipes/login-form",
          "recipes/optimistic-like",
          "recipes/live-updates",
          "recipes/analytics-page-views",
          "recipes/instant-page-transitions",
          "recipes/markdown-blog",
        ],
      },
      {
        title: "Best practices",
        pages: [
          "best-practices/secrets-in-server-files",
          "best-practices/pass-data-not-services",
          "best-practices/state-close-to-use",
          "best-practices/serializable-captures",
          "best-practices/links-and-forms-without-js",
          "best-practices/preload-by-impact",
          "best-practices/error-handling",
        ],
      },
      {
        title: "Gotchas",
        pages: [
          "gotchas/component-did-not-run-again",
          "gotchas/function-is-not-serializable",
          "gotchas/window-is-not-defined",
          "gotchas/context-gone-after-await",
          "gotchas/dev-and-production-differ",
          "gotchas/pushstate-does-not-update-router",
          "gotchas/spread-props-and-style",
          "gotchas/promise-child-needs-async",
          "gotchas/changing-built-ins",
        ],
      },
      { title: "Reference", pages: ["reference/file-conventions", "reference/jsx", "reference/config", { path: "reference/motion", tag: "new" }, "reference/glossary"] },
      { title: "Project", pages: ["about/roadmap", "about/benchmarks"] },
    ],
  },
];
