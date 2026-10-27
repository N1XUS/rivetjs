// Home page data: the theme presets the showcase and the Themes section switch between, the showcase tabs, and the
// component directory (read from the site navigation, so a new component page shows up here by itself).
import { sections } from "virtual:docs/nav";
import { oklchToHex, THEME_PRESETS } from "@rivetjs/ui/theme";

/** Colour presets of the showcase swatches: `[data-ui-preset]` id, label and accent colour (from the preset's OKLCH accent). */
export const ACCENTS = ["rivet", "classic", "sky", "lavender", "mint", "ocean", "iris", "ember", "mauve", "mono"].map((id) => {
  const preset = THEME_PRESETS.find((p) => p.id === id)!;
  return { id, label: preset.label, color: oklchToHex({ l: preset.lightness, c: preset.chroma, h: preset.hue }) };
});

/** Preset id of a swatch colour (the picker's value is the colour string). */
export const accentOf = (color: string | null | undefined): string => ACCENTS.find((a) => a.color === color?.toLowerCase())?.id ?? "rivet";

/** Look presets of the Themes section (colours, radii, borders, shadows and backdrop change together). */
export const LOOKS = ["rivet", "classic", "brutalist", "glass", "mauve"].map((id) => {
  const p = THEME_PRESETS.find((preset) => preset.id === id)!;
  const edit =
    id === "rivet"
      ? "/themes/"
      : `/themes/?lightness=${p.lightness}&chroma=${p.chroma}&hue=${p.hue}&base=${p.base}&radius=${p.radius}&formRadius=${p.formRadius}`;
  return { id, label: p.label, edit };
});

/** Showcase tabs after "Components": full app screens, each an example frame loaded when its tab opens. */
export const SCREENS = [
  { id: "dashboard", label: "Dashboard", frame: "/examples/showcase-dashboard/frame/", page: "/showcase/dashboard/" },
  { id: "mail", label: "Mail", frame: "/examples/showcase-mail/frame/", page: "/showcase/mail/" },
  { id: "chat", label: "Chat", frame: "/examples/showcase-chat/frame/", page: "/showcase/chat/" },
  { id: "music", label: "Music", frame: "/examples/showcase-music/frame/", page: "/showcase/music/" },
  { id: "storefront", label: "Storefront", frame: "/examples/showcase-storefront/frame/", page: "/showcase/storefront/" },
] as const;

/** Component pages by category (the Components side nav minus its overview page). */
export const CATEGORIES = (sections.find((s) => s.id === "components")?.groups ?? [])
  .map((group) => ({ title: group.title, items: group.items.filter((item) => !item.href.endsWith("/overview/")) }))
  .filter((group) => group.items.length > 0);

/** Number of component pages. */
export const COMPONENT_COUNT = CATEGORIES.reduce((n, group) => n + group.items.length, 0);
