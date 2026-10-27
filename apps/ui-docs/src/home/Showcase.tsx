// Showcase under the hero: a view switch (the component collage, then full app screens as example frames that load when
// picked) and accent swatches that re-theme the collage through one attribute (`data-ui-preset`, presets.css).
//
// The collage (`Bento`) is a sibling of this toolbar, not a child: a swatch or view press wakes only this component (its
// code + the Segment / ColorSwatchPicker), never the 15 tiles. So the toolbar writes the collage's preset attribute itself
// (`#home-collage`, presets.ts loads the preset styles on the first press), and CSS hides the collage while another view is open (`[data-view]` on the bar, home.css).
import { signal } from "@rivetjs/reactivity";
import type { Color } from "@rivetjs/cdk/color";
import { Icon } from "@rivetjs/kit/icon";
import { ArrowUpRight } from "lucide";
import { ColorSwatchPicker } from "@rivetjs/ui/color-swatch-picker";
import { Segment } from "@rivetjs/ui/segment";
import { ACCENTS, accentOf, SCREENS } from "./data.ts";
import { applyPreset } from "./presets.ts";

export function ShowcaseBar() {
  const view = signal<string | null>("components");
  const screen = () => SCREENS.find((s) => s.id === view());
  const recolor = (color: Color) => void applyPreset("home-collage", accentOf(color.toString("hex")));
  return (
    <div class="uih-showcase-head" data-view={view() ?? "components"}>
      <div class="uih-showcase-bar">
        <div class="uih-scroll-x">
          <Segment aria-label="Showcase view" selectedKey={view}>
            <Segment.Item id="components">Components</Segment.Item>
            {SCREENS.map((s) => (
              <Segment.Item id={s.id}>{s.label}</Segment.Item>
            ))}
          </Segment>
        </div>
        <div class="uih-swatches">
          <ColorSwatchPicker aria-label="Accent colour" defaultValue={ACCENTS[0].color} size="sm" class="flex-nowrap" onChange={recolor}>
            {ACCENTS.map((a) => (
              <ColorSwatchPicker.Item color={a.color} aria-label={a.label}>
                <ColorSwatchPicker.Swatch />
                <ColorSwatchPicker.Indicator />
              </ColorSwatchPicker.Item>
            ))}
          </ColorSwatchPicker>
        </div>
      </div>
      {screen() ? (
        <div class="uih-panel uih-screen">
          <iframe src={screen()!.frame} title={`${screen()!.label} screen (live example)`} />
          <a class="uih-screen-link" href={screen()!.page} data-rivet-reload="">
            About this screen
            <Icon icon={ArrowUpRight} size={14} />
          </a>
        </div>
      ) : null}
    </div>
  );
}
