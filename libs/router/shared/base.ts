// App base path (`rivetRouter({ base: "/app" })` or Vite's `base`): Vite replaces
// `import.meta.env.BASE_URL` in every module it builds (client and server bundles); outside Vite
// (plain Node) it is the root. Route patterns in the generated files already carry the base;
// these helpers serve code that takes app paths (`<Link to>`, `navigate()`).

/** Normalize a base (`/app/`, `/app`, `/`, `./`) to `""` (root) or `/app` (no trailing slash). */
export function normalizeBase(base: string | undefined): string {
  if (!base || !base.startsWith("/")) return "";
  return base.replace(/\/+$/, "");
}

/** The app's base path without trailing slash; `""` at the root. */
export const BASE: string = normalizeBase((import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL);

/** An app path (`/items/1?q`) as a URL path under the base; other forms (full, relative URLs) unchanged. */
export function withBase(to: string, base: string = BASE): string {
  return base && to.startsWith("/") && !to.startsWith("//") ? base + to : to;
}

/** Whether a URL path lies under the base (the app's routes can serve it). */
export function underBase(pathname: string, base: string = BASE): boolean {
  return !base || pathname === base || pathname.startsWith(base + "/");
}
