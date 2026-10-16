// Type-level suite (`tsc -p libs/ui` only): `Popover` parts accept the cdk props (+ `class`), `Popover["…Props"]`, generic
// `Popover.Trigger<"span">`; Rivet fold: `title`, function children, `dialog={false}`; errors: unknown placement, `dialog` not a boolean.
import { signal } from "@rivetjs/reactivity";
import { Popover } from "../src/components/popover/index.ts";

const open = signal(false);

export const ok = () => (
  <Popover isOpen={open} onOpenChange={(o: boolean) => void o}>
    <Popover.Trigger aria-label="x">t</Popover.Trigger>
    <Popover.Content class="max-w-64" placement="top" offset={10} render={(props) => <div {...props} data-custom="foo" />}>
      <Popover.Dialog>
        <Popover.Arrow />
        <Popover.Heading>Title</Popover.Heading>
      </Popover.Dialog>
    </Popover.Content>
  </Popover>
);

export const generic = () => <Popover.Trigger<"span"> class="x">t</Popover.Trigger>;

const props: Popover["ContentProps"] = { children: "x", placement: "bottom start" };
void props;

// @ts-expect-error unknown placement
export const badPlacement = () => <Popover.Content placement="middle">x</Popover.Content>;

export const folded = () => (
  <Popover>
    <Popover.Trigger>t</Popover.Trigger>
    <Popover.Content title="Title">{({ close }) => <button onClick={close}>x</button>}</Popover.Content>
  </Popover>
);
export const titleOnly = () => <Popover.Content title={<b>T</b>} />;
export const own = () => (
  <Popover.Content dialog={false}>
    <Popover.Dialog class="p-2">x</Popover.Dialog>
  </Popover.Content>
);

// @ts-expect-error dialog is a boolean
export const badDialog = () => <Popover.Content dialog="yes">x</Popover.Content>;
