// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/toggle-button-group/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import type { Key } from "@rivetjs/cdk/collections";
import { Icon } from "@rivetjs/kit/icon";
import { Bold, Italic, Strikethrough, Underline } from "lucide";
import { ToggleButton } from "@rivetjs/ui/toggle-button";
import { ToggleButtonGroup } from "@rivetjs/ui/toggle-button-group";

export const head = { title: "ToggleButtonGroup: Controlled" };

// #region demo
// Rivet: `selectedKeys` takes a signal (two-way), in place of React's `selectedKeys` + `onSelectionChange` pair.
export function Controlled() {
  const selectedKeys = signal<Iterable<Key>>(new Set<Key>(["bold"]));

  return (
    <div class="flex flex-col gap-4">
      <ToggleButtonGroup selectedKeys={selectedKeys} selectionMode="multiple">
        <ToggleButton isIconOnly aria-label="Bold" id="bold">
          <Icon icon={Bold} size={16} />
        </ToggleButton>
        <ToggleButton isIconOnly aria-label="Italic" id="italic">
          <ToggleButtonGroup.Separator />
          <Icon icon={Italic} size={16} />
        </ToggleButton>
        <ToggleButton isIconOnly aria-label="Underline" id="underline">
          <ToggleButtonGroup.Separator />
          <Icon icon={Underline} size={16} />
        </ToggleButton>
        <ToggleButton isIconOnly aria-label="Strikethrough" id="strikethrough">
          <ToggleButtonGroup.Separator />
          <Icon icon={Strikethrough} size={16} />
        </ToggleButton>
      </ToggleButtonGroup>
      <p class="text-sm text-muted">
        Selected: <span class="font-medium">{[...selectedKeys()].length > 0 ? [...selectedKeys()].join(", ") : "None"}</span>
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}
