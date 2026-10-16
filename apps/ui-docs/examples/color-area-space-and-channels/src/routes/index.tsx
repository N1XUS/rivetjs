// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-area/space-and-channels.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorArea } from "@rivetjs/ui/color-area";
import type { ColorSpace } from "@rivetjs/cdk/color";
import type { Key } from "@rivetjs/cdk/collections";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { parseColor } from "@rivetjs/cdk/color";
import { Select } from "@rivetjs/ui/select";
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Collection } from "@rivetjs/cdk/collections/components";

export const head = { title: "ColorArea: Color Space & Channels" };

// #region demo
type ColorChannel = "hue" | "saturation" | "brightness" | "lightness" | "red" | "green" | "blue";

interface ChannelOption {
  id: ColorChannel;
  name: string;
}

const colorSpaces: Array<{ id: ColorSpace; name: string }> = [
  { id: "rgb", name: "RGB" },
  { id: "hsl", name: "HSL" },
  { id: "hsb", name: "HSB" },
];

const channelsBySpace: Record<ColorSpace, ChannelOption[]> = {
  hsb: [
    { id: "hue", name: "Hue" },
    { id: "saturation", name: "Saturation" },
    { id: "brightness", name: "Brightness" },
  ],
  hsl: [
    { id: "hue", name: "Hue" },
    { id: "saturation", name: "Saturation" },
    { id: "lightness", name: "Lightness" },
  ],
  rgb: [
    { id: "red", name: "Red" },
    { id: "green", name: "Green" },
    { id: "blue", name: "Blue" },
  ],
};

export function ColorAreaSpaceAndChannels() {
  // Rivet: two-way signals (Select values, the color string); the axis options are live collections; the area reads its color
  // space and channels once, so a keyed Show re-creates it per color space / channel pair.
  const colorSpace = signal<Key | null>("hsb");
  const color = signal("hsb(219, 58%, 93%)");
  const xChannel = signal<Key | null>("saturation");
  const yChannel = signal<Key | null>("brightness");

  const handleColorSpaceChange = (newSpace: Key | null) => {
    if (!newSpace) return;
    const space = newSpace as ColorSpace;

    // Reset channels to appropriate defaults for the new color space
    if (space === "rgb") {
      xChannel.set("blue");
      yChannel.set("green");
    } else if (space === "hsl") {
      xChannel.set("saturation");
      yChannel.set("lightness");
    } else {
      xChannel.set("saturation");
      yChannel.set("brightness");
    }
  };

  const channels = () => channelsBySpace[colorSpace() as ColorSpace];
  // Filter out the other channel from options (can't have same channel on both axes)
  const xChannelOptions = () => channels().filter((c) => c.id !== yChannel());
  const yChannelOptions = () => channels().filter((c) => c.id !== xChannel());

  return (
    <div class="flex flex-col items-center gap-6">
      {/* Controls */}
      <div class="flex gap-4">
        {/* Color Space Select */}
        <Select class="w-32" value={colorSpace} onChange={handleColorSpaceChange}>
          <Label>Color Space</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {colorSpaces.map((space) => (
                <ListBox.Item id={space.id} textValue={space.name}>
                  {space.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        {/* X Channel Select */}
        <Select class="w-36" value={xChannel}>
          <Label>X Axis</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <Collection items={xChannelOptions}>
                {(channel: ChannelOption) => (
                  <ListBox.Item id={channel.id} textValue={channel.name}>
                    {channel.name}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                )}
              </Collection>
            </ListBox>
          </Select.Popover>
        </Select>

        {/* Y Channel Select */}
        <Select class="w-36" value={yChannel}>
          <Label>Y Axis</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <Collection items={yChannelOptions}>
                {(channel: ChannelOption) => (
                  <ListBox.Item id={channel.id} textValue={channel.name}>
                    {channel.name}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                )}
              </Collection>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>
      {/* Color Area */}
      <Show keyed when={`${String(colorSpace())}|${String(xChannel())}|${String(yChannel())}`}>
        {() => (
          <ColorArea colorSpace={colorSpace() as ColorSpace} value={color} xChannel={xChannel() as ColorChannel} yChannel={yChannel() as ColorChannel}>
            <ColorArea.Thumb />
          </ColorArea>
        )}
      </Show>

      {/* Color Value Display */}
      <div class="flex items-center gap-3">
        <div class="size-8 rounded-md border border-default" style={{ backgroundColor: parseColor(color()).toString("css") }} />
        <code class="rounded bg-default/50 px-2 py-1 text-sm">{parseColor(color()).toString(colorSpace() as ColorSpace)}</code>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ColorAreaSpaceAndChannels />
    </div>
  );
}
