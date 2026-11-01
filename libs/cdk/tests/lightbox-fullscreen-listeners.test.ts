// Lightbox Fullscreen plugin: the document `fullscreenchange` listeners of a lightbox state live for its fullscreen
// session only (YARL removes them with the plugin; before, every lightbox state ever put in fullscreen kept two).
import { installDom } from "./install-dom.ts";
installDom();
import { describe, expect, it, vi } from "vitest";
import { createLightboxState } from "../lightbox/state.ts";
import { lightboxEnterFullscreen, lightboxExitFullscreen } from "../lightbox/fullscreen/index.tsx";

describe("lightbox fullscreen listeners", () => {
  it("are removed when the fullscreen session ends", async () => {
    let current: Element | null = null;
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => current });
    const change = () => document.dispatchEvent(new Event("fullscreenchange"));
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: async () => ((current = null), change()) });
    const root = document.createElement("div");
    root.setAttribute("data-lightbox-root", "");
    const container = document.createElement("div");
    container.id = "lb-container";
    root.append(container);
    document.body.append(root);
    (root as HTMLElement & { requestFullscreen: () => Promise<void> }).requestFullscreen = async () => {
      current = root;
      change();
    };
    const state = createLightboxState({ slides: [] } as never, "lb");
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    try {
      lightboxEnterFullscreen(state);
      await Promise.resolve();
      expect(state.fullscreen()).toBe(true);
      lightboxExitFullscreen(state);
      await Promise.resolve();
      expect(state.fullscreen()).toBe(false);
      const added = add.mock.calls.filter(([type]) => String(type).endsWith("fullscreenchange")).length;
      const removed = remove.mock.calls.filter(([type]) => String(type).endsWith("fullscreenchange")).length;
      expect(added).toBe(2);
      expect(removed).toBe(2);
      // A new session listens again.
      lightboxEnterFullscreen(state);
      await Promise.resolve();
      expect(state.fullscreen()).toBe(true);
    } finally {
      add.mockRestore();
      remove.mockRestore();
      root.remove();
    }
  });
});
