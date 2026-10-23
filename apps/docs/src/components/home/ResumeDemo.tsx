// Home "Resumability" demo: a real resumable component. The server renders it once ("rendered on: server" is computed
// in the component body: if the browser ever ran the component, the text would say "browser"). The
// resumed code for this example is reported from Resource Timing (the runtime, its boundary chunk and their imports), split into
// what the click fetched and what was already prefetched before it (hover / focus intent, an earlier interaction).
// Other widgets and page prefetches are excluded. The component has its own intent chunk (vite.config.ts `HOME_RULES`).
// Tests: tests/home.test.ts "resume demo".
import { signal } from "@rivetjs/reactivity";
import { Heart } from "lucide";
import { Icon } from "@rivetjs/kit/icon";
import { loadedFor } from "./resume-downloads.ts";

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
  const earlyFiles = signal("");
  const earlyCost = signal("");
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
        onClick={async (event) => {
          likes.update((n) => n + 1);
          if (likes() > 1) return;
          const loaded = await loadedFor(event);
          files.set(loaded.files);
          cost.set(loaded.cost);
          earlyFiles.set(loaded.earlyFiles);
          earlyCost.set(loaded.earlyCost);
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
            <p class="rd-now">
              <span class="rd-cost">{cost()}</span>
              <code class="rd-files">{files()}</code>
            </p>
            <p class="rd-early" hidden={earlyCost() ? undefined : true}>
              <span class="rd-cost">{earlyCost()}</span>
              <code class="rd-files">{earlyFiles()}</code>
            </p>
          </dd>
        </div>
      </dl>
    </div>
  );
}

const kb = (bytes: number) => (bytes < 1000 ? `${bytes} B` : `${(bytes / 1000).toFixed(1)} KB`);
