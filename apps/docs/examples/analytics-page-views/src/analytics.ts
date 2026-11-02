// Stand-in for a real analytics script (gtag, Plausible, your own endpoint).
// A real one would send the view, for example with navigator.sendBeacon("/api/views", path).
const sent: string[] = [];

/** Record one page view and return the last 20 paths sent (the list stays bounded in a long session). */
export function pageView(path: string): string[] {
  sent.push(path);
  if (sent.length > 20) sent.shift();
  return [...sent];
}
