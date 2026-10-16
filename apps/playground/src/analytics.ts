declare global {
  interface Window {
    /** Paths recorded by the example analytics module, in page-view order. */
    __pageViews?: string[];
  }
}

/** Local stand-in for a third-party tag (gtag): no network, records each page view. */
export function pageView(path: string) {
  (window.__pageViews ??= []).push(path);
}
