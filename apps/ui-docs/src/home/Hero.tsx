// Home hero: release pill, headline (one word in the logo gradient), pitch, calls to action, the starter command.
// Static server HTML: the links use the ui button classes, the copy button is the docs page script's (no boundary;
// `.code-panel`, not `.code-block`: the ui chat-message / code-block CSS on this page owns `.code-block`).
import { Icon } from "@rivetjs/kit/icon";
import { ArrowRight, Sparkles, Terminal } from "lucide";
import { buttonVariants } from "@rivetjs/ui/button";
import { CopyButton } from "@rivetjs/docs-kit/components/CodeBlock.tsx";
import { site } from "virtual:docs/site";
import { COMPONENT_COUNT } from "./data.ts";

export function Hero() {
  return (
    <section class="uih-hero" aria-labelledby="home-title">
      <a class="uih-pill" href="/start/introduction/" data-rivet-reload="">
        <Icon icon={Sparkles} size={14} />
        <span>
          {site.version} · {COMPONENT_COUNT} components
        </span>
        <Icon icon={ArrowRight} size={14} />
      </a>
      <h1 id="home-title" class="uih-title">
        {/* Fixed line breaks (nowrap lines, phone breaks via <br>) + a width-relative size: the same lines in Manrope and its
            fallback, so the web font swap never changes the line count (CLS 0.08 → 0.003). */}
        <span class="uih-title-line">
          Polished
          <br class="sm:hidden" /> components.
        </span>
        <span class="uih-title-line uih-title-soft">
          <span class="uih-gradient">Resumable</span> from
          <br class="sm:hidden" /> the first byte.
        </span>
      </h1>
      <p class="uih-lead">Accessible, themeable components for Rivet. They arrive as server HTML and answer the first press without a hydration pass.</p>
      <div class="uih-actions">
        <a class={buttonVariants({ size: "lg", class: "max-sm:h-10 max-sm:px-4 max-sm:text-sm" })} href="/start/installation/" data-rivet-reload="">
          Get started
          <Icon icon={ArrowRight} size={16} />
        </a>
        <a
          class={buttonVariants({ size: "lg", variant: "tertiary", class: "max-sm:h-10 max-sm:px-4 max-sm:text-sm" })}
          href="/components/overview/"
          data-rivet-reload=""
        >
          Browse components
        </a>
      </div>
      <div class="uih-install code-panel">
        <Icon icon={Terminal} size={15} />
        <pre>npm create rivet@latest my-app -- --template ui</pre>
        <CopyButton />
      </div>
    </section>
  );
}
