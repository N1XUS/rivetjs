import { site } from "virtual:docs/site";
import "../home-ui.css";
import { Accessibility, ArrowDown, ArrowRight, BookOpen, Cable, FileCode, FileText, FormInput, Package, Languages, MousePointerClick, Plug, Route, Scale, Server, Terminal, Waves, Wrench, Zap } from "lucide";
import { Icon } from "@rivetjs/kit/icon";
import { buttonVariants } from "@rivetjs/ui/button";
import { CopyButton } from "@rivetjs/docs-kit/components/CodeBlock.tsx";
import { editorialLoss, homeFacts, homeStrip } from "../../content/_charts.ts";
import Sample from "../generated/fragments/home-sample.tsx";
import Demo from "../generated/fragments/home-demo.tsx";
import homePerf from "../../content/_home-perf.json" with { type: "json" };
import { ResumeDemo } from "../components/home/ResumeDemo.tsx";
import { ShowcaseStage } from "../components/home/ShowcaseStage.tsx";
import { PerfLine } from "../components/home/PerfLine.tsx";
import { RotatingWords } from "../components/home/RotatingWords.tsx";
import { BarList } from "../components/home/BarList.tsx";
import { CountUp } from "../components/home/CountUp.tsx";

export const head = {
  title: `Rivet · server-rendered JSX that resumes instead of re-running`,
  meta: [
    { name: "description", content: site.tagline },
    { property: "og:title", content: "Rivet" },
    { property: "og:description", content: site.tagline },
    { property: "og:type", content: "website" },
  ],
  links: [{ rel: "canonical", href: site.origin + "/" }],
};

/** Hero words: each one has its proof on this page (numbers strip, resume demo, dynamic-rendering chart, open source). */
const WORDS = ["fast.", "resumable.", "dynamic.", "yours."];

const CREATE = "npm create rivet@latest";

/** Hero sub-line: the static-SSR ratio vs Razor, computed in content/_charts.ts (fair-comparison report), never typed. */
const SSR = homeStrip.find((chart) => chart.id === "ssr")!;
const LEAD = `Compiled JSX. ${SSR.big} less server CPU than ASP.NET Razor. Resumed in the browser, never hydrated.`;

/** Published alpha version beside every `npm create` command. Plain home CSS (`.lp-chip`, the ui soft
 * warning chip's look): no `@rivetjs/ui` above the fold, so its theme tokens stay out of the inline critical CSS. */
function ReleaseTag() {
  return (
    <span class="lp-chip lp-chip-warning lp-prerelease">
      <Icon icon={Package} size={12} />
      {site.version + " · on npm"}
    </span>
  );
}

