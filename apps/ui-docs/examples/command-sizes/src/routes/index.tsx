// Rivet-authored Command demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { Command } from "@rivetjs/ui/command";
import { Search } from "lucide";

export const head = { title: "Command: Sizes" };

// #region demo
const SIZES = ["sm", "md", "lg"] as const;

function SizedPalette(props: { size: (typeof SIZES)[number] }) {
  const open = signal(false);
  return (
    <Command isOpen={open}>
      <Button id={`cmd-size-${props.size}`} variant="secondary">
        {props.size}
      </Button>
      <Command.Backdrop>
        <Command.Container size={props.size}>
          <Command.Dialog>
            <Command.InputGroup>
              <Command.InputGroup.Prefix>
                <Icon icon={Search} size={16} />
              </Command.InputGroup.Prefix>
              <Command.InputGroup.Input />
            </Command.InputGroup>
            <Command.List onAction={() => open.set(false)}>
              <Command.Item id="one">First command</Command.Item>
              <Command.Item id="two">Second command</Command.Item>
              <Command.Item id="three">Third command</Command.Item>
            </Command.List>
          </Command.Dialog>
        </Command.Container>
      </Command.Backdrop>
    </Command>
  );
}

export function Sizes() {
  return (
    <div id="cmd-sizes" class="flex gap-2">
      {SIZES.map((size) => (
        <SizedPalette size={size} />
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Sizes />
    </div>
  );
}
