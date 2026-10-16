// Home footer line: this page's own numbers (content/_home-perf.json, measured on the build by scripts/home-perf.ts)
// and "Measure my visit", whose handler reads the reader's own Navigation, LCP and Resource Timing entries.
// Nothing runs before the click.
import { signal } from "@rivetjs/reactivity";
import { Gauge } from "lucide";
import { Icon } from "@rivetjs/kit/icon";
import { visitLine } from "./visit.ts";

export interface PerfLineProps {
  /** The static line, rendered on the server. */
  text: string;
  /** Button classes (ui `buttonVariants`, computed by the page). */
  buttonClass: string;
}

export function PerfLine(props: PerfLineProps) {
  const visit = signal("");
  const text = props.text;
  const buttonClass = props.buttonClass;
  return (
    <div class="lp-perf" data-css-defer="">
      <p class="lp-perf-line">{text}</p>
      <div class="lp-perf-live">
        <span data-ui-theme="rivet">
          <button
            type="button"
            class={buttonClass}
            onClick={() => {
              const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
              const scripts = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter((entry) => /\.m?js(?:$|\?)/.test(entry.name));
              let done = false;
              const report = (lcp: number | null) => {
                if (done) return;
                done = true;
                visit.set(visitLine({ ttfb: navigation?.responseStart ?? 0, lcp, scripts, loaded: navigation?.loadEventEnd ?? 0 }));
              };
              if (!PerformanceObserver.supportedEntryTypes?.includes("largest-contentful-paint")) return report(null);
              // Buffered entries arrive in one callback; none buffered (hidden tab at load) → no LCP after 250 ms.
              const observer = new PerformanceObserver((list) => report(list.getEntries().at(-1)?.startTime ?? null));
              observer.observe({ type: "largest-contentful-paint", buffered: true });
              setTimeout(() => {
                observer.disconnect();
                report(null);
              }, 250);
            }}
          >
            <Icon icon={Gauge} size={16} />
            Measure my visit
          </button>
        </span>
        <output class="lp-perf-visit">{visit()}</output>
      </div>
    </div>
  );
}
