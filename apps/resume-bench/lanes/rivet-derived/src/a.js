// Spike S2: gtag-style analytics, its own chunk loaded at idle (never prefetched earlier), re-run per navigation.
export function pageview(path) {
  (window.__analytics ??= []).push(["pageview", path]);
}
