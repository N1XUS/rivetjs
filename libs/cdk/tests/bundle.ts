// Bundle cdk modules (plain TS, no JSX) into an IIFE for blank Chromium pages: unit-level browser tests
// of engines that need real layout (scroll offsets, rects) without the story app. `window.cdk` holds
// the entry's exports.
import { build } from "esbuild";

const cache = new Map<string, Promise<string>>();

/** IIFE source exposing `globalThis.cdk = { ...exports of entry }`; `entry` is TS source (imports relative to libs/cdk/tests). */
export function bundle(entry: string): Promise<string> {
  let hit = cache.get(entry);
  if (!hit)
    cache.set(
      entry,
      (hit = build({
        stdin: { contents: entry, resolveDir: new URL(".", import.meta.url).pathname, loader: "ts" },
        bundle: true,
        format: "iife",
        globalName: "cdk",
        write: false,
        platform: "browser",
        conditions: ["browser"],
        logLevel: "silent",
      }).then((r) => r.outputFiles[0]!.text)),
    );
  return hit;
}
