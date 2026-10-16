// Route announcer: one visually hidden live region, created on the first client navigation (pages
// that never navigate client-side get no node and run nothing). Styled through CSSOM, which strict
// `style-src` policies allow, unlike an inline `style` attribute in markup.
let region: HTMLElement | undefined;
const HIDDEN = "position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap";

/** Announce the committed page to screen readers: its title, else its first h1, else its path. */
export function announce(): void {
  const text = document.title || document.querySelector("h1")?.textContent?.trim() || location.pathname;
  if (!region) {
    region = document.createElement("div");
    region.setAttribute("aria-live", "assertive");
    region.setAttribute("aria-atomic", "true");
    region.style.cssText = HIDDEN;
  }
  if (!region.isConnected) document.body.append(region);
  // Cleared, then set a frame later: the same text twice in a row is announced again.
  region.textContent = "";
  const node = region;
  requestAnimationFrame(() => (node.textContent = text));
}
