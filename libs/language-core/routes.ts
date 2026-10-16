// File-route lookups for links: match a literal internal href against the manifest's route patterns
// with the router's rules (`compileRoutes`: static, `:param`, terminal `*splat`, case-sensitive).
import type { EditorRoute } from "./manifest.ts";

/** Path of an internal link (`/a/b?q#h` → `/a/b`); null for external, protocol-relative or relative hrefs. */
export function internalPath(href: string): string | null {
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  const end = href.search(/[?#]/);
  return end === -1 ? href : href.slice(0, end);
}

const segments = (path: string): string[] => (path === "/" ? [] : path.slice(1, path.endsWith("/") ? -1 : undefined).split("/"));

/** First route whose pattern matches `path` (router declaration order), with its params. */
export function matchRoute(routes: readonly EditorRoute[], path: string): { route: EditorRoute; params: Record<string, string> } | null {
  let parts: string[];
  try {
    parts = segments(path).map((part) => decodeURIComponent(part));
  } catch {
    return null;
  }
  if (parts.some((part) => part === "")) return null;
  for (const route of routes) {
    const params: Record<string, string> = {};
    let index = 0,
      matched = true;
    for (const segment of segments(route.pattern)) {
      if (segment.startsWith("*")) {
        params[segment.slice(1)] = parts.slice(index).join("/");
        index = parts.length;
        break;
      }
      if (index >= parts.length || (!segment.startsWith(":") && decodeURIComponent(segment) !== parts[index])) {
        matched = false;
        break;
      }
      if (segment.startsWith(":")) params[segment.slice(1)] = parts[index]!;
      index++;
    }
    if (matched && index === parts.length) return { route, params };
  }
  return null;
}

/** Completion text for a route: the full path when static, else the static prefix up to the first param. */
export function routeCompletion(route: EditorRoute): { path: string; complete: boolean } {
  const parts = segments(route.pattern);
  const dynamic = parts.findIndex((part) => part.startsWith(":") || part.startsWith("*"));
  if (dynamic === -1) return { path: route.pattern, complete: true };
  return { path: "/" + parts.slice(0, dynamic).map((part) => part + "/").join(""), complete: false };
}
