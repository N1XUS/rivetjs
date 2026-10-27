// Rivet-authored Command demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { Command } from "@rivetjs/ui/command";
import { Search } from "lucide";

export const head = { title: "Command: Backdrop Variants" };

// #region demo
const VARIANTS = ["opaque", "blur", "transparent"] as const;

function VariantPalette(props: { variant: (typeof VARIANTS)[number] }) {
  const open = signal(false);
  return (
    <Command isOpen={open}>
      <Button id={`cmd-backdrop-${props.variant}`} variant="secondary">
        {props.variant}
      </Button>
      <Command.Backdrop variant={props.variant}>
        <Command.Container>
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
            </Command.List>
          </Command.Dialog>
        </Command.Container>
      </Command.Backdrop>
    </Command>
  );
}

export function BackdropVariants() {
  return (
    <div id="cmd-backdrops" class="flex gap-2">
      {VARIANTS.map((variant) => (
        <VariantPalette variant={variant} />
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <BackdropVariants />
    </div>
  );
}
