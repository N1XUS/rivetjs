// Type-level suite (`tsc -p libs/ui` only): `Compare` props (value forms, orientation, dragAnywhere, animation, events),
// parts, `Compare["…Props"]`; errors: unknown orientation, label placement.
import { signal } from "@rivetjs/reactivity";

import { Compare } from "../src/components/compare/index.ts";

export const ok = () => {
  const value = signal(40);
  return (
    <Compare
      value={value}
      onChange={(v: number) => void v}
      onChangeEnd={(v: number) => void v}
      orientation="vertical"
      dragAnywhere
      animation={{ duration: 12 }}
      class="c"
      id="x"
    >
      <Compare.Before class="b">a</Compare.Before>
      <Compare.After>
        b<Compare.Label placement="end">After</Compare.Label>
      </Compare.After>
      <Compare.Handle aria-label="Split" aria-valuetext={(v: number) => `${v} percent`}>
        <Compare.Divider />
        <Compare.Thumb class="t">x</Compare.Thumb>
      </Compare.Handle>
    </Compare>
  );
};

export const flags = () => <Compare defaultValue={10} isDisabled animation={false} step={5} pageStep={20} />;

export const props: Compare["Props"] = { orientation: "horizontal" };

// @ts-expect-error unknown orientation
export const badOrientation = () => <Compare orientation="diagonal" />;

// @ts-expect-error unknown placement
export const badPlacement = () => <Compare.Label placement="middle" />;
