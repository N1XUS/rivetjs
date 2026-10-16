import { site } from "virtual:docs/site";
import { ThemeBuilder } from "../theme-builder/ThemeBuilder.tsx";

export const head = {
  title: `Theme builder · ${site.name}`,
  meta: [
    { name: "description", content: "Build a @rivetjs/ui theme from one OKLCH accent: live preview of the real components, light and dark, CSS export." },
    { property: "og:title", content: `Theme builder · ${site.name}` },
  ],
  links: [{ rel: "canonical", href: site.origin + "/themes/" }],
};

/** /themes: the theme builder. Page code lives in src/theme-builder/. */
export default function Themes() {
  return <ThemeBuilder />;
}
