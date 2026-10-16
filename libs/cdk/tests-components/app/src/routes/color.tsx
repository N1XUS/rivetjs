// RAC color components on a resumed page (lane C5): ColorArea / ColorSlider / ColorWheel / ColorField / ColorSwatch
// standalone over two-way Signals, and composed in a ColorPicker. Thumb drag and keys must work after resume.
import { signal } from "@rivetjs/reactivity";
import { toColor, type Color } from "@rivetjs/cdk/color";
import { ColorArea } from "@rivetjs/cdk/color-area";
import { ColorField } from "@rivetjs/cdk/color-field";
import { ColorPicker } from "@rivetjs/cdk/color-picker";
import { ColorSlider } from "@rivetjs/cdk/color-slider";
import { ColorSwatch } from "@rivetjs/cdk/color-swatch";
import { ColorSwatchPicker, ColorSwatchPickerItem } from "@rivetjs/cdk/color-swatch-picker";
import { ColorThumb } from "@rivetjs/cdk/color-thumb";
import { ColorWheel, ColorWheelTrack } from "@rivetjs/cdk/color-wheel";
import { FieldError } from "@rivetjs/cdk/form";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { SliderOutput, SliderTrack } from "@rivetjs/cdk/slider";

const thumb = { width: "20px", height: "20px", borderRadius: "50%", border: "2px solid white", boxSizing: "border-box" };

export default function ColorStories() {
  const area = signal<string | Color>("rgb(0, 0, 0)");
  const hue = signal<string | Color>("hsl(0, 100%, 50%)");
  const wheel = signal<string | Color>("hsl(0, 100%, 50%)");
  const hex = signal<string | Color | null>("#ff0000");
  // Signals of a resumed page hold color strings (Color instances are not serializable).
  const picked = signal<string | Color>("#3366cc");
  const areaText = () => toColor(area())!.toString("rgb");
  const hueText = () => String(toColor(hue())!.getChannelValue("hue"));
  const wheelText = () => String(toColor(wheel())!.getChannelValue("hue"));
  const hexText = () => toColor(hex())?.toString("hex") ?? "";
  const pickedText = () => toColor(picked())!.toString("hex");
  return (
    <main>
      <h1>Color</h1>
      <section>
        <ColorArea id="area" value={area} xChannel="red" yChannel="green" style={{ width: "200px", height: "200px" }}>
          <ColorThumb style={thumb} />
        </ColorArea>
        <output id="area-value">{areaText()}</output>
      </section>
      <section>
        <ColorSlider id="hue" value={hue} channel="hue">
          <Label />
          <SliderOutput id="hue-output" />
          <SliderTrack id="hue-track" style={{ width: "200px", height: "24px" }}>
            <ColorThumb style={thumb} />
          </SliderTrack>
        </ColorSlider>
        <div id="hue-field">
          <ColorField value={hue} channel="hue" colorSpace="hsl">
            <Label>Hue field</Label>
            <Input />
          </ColorField>
        </div>
        <output id="hue-value">{hueText()}</output>
      </section>
      <section id="wheel">
        <ColorWheel value={wheel} outerRadius={100} innerRadius={74}>
          <ColorWheelTrack />
          <ColorThumb style={thumb} />
        </ColorWheel>
        <output id="wheel-value">{wheelText()}</output>
      </section>
      <section>
        <ColorField id="hex" value={hex}>
          <Label>Hex</Label>
          <Input id="hex-input" />
        </ColorField>
        <output id="hex-value">{hexText()}</output>
      </section>
      <section>
        {/* FieldErrorContext on a resumed page (G-PAR/K): the error renders after the first invalid commit. */}
        <ColorField
          id="brand"
          defaultValue="#336699"
          validationBehavior="aria"
          validate={(color) => (color?.toString("hex") === "#000000" ? "Pick a lighter color" : null)}
        >
          <Label>Brand</Label>
          <Input id="brand-input" />
          <FieldError />
        </ColorField>
      </section>
      <section>
        <ColorPicker value={picked}>
          <ColorSwatch id="picker-swatch" style={{ width: "32px", height: "32px" }} />
          <ColorSwatchPicker id="swatches">
            <ColorSwatchPickerItem color="#3366cc">
              <ColorSwatch style={{ width: "24px", height: "24px" }} />
            </ColorSwatchPickerItem>
            <ColorSwatchPickerItem color="#00ff00">
              <ColorSwatch style={{ width: "24px", height: "24px" }} />
            </ColorSwatchPickerItem>
            <ColorSwatchPickerItem color="hsl(0, 100%, 50%)">
              <ColorSwatch style={{ width: "24px", height: "24px" }} />
            </ColorSwatchPickerItem>
          </ColorSwatchPicker>
          <ColorField id="picker-field">
            <Label>Picker hex</Label>
            <Input id="picker-input" />
          </ColorField>
          <ColorSlider channel="hue" colorSpace="hsl">
            <Label />
            <SliderTrack id="picker-track" style={{ width: "200px", height: "24px" }}>
              <ColorThumb style={thumb} />
            </SliderTrack>
          </ColorSlider>
        </ColorPicker>
        <output id="picked-value">{pickedText()}</output>
      </section>
    </main>
  );
}
