// Home "Resumability" demo: a real resumable component, an independent boundary (data-only call site on the home page:
// literal props, recorded with the boundary). The server renders it; nothing runs in the browser before an interaction
// (home = a lean page: no fetch-ahead). Its first click starts the runtime, which loads and adopts the boundaries around
// the button (this one and its ancestors up to the router's Root: their handlers may see the click bubble), runs each
// component once over the server's elements, then the handler. "Component code ran on" is evaluated in the body: the
// server's text until that adopt run, then the browser's. The readout lists the JavaScript the click fetched, from
// Resource Timing (the runtime, the boundaries' chunks and their imports), split into what the click fetched and what was
// already fetched before it (hover / focus intent, an earlier interaction). Tests: tests/home.test.ts "resume demo".
import { signal } from "@rivetjs/reactivity";
import { Heart } from "lucide";
import { Icon } from "@rivetjs/kit/icon";
import homePerf from "../../../content/_home-perf.json" with { type: "json" };
import { loadedFor } from "./resume-downloads.ts";

export interface ResumeDemoProps {
  /** Button classes (ui `buttonVariants({ variant: "primary" })` as a literal: no ui code in the boundary's chunk). */
  buttonClass: string;
}

export function ResumeDemo(props: ResumeDemoProps) {
  const likes = signal(0);
  const files = signal("");
  const cost = signal("");
  const earlyFiles = signal("");
  const earlyCost = signal("");
  // Server: the HTML's text; browser: the adopt run of the first click (it keeps the elements, rewrites this text).
  const where = typeof document === "undefined" ? "the server only" : "the server, then this tab (on your first click)";
  // The inline loader of the built home page (content/_home-perf.json, measured): constants in the HTML.
  const loader = `loader only (${kb(homePerf.loader.bytes)} inline, ${kb(homePerf.loader.brotli)} compressed)`;
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
          <dt>Component code ran on</dt>
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
