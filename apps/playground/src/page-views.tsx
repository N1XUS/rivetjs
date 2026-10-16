import { clientEffect } from "@rivetjs/runtime/dom";

// Module scope: the dynamic import resolves against this file, and the analytics module stays its own
// chunk outside the layout's static graph (so the layout's preload strategy does not schedule it).
const loadAnalytics = () => import("./analytics.js");

/** gtag-style page views: the analytics chunk loads at idle and the effect reruns on each client
 * navigation through the layout's URL accessor. Renders nothing. */
export function PageViews({ url }: { url: () => URL }) {
  clientEffect(
    async () => {
      const current = url().pathname;
      const { pageView } = await loadAnalytics();
      pageView(current);
    },
    { when: "idle" },
  );
  return null;
}
