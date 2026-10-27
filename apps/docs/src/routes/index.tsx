import { site } from "virtual:docs/site";
import "../home-ui.css";
import "../home.css";
import { ArrowRight, Blocks, Box, Cpu, FolderTree, Languages, Layers, MousePointerClick, Terminal, Zap } from "lucide";
import { Icon } from "@rivetjs/kit/icon";
import { buttonVariants } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { Chip } from "@rivetjs/ui/chip";
import { CopyButton } from "@rivetjs/docs-kit/components/CodeBlock.tsx";
// The benchmark values as literals (docs-kit writes them from content/_charts.ts): importing the module would bundle its reports.
import { homeBench } from "../generated/charts.ts";
import { ProductShot } from "../components/home/ProductShot.tsx";

export const head = {
  title: "Rivet · The resumable JSX framework",
  meta: [
    { name: "description", content: site.tagline },
    { property: "og:title", content: "Rivet · The resumable JSX framework" },
    { property: "og:description", content: site.tagline },
    { property: "og:type", content: "website" },
  ],
  links: [{ rel: "canonical", href: site.origin + "/" }],
};

const primary = buttonVariants({ variant: "primary", size: "lg" });
const secondary = buttonVariants({ variant: "tertiary", size: "lg" });

const FEATURES = [
  {
    icon: Cpu,
    title: "Compiled JSX",
    text: "A Rust compiler turns each component into a server string template and direct DOM code. No virtual DOM, no diffing.",
    href: "/learn/rendering-modes/",
  },
  {
    icon: MousePointerClick,
    title: "Resumable pages",
    text: "The page arrives as HTML. A component's code loads on its first event and adopts the existing DOM. Nothing renders twice.",
    href: "/learn/resuming/",
  },
  {
    icon: Zap,
    title: "Fine-grained signals",
    text: "signal, computed and effect update the one text node or attribute that changed, not the component around it.",
    href: "/learn/signals/",
  },
  {
    icon: FolderTree,
    title: "File routing",
    text: "Files in src/routes become pages, layouts, loaders and actions with typed links. Static or server output.",
    href: "/guides/routing/file-routes/",
  },
  {
    icon: Languages,
    title: "Compile-time i18n",
    text: "ICU messages are compiled into each locale's build, so the browser only receives the strings of its language.",
    href: "/guides/i18n/translating-text/",
  },
  {
    icon: Blocks,
    title: "Framework bridges",
    text: "Bring React and Preact components as islands: rendered into the server stream, started when they are needed.",
    href: "/guides/components/framework-components/",
  },
];

const STEPS = [
  { title: "Write components", text: "JSX and signals. The compiler emits a server template and a DOM function for each component." },
  { title: "Stream HTML", text: "The server renders the page with its data and records the signal values of interactive components." },
  { title: "Resume on input", text: "On the first event, the browser loads that component's code, adopts its server nodes and updates them." },
];

const STARTERS = [
  { id: "static", title: "Static site", text: "Pages become HTML files at build time. Tailwind, two pages, one interactive component." },
  { id: "server", title: "Node server", text: "Pages render for each request, with a loader, a form action and a Dockerfile." },
  { id: "ui", title: "UI components", text: "The static starter with Rivet UI components and Tailwind CSS v4." },
  { id: "minimal", title: "Minimal", text: "One page, one signal, no Tailwind. The smallest thing that runs." },
];

const FAMILY = [
  {
    icon: Layers,
    title: "Rivet UI",
    text: "HeroUI-style styled components with one token-driven theme, light and dark. Resumable like the rest of the page.",
    href: site.sites!.ui + "/",
  },
  {
    icon: Box,
    title: "Rivet CDK",
    text: "Headless components and utilities: React Aria and Angular CDK behaviour, ported. The styling is yours.",
    href: site.sites!.cdk + "/",
  },
];

const BAR_MAX = Math.max(...homeBench.bars.map((bar) => bar.value));

function Install() {
  return (
    <div class="rh-install">
      <div class="rh-command code-block">
        <Icon icon={Terminal} size={16} />
        <pre>npm create rivet@latest</pre>
        <CopyButton />
      </div>
      <span class="rh-version">{site.version + " · on npm"}</span>
    </div>
  );
}

