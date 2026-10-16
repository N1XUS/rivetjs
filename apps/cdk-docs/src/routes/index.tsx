import { site } from "virtual:docs/site";
import { logo } from "virtual:docs/brand";
import { sections } from "virtual:docs/nav";
import { Example } from "@rivetjs/docs-kit/components/Example.tsx";
import { ArrowRight, Copy, Paintbrush, Zap } from "lucide";
import { Icon } from "@rivetjs/kit/icon";

export const head = {
  title: `${site.name} · headless accessible components for Rivet`,
  meta: [
    { name: "description", content: site.tagline },
    { property: "og:title", content: site.name },
    { property: "og:description", content: site.tagline },
    { property: "og:type", content: "website" },
  ],
  links: [{ rel: "canonical", href: site.origin + "/" }],
};

const IDEAS = [
  {
    icon: Paintbrush,
    title: "Headless",
    text: "Components render semantic markup with default class names and data attributes, and no styles. Style them with Tailwind, plain CSS or the optional starter theme.",
    href: "/components/overview/",
  },
  {
    icon: Copy,
    title: "Faithful ports",
    text: "Behaviour, options and edge cases come from React Aria, React Stately, React Aria Components and the Angular CDK, with their test suites ported.",
    href: "/foundations/overview/",
  },
  {
    icon: Zap,
    title: "Resumable",
    text: "Pages render on the server. A component's code loads when someone is about to use it; closed overlays cost nothing until they open.",
    href: "/components/overview/",
  },
];

/** Home: what @rivetjs/cdk is, a live component, three ideas, the sections. */
export default function Home() {
  return (
    <div class="home" data-pagefind-body="" data-pagefind-filter="section:Home">
      <section class="home-hero" aria-labelledby="home-title">
        <img class="home-logo" src={logo} alt="" width="84" height="80" />
        <p class="home-status">
          <span class="status-badge status-experimental">Experimental</span> Not ready for production yet. APIs can change.
        </p>
        <h1 id="home-title">
          Accessible components, <span class="brand-text">headless</span> and resumable.
        </h1>
        <p class="home-tagline">{site.tagline}</p>
        <p class="home-actions">
          <a class="button-primary" href="/components/overview/" data-rivet-reload="">
            Components
            <Icon icon={ArrowRight} size={16} />
          </a>
          <a class="button-secondary" href="/foundations/overview/" data-rivet-reload="">
            Foundations
          </a>
          <a class="button-secondary" href="/examples/" data-rivet-reload="">
            All examples
          </a>
        </p>
      </section>

      <section class="home-demo" aria-labelledby="home-demo-title">
        <h2 id="home-demo-title">Try it</h2>
        <p>A menu button from {site.name}: the server sent its HTML, and the menu's code loads only when you reach for it.</p>
        <Example id="aria-menu" eager />
      </section>

      <section class="home-ideas" aria-labelledby="home-ideas-title">
        <h2 id="home-ideas-title">Three ideas</h2>
        <ul class="feature-grid">
          {IDEAS.map((idea) => (
            <li>
              <a class="feature" href={idea.href} data-rivet-reload="">
                <span class="feature-icon">
                  <Icon icon={idea.icon} size={20} />
                </span>
                <strong>{idea.title}</strong>
                <span class="feature-text">{idea.text}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section class="home-sections" aria-labelledby="home-sections-title">
        <h2 id="home-sections-title">Find your way</h2>
        <ul class="card-grid">
          {sections.map((section) => (
            <li>
              <a class="card" href={section.href} data-rivet-reload="">
                <strong>{section.title}</strong>
                <p>{section.groups.map((group) => group.title).join(" · ")}</p>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
