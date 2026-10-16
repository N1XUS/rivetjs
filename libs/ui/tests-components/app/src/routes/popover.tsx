// Popover on a resumed page (upstream popover fixture + browser test): `#po-trigger` Button opens `#po-dialog` (heading + inside
// action `#po-inside`); `#po-top` placement top + Arrow; `#po-ptrigger` `Popover.Trigger` (div role=button) opens the `po-ptitle` dialog;
// `#po-ctrl` controlled `isOpen` signal toggled by native `#po-ext`, state in `#po-state`. The first two use the explicit parts
// (`dialog={false}` + `Popover.Dialog`), the last two the folded Content (dialog found by its heading `[data-testid=po-ptitle]` / `po-ctitle`).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Popover } from "@rivetjs/ui/popover";

export default function PopoverStories() {
  const open = signal(false);
  return (
    <section class="flex flex-wrap gap-8 p-10">
      <Popover>
        <Button id="po-trigger">Open popover</Button>
        <Popover.Content class="max-w-64" dialog={false}>
          <Popover.Dialog id="po-dialog">
            <Popover.Heading>Popover heading</Popover.Heading>
            <p>This is the popover content</p>
            <Button id="po-inside">Inside action</Button>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>

      <Popover>
        <Button id="po-top" variant="tertiary" class="mt-48">
          Top
        </Button>
        <Popover.Content placement="top" dialog={false}>
          <Popover.Dialog id="po-top-dialog">
            <Popover.Arrow />
            <p class="text-sm">Top placement</p>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>

      <Popover>
        <Popover.Trigger id="po-ptrigger" aria-label="User profile">
          <span>Sarah Johnson</span>
        </Popover.Trigger>
        <Popover.Content>
          <Popover.Heading data-testid="po-ptitle">Profile</Popover.Heading>
        </Popover.Content>
      </Popover>

      <Popover isOpen={open}>
        <Button id="po-ctrl">Controlled</Button>
        <Popover.Content>
          <Popover.Heading data-testid="po-ctitle">Controlled</Popover.Heading>
        </Popover.Content>
      </Popover>
      <button id="po-ext" type="button" onClick={() => open.set(!open())}>
        external
      </button>
      <output id="po-state">{open() ? "open" : "closed"}</output>
    </section>
  );
}
