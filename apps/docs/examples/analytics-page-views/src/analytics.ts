// Stand-in for a real analytics script (gtag, Plausible, your own endpoint).
// A real one would send the view, for example with navigator.sendBeacon("/api/views", path).
const sent: string[] = [];

/** Record one page view and return every path sent so far. */
export function pageView(path: string): string[] {
  sent.push(path);
  return [...sent];
}
