import { signal } from "@rivetjs/reactivity";
import { clientEffect, ref } from "@rivetjs/runtime/dom";
import { Motion } from "@rivetjs/motion";
import { ArrowRight, Box, Code, FileCode, FileText, Grid2X2, MousePointer2, Minus, Pause, Play, Plus, RotateCcw, Server, AppWindow, Zap } from "lucide";
import { Icon } from "@rivetjs/kit/icon";
import "./home-schema.css";

const STAGES = [
  {
    title: "Compile your components",
    detail: "JSX becomes direct server and DOM code.",
    caption: "Write familiar JSX. The compiler prepares both sides.",
    icon: Code,
  },
  {
    title: "Start with the page",
    detail: "Send HTML and the values the page needs.",
    caption: "Real HTML arrives with the signal values needed to continue.",
    icon: FileText,
  },
  {
    title: "Keep the interaction",
    detail: "Adopt the existing DOM. Update what changed.",
    caption: "Wake on interaction or a client trigger. Keep the server DOM.",
    icon: MousePointer2,
  },
];
const FLOW = ["Render", "Send", "Wait", "Resume", "Update"];
export function HomeArchitecture() {
  const stage = signal(2);
  const step = signal(0);
  const playing = signal(false);
  const root = ref<HTMLElement>();
  clientEffect(
    () => {
      const node = root();
      if (!node) return;
      const reduced = matchMedia("(prefers-reduced-motion: reduce)");
      let visible = false;
      const seen = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
      });
      seen.observe(node);
      const policy = () => {
        if (reduced.matches) {
          playing.set(false);
          step.set(4);
        }
      };
      policy();
      if (!reduced.matches) playing.set(true);
      const timer = setInterval(() => {
        if (!visible || document.hidden || reduced.matches || !playing()) return;
        if (step() < 4) step.update((n) => n + 1);
        else playing.set(false);
      }, 1100);
      reduced.addEventListener("change", policy);
      return () => {
        clearInterval(timer);
        seen.disconnect();
        reduced.removeEventListener("change", policy);
      };
    },
    { when: "visible" },
  );
  const choose = (value: number) => {
    stage.set(value);
    step.set(value === 0 ? 0 : value === 1 ? 1 : 3);
    playing.set(false);
  };
  return (
    <section id="how-it-works" class="hs-architecture hs-section" data-stage={String(stage())} ref={root} aria-labelledby="home-how-title">
      <div class="hs-architecture-copy">
        <p class="hs-eyebrow">A DIFFERENT STARTING POINT</p>
        <h2 id="home-how-title">
          The right work.
          <br />
          In the right place.
        </h2>
        <p class="hs-section-lead">HTML arrives first. Interactivity picks up where the server left off.</p>
        <div
          role="tablist"
          aria-label="How Rivet works"
          aria-orientation="vertical"
          class="hs-stage-list"
          onKeyDown={(event) => {
            const next =
              event.key === "ArrowDown"
                ? (stage() + 1) % 3
                : event.key === "ArrowUp"
                  ? (stage() + 2) % 3
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? 2
                      : -1;
            if (next < 0) return;
            event.preventDefault();
            choose(next);
            (event.target as Element).closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
          }}
        >
          {STAGES.map((item, i) => (
            <button
              id={`home-stage-${i}`}
              type="button"
              role="tab"
              aria-selected={stage() === i}
              aria-controls="home-stage-scene"
              tabIndex={stage() === i ? 0 : -1}
              onClick={() => choose(i)}
            >
              <span class="hs-stage-number" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                <strong>{item.title}</strong>
                <span class="hs-stage-detail">{item.detail}</span>
              </span>
              <Icon icon={ArrowRight} size={16} class="hs-stage-arrow" />
            </button>
          ))}
        </div>
        <a class="hs-text-link" href="/learn/resuming/" data-rivet-reload="">
          Read about resumability
          <Icon icon={ArrowRight} size={17} />
        </a>
      </div>
      <div id="home-stage-scene" class="hs-schema-scene" role="tabpanel" aria-labelledby={`home-stage-${stage()}`} tabIndex={0}>
        <div class="hs-schema-file">
          <span>
            <Icon icon={FileCode} size={17} />
            counter.tsx
          </span>
          <code>
            <b>const</b> count = <em>signal</em>(<i>7</i>);
          </code>
        </div>
        <p class="sr-only" aria-live="polite">
          {STAGES[stage()]!.caption}
        </p>
        <div class="hs-resume-diagram" data-step={String(step())}>
          <div class="hs-schema-lanes">
            <div class="hs-server-lane">
              <div class="hs-domain hs-server-domain">
                <Icon icon={Server} size={25} />
                <span>
                  SERVER
                  <small>
                    Render components
                    <br />
                    to HTML and values.
                  </small>
                </span>
              </div>
              <div class="hs-output-node">
                <span class="hs-node-title">
                  <Icon icon={FileText} size={15} />
                  Rendered output
                </span>
                <code>
                  &lt;button&gt;<strong>07</strong>&lt;/button&gt;
                </code>
                <span class="hs-data-label">Signal values</span>
                <code>{"{ count: 7 }"}</code>
              </div>
              <span class="hs-node-caption">HTML + signal values</span>
            </div>
            <div class="hs-transfer" aria-hidden="true">
              <span>Send the page</span>
              <div class="hs-route">
                <Motion.span
                  class="hs-packet"
                  initial={false}
                  animate={() => ({ x: step() === 1 ? "85%" : "48%", opacity: step() >= 1 ? 1 : 0 })}
                  transition={{ duration: 1 }}
                >
                  <Icon icon={Box} size={15} />
                </Motion.span>
              </div>
              <Icon icon={ArrowRight} size={16} />
            </div>
            <div class="hs-browser-lane">
              <div class="hs-domain">
                <Icon icon={AppWindow} size={25} />
                <span>
                  BROWSER
                  <small>
                    Resume interactivity
                    <br />
                    in your app.
                  </small>
                </span>
              </div>
              <div class="hs-browser-node">
                <span>Your page, already rendered</span>
                <div class="hs-browser-preview">
                  <strong class="hs-schema-count">
                    <span class="sr-only">{step() >= 4 ? "08" : "07"}</span>
                    <Motion.span
                      aria-hidden="true"
                      class="hs-schema-count-track"
                      initial={false}
                      animate={() => ({ y: step() >= 4 ? "-1em" : "0em" })}
                      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <span>07</span>
                      <span>08</span>
                    </Motion.span>
                  </strong>
                  <div class="hs-browser-controls" aria-hidden="true">
                    <span>
                      <Icon icon={Minus} size={17} />
                    </span>
                    <span>
                      <Icon icon={Plus} size={17} />
                    </span>
                  </div>
                  <span class="hs-click-marker" data-active={step() >= 3 || undefined}>
                    <Icon icon={MousePointer2} size={18} />
                  </span>
                </div>
                <span class="hs-update-label" aria-hidden="true">
                  Update
                  <br />
                  changed value
                </span>
              </div>
              <span class="sr-only">
                {step() >= 4 ? "Only the changed value updates." : step() >= 3 ? "Adopt existing DOM, run the handler." : "HTML is ready before interaction."}
              </span>
            </div>
          </div>
          <div class="hs-interaction-loop" aria-label="Interaction resumes the component">
            <span class="hs-trigger-route" aria-hidden="true" />
            {[
              { icon: MousePointer2, lines: ["User", "interacts"] },
              { icon: FileText, lines: ["Load", "component code"] },
              { icon: Grid2X2, lines: ["Adopt", "existing DOM"] },
              { icon: Zap, lines: ["Run", "handler"] },
            ].map((item, i) => (
              <Motion.div
                class="hs-loop-node"
                data-active={step() >= 3 || undefined}
                initial={false}
                animate={() => ({ y: step() >= 3 ? 0 : 5 })}
                transition={{ duration: 0.28, delay: i * 0.09 }}
              >
                <span class="hs-loop-icon">
                  <Icon icon={item.icon} size={21} />
                </span>
                <span>
                  {item.lines[0]}
                  <br />
                  {item.lines[1]}
                </span>
                {i < 3 ? <Icon icon={ArrowRight} class="hs-loop-arrow" size={17} /> : null}
              </Motion.div>
            ))}
          </div>
          <p class="hs-schema-reassurance">Same DOM. One signal update.</p>
          <div class="hs-playback">
            <button
              type="button"
              class="hs-play-control"
              aria-label={playing() ? "Pause resumability diagram" : "Play resumability diagram"}
              onClick={() => {
                if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) {
                  step.update((n) => (n + 1) % 5);
                  return;
                }
                if (!playing() && step() === 4) step.set(0);
                playing.set(!playing());
              }}
            >
              <Icon icon={playing() ? Pause : Play} size={14} />
              <span>{playing() ? "Pause" : "Play"}</span>
            </button>
            <div class="hs-playback-steps" aria-label="Resumability steps">
              {FLOW.map((label, i) => (
                <button
                  type="button"
                  aria-label={`Show ${label.toLowerCase()} step`}
                  aria-current={step() === i ? "step" : undefined}
                  data-complete={step() >= i || undefined}
                  onClick={() => {
                    playing.set(false);
                    step.set(i);
                  }}
                >
                  <span class="hs-step-dot" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              class="hs-replay"
              aria-label="Replay resumability diagram"
              onClick={() => {
                step.set(0);
                playing.set(!(typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches));
              }}
            >
              <Icon icon={RotateCcw} size={15} />
              <span>Replay</span>
            </button>
          </div>
          <p class="hs-playback-hint">Step through it, or watch it happen.</p>
        </div>
      </div>
    </section>
  );
}
