// Theme presets on demand: every preset scoped to `[data-ui-preset]` (`@rivetjs/ui/styles/themes/presets.css`, ~170 KB
// raw, 12 presets × light + dark) is linked on the first swatch / look press, not with the page: the page itself renders
// the Rivet theme from the site stylesheet (`[data-ui-theme="rivet"]`, themes/scoped.css). presets.css sits in the
// top-level `base` layer, after `theme` (scoped.css), so a preset attribute beats the scoped Rivet tokens.
import href from "@rivetjs/ui/styles/themes/presets.css?url";

let ready: Promise<void> | undefined;

/** Links presets.css once; resolves when it applied (or failed: the attribute still changes). */
function presetStyles(): Promise<void> {
  return (ready ??= new Promise<void>((done) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = link.onerror = () => done();
    document.head.append(link);
  }));
}

/** Sets `data-ui-preset` on the element with this id once the preset styles are in (no flash of half-applied tokens). */
export async function applyPreset(target: string, preset: string): Promise<void> {
  await presetStyles();
  const element = document.getElementById(target);
  if (element) element.dataset.uiPreset = preset;
}
