import { site } from "virtual:docs/site";
import "../home/home.css";
import { Bento } from "../home/Bento.tsx";
import { Hero } from "../home/Hero.tsx";
import { AccessibilitySection, ComponentsSection, CtaSection, CustomizeSection, DarkModeSection } from "../home/Sections.tsx";
import { ShowcaseBar } from "../home/Showcase.tsx";
import { LookBar, LookPreview } from "../home/Themes.tsx";
import { PortalProvider } from "@rivetjs/cdk/portal";

export const head = {
  title: `${site.name} · styled, resumable components for Rivet`,
  meta: [
    { name: "description", content: site.tagline },
    { property: "og:title", content: site.name },
    { property: "og:description", content: site.tagline },
    { property: "og:type", content: "website" },
  ],
  links: [{ rel: "canonical", href: site.origin + "/" }],
};

/**
 * Home (src/home/): hero, live showcase (view switch + accent swatches over the component collage), themes, dark mode,
 * accessibility, customization, the component directory, final call. Everything renders inside the scoped Rivet theme
 * (`data-ui-theme="rivet"`, site stylesheet) so the ui components get their own tokens, not the docs frame's; the
 * swatches / look switch add `data-ui-preset` (presets.css linked on the first press, src/home/presets.ts).
 */
export default function Home() {
  return (
    <div class="uih" data-ui-theme="rivet" data-pagefind-body="" data-pagefind-filter="section:Home">
      <Hero />
      <ShowcaseBar />
      <div id="home-collage" class="uih-panel uih-collage uih-stage" data-ui-theme="rivet" data-testid="home-collage">
        <h2 class="sr-only">Live components</h2>
        <div id="home-overlays" />
        <PortalProvider container="#home-overlays">
          <Bento />
        </PortalProvider>
      </div>

      <section class="uih-section" aria-labelledby="home-themes-title">
        <div class="uih-heading uih-heading-center">
          <p class="uih-eyebrow">Themes</p>
          <h2 id="home-themes-title">One attribute, a different look</h2>
          <p class="uih-section-lead">
            Presets change colours, radii, borders, shadows and backdrop together. The markup of the cards below stays the same; only{" "}
            <code>data-ui-preset</code> changes.
          </p>
        </div>
        <LookBar />
        <LookPreview />
      </section>

      <DarkModeSection />
      <AccessibilitySection />
      <CustomizeSection />
      <ComponentsSection />
      <CtaSection />
    </div>
  );
}
