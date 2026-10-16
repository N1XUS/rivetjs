// Home "Resumability" demo: a real resumable component. The server renders it once ("rendered on: server" is computed
// in the component body: if the browser ever ran the component, the text would say "browser"). The click handler is
// the only code this page loads; it reports what the browser fetched for it from Resource Timing, which the browser
// records without any page code. Tests: tests/home.test.ts "resume demo".
import { signal } from "@rivetjs/reactivity";
import { Heart } from "lucide";
import { Icon } from "@rivetjs/kit/icon";

export interface ResumeDemoProps {
  /** Inline resume loader of the built home page, UTF-8 bytes (content/_home-perf.json). */
  loaderBytes: number;
  /** The same, brotli-compressed. */
  loaderBrotli: number;
  /** Button classes (ui `buttonVariants`, computed by the page: no ui code in the handler's chunk). */
  buttonClass: string;
}

export function ResumeDemo(props: ResumeDemoProps) {
  const likes = signal(0);
  const files = signal("");
  const cost = signal("");
  const where = typeof document === "undefined" ? "server" : "browser";
  // Read once while rendering (server): constants in the HTML, so no binding here reaches the page's props recipe.
  const loader = `loader only (${kb(props.loaderBytes)} inline, ${kb(props.loaderBrotli)} compressed)`;
  const buttonClass = props.buttonClass;
  return (
    <div class="rd" data-clicked={likes() > 0 ? "" : undefined}>
      <span class="rd-like" data-ui-theme="rivet">
        <button
        type="button"
        class={buttonClass}
        onClick={(event) => {
          likes.update((n) => n + 1);
          if (likes() > 1) return;
          // First click only: what the browser fetched up to now is what this click needed.
          const [names, line] = loadedFor(event);
          files.set(names);
          cost.set(line);
        }}
      >
        <Icon icon={Heart} size={16} />
        {likes()} {likes() === 1 ? "like" : "likes"}
      </button>
      </span>
      <dl class="rd-readout" aria-live="polite">
        <div>
          <dt>Component rendered on</dt>
          <dd>
            <span class="rd-where" data-where="">
              {where}
            </span>
          </dd>
        </div>
        <div class="rd-before">
          <dt>JavaScript executed so far</dt>
          <dd>{loader}</dd>
        </div>
        <div class="rd-after">
          <dt>Loaded for your first click</dt>
          <dd>
            <code class="rd-files">{files()}</code>
            <span class="rd-cost">{cost()}</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}

const kb = (bytes: number) => (bytes < 1000 ? `${bytes} B` : `${(bytes / 1000).toFixed(1)} KB`);

/** File names + one cost line from the Resource Timing entries of this page's script chunks (`/assets/*.js`). */
function loadedFor(event: Event): [string, string] {
  const entries = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter((entry) => /\/assets\/[^/?#]+\.js(?:$|\?)/.test(entry.name));
  if (!entries.length) return ["nothing", "the handler was already in this tab"];
  const names = entries.map((entry) => entry.name.slice(entry.name.lastIndexOf("/") + 1).replace(/\?.*$/, "")).join(" · ");
  let wire = 0;
  let decoded = 0;
  let end = 0;
  let early = 0;
  for (const entry of entries) {
    wire += entry.transferSize;
    decoded += entry.decodedBodySize;
    end = Math.max(end, entry.responseEnd);
    if (entry.startTime < event.timeStamp) early = Math.max(early, event.timeStamp - entry.startTime);
  }
  const size = wire ? `${kb(wire)} over the network (${kb(decoded)} uncompressed)` : `${kb(decoded)} from cache`;
  const when = early > 0 ? `fetched on hover, ${Math.round(early)} ms before your click` : `in ${Math.round(Math.max(0, end - event.timeStamp))} ms`;
  return [names, ` — ${entries.length} ${entries.length === 1 ? "file" : "files"}, ${size}, ${when}`];
}
