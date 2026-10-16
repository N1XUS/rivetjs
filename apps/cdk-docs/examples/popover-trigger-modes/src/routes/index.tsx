import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Popover } from "@rivetjs/cdk/popover";

export const head = { title: "Popover trigger modes" };

// #region demo
export default function TriggerModes() {
  return (
    <section class="m-4 flex gap-3 text-sm">
      {/* hover: mouse / pen hover after `delay` or keyboard focus opens; a safe area bridges trigger and popover. */}
      <DialogTrigger trigger="hover" delay={200} closeDelay={300}>
        <Button id="hover-trigger">Hover me</Button>
        <Popover placement="bottom start">
          <Dialog id="hover-card" class="outline-none">
            <Heading slot="title" class="m-0 text-sm font-semibold">
              Profile
            </Heading>
            <p>Opened by hover or keyboard focus.</p>
          </Dialog>
        </Popover>
      </DialogTrigger>
      {/* focus: keyboard focus opens (a press still toggles). */}
      <DialogTrigger trigger="focus">
        <Button id="focus-trigger">Focus me</Button>
        <Popover placement="bottom start">
          <Dialog id="focus-card" class="outline-none">
            <Heading slot="title" class="m-0 text-sm font-semibold">
              Shortcuts
            </Heading>
            <p>Opened by keyboard focus.</p>
          </Dialog>
        </Popover>
      </DialogTrigger>
      {/* longPress: a long press opens; Enter / Space and screen reader presses still toggle. */}
      <DialogTrigger trigger="longPress" longPressAccessibilityDescription="Long press to see versions">
        <Button id="long-trigger">Save</Button>
        <Popover placement="bottom start">
          <Dialog id="long-card" aria-label="Versions">
            <p>Earlier versions.</p>
          </Dialog>
        </Popover>
      </DialogTrigger>
    </section>
  );
}
// #endregion
