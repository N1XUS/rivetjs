// Per-site modules the docs-kit components and routes import; `docsSite()` (vite.ts) maps each onto
// the app's own file (site.config.ts, api.config.ts, src/generated/*); on the server `examples` and `api` are read
// from disk at render time (vite.ts `docsModules`).
declare module "virtual:docs/site" {
  export const site: import("./tools/app.ts").DocsSite;
}
declare module "virtual:docs/api-config" {
  export const entries: import("./tools/app.ts").ApiEntryConfig[];
  export const packages: import("./tools/app.ts").ApiPackage[];
}
declare module "virtual:docs/nav" {
  export const sections: import("./components/types.ts").NavData;
  export const areas: import("./components/types.ts").NavAreas;
}
declare module "virtual:docs/pages" {
  export const pages: import("./components/types.ts").PageIndexEntry[];
}
declare module "virtual:docs/examples" {
  /** Every example (meta + shown code): `src/generated/examples.json`; server only (`{}` in a client build); generated pages import `virtual:docs/examples?ids=…` instead, other routes pass the needed records as route data. */
  export const examples: Record<string, import("./components/types.ts").ExampleData>;
}
declare module "virtual:docs/examples?ids=*" {
  /** A generated page's own examples (ZERO Z9): client build = just the listed records' `ExampleView` fields (in the page chunk); server / dev = every example. */
  export const examples: Record<string, import("./components/types.ts").ExampleView>;
}
declare module "virtual:docs/scripts" {
  /** URL of the docs page script (`components/page-script.ts`, ZERO Z13); undefined in the browser / when not built. */
  export const pageScript: () => string | undefined;
  /** URL of a page's own plain module script (`docsSite({ scripts })`, DOCS-FAST); undefined in the browser / for other pages. */
  export const routeScript: (pathname: string) => string | undefined;
}
declare module "virtual:docs/example-frames" {
  /** Live examples: their frame page paths and frame module (`src/generated/example-frames.tsx`). */
  export const frames: Record<string, { paths: readonly string[]; load: () => Promise<import("./components/frame.tsx").FrameModule> }>;
}
declare module "virtual:docs/frame-styles" {
  /** Stylesheet URLs of an example's frame page (server; `[]` in the browser). */
  export function frameStyles(id: string): readonly string[] | Promise<readonly string[]>;
}
declare module "virtual:docs/starters" {
  export const starters: Record<string, Record<string, string>>;
}
declare module "virtual:docs/api" {
  const model: import("./tools/api.ts").ApiModel;
  export default model;
}
declare module "virtual:docs/brand" {
  /** URL of the Rivet logo (repo root `logo.svg`, hashed asset): brand mark + favicon. */
  export const logo: string;
}
declare module "*.woff2?url" {
  /** Hashed asset URL (Vite `?url`): the same file the theme's `@font-face` rules reference. */
  const url: string;
  export default url;
}
declare module "*?url" {
  /** Vite asset URL import (`./clip.mp4?url`): example media (lightbox video / PDF) without the image pipeline. */
  const url: string;
  export default url;
}
