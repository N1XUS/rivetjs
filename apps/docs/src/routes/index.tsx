import { site } from "virtual:docs/site";
import "../home-studio.css";
import { ArrowRight, BookOpen, Box, Code, FileText, Layers, Package, Terminal } from "lucide";
import { Icon } from "@rivetjs/kit/icon";
import { CopyButton } from "@rivetjs/docs-kit/components/CodeBlock.tsx";
import { homeStrip } from "../../content/_charts.ts";
import { HomeCanvas } from "../components/home/HomeCanvas.tsx";
import { HomeHeadline } from "../components/home/HomeHeadline.tsx";
import { HomeWorkbench } from "../components/home/HomeWorkbench.tsx";
import { HomeArchitecture } from "../components/home/HomeArchitecture.tsx";

export const head = {
  title: "Rivet · Make the web feel alive",
  meta: [
    { name: "description", content: site.tagline },
    { property: "og:title", content: "Rivet · Make the web feel alive" },
    { property: "og:description", content: site.tagline },
    { property: "og:type", content: "website" },
  ],
  links: [{ rel: "canonical", href: site.origin + "/" }],
};

const PIPELINE = [
  { icon: Box, title: "Compiled on build", detail: "JSX becomes direct server and DOM code." },
  { icon: FileText, title: "Rendered on the server", detail: "Send real HTML before asking the browser to do more." },
  { icon: Code, title: "Resumed when needed", detail: "Continue from the server DOM when a component wakes." },
];
const SOURCES = homeStrip.map((chart) => chart.source).filter((source, i, all) => all.findIndex((item) => item.href === source.href) === i);
const DOCS = [
  { icon: BookOpen, title: "Learn the framework", detail: "Core concepts, guides and API reference.", href: "/start/what-is-rivet/" },
  { icon: Layers, title: "Build with UI", detail: "Accessible components with a finished point of view.", href: site.sites!.ui + "/" },
  { icon: Box, title: "Go headless with CDK", detail: "The behavior is covered. The design is yours.", href: site.sites!.cdk + "/" },
];

export default function Home() {
  return (
    <div class="hs-home" data-pagefind-body="" data-pagefind-filter="section:Home">
      <section class="hs-hero" aria-labelledby="lp-title">
        <HomeCanvas />
        <div class="hs-inner">
          <div class="hs-hero-copy">
            <p class="hs-eyebrow">COMPILED JSX. RESUMABLE BY DESIGN.</p>
            <HomeHeadline />
            <p class="hs-lead">
              Real HTML from the server. Fine-grained updates in the browser.
              <br class="hs-desktop-break" /> One familiar component model.
            </p>
            <div class="hs-hero-actions">
              <a class="hs-button hs-primary" href="/start/quick-start/" data-rivet-reload="">
                Start building
                <Icon icon={ArrowRight} size={19} />
              </a>
              <a class="hs-button hs-secondary" href="/start/what-is-rivet/" data-rivet-reload="">
                Explore the docs
              </a>
            </div>
            <div class="hs-install">
              <div class="hs-command code-block">
                <Icon icon={Terminal} size={15} />
                <pre>npm create rivet@latest</pre>
                <CopyButton />
              </div>
              <a class="hs-release" href="/about/roadmap/" data-rivet-reload="">
                <span>Experimental</span> APIs can change
                <Icon icon={ArrowRight} size={13} />
              </a>
              <span class="hs-published">
                <Icon icon={Package} size={11} />
                {site.version + " · on npm"}
              </span>
            </div>
          </div>
          <HomeWorkbench />
          <ol class="hs-pipeline" aria-label="From component to interaction">
            {PIPELINE.map((item) => (
              <li>
                <span class="hs-pipeline-icon">
                  <Icon icon={item.icon} size={20} />
                </span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <div class="hs-inner">
        <HomeArchitecture />
        <section class="hs-proof hs-section" aria-labelledby="home-proof-title">
          <div class="hs-proof-heading">
            <p class="hs-eyebrow">LESS WORK. MEASURED.</p>
            <h2 id="home-proof-title">
              A little less overhead.
              <br />A lot more possibility.
            </h2>
            <a class="hs-text-link" href="/about/benchmarks/" data-rivet-reload="">
              See the benchmarks
              <Icon icon={ArrowRight} size={17} />
            </a>
          </div>
          <div class="hs-proof-content">
            <ul class="hs-stats">
              {homeStrip.map((chart) => (
                <li>
                  <a href={`/about/benchmarks/#chart-${chart.chart}`} data-rivet-reload="">
                    <data value={chart.big.replace("×", "")}>{chart.big}</data>
                    <span>{chart.strip}</span>
                  </a>
                </li>
              ))}
            </ul>
            <p class="hs-proof-caveat" data-verdict="loss">
              {homeStrip.find((chart) => chart.id === "dynamic")!.loss}{" "}
              <a href="/about/benchmarks/" data-rivet-reload="">
                Methods, sources and tradeoffs
                <Icon icon={ArrowRight} size={13} />
              </a>
            </p>
            <p class="hs-proof-sources">
              {SOURCES.map((source) => (
                <a href={source.href}>{source.text}</a>
              ))}
            </p>
          </div>
        </section>
        <section id="home-docs" class="hs-directory hs-section" aria-labelledby="home-docs-title">
          <p class="hs-eyebrow">YOUR NEXT CHAPTER</p>
          <h2 id="home-docs-title">Take it from here.</h2>
          <p class="hs-section-lead">Go deeper with guides, API reference and examples you can touch.</p>
          <div class="hs-doc-links">
            {DOCS.map((item) => (
              <a href={item.href} data-rivet-reload="">
                <span class="hs-doc-icon">
                  <Icon icon={item.icon} size={24} />
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </span>
                <Icon class="hs-doc-arrow" icon={ArrowRight} size={22} />
              </a>
            ))}
          </div>
          <p class="hs-end-note">Open source. Still experimental. Built for what comes next.</p>
        </section>
      </div>
    </div>
  );
}
