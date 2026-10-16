// Color components on a resumed page (P3-DATE-COLOR): `#sw` ColorSwatch (#0485F7), `#area` ColorArea (hsb, `onChange` → `#area-value`),
// `#hue` ColorSlider hue (hsl 120, `onChange` → `#hue-value`), `#alpha` ColorSlider alpha, `#cf` ColorField (hex, `onChange` → `#cf-value`),
// `#csp` ColorSwatchPicker (3 presets, `onChange` → `#csp-value`), `#cp` ColorPicker (two-way `value` signal → `#cp-value`; popover:
// swatch presets + area + hue slider). Values are strings (Color instances are not serializable resume captures).
import { signal } from "@rivetjs/reactivity";
import { ColorArea } from "@rivetjs/ui/color-area";
import { ColorField } from "@rivetjs/ui/color-field";
import { ColorPicker } from "@rivetjs/ui/color-picker";
import { ColorSlider } from "@rivetjs/ui/color-slider";
import { ColorSwatch } from "@rivetjs/ui/color-swatch";
import { ColorSwatchPicker } from "@rivetjs/ui/color-swatch-picker";
import { Label } from "@rivetjs/ui/label";

export default function ColorStories() {
  const area = signal("");
  const hue = signal("");
  const field = signal("");
  const preset = signal("");
  const color = signal("#0485F7");
  const presets = ["#ef4444", "#22c55e", "#3b82f6"];
  return (
    <section class="flex flex-col gap-8 p-10">
      <div id="sw">
        <ColorSwatch color="#0485F7" size="lg" />
      </div>
      <div id="area">
        <ColorArea
          aria-label="Color area"
          colorSpace="hsb"
          defaultValue="hsb(200, 50%, 50%)"
          xChannel="saturation"
          yChannel="brightness"
          onChange={(c) => area.set(c.toString("hsb"))}
        >
          <ColorArea.Thumb />
        </ColorArea>
      </div>
      <output id="area-value">{area()}</output>
      <div id="hue" class="w-64">
        <ColorSlider channel="hue" colorSpace="hsl" defaultValue="hsl(120, 100%, 50%)" onChange={(c) => hue.set(String(c.getChannelValue("hue")))}>
          <Label>Hue</Label>
          <ColorSlider.Output />
          <ColorSlider.Track>
            <ColorSlider.Thumb />
          </ColorSlider.Track>
        </ColorSlider>
      </div>
      <output id="hue-value">{hue()}</output>
      <div id="alpha" class="w-64">
        <ColorSlider channel="alpha" defaultValue="hsla(0, 100%, 50%, 0.5)">
          <Label>Alpha</Label>
          <ColorSlider.Track>
            <ColorSlider.Thumb />
          </ColorSlider.Track>
        </ColorSlider>
      </div>
      <div id="cf">
        <ColorField name="color" defaultValue="#0485F7" onChange={(c) => field.set(c ? c.toString("hex") : "")}>
          <Label>Color</Label>
          <ColorField.Group>
            <ColorField.Input />
          </ColorField.Group>
        </ColorField>
      </div>
      <output id="cf-value">{field()}</output>
      <div id="csp">
        <ColorSwatchPicker aria-label="Presets" onChange={(c) => preset.set(c.toString("hex"))}>
          {presets.map((p) => (
            <ColorSwatchPicker.Item color={p}>
              <ColorSwatchPicker.Swatch />
              <ColorSwatchPicker.Indicator />
            </ColorSwatchPicker.Item>
          ))}
        </ColorSwatchPicker>
      </div>
      <output id="csp-value">{preset()}</output>
      <div id="cp">
        <ColorPicker value={color}>
          <ColorPicker.Trigger>
            <ColorSwatch size="lg" />
            <Label>Pick a color</Label>
          </ColorPicker.Trigger>
          <ColorPicker.Popover class="gap-2">
            <ColorSwatchPicker aria-label="Picker presets" size="xs">
              {presets.map((p) => (
                <ColorSwatchPicker.Item color={p}>
                  <ColorSwatchPicker.Swatch />
                </ColorSwatchPicker.Item>
              ))}
            </ColorSwatchPicker>
            <ColorArea aria-label="Picker area" colorSpace="hsb" xChannel="saturation" yChannel="brightness">
              <ColorArea.Thumb />
            </ColorArea>
            <ColorSlider channel="hue" colorSpace="hsb">
              <Label>Picker hue</Label>
              <ColorSlider.Track>
                <ColorSlider.Thumb />
              </ColorSlider.Track>
            </ColorSlider>
          </ColorPicker.Popover>
        </ColorPicker>
      </div>
      <output id="cp-value">{String(color())}</output>
    </section>
  );
}
