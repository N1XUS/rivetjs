// Type-level suite (`tsc -p libs/ui` only): `ScrollArea` parts accept the cdk (Radix) props + `class`, `ScrollArea["…Props"]`,
// size / variant / shadow unions; errors: unknown size / variant / shadow / orientation.
import { ScrollArea } from "../src/components/scroll-area/index.ts";
import type { ScrollAreaProps, ScrollAreaShadow } from "../src/components/scroll-area/index.ts";

const rootProps: ScrollArea["Props"] = { size: "sm", variant: "always", shadow: "horizontal", shadowSize: 24, class: "h-40" };
const shadow: ScrollAreaShadow = true;
const props: ScrollAreaProps = rootProps;

export const ok = () => (
  <ScrollArea {...props} shadow={shadow} type="scroll" scrollHideDelay={300} dir="rtl" id="a">
    <ScrollArea.Viewport class="p-2" tabIndex={0} onScroll={() => {}}>
      <p>row</p>
    </ScrollArea.Viewport>
    <ScrollArea.Scrollbar orientation="vertical" forceMount class="x">
      <ScrollArea.Thumb class="y" />
    </ScrollArea.Scrollbar>
    <ScrollArea.Scrollbar orientation="horizontal" />
    <ScrollArea.Corner class="z" />
  </ScrollArea>
);

export const bad = () => (
  <>
    {/* @ts-expect-error unknown size */}
    <ScrollArea size="lg" />
    {/* @ts-expect-error unknown variant */}
    <ScrollArea variant="never" />
    {/* @ts-expect-error unknown shadow orientation */}
    <ScrollArea shadow="both" />
    {/* @ts-expect-error unknown scrollbar orientation */}
    <ScrollArea.Scrollbar orientation="diagonal" />
  </>
);
