import { signal } from "@rivetjs/reactivity";
import { Motion, spring } from "@rivetjs/motion";
import { Code, FileText, Minus, Play, Plus } from "lucide";
import { Icon } from "@rivetjs/kit/icon";

const SOURCE = `import { signal } from "@rivetjs/reactivity";

export default function Counter() {
  const count = signal(7);
  const change = (by: number) => count.update(
    (n) => Math.max(0, Math.min(99, n + by))
  );

  return (
    <div>
      <output aria-live="polite">
        {String(count()).padStart(2, "0")}
      </output>
      <button type="button" disabled={count() === 0}
        onClick={() => change(-1)}>Decrement counter</button>
      <button type="button" disabled={count() === 99}
        onClick={() => change(1)}>Increment counter</button>
    </div>
  );
}`;

export function HomeWorkbench() {
  const count = signal(7);
  const pane = signal(0);
  const text = () => String(count()).padStart(2, "0");
  const choose = (index: number) => {
    pane.set(index);
  };
  return (
    <section class="hs-workbench" aria-label="A real Rivet component">
      <div class="hs-workbench-bar">
        <div
          role="tablist"
          aria-label="Counter code"
          class="hs-code-tabs"
          onKeyDown={(event) => {
            const next = event.key === "ArrowRight" || event.key === "ArrowLeft" ? 1 - pane() : event.key === "Home" ? 0 : event.key === "End" ? 1 : -1;
            if (next < 0) return;
            event.preventDefault();
            choose(next);
            (event.target as Element).closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
          }}
        >
          <button
            id="home-tab-component"
            role="tab"
            aria-selected={pane() === 0}
            aria-controls="home-code-component"
            tabIndex={pane() === 0 ? 0 : -1}
            onClick={() => choose(0)}
          >
            <Icon icon={Code} size={17} />
            Component
          </button>
          <button
            id="home-tab-server"
            role="tab"
            aria-selected={pane() === 1}
            aria-controls="home-code-server"
            tabIndex={pane() === 1 ? 0 : -1}
            onClick={() => choose(1)}
          >
            <Icon icon={FileText} size={17} />
            Server HTML
          </button>
        </div>
        <span class="hs-file-name">counter.tsx</span>
      </div>
      <div class="hs-workbench-body">
        <div class="hs-code-column">
          <pre id="home-code-component" role="tabpanel" aria-labelledby="home-tab-component" tabIndex={0} hidden={pane() !== 0}>
            <code>
              {SOURCE.split("\n").map((line, i) => (
                <span class="hs-code-line">
                  <span class="hs-line-number" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span>{line || " "}</span>
                </span>
              ))}
            </code>
          </pre>
          <pre id="home-code-server" role="tabpanel" aria-labelledby="home-tab-server" tabIndex={0} hidden={pane() !== 1}>
            <code>
              <span class="hs-code-comment">// Initial HTML. Boundary metadata omitted.</span>
              {
                '\n\n<div>\n  <output aria-live="polite">07</output>\n  <button type="button">Decrement counter</button>\n  <button type="button">Increment counter</button>\n</div>\n\n'
              }
              <span class="hs-code-comment">{"// Signal value: { count: 7 }\n// The preview adds icons and Motion digit tracks."}</span>
            </code>
          </pre>
        </div>
        <div class="hs-live-preview">
          <p class="hs-preview-label">
            <Icon icon={Play} size={13} />
            <span>Live preview</span>
            <span class="hs-live-dot" />
          </p>
          <h2>
            A little state.
            <br />A lot of possibility.
          </h2>
          <div class="hs-counter-digits" aria-hidden="true" data-value={text()}>
            {[0, 1].map((place) => (
              <span class="hs-digit-window">
                <Motion.span
                  class="hs-digit-track"
                  initial={false}
                  animate={() => ({ y: `${-Number(text()[place])}em` })}
                  transition={{ type: spring, duration: 0.4, bounce: 0.08 }}
                >
                  {Array.from({ length: 10 }, (_, n) => (
                    <span class="hs-digit">{n}</span>
                  ))}
                </Motion.span>
              </span>
            ))}
          </div>
          <output id="home-counter-value" class="sr-only" aria-live="polite" aria-atomic="true">
            {text()}
          </output>
          <div class="hs-counter-controls">
            <button type="button" aria-label="Decrement counter" disabled={count() === 0} onClick={() => count.update((n) => Math.max(0, n - 1))}>
              <Icon icon={Minus} size={23} />
            </button>
            <button type="button" aria-label="Increment counter" disabled={count() === 99} onClick={() => count.update((n) => Math.min(99, n + 1))}>
              <Icon icon={Plus} size={23} />
            </button>
          </div>
          <span class="hs-counter-hint">Go on. Give it a click.</span>
        </div>
      </div>
    </section>
  );
}
