// Production fixed-trigger consumer: document scroll must dismiss the absolute nonmodal overlay.
import { Popover } from "@rivetjs/ui/popover";

export default function FixedPopoverStory() {
  return (
    <main style={{ width: "2400px", height: "2400px" }}>
      <Popover>
        <Popover.Trigger id="fixed-trigger" style={{ position: "fixed", left: "120px", top: "120px" }}>
          Open fixed popover
        </Popover.Trigger>
        <Popover.Content isNonModal dialog={false}>
          <Popover.Dialog id="fixed-dialog">
            <Popover.Heading>Fixed trigger</Popover.Heading>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </main>
  );
}