export default function Home() {
  return (
    <div class="rh" data-pagefind-body="" data-pagefind-filter="section:Home">
      <section class="rh-hero rh-wrap" aria-labelledby="home-title">
        <a class="rh-badge rh-ui" href="/about/roadmap/" data-rivet-reload="">
          <Chip size="sm" variant="soft" color="accent">
            Alpha
          </Chip>
          <span>Experimental: APIs can still change</span>
          <Icon icon={ArrowRight} size={14} />
        </a>
        <h1 id="home-title">
          <span class="rh-line">
            The <span class="rh-grad">resumable</span>
          </span>{" "}
          <span class="rh-line">framework for the web</span>
        </h1>
        <p class="rh-lead">Rivet compiles JSX into streaming server HTML and precise DOM updates. Pages continue where the server left off, with no hydration.</p>
        <div class="rh-actions rh-ui">
          <a class={primary} href="/start/quick-start/" data-rivet-reload="">
            Get started
            <Icon icon={ArrowRight} size={18} />
          </a>
          <a class={secondary} href="/start/what-is-rivet/" data-rivet-reload="">
            Why Rivet
          </a>
        </div>
        <Install />
      </section>

      <section class="rh-wrap rh-shot-wrap" aria-label="A Rivet component, its server HTML and its browser code">
        <ProductShot />
      </section>

      <section class="rh-wrap rh-section rh-bench" aria-labelledby="home-numbers-title">
        <div class="rh-heading">
          <h2 id="home-numbers-title">
            <span class="rh-grad">{homeBench.big}</span> less server CPU than {homeBench.peer}
          </h2>
          <p>{homeBench.metric}</p>
        </div>
        <ol class="rh-bars" aria-label="Server CPU per page, lower is better">
          {homeBench.bars.map((bar) => (
            <li data-rivet={bar.rivet ? "" : undefined} style={{ "--v": (bar.value / BAR_MAX).toFixed(4) }}>
              <span class="rh-bar-label">{bar.label}</span>
              <span class="rh-bar-track">
                <span class="rh-bar" />
                <data value={bar.value.toFixed(3)}>{bar.text}</data>
              </span>
            </li>
          ))}
        </ol>
        <ul class="rh-chips">
          {homeBench.chips.map((chip) => (
            <li>
              <a href={chip.href}>
                <data value={chip.big.replace("×", "")}>{chip.big}</data>
                <span>{chip.text}</span>
              </a>
            </li>
          ))}
        </ul>
        <div class="rh-bench-foot">
          <a class="rh-link" href="/about/benchmarks/" data-rivet-reload="">
            See all benchmarks
            <Icon icon={ArrowRight} size={16} />
          </a>
          <p class="rh-footnote">
            {homeBench.footnote} <a href={homeBench.methodology}>Methodology</a>
          </p>
        </div>
      </section>

      <section class="rh-wrap rh-section" aria-labelledby="home-features-title">
        <div class="rh-heading">
          <h2 id="home-features-title">Everything a page needs, compiled in</h2>
          <p>One component model from the server to the browser, with the tools around it.</p>
        </div>
        <ul class="rh-grid">
          {FEATURES.map((feature) => (
            <li>
              <a href={feature.href} data-rivet-reload="">
                <span class="rh-icon">
                  <Icon icon={feature.icon} size={20} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section class="rh-wrap rh-section" aria-labelledby="home-how-title">
        <div class="rh-heading">
          <h2 id="home-how-title">How it works</h2>
          <p>
            Three steps, no hydration pass. <a href="/learn/resuming/">Read how resuming works</a>.
          </p>
        </div>
        <ol class="rh-steps">
          {STEPS.map((step, i) => (
            <li>
              <span class="rh-step">{String(i + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section class="rh-wrap rh-section" aria-labelledby="home-starters-title">
        <div class="rh-heading rh-heading-row">
          <div>
            <h2 id="home-starters-title">Start from a template</h2>
            <p>Pick a starter when you run the command, or pass it directly.</p>
          </div>
          <a class="rh-link" href="/start/quick-start/#starters" data-rivet-reload="">
            Compare starters
            <Icon icon={ArrowRight} size={16} />
          </a>
        </div>
        <ul class="rh-starters rh-ui">
          {STARTERS.map((starter) => (
            <li>
              <Card class="rh-starter">
                <Card.Header>
                  <Card.Title>{starter.title}</Card.Title>
                  <Card.Description>{starter.text}</Card.Description>
                </Card.Header>
                <Card.Footer>
                  <code>--template {starter.id}</code>
                </Card.Footer>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section class="rh-wrap rh-section" aria-labelledby="home-family-title">
        <div class="rh-heading">
          <h2 id="home-family-title">Components, when you need them</h2>
          <p>Two component libraries built on the same compiler and resume model, each with its own docs.</p>
        </div>
        <ul class="rh-grid rh-grid-2">
          {FAMILY.map((item) => (
            <li>
              <a href={item.href}>
                <span class="rh-icon">
                  <Icon icon={item.icon} size={20} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section class="rh-wrap rh-final" aria-labelledby="home-final-title">
        <h2 id="home-final-title">Build a page that is ready before it boots</h2>
        <p>Open source, MIT licensed and still experimental. Try it on your next page.</p>
        <div class="rh-actions rh-ui">
          <a class={primary} href="/start/quick-start/" data-rivet-reload="">
            Get started
            <Icon icon={ArrowRight} size={18} />
          </a>
          <a class={secondary} href={site.repo}>
            Source on GitHub
          </a>
        </div>
      </section>
    </div>
  );
}
