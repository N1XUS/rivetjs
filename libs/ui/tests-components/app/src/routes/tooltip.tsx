// Tooltip on a resumed page (upstream tooltip tests): `#tt-hover` delay 0 → "Hover tip"; `#tt-close` closeDelay 300;
// `#tt-disabled` isDisabled; `#tt-arrow` showArrow + Arrow; `#tt-trigger` Tooltip.Trigger (div) → "Trigger tip"; `#tt-open`
// defaultOpen (upstream browser test: Escape dismisses).
import { Button } from "@rivetjs/ui/button";
import { Tooltip } from "@rivetjs/ui/tooltip";

export default function TooltipStories() {
  return (
    <section class="flex flex-wrap gap-8 p-16 pt-32">
      <Tooltip delay={0}>
        <Button id="tt-hover">Hover me</Button>
        <Tooltip.Content id="tt-hover-tip">Hover tip</Tooltip.Content>
      </Tooltip>
      <Tooltip delay={0} closeDelay={300}>
        <Button id="tt-close">Closable</Button>
        <Tooltip.Content id="tt-close-tip">Closable tip</Tooltip.Content>
      </Tooltip>
      <Tooltip delay={0} isDisabled>
        <Button id="tt-disabled">Disabled</Button>
        <Tooltip.Content id="tt-disabled-tip">Should not appear</Tooltip.Content>
      </Tooltip>
      <Tooltip delay={0}>
        <Button id="tt-arrow">Arrow</Button>
        <Tooltip.Content id="tt-arrow-tip" showArrow>
          <Tooltip.Arrow />
          Arrow tip
        </Tooltip.Content>
      </Tooltip>
      <Tooltip delay={0}>
        <Tooltip.Trigger id="tt-trigger" aria-label="Info">
          <span>i</span>
        </Tooltip.Trigger>
        <Tooltip.Content id="tt-trigger-tip">Trigger tip</Tooltip.Content>
      </Tooltip>
      <Tooltip defaultOpen delay={0}>
        <Button id="tt-open">Open</Button>
        <Tooltip.Content id="tt-open-tip">Open tip</Tooltip.Content>
      </Tooltip>
    </section>
  );
}
