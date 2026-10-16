// Served to Chromium by ../image.test.ts: types stripped, specifiers rewritten to served paths.
import { mount } from "@rivetjs/runtime/dom";
import { Picture, ImagePreload, pictureHtml, preloadHtml, preloadLink } from "@rivetjs/runtime/image/dom";
import type { ImageDescriptor } from "@rivetjs/runtime/image/dom";

export function run(image: ImageDescriptor): string {
  const host = document.createElement("div");
  mount(() => [Picture({ image, alt: "x", priority: true }), ImagePreload({ image })], host);
  const expected = document.createElement("div");
  expected.innerHTML = pictureHtml({ image, alt: "x", priority: true }) + preloadHtml(preloadLink(image));
  // Runtime markers are comments (v1 range boundaries, v2 anchors); the markup between them must match the server's.
  const actual = host.innerHTML.replace(/<!--[\s\S]*?-->/g, "");
  return actual === expected.innerHTML ? "passed" : `mismatch:\n${actual}\n${expected.innerHTML}`;
}