export default function Home() {
  return (
    <div class="lp" data-pagefind-body="" data-pagefind-filter="section:Home">
      <div class="lp-inner">
        <section class="lp-hero" aria-labelledby="lp-title">
          <div class="hero-glow lp-hero-glow" aria-hidden="true" />
          <div class="lp-hero-copy">
            <a class="lp-eyebrow" href="/about/roadmap/" data-rivet-reload="">
              <span class="lp-chip">Experimental</span>
              <span>APIs can change · Roadmap</span>
              <Icon icon={ArrowRight} size={14} />
            </a>
            <RotatingWords id="lp-title" lead="The JSX framework built to be" words={WORDS} label="The JSX framework built to be fast, resumable, dynamic and yours." />
            <p class="lp-lead">{LEAD}</p>
            <div class="lp-hero-actions">
              <div class="code-block lp-command">
                <Icon icon={Terminal} size={15} class="lp-command-icon" />
                <pre>{CREATE}</pre>
                <CopyButton />
              </div>
              <ReleaseTag />
              <a class="lp-btn lp-hero-secondary" href="#numbers">
                See the numbers
                <Icon icon={ArrowDown} size={16} />
              </a>
            </div>
            <a class="lp-textlink" href="/start/quick-start/" data-rivet-reload="">
              Get started
              <Icon icon={ArrowRight} size={14} />
            </a>
          </div>
          <ul class="lp-strip" aria-label="Measured">
            {homeStrip.map((chart) => (
              <li>
                <a href={`#chart-${chart.id}`}>
                  <span class="lp-strip-big">{chart.big}</span>
                  <span class="lp-strip-claim">{chart.strip}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section class="lp-section lp-numbers" id="numbers" aria-labelledby="lp-numbers-title">
          <header class="lp-section-head">
            <p class="lp-kicker">The numbers</p>
            <h2 id="lp-numbers-title">Measured against the frameworks you would pick instead.</h2>
            <p>Medians from runs where every framework did the same work, one CPU core each. Where Rivet is slower, it says so.</p>
          </header>
          <div class="lp-charts">
            {homeStrip.map((chart) => (
              <article class="lp-chart" id={`chart-${chart.id}`} aria-labelledby={`lp-chart-${chart.id}`}>
                <h3 id={`lp-chart-${chart.id}`} class="lp-chart-head">
                  <span class="lp-chart-figure">
                    <CountUp text={chart.big} class="lp-chart-big" />
                    <span class="lp-chart-peer">vs {chart.peer}</span>
                  </span>
                  <span class="lp-chart-claim">{chart.claim}</span>
                </h3>
                <BarList points={chart.points} unit={chart.unit} digits={chart.digits} label={`${chart.unit}, ${chart.better} is better`} />
                <p class="lp-chart-note">
                  {chart.footnote} <span class="lp-chart-unit">{`${chart.unit}, ${chart.better} is better.`}</span>
                </p>
                {chart.loss ? (
                  <p class="lp-chart-loss">
                    <Icon icon={Scale} size={14} />
                    <span>{chart.loss}</span>
                  </p>
                ) : null}
                <p class="lp-chart-source">
                  <a href={`/about/benchmarks/#chart-${chart.chart}`} data-rivet-reload="">
                    Full chart
                  </a>
                </p>
              </article>
            ))}
          </div>
          {/* Below the charts (≥ 1.9k px down at every width): styled by the full sheets, not the inline critical CSS. */}
          <div data-css-defer="">
          <p class="lp-charts-source">
            <a href={SSR.source.href} rel="noopener">
              {SSR.source.text}
            </a>
            {" · 1 CPU / 512 MiB per lane · "}
            <a href="/about/benchmarks/" data-rivet-reload="">
              Method
            </a>
          </p>
          <p class="lp-loss" data-verdict="loss">
            <Icon icon={Scale} size={16} class="lp-loss-icon" />
            <span>
              <strong>Where we lose: static content sites.</strong> {editorialLoss.zeroJs.join(", ").replace(/, ([^,]*)$/, " and $1")} ship 0 KB of JavaScript;
              Rivet ships a {kb(editorialLoss.rivetInlineJS, 1)} loader and prefetches {kb(editorialLoss.rivetFetchedJS, 0)}, so its article LCP is{" "}
              {seconds(editorialLoss.rivetLcp)} against {seconds(editorialLoss.astroLcp)}. Zero-JS output for pages without handlers is next.{" "}
              <a href={editorialLoss.source.href} rel="noopener">
                {editorialLoss.source.text}
              </a>
            </span>
          </p>
          <p class="lp-more">
            <a href="/about/benchmarks/" data-rivet-reload="">
              All numbers: methodology, machines and every lane <Icon icon={ArrowRight} size={14} />
            </a>
          </p>
          </div>
        </section>

        <section data-css-defer="" class="lp-section lp-resume" aria-labelledby="lp-resume-title">
          <header class="lp-section-head">
            <p class="lp-kicker">Resumability</p>
            <h2 id="lp-resume-title">Click it. That's the only code this page has loaded.</h2>
          </header>
          <div class="lp-resume-body">
            <ol class="lp-rail" aria-label="One page, from request to first click">
              <li>
                <Icon icon={Server} size={18} />
                <strong>Server</strong>
                <span>Your component runs once, on the server. The HTML arrives finished, with the state its handlers need.</span>
              </li>
              <li>
                <Icon icon={FileCode} size={18} />
                <strong>Page load</strong>
                <span>No component code runs. No hydration. The browser waits for you.</span>
              </li>
              <li>
                <Icon icon={MousePointerClick} size={18} />
                <strong>First click</strong>
                <span>The one handler you touched loads and updates one text node.</span>
              </li>
            </ol>
            <div class="lp-resume-panel">
              <ResumeDemo loaderBytes={homePerf.loader.bytes} loaderBrotli={homePerf.loader.brotli} buttonClass={buttonVariants({ variant: "primary" })} />
              <div class="lp-resume-code">
                <Demo />
              </div>
              <a class="lp-textlink" href="/learn/resuming/" data-rivet-reload="">
                How resuming works
                <Icon icon={ArrowRight} size={14} />
              </a>
            </div>
          </div>
        </section>

        <section data-css-defer="" class="lp-section lp-features" aria-labelledby="lp-features-title">
          <header class="lp-section-head">
            <p class="lp-kicker">What you get</p>
            <h2 id="lp-features-title">The work happens at build time and on the server.</h2>
          </header>
          <ul class="lp-grid">
            {FEATURES.map((feature) => (
              <li class="lp-cell">
                <Icon icon={feature.icon} size={20} class="lp-cell-icon" />
                <h3>{feature.title}</h3>
                <p>{feature.proof}</p>
                <a href={feature.href} data-rivet-reload="">
                  {feature.link}
                  <Icon icon={ArrowRight} size={14} />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section data-css-defer="" class="lp-section lp-showcase" aria-labelledby="lp-showcase-title">
          <div class="lp-showcase-text">
            <header class="lp-section-head">
              <p class="lp-kicker">Components</p>
              <h2 id="lp-showcase-title">The look of HeroUI, the behaviour of React Aria. No React.</h2>
            </header>
            <ul class="lp-facts">
              <li>Own components, API familiar from React Aria: keyboard, focus and screen-reader behaviour checked by {floor(homePerf.cdk.a11y)} tests.</li>
              <li>
                Headless <code>@rivetjs/cdk</code> underneath, styled <code>@rivetjs/ui</code> on top — or bring your own styles.
              </li>
              <li>Try it: this panel is the library. It ships as a static snapshot and turns live on your first touch.</li>
            </ul>
            <p class="lp-showcase-links">
              <a class="lp-textlink" href={(site.sites?.ui ?? "") + "/"} rel="noopener">
                Browse components
                <Icon icon={ArrowRight} size={14} />
              </a>
              <a class="lp-textlink" href={(site.sites?.cdk ?? "") + "/"} rel="noopener">
                Headless cdk
                <Icon icon={ArrowRight} size={14} />
              </a>
            </p>
          </div>
          <ShowcaseStage />
        </section>

        <section data-css-defer="" class="lp-section lp-ai" aria-labelledby="lp-ai-title">
          <header class="lp-section-head">
            <p class="lp-kicker">AI tooling</p>
            <h2 id="lp-ai-title">Your assistant reads the same docs you do.</h2>
          </header>
          <ul class="lp-ai-list">
            <li>
              <Icon icon={FileText} size={20} class="lp-cell-icon" />
              <h3>llms.txt</h3>
              <p>Every docs page as Markdown for language models, regenerated on every build.</p>
              <p class="lp-ai-links">
                <a href="/llms.txt">/llms.txt</a>
                <span aria-hidden="true"> · </span>
                <a href="/llms-full.txt">/llms-full.txt</a>
              </p>
            </li>
            <li>
              <Icon icon={Plug} size={20} class="lp-cell-icon" />
              <h3>MCP server</h3>
              <p>
                Docs search, component reference and <code>check_code</code> (compiler + diagnostics) for your assistant.
              </p>
              <div class="code-block lp-command lp-command-small">
                <pre>{AI_MCP}</pre>
                <CopyButton />
              </div>
            </li>
            <li>
              <Icon icon={BookOpen} size={20} class="lp-cell-icon" />
              <h3>Agent skills</h3>
              <p>
                <code>rivet-ui-design</code> for Claude Code, Codex and Cursor; new starters include it.
              </p>
              <div class="code-block lp-command lp-command-small">
                <pre>{AI_SKILL}</pre>
                <CopyButton />
              </div>
            </li>
          </ul>
          <a class="lp-textlink" href="/guides/tooling/ai/" data-rivet-reload="">
            AI tooling guide
            <Icon icon={ArrowRight} size={14} />
          </a>
        </section>

        <section data-css-defer="" class="lp-section lp-start" aria-labelledby="lp-start-title">
          <header class="lp-section-head">
            <p class="lp-kicker">Get started</p>
            <h2 id="lp-start-title">Ten lines to your first resumable page.</h2>
            <p>Toggle "Compiled output" to read what the server and the browser run, compiled when this page was built.</p>
          </header>
          <div class="lp-start-body">
            <div class="prose lp-start-code">
              <Sample />
            </div>
            <div class="lp-start-steps">
              <ol class="lp-commands">
                {START.map((command) => (
                  <li>
                    <div class="code-block lp-command">
                      <pre>{command}</pre>
                      <CopyButton />
                    </div>
                  </li>
                ))}
              </ol>
              <p class="lp-start-needs">Node.js 24+ · npm · Git</p>
              <div class="lp-start-actions" data-ui-theme="rivet">
                <a class={buttonVariants({ variant: "primary", size: "lg" })} href="/start/quick-start/" data-rivet-reload="">
                  Quick start
                  <Icon icon={ArrowRight} size={16} />
                </a>
                <a class={buttonVariants({ variant: "ghost", size: "lg" })} href="/start/what-is-rivet/" data-rivet-reload="">
                  What is Rivet?
                </a>
              </div>
            </div>
          </div>
        </section>

        <section data-css-defer="" class="lp-cta" aria-labelledby="lp-cta-title">
          <h2 id="lp-cta-title" class="lp-cta-title">
            Build something fast.
          </h2>
          <div class="code-block lp-command">
            <Icon icon={Terminal} size={15} class="lp-command-icon" />
            <pre>{CREATE}</pre>
            <CopyButton />
          </div>
          <ReleaseTag />
          <a class="lp-textlink" href={site.repo} rel="noopener">
            Star on GitHub
            <Icon icon={ArrowRight} size={14} />
          </a>
        </section>
        <PerfLine text={perfText()} buttonClass={buttonVariants({ variant: "ghost", size: "sm" })} />
      </div>
    </div>
  );
}

/** 4856 → "4,800+" (rounded down to hundreds; tens below 1,000). */
const floor = (count: number) => {
  const step = count >= 1000 ? 100 : 10;
  return (Math.floor(count / step) * step).toLocaleString("en-US") + "+";
};

/** Feature grid: one capability + one proof each. Numbers come from content/_charts.ts (committed reports). */
const FEATURES = [
  {
    icon: Zap,
    title: "Compiled templates",
    proof: `A Rust compiler turns JSX into string templates on the server and cloned DOM in the browser. 1,000-row DOM update: ${homeFacts.domUpdate1000}.`,
    link: "Signals",
    href: "/learn/signals/",
  },
  {
    icon: Waves,
    title: "Streaming SSR",
    proof: `The shell flushes first; <Async> data streams into place. p99 ${homeFacts.streamP99} at 5,000 rows vs Razor ${homeFacts.razorP99}.`,
    link: "Streaming",
    href: "/guides/performance/streaming/",
  },
  {
    icon: Cable,
    title: "Function Bridge",
    proof: "Closures, classes and contexts resume with plain-JS semantics; what cannot resume is a named compile error.",
    link: "Resuming",
    href: "/learn/resuming/",
  },
  {
    icon: Accessibility,
    title: "Accessible components",
    proof: `Own components, API familiar from React Aria: ${floor(homePerf.cdk.tests)} test cases, ${floor(homePerf.cdk.a11y)} on ARIA, keyboard and focus.`,
    link: "Components",
    href: "/ui/overview/",
  },
  {
    icon: Route,
    title: "File routing",
    proof: "Pages, layouts, loaders, actions and guards on a web-standard handler; Node and static adapters.",
    link: "File routes",
    href: "/guides/routing/file-routes/",
  },
  { icon: FormInput, title: "Forms", proof: "Standard Schema forms that submit before JavaScript loads.", link: "Forms", href: "/guides/forms/forms/" },
  { icon: Languages, title: "Compile-time i18n", proof: "ICU messages inlined per locale. No runtime catalog.", link: "Translating text", href: "/guides/i18n/translating-text/" },
  {
    icon: Wrench,
    title: "DevTools + editor",
    proof: "Component tree, signals and updates in the dev server; compiler diagnostics with quick fixes in VS Code.",
    link: "DevTools",
    href: "/guides/tooling/devtools/",
  },
];

/** AI tooling commands, verbatim from content/guides/tooling/ai.md (site.test checks). */
const AI_MCP = "claude mcp add rivet -- npx -y @rivetjs/mcp";
const AI_SKILL = "npx skills add N1XUS/rivetjs --skill rivet-ui-design --agent codex claude-code cursor";
const START = ["npm create rivet@latest my-app", "cd my-app", "npm run dev"];

/** Bytes → "4.7 KB" (decimal kilobytes, as the editorial report). */
const kb = (bytes: number, digits: number) => (bytes / 1000).toFixed(digits) + " KB";
/** Milliseconds → "1.20 s". */
const seconds = (ms: number) => (ms / 1000).toFixed(2) + " s";

/** Lighthouse LCP the footer may quote (ms): Astro's editorial article LCP, editorialLoss.astroLcp, ~1.05 s. */
const LCP_BAR = editorialLoss.astroLcp;

/** Footer line from content/_home-perf.json: what this page weighs, measured on the build (scripts/home-perf.ts). */
function perfText(): string {
  const parts = [
    `This page: ${kb(homePerf.html.bytes, 0)} HTML (${kb(homePerf.html.brotli, 0)} compressed)`,
    `${kb(homePerf.inlineJs.bytes, 1)} inline JavaScript, no script files before you interact`,
  ];
  const lh = homePerf.lighthouse;
  // LCP is stated once it meets the spec bar (Astro's editorial article LCP, ~1.05 s); until then the line omits it.
  if (lh) parts.push(`Lighthouse mobile ${lh.score}`, ...(lh.lcp <= LCP_BAR ? [`LCP ${(lh.lcp / 1000).toFixed(2)} s`] : []), `CLS ${lh.cls}`);
  return parts.join(" · ") + (lh ? ` — measured ${lh.date}.` : ".");
}
