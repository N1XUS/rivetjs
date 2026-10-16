// Type-level suite (`tsc -p libs/ui` only): `Segment` props (size / variant unions, `selectedKey` key / null / Signal,
// `onSelectionChange(key)`), Item `id` required + render-prop children, Separator span props; errors: bad size / variant, Item
// without `id`, `selectedKeys` (multiple-selection API) on the root.
import { signal } from "@rivetjs/reactivity";
import type { Key } from "@rivetjs/cdk/collections/types";
import { Segment } from "../src/components/segment/index.ts";
import type { SegmentProps } from "../src/components/segment/index.ts";

const props: Segment["Props"] = { size: "sm", variant: "ghost", defaultSelectedKey: "a", isDisabled: false };
const rootProps: SegmentProps = props;
const key = signal<Key | null>("a");

export const ok = () => (
  <>
    <Segment {...rootProps} aria-label="View" onSelectionChange={(k: Key) => void k}>
      <Segment.Item id="a" class="x">
        A
      </Segment.Item>
      <Segment.Separator class="y" />
      <Segment.Item id={2} isDisabled>
        {({ isSelected }) => (isSelected() ? "on" : "off")}
      </Segment.Item>
    </Segment>
    <Segment selectedKey={key} aria-label="Two-way" allowsEmptySelection>
      <Segment.Item id="a">A</Segment.Item>
    </Segment>
    <Segment selectedKey={null} aria-label="None">
      <Segment.Item id="a">A</Segment.Item>
    </Segment>
  </>
);

// @ts-expect-error unknown size
export const badSize = () => <Segment size="xl" />;
// @ts-expect-error unknown variant
export const badVariant = () => <Segment variant="primary" />;
// @ts-expect-error Item needs an id
export const noId = () => <Segment.Item>A</Segment.Item>;
// @ts-expect-error multiple-selection API is not part of Segment
export const badKeys = () => <Segment selectedKeys={["a"]} />;
